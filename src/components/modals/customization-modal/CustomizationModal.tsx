"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  X,
  Check,
  Copy,
  RotateCcw,
  ExternalLink,
  Menu,
} from "lucide-react";
import { useConfig, SiteConfigState } from "@/context/ConfigContext";
import { ColorPicker } from "@/components/modals/customization-modal/ColorPicker";
import { normalizeHex, applyAccentColorToDom } from "@/lib/color-utils";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import {
  areSiteConfigsEqual,
  DEFAULT_SITE_CONFIG,
  generateConfigTsCode,
} from "@/lib/config-utils";

export type CustomizationModalProps = Record<string, never>;

export const CustomizationModal: React.FC<CustomizationModalProps> = () => {
  const {
    config,
    deployedConfig,
    markAsDeployed,
    updateConfig,
    resetLocalCustomizations,
    isDbConfigured,
    isModalOpen,
    closeModal,
    isAuthenticated,
    isAdminSpotifyModalOpen,
  } = useConfig();

  // Local draft state while modal is open
  const [draft, setDraft] = useState<SiteConfigState>(config);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Lock document body scroll while modal is open
  useBodyScrollLock(isModalOpen);

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
        setDraft(config);
      }, 200);
    }

    return () => {
      clearTimeout(timer);
    };
  }, [isModalOpen, config]);

  // Sync draft state whenever modal is opened
  const prevIsOpenRef = useRef(isModalOpen);
  useEffect(() => {
    if (isModalOpen && !prevIsOpenRef.current) {
      setDraft(config);
      setCopiedCode(false);
    }
    prevIsOpenRef.current = isModalOpen;
  }, [isModalOpen, config]);

  // Close modal without applying uncommitted changes
  const handleCancel = useCallback(() => {
    applyAccentColorToDom(config.accentColor);
    closeModal();
  }, [closeModal, config]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isModalOpen || isAdminSpotifyModalOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, isAdminSpotifyModalOpen, handleCancel]);

  // Color picker change handler: updates draft state only (static preview within modal)
  const handleColorChange = (hex: string) => {
    const normalized = normalizeHex(hex);
    setDraft((prev) => ({ ...prev, accentColor: normalized }));
  };

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Check if draft differs from current local active config
  const hasLocalEdits = useMemo(() => {
    return !areSiteConfigsEqual(draft, config);
  }, [draft, config]);

  // Check if draft matches what is currently deployed in the database / server
  const isDeployedToDb = useMemo(() => {
    return areSiteConfigsEqual(draft, deployedConfig);
  }, [draft, deployedConfig]);

  // Can the user save or deploy?
  const canSave = useMemo(() => {
    if (saveError) return true;
    if (isAuthenticated) {
      return !isDeployedToDb || hasLocalEdits;
    }
    return hasLocalEdits;
  }, [saveError, isAuthenticated, isDeployedToDb, hasLocalEdits]);

  // Clear save error when new valid changes occur
  useEffect(() => {
    setSaveError(null);
  }, [draft]);

  // Save and apply changes to site (persists to Neon DB if authenticated, or local fallback)
  const handleSave = async () => {
    // For unauthenticated visitors: save accent color locally to DOM & localStorage and close modal
    if (!isAuthenticated) {
      applyAccentColorToDom(draft.accentColor);
      updateConfig({ accentColor: draft.accentColor });
      closeModal();
      return;
    }

    if (!canSave || isSaving) return;

    setSaveError(null);

    const isFactory = areSiteConfigsEqual(draft, DEFAULT_SITE_CONFIG);

    setIsSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isFactory ? { ...DEFAULT_SITE_CONFIG, resetToDefault: true } : draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setSaveError(data.error || "Save failed");
      } else {
        const saved = data.config || (isFactory ? DEFAULT_SITE_CONFIG : draft);
        updateConfig(saved);
        markAsDeployed(saved);
        applyAccentColorToDom(saved.accentColor);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error";
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset accent color to site owner's deployed color and clear local visitor override
  const handleResetColor = () => {
    const ownerColor = deployedConfig.accentColor;
    setDraft((prev) => ({ ...prev, accentColor: ownerColor }));
    applyAccentColorToDom(ownerColor);
    resetLocalCustomizations();
  };

  // Reset draft form to factory defaults for admin (does not apply to site until Save is clicked)
  const handleReset = () => {
    setDraft({ ...DEFAULT_SITE_CONFIG });
    setSaveError(null);
  };

  // Copy code snippet for src/config.ts
  const handleCopyCode = async () => {
    const snippet = generateConfigTsCode(draft);
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
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#080808]/85 backdrop-blur-sm transition-opacity duration-200 ease-out ${isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div
        className={`w-full max-w-[620px] max-h-[92vh] bg-[#0E0E0D] border border-[#26261F] text-[#EDEDE8] shadow-2xl flex flex-col overflow-hidden font-sans transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] transform will-change-[transform,opacity] ${isVisible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-[0.97] translate-y-2"
          }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#26261F] bg-[#121211] select-none">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Menu className="w-3.5 h-3.5 text-music-accent" />
            <h2
              id="customization-modal-title"
              className="font-mono text-[12px] tracking-[0.16em] text-[#EDEDE8] uppercase whitespace-nowrap"
            >
              {isAuthenticated ? "ACTIVE CONFIGURATION" : "APPEARANCE"}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleCancel}
              title="Close (Esc)"
              className="text-[#6A6A64] hover:text-[#EDEDE8] p-1 cursor-pointer transition-colors focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-6 scrollbar-hidden">
          {/* Section 1: Identity */}
          {isAuthenticated && (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between border-b border-[#1F1F1C] pb-1.5">
                <span className="font-mono text-[10px] tracking-[0.16em] text-[#8A8A82] uppercase">
                  IDENTITY
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
                    DISPLAY NAME
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
          )}

          {/* Section 2: Accent Color (Photo-App Color Picker) */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between border-b border-[#1F1F1C] pb-1.5">
              <span className="font-mono text-[10px] tracking-[0.16em] text-[#8A8A82] uppercase">
                ACCENT COLOR
              </span>
            </div>

            <ColorPicker color={draft.accentColor} onChange={handleColorChange} />
          </div>

          {/* Section 4: External Links */}
          {isAuthenticated && (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between border-b border-[#1F1F1C] pb-1.5">
                <span className="font-mono text-[10px] tracking-[0.16em] text-[#8A8A82] uppercase">
                  LINKS
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

                <div className="space-y-1 mb-[-10]">
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
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-t border-[#26261F] bg-[#121211] select-none overflow-x-auto scrollbar-hidden">
          {!isAuthenticated ? (
            <>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleResetColor}
                  title="Reset color to factory default (#1DB954)"
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] px-2.5 py-1.5 border border-[#26261F] text-[#8A8A82] hover:text-[#EDEDE8] hover:border-[#3A3A32] bg-transparent cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Color</span>
                </button>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={handleSave}
                  className="font-mono text-[11px] tracking-[0.08em] px-3.5 py-1.5 border border-music-accent bg-music-accent/10 text-music-accent hover:bg-music-accent/20 cursor-pointer shadow-[0_0_10px_rgba(var(--color-music-accent),0.15)] transition-colors font-medium inline-flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
                >
                  <span>Save Locally</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleReset}
                  title="Revert all settings to defaults from src/config.ts"
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] px-2 sm:px-2.5 py-1.5 border border-[#26261F] text-[#8A8A82] hover:text-[#EDEDE8] hover:border-[#3A3A32] bg-transparent cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="sm:hidden">Reset</span>
                  <span className="hidden sm:inline">Reset Defaults</span>
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
                      <span className="text-music-accent">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span className="sm:hidden">Copy</span>
                      <span className="hidden sm:inline">Copy config.ts</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !canSave}
                  className={`font-mono text-[11px] tracking-[0.08em] px-3 sm:px-3.5 py-1.5 border transition-colors font-medium inline-flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${isSaving
                      ? "border-music-accent/50 bg-music-accent/10 text-music-accent cursor-wait"
                      : saveError
                        ? "border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer"
                        : canSave
                          ? "border-music-accent bg-music-accent/10 text-music-accent hover:bg-music-accent/20 cursor-pointer shadow-[0_0_10px_rgba(var(--color-music-accent),0.15)]"
                          : "border-music-accent/60 bg-music-accent/10 text-music-accent cursor-default select-none"
                    }`}
                >
                  {isSaving ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-music-accent animate-pulse" />
                      <span>Deploying...</span>
                    </>
                  ) : saveError ? (
                    <span>Save failed · Retry</span>
                  ) : canSave ? (
                    <span>
                      {hasLocalEdits
                        ? isDbConfigured
                          ? "Save & Deploy"
                          : "Save to config.ts"
                        : isDbConfigured
                          ? "Deploy"
                          : "Save to config.ts"}
                    </span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 text-music-accent" />
                      <span>
                        {isDbConfigured
                          ? "Deployed"
                          : "Saved to config.ts"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
