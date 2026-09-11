"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { X, Check, Copy, RotateCcw, Clock, ExternalLink, Search, ChevronDown } from "lucide-react";
import { useConfig, SiteConfigState } from "@/context/ConfigContext";
import { ColorPicker } from "@/components/ColorPicker";
import { normalizeHex, applyAccentColorToDom } from "@/lib/color-utils";
import { siteConfig as originalConfig } from "@/config";

// Major timezones fallback if Intl.supportedValuesOf is unavailable
const POPULAR_TIMEZONES = [
  "America/Chicago",
  "America/New_York",
  "America/Los_Angeles",
  "America/Denver",
  "America/Phoenix",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Stockholm",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Seoul",
  "Asia/Taipei",
  "Asia/Bangkok",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "Pacific/Honolulu",
  "UTC",
];

export const CustomizationModal: React.FC = () => {
  const {
    config,
    updateConfig,
    resetToDefaults,
    isDbConfigured,
    isModalOpen,
    closeModal,
  } = useConfig();

  // Local draft state while modal is open
  const [draft, setDraft] = useState<SiteConfigState>(config);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [tzSearch, setTzSearch] = useState<string>("");
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");
  const [isTzOpen, setIsTzOpen] = useState<boolean>(false);
  const tzContainerRef = useRef<HTMLDivElement>(null);

  // Animation transition state for smooth open and close
  const [shouldRender, setShouldRender] = useState<boolean>(isModalOpen);
  const [isVisible, setIsVisible] = useState<boolean>(isModalOpen);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isModalOpen) {
      setShouldRender(true);
      setIsVisible(true);
    } else {
      setIsVisible(false);
      timer = setTimeout(() => {
        setShouldRender(false);
      }, 200);
    }

    return () => {
      clearTimeout(timer);
    };
  }, [isModalOpen]);

  // Sync draft state whenever modal is opened
  const prevIsOpenRef = useRef(isModalOpen);
  useEffect(() => {
    if (isModalOpen && !prevIsOpenRef.current) {
      setDraft(config);
      setCopiedCode(false);
      setTzSearch("");
      setIsTzOpen(false);
    }
    prevIsOpenRef.current = isModalOpen;
  }, [isModalOpen, config]);

  // Click-outside listener to collapse timezone dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tzContainerRef.current && !tzContainerRef.current.contains(e.target as Node)) {
        setIsTzOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute live time in the selected timezone
  const updateCurrentTime = useCallback((tz: string) => {
    try {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZoneName: "short",
      }).format(now);
      setCurrentTimeStr(formatted);
    } catch {
      setCurrentTimeStr("--:--:--");
    }
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;
    updateCurrentTime(draft.timezone);
    const interval = setInterval(() => {
      updateCurrentTime(draft.timezone);
    }, 1000);
    return () => clearInterval(interval);
  }, [isModalOpen, draft.timezone, updateCurrentTime]);

  // Comprehensive list of available IANA timezones
  const allTimezones = useMemo(() => {
    try {
      if (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function") {
        const supported = Intl.supportedValuesOf("timeZone");
        return Array.from(new Set([...POPULAR_TIMEZONES, ...supported]));
      }
    } catch (e) {
      console.warn("[TIMEZONE] Intl.supportedValuesOf error:", e);
    }
    return POPULAR_TIMEZONES;
  }, []);

  // Filtered timezone list for search
  const filteredTimezones = useMemo(() => {
    if (!tzSearch.trim()) return allTimezones;
    const q = tzSearch.toLowerCase();
    return allTimezones.filter((tz) => tz.toLowerCase().includes(q));
  }, [allTimezones, tzSearch]);

  // Close modal without applying uncommitted changes
  const handleCancel = useCallback(() => {
    applyAccentColorToDom(config.accentColor);
    setDraft(config);
    closeModal();
  }, [closeModal, config]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isModalOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, handleCancel]);

  // Color picker change handler: updates draft state only (static preview within modal)
  const handleColorChange = (hex: string) => {
    const normalized = normalizeHex(hex);
    setDraft((prev) => ({ ...prev, accentColor: normalized }));
  };

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasUnsavedChanges = useMemo(() => {
    return (
      draft.title !== config.title ||
      draft.ownerName !== config.ownerName ||
      normalizeHex(draft.accentColor) !== normalizeHex(config.accentColor) ||
      draft.siteUrl !== config.siteUrl ||
      draft.githubUrl !== config.githubUrl ||
      draft.timezone !== (config.timezone || "America/Chicago")
    );
  }, [draft, config]);

  // Clear save error when new unsaved edits occur
  useEffect(() => {
    if (hasUnsavedChanges) {
      setSaveError(null);
    }
  }, [hasUnsavedChanges]);

  // Save and apply changes to site (persists to Neon DB if connected, or local fallback)
  const handleSave = async () => {
    if (!hasUnsavedChanges && !isSaving) return;

    setSaveError(null);

    // 1. Immediately apply draft accent color to DOM so all site elements repaint in 0ms!
    applyAccentColorToDom(draft.accentColor);

    const isFactory =
      draft.title === originalConfig.title &&
      draft.ownerName === originalConfig.ownerName &&
      normalizeHex(draft.accentColor) === normalizeHex(originalConfig.accentColor) &&
      draft.siteUrl === originalConfig.siteUrl &&
      draft.githubUrl === originalConfig.githubUrl &&
      draft.timezone === (originalConfig.timezone || "America/Chicago");

    // 2. Immediately update client config context so title, owner, timezone repaint in 0ms
    if (isFactory) {
      resetToDefaults();
    } else {
      updateConfig(draft);
    }

    // 3. Persist to Neon DB in the background
    setIsSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isFactory ? { ...originalConfig, resetToDefault: true } : draft),
      });
      const data = await res.json();
      if (!data.success) {
        setSaveError(data.error || "Save failed");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error";
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset draft form to original defaults (does not apply to site until Save & Apply is clicked)
  const handleReset = () => {
    const defaultDraft: SiteConfigState = {
      title: originalConfig.title,
      ownerName: originalConfig.ownerName,
      accentColor: normalizeHex(originalConfig.accentColor),
      siteUrl: originalConfig.siteUrl,
      githubUrl: originalConfig.githubUrl,
      timezone: originalConfig.timezone || "America/Chicago",
    };
    setDraft(defaultDraft);
    setSaveError(null);
  };

  // Copy code snippet for src/config.ts
  const handleCopyCode = async () => {
    const snippet = `export const siteConfig = {
  title: ${JSON.stringify(draft.title)},
  ownerName: ${JSON.stringify(draft.ownerName)},
  accentColor: ${JSON.stringify(draft.accentColor)},
  siteUrl: ${JSON.stringify(draft.siteUrl)},
  githubUrl: ${JSON.stringify(draft.githubUrl)},
  timezone: ${JSON.stringify(draft.timezone)},
};
`;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      console.warn("[CLIPBOARD] Failed to copy:", e);
    }
  };

  if (!shouldRender) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="customization-modal-title"
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#080808]/85 backdrop-blur-sm transition-opacity duration-200 ease-out ${
        isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div
        className={`w-full max-w-[620px] max-h-[92vh] bg-[#0E0E0D] border border-[#26261F] text-[#EDEDE8] shadow-2xl flex flex-col overflow-hidden font-sans transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] transform will-change-[transform,opacity] ${
          isVisible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-[0.97] translate-y-2"
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#26261F] bg-[#121211] select-none">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-music-accent inline-block" />
            <h2
              id="customization-modal-title"
              className="font-mono text-[12px] tracking-[0.16em] text-[#EDEDE8] uppercase"
            >
              [ ACTIVE CONFIGURATION ]
            </h2>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            title="Close (Esc)"
            className="text-[#6A6A64] hover:text-[#EDEDE8] p-1 cursor-pointer transition-colors focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-6 scrollbar-hidden">
          {/* Section 1: Identity */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between border-b border-[#1F1F1C] pb-1.5">
              <span className="font-mono text-[10px] tracking-[0.16em] text-[#8A8A82] uppercase">
                [ 01 · IDENTITY ]
              </span>
              <span className="font-mono text-[9px] text-[#6A6A64]">
                DEFAULT: src/config.ts
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block font-mono text-[10px] tracking-[0.1em] text-[#6A6A64] uppercase">
                  SITE TITLE
                </label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Listening Index"
                  className="w-full bg-[#141413] border border-[#26261F] text-[#EDEDE8] font-sans text-[13px] px-3 py-1.5 focus:border-music-accent focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-mono text-[10px] tracking-[0.1em] text-[#6A6A64] uppercase">
                  DISPLAY NAME (HEADER)
                </label>
                <input
                  type="text"
                  value={draft.ownerName}
                  onChange={(e) => setDraft({ ...draft, ownerName: e.target.value })}
                  placeholder="YOUR NAME"
                  className="w-full bg-[#141413] border border-[#26261F] text-[#EDEDE8] font-sans text-[13px] px-3 py-1.5 focus:border-music-accent focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Accent Color (Photo-App Color Picker) */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between border-b border-[#1F1F1C] pb-1.5">
              <span className="font-mono text-[10px] tracking-[0.16em] text-[#8A8A82] uppercase">
                [ 02 · ACCENT COLOR ]
              </span>
            </div>

            <ColorPicker color={draft.accentColor} onChange={handleColorChange} />
          </div>

          {/* Section 3: Timezone */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between border-b border-[#1F1F1C] pb-1.5">
              <span className="font-mono text-[10px] tracking-[0.16em] text-[#8A8A82] uppercase">
                [ 03 · TIMEZONE ]
              </span>
              {currentTimeStr && (
                <span className="font-mono text-[10px] tracking-[0.08em] text-[#A0A09A] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-music-accent" />
                  <span>{currentTimeStr}</span>
                </span>
              )}
            </div>

            <div ref={tzContainerRef} className="relative space-y-2">
              <div className="flex items-center bg-[#141413] border border-[#26261F] focus-within:border-music-accent transition-colors">
                <Search className="w-3.5 h-3.5 text-[#6A6A64] ml-3 flex-shrink-0" />
                <input
                  type="text"
                  value={tzSearch}
                  onChange={(e) => {
                    setTzSearch(e.target.value);
                    setIsTzOpen(true);
                  }}
                  onFocus={() => setIsTzOpen(true)}
                  placeholder="Search timezones (e.g. Chicago, London, Tokyo, UTC)..."
                  className="w-full bg-transparent border-0 text-[#EDEDE8] font-mono text-[12px] px-2.5 py-2 focus:outline-none"
                />
                {tzSearch ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTzSearch("");
                      setIsTzOpen(true);
                    }}
                    className="px-3 text-[#6A6A64] hover:text-[#EDEDE8] cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsTzOpen((prev) => !prev)}
                    className="px-3 text-[#6A6A64] hover:text-[#EDEDE8] cursor-pointer"
                    title={isTzOpen ? "Close list" : "Browse all timezones"}
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isTzOpen ? "rotate-180" : ""}`} />
                  </button>
                )}
              </div>

              {/* Collapsed dropdown menu - opens when search bar is focused or clicked */}
              {isTzOpen && (
                <div className="absolute z-30 left-0 right-0 top-[38px] max-h-52 overflow-y-auto bg-[#141413] border border-[#26261F] shadow-2xl divide-y divide-[#1C1C1A] scrollbar-hidden">
                  {filteredTimezones.length === 0 ? (
                    <div className="p-3 font-mono text-[11px] text-[#6A6A64] text-center">
                      NO MATCHING TIMEZONES FOUND
                    </div>
                  ) : (
                    filteredTimezones.map((tz) => {
                      const isActive = draft.timezone === tz;
                      return (
                        <button
                          key={tz}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setDraft((prev) => ({ ...prev, timezone: tz }));
                            setIsTzOpen(false);
                            setTzSearch("");
                          }}
                          className={`w-full text-left font-mono text-[12px] px-3 py-2 flex items-center justify-between transition-colors cursor-pointer ${
                            isActive
                              ? "bg-[#1C1C19] text-music-accent font-medium"
                              : "text-[#EDEDE8] hover:bg-[#1A1A18] hover:text-white"
                          }`}
                        >
                          <span>{tz}</span>
                          {isActive && (
                            <span className="text-[10px] text-music-accent tracking-widest">[ACTIVE]</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {/* Active Timezone Indicator */}
              <div className="flex items-center justify-between pt-0.5 font-mono text-[10px] tracking-[0.08em]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#6A6A64]">ACTIVE:</span>
                  <span className="text-music-accent font-medium">{draft.timezone}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTzOpen((prev) => !prev)}
                  className="text-[#6A6A64] hover:text-[#EDEDE8] underline text-[9px] cursor-pointer"
                >
                  {isTzOpen ? "COLLAPSE LIST" : "BROWSE ALL"}
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: External Links */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between border-b border-[#1F1F1C] pb-1.5">
              <span className="font-mono text-[10px] tracking-[0.16em] text-[#8A8A82] uppercase">
                [ 04 · LINKS ]
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="space-y-1">
                <label className="block font-mono text-[10px] tracking-[0.1em] text-[#6A6A64] uppercase">
                  SPOTIFY OR PROFILE URL
                </label>
                <div className="flex items-center bg-[#141413] border border-[#26261F] px-2.5 py-1.5 focus-within:border-music-accent">
                  <input
                    type="text"
                    value={draft.siteUrl}
                    onChange={(e) => setDraft({ ...draft, siteUrl: e.target.value })}
                    placeholder="https://open.spotify.com/..."
                    className="w-full bg-transparent border-0 text-[#EDEDE8] font-mono text-[12px] focus:outline-none"
                  />
                  <a
                    href={draft.siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#6A6A64] hover:text-music-accent ml-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-mono text-[10px] tracking-[0.1em] text-[#6A6A64] uppercase">
                  GITHUB REPOSITORY URL
                </label>
                <div className="flex items-center bg-[#141413] border border-[#26261F] px-2.5 py-1.5 focus-within:border-music-accent">
                  <input
                    type="text"
                    value={draft.githubUrl}
                    onChange={(e) => setDraft({ ...draft, githubUrl: e.target.value })}
                    placeholder="https://github.com/..."
                    className="w-full bg-transparent border-0 text-[#EDEDE8] font-mono text-[12px] focus:outline-none"
                  />
                  <a
                    href={draft.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#6A6A64] hover:text-music-accent ml-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-t border-[#26261F] bg-[#121211] select-none overflow-x-auto scrollbar-hidden">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleReset}
              title="Revert all settings to defaults from src/config.ts"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] px-2 sm:px-2.5 py-1.5 border border-[#26261F] text-[#8A8A82] hover:text-[#EDEDE8] hover:border-[#3A3A32] bg-transparent cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>RESET DEFAULTS</span>
            </button>

            <button
              type="button"
              onClick={handleCopyCode}
              title="Copy code snippet to paste into src/config.ts"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] px-2 sm:px-2.5 py-1.5 border border-[#26261F] text-[#8A8A82] hover:text-[#EDEDE8] hover:border-[#3A3A32] bg-transparent cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3 h-3 text-music-accent" />
                  <span className="text-music-accent">COPIED!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>COPY CONFIG.TS</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className={`font-mono text-[11px] tracking-[0.08em] px-3 sm:px-3.5 py-1.5 border transition-colors font-medium inline-flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                isSaving
                  ? "border-music-accent/50 bg-music-accent/10 text-music-accent cursor-wait"
                  : saveError
                  ? "border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer"
                  : hasUnsavedChanges
                  ? "border-music-accent bg-music-accent/10 text-music-accent hover:bg-music-accent/20 cursor-pointer shadow-[0_0_10px_rgba(var(--color-music-accent),0.15)]"
                  : "border-music-accent/60 bg-music-accent/10 text-music-accent cursor-default select-none"
              }`}
            >
              {isSaving ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-music-accent animate-pulse" />
                  <span>DEPLOYING...</span>
                </>
              ) : saveError ? (
                <span>SAVE FAILED · RETRY</span>
              ) : hasUnsavedChanges ? (
                <span>SAVE & APPLY</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 text-music-accent" />
                  <span>{isDbConfigured ? "DEPLOYED TO DATABASE" : "SAVED TO CONFIG.TS"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
