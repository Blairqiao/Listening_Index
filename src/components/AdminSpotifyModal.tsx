"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Music2,
} from "lucide-react";
import { useConfig } from "@/context/ConfigContext";
import {
  beginLoginPopup,
  getRedirectUri,
  resolveRedirectUriDisplay,
} from "@/lib/spotify-auth";
import { ScheduledSyncCard } from "./admin-spotify-modal/ScheduledSyncCard";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";

export interface SpotifyOwnerStatus {
  connected: boolean;
  source: "environment" | "database" | null;
  displayName: string | null;
  profileUrl?: string | null;
  connectedAt: string | null;
  daysRemaining: number | null;
  isExpiringSoon: boolean;
  redirectUri: string;
  canConnect: boolean;
}

export type AdminSpotifyModalMode = "onboarding" | "connected" | "expiring";

export interface AdminSpotifyModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialModeOverride?: AdminSpotifyModalMode;
  initialStatus?: Partial<SpotifyOwnerStatus>;
}

/**
 * Resolves the external Spotify profile URL for the connected owner.
 * Priority: explicit status profileUrl > open.spotify.com/user/<username> (if no spaces) > open.spotify.com
 */
export function resolveSpotifyProfileUrl(
  displayName?: string | null,
  profileUrl?: string | null
): string {
  if (profileUrl) return profileUrl;
  if (displayName && !displayName.includes(" ")) {
    return `https://open.spotify.com/user/${encodeURIComponent(displayName)}`;
  }
  return "https://open.spotify.com";
}

/**
 * Resolves which visual mode the modal should display.
 * Priority: explicit override > unconfigured/unconnected > expiring soon > connected.
 */
export function resolveAdminSpotifyMode(
  status: {
    connected: boolean;
    updatedAt?: string | null;
    connectedAt?: string | null;
    isExpiringSoon?: boolean;
    daysRemaining?: number | null;
  } | null,
  override?: AdminSpotifyModalMode
): AdminSpotifyModalMode {
  if (override) return override;
  if (!status || !status.connected) return "onboarding";

  // Check explicit expiration signals first before date string check
  if (
    status.isExpiringSoon ||
    (status.daysRemaining !== null && status.daysRemaining !== undefined && status.daysRemaining <= 14)
  ) {
    return "expiring";
  }

  const dateStr = status.connectedAt || status.updatedAt;
  if (dateStr) {
    const elapsedDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, 180 - elapsedDays);
    if (daysRemaining <= 14) return "expiring";
  }

  return "connected";
}

export const AdminSpotifyModal: React.FC<AdminSpotifyModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  initialModeOverride,
  initialStatus,
}) => {
  const config = useConfig();
  const effectiveIsOpen = propIsOpen !== undefined ? propIsOpen : config.isAdminSpotifyModalOpen;
  const effectiveOnClose = propOnClose || config.closeAdminSpotifyModal;

  // Lock document body scroll while Spotify modal is open
  useBodyScrollLock(effectiveIsOpen);

  const [status, setStatus] = useState<SpotifyOwnerStatus | null>(() => {
    if (initialStatus) {
      return {
        connected: false,
        source: null,
        displayName: null,
        connectedAt: null,
        daysRemaining: null,
        isExpiringSoon: false,
        redirectUri: initialStatus.redirectUri || getRedirectUri(),
        canConnect: true,
        ...initialStatus,
      };
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [copiedTarget, setCopiedTarget] = useState<"production" | "local" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [syncUrl, setSyncUrl] = useState<string>("");
  const [cronKey, setCronKey] = useState<string>("");
  const [copiedSyncUrl, setCopiedSyncUrl] = useState<boolean>(false);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState<boolean>(false);

  const [redirectUri, setRedirectUri] = useState<string>(() => {
    if (initialStatus?.redirectUri) return initialStatus.redirectUri;
    return getRedirectUri();
  });

  const redirectDisplay = useMemo(
    () => resolveRedirectUriDisplay(redirectUri),
    [redirectUri]
  );

  // Modal open/close animation states
  const [shouldRender, setShouldRender] = useState<boolean>(effectiveIsOpen);
  const [isVisible, setIsVisible] = useState<boolean>(effectiveIsOpen);

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/owner/spotify", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as SpotifyOwnerStatus;
        setStatus(data);
        if (data.redirectUri) {
          setRedirectUri(data.redirectUri);
        }
      }
    } catch (_err) {
      // Non-blocking status fetch error
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshSyncKey = useCallback(async () => {
    try {
      const res = await fetch("/api/owner/sync-key", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.syncUrl) setSyncUrl(data.syncUrl);
        if (data.cronKey) setCronKey(data.cronKey);
      }
    } catch (_err) {
      // Non-blocking sync key fetch
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const isAllowed = Boolean(initialModeOverride || config.isAuthenticated);
    if (effectiveIsOpen && isAllowed) {
      setShouldRender(true);
      setIsVisible(true);
      setError(null);
      setCopiedTarget(null);
      setCopiedSyncUrl(false);
      if (!redirectUri && typeof window !== "undefined") {
        setRedirectUri(getRedirectUri());
      }
      if (!initialStatus) {
        void refreshStatus();
      }
      void refreshSyncKey();
    } else {
      setIsVisible(false);
      timer = setTimeout(() => {
        setShouldRender(false);
        setError(null);
      }, 200);
    }
    return () => clearTimeout(timer);
  }, [
    effectiveIsOpen,
    config.isAuthenticated,
    initialModeOverride,
    initialStatus,
    redirectUri,
    refreshStatus,
    refreshSyncKey,
  ]);

  // Handle Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && effectiveIsOpen && !isBusy) {
        e.preventDefault();
        e.stopPropagation();
        effectiveOnClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [effectiveIsOpen, isBusy, effectiveOnClose]);

  const handleCopyUri = async (uri: string, target: "production" | "local") => {
    try {
      await navigator.clipboard.writeText(uri);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 2000);
    } catch {
      setError("Failed to copy redirect URI to clipboard.");
    }
  };

  const handleConnect = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const ok = await beginLoginPopup();
      if (ok === null) {
        setError("Popup was blocked by your browser. Please allow popups for this site.");
      } else if (ok) {
        await refreshStatus();
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("spotify-status-changed", { detail: { connected: true } })
          );
        }
      } else {
        setError("Spotify authorization was cancelled or closed.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/spotify", { method: "DELETE" });
      if (res.ok) {
        await refreshStatus();
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("spotify-status-changed", { detail: { connected: false } })
          );
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Disconnect failed.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Disconnect failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const hasValidSyncKey = Boolean(syncUrl || cronKey);
  const displaySyncUrl =
    syncUrl ||
    (cronKey && typeof window !== "undefined"
      ? `${window.location.origin}/api/sync?key=${cronKey}`
      : "");
  const placeholderSyncUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/sync?key=...`
      : "https://<your-app>.vercel.app/api/sync?key=...";

  const handleCopySyncUrl = async () => {
    if (!displaySyncUrl || !hasValidSyncKey || isRegeneratingKey) return;
    try {
      await navigator.clipboard.writeText(displaySyncUrl);
      setCopiedSyncUrl(true);
      setTimeout(() => setCopiedSyncUrl(false), 2000);
    } catch {
      setError("Failed to copy scheduled sync URL to clipboard.");
    }
  };

  const handleRegenerateSyncKey = async () => {
    setIsRegeneratingKey(true);
    setCopiedSyncUrl(false);
    setError(null);
    try {
      const res = await fetch("/api/owner/sync-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.syncUrl) setSyncUrl(data.syncUrl);
        if (data.cronKey) setCronKey(data.cronKey);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to regenerate sync key.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to regenerate sync key.");
    } finally {
      setIsRegeneratingKey(false);
    }
  };

  const currentMode = resolveAdminSpotifyMode(status, initialModeOverride);

  const displayName =
    status?.displayName || (initialModeOverride === "connected" ? "OWNER" : "SPOTIFY ACCOUNT");

  const profileUrl = useMemo(
    () => resolveSpotifyProfileUrl(status?.displayName, status?.profileUrl),
    [status?.displayName, status?.profileUrl]
  );

  const effectiveDaysRemaining = useMemo(() => {
    if (currentMode === "expiring") {
      if (
        status?.daysRemaining === undefined ||
        status?.daysRemaining === null ||
        status.daysRemaining > 14
      ) {
        return 6;
      }
      return status.daysRemaining;
    }
    if (status?.daysRemaining !== null && status?.daysRemaining !== undefined) {
      return status.daysRemaining;
    }
    return 175;
  }, [currentMode, status?.daysRemaining]);

  if (!shouldRender || (!initialModeOverride && !config.isAuthenticated)) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-spotify-modal-title"
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#080808]/85 backdrop-blur-sm transition-opacity duration-200 ease-out ${
        isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) effectiveOnClose();
      }}
    >
      <div
        className={`w-full max-w-[480px] bg-[#0E0E0D] border border-[#26261F] text-[#EDEDE8] shadow-2xl flex flex-col overflow-hidden font-sans transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] transform will-change-[transform,opacity] ${
          isVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-[0.97] translate-y-2"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#26261F] bg-[#121211] select-none">
          <div className="flex items-center gap-2">
            <Music2
              className={`w-3.5 h-3.5 ${
                currentMode === "onboarding"
                  ? "text-music-accent animate-slow-blink"
                  : currentMode === "expiring"
                  ? "text-amber-400 animate-slow-blink"
                  : "text-music-accent"
              }`}
            />
            <h2
              id="admin-spotify-modal-title"
              className="font-mono text-[12px] tracking-[0.16em] text-[#EDEDE8] uppercase whitespace-nowrap"
            >
              SPOTIFY ACCOUNT SETUP
            </h2>
          </div>
          <button
            type="button"
            onClick={effectiveOnClose}
            disabled={isBusy}
            title="Close (Esc)"
            className="text-[#6A6A64] hover:text-[#EDEDE8] p-1 cursor-pointer transition-colors focus:outline-none disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 text-left">
          {isLoading && !status && !initialModeOverride ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 font-mono text-[11px] text-[#6A6A64]">
              <Loader2 className="w-4 h-4 animate-spin text-music-accent" />
              <span>[ CHECKING CONNECTION STATUS... ]</span>
            </div>
          ) : (
            <>
              {/* MODE 1: Onboarding / Unconnected */}
              {currentMode === "onboarding" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="font-mono text-[10px] tracking-[0.1em] text-[#6A6A64] uppercase">
                      Step 1: Register redirect URI
                    </div>
                    <p className="font-mono text-[11px] leading-relaxed text-[#A6A69F]">
                      Add your production and local callback URIs to your App Settings in the{" "}
                      <a
                        href="https://developer.spotify.com/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-music-accent underline underline-offset-2 hover:opacity-80 inline-flex items-center gap-1"
                      >
                        Spotify Developer Dashboard
                        <ExternalLink className="w-3 h-3 inline" />
                      </a>{" "}
                      before connecting.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.1em] text-[#6A6A64] uppercase">
                        <span>PRODUCTION REDIRECT URI</span>
                        {redirectDisplay.activeEnvironment === "production" && (
                          <span className="text-music-accent">[ ACTIVE ]</span>
                        )}
                      </div>
                      <div className="flex items-center bg-[#141413] border border-[#26261F] focus-within:border-music-accent">
                        <code className="flex-1 font-mono text-[11px] text-music-accent px-3 py-2 overflow-x-auto whitespace-nowrap select-all scrollbar-hidden">
                          {redirectDisplay.productionUri}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopyUri(redirectDisplay.productionUri, "production")}
                          className="px-3 py-2 border-l border-[#26261F] font-mono text-[10px] tracking-[0.12em] text-[#EDEDE8] hover:text-music-accent hover:bg-[#1A1A18] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                          title="Copy Production Redirect URI"
                        >
                          {copiedTarget === "production" ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-bold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.1em] text-[#6A6A64] uppercase">
                        <span>LOCAL DEV REDIRECT URI (LOOPBACK)</span>
                        {redirectDisplay.activeEnvironment === "local" && (
                          <span className="text-music-accent">[ ACTIVE ]</span>
                        )}
                      </div>
                      <div className="flex items-center bg-[#141413] border border-[#26261F] focus-within:border-music-accent">
                        <code className="flex-1 font-mono text-[11px] text-music-accent px-3 py-2 overflow-x-auto whitespace-nowrap select-all scrollbar-hidden">
                          {redirectDisplay.localUri}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopyUri(redirectDisplay.localUri, "local")}
                          className="px-3 py-2 border-l border-[#26261F] font-mono text-[10px] tracking-[0.12em] text-[#EDEDE8] hover:text-music-accent hover:bg-[#1A1A18] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                          title="Copy Local Redirect URI"
                        >
                          {copiedTarget === "local" ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-bold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <div className="font-mono text-[10px] tracking-[0.1em] text-[#6A6A64] uppercase">
                      STEP 2: CONNECT ACCOUNT
                    </div>
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={isBusy}
                      className="w-full py-2.5 px-4 bg-music-accent text-black font-mono text-[11px] font-bold tracking-[0.08em] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2 select-none"
                    >
                      {isBusy ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Authorizing Spotify...</span>
                        </>
                      ) : (
                        <span>Connect Spotify Account</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 2: Connected */}
              {currentMode === "connected" && (
                <div className="space-y-4">
                  {/* Unified Status Card */}
                  <div className="bg-[#141413] border border-[#26261F] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3 font-mono">
                      <span className="text-[10px] tracking-[0.12em] text-[#6A6A64] uppercase">
                        CONNECTED
                      </span>
                      <a
                        href={profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group/profile inline-flex items-center gap-1.5 text-[11px] tracking-[0.08em] text-[#EDEDE8] hover:text-music-accent font-semibold truncate transition-colors cursor-pointer"
                        title={`Open ${displayName}'s Spotify Profile`}
                      >
                        <span className="underline decoration-[#3A3A32] group-hover/profile:decoration-music-accent underline-offset-4 truncate">
                          {displayName}
                        </span>
                        <ExternalLink className="w-3 h-3 text-[#6A6A64] group-hover/profile:text-music-accent shrink-0 transition-colors" />
                      </a>
                    </div>

                    <div className="pt-2.5 border-t border-[#1F1F1A] flex items-center justify-between gap-3 font-mono">
                      <span className="text-[10px] tracking-[0.12em] text-[#6A6A64] uppercase">
                        TOKEN LIFECYCLE
                      </span>
                      <span className="text-[10px] sm:text-[11px] tracking-[0.08em] sm:tracking-[0.12em] text-[#EDEDE8] font-bold shrink-0 whitespace-nowrap">
                        {effectiveDaysRemaining} days remaining
                      </span>
                    </div>
                  </div>

                  {/* Database storage note */}
                  <div className="font-mono text-[10px] text-[#6A6A64] leading-relaxed">
                    Stores your spotify token in your database.
                  </div>

                  {/* Actions */}
                  <div className="pt-1 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={isBusy}
                      className="flex-1 py-2 px-3 border border-music-accent text-music-accent hover:bg-music-accent/10 font-mono text-[11px] font-bold tracking-[0.08em] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isBusy ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Re-linking...</span>
                        </>
                      ) : (
                        <span>Refresh Token</span>
                      )}
                    </button>
                    {status?.source !== "environment" && (
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        disabled={isBusy}
                        className="py-2 px-3 border border-[#26261F] text-[#6A6A64] hover:text-[#EDEDE8] hover:border-[#3A3A32] font-mono text-[10px] tracking-[0.12em] transition-colors cursor-pointer disabled:opacity-50"
                        title="Disconnect Spotify account"
                      >
                        Disconnect
                      </button>
                    )}
                  </div>

                  {/* SCHEDULED SYNC (CRON) */}
                  <ScheduledSyncCard
                    displaySyncUrl={displaySyncUrl}
                    placeholderSyncUrl={placeholderSyncUrl}
                    hasValidSyncKey={hasValidSyncKey}
                    copiedSyncUrl={copiedSyncUrl}
                    isBusy={isBusy}
                    isRegeneratingKey={isRegeneratingKey}
                    onCopySyncUrl={handleCopySyncUrl}
                    onRegenerateSyncKey={handleRegenerateSyncKey}
                  />
                </div>
              )}

              {/* MODE 3: Expiring Soon */}
              {currentMode === "expiring" && (
                <div className="space-y-4">
                  {/* Unified Status Card */}
                  <div className="bg-[#141413] border border-amber-500/30 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3 font-mono">
                      <span className="text-[10px] tracking-[0.12em] text-[#6A6A64] uppercase">
                        CONNECTED
                      </span>
                      <a
                        href={profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group/profile inline-flex items-center gap-1.5 text-[11px] tracking-[0.08em] text-[#EDEDE8] hover:text-amber-400 font-semibold uppercase truncate transition-colors cursor-pointer"
                        title={`Open ${displayName}'s Spotify Profile`}
                      >
                        <span className="underline decoration-[#3A3A32] group-hover/profile:decoration-amber-400 underline-offset-4 truncate">
                          {displayName}
                        </span>
                        <ExternalLink className="w-3 h-3 text-[#6A6A64] group-hover/profile:text-amber-400 shrink-0 transition-colors" />
                      </a>
                    </div>

                    <div className="pt-2.5 border-t border-[#1F1F1A] flex items-center justify-between gap-3 font-mono">
                      <span className="text-[10px] tracking-[0.12em] text-[#6A6A64] uppercase">
                        TOKEN LIFECYCLE
                      </span>
                      <span className="text-[10px] sm:text-[11px] tracking-[0.08em] sm:tracking-[0.12em] text-amber-400 font-bold shrink-0 whitespace-nowrap">
                        {effectiveDaysRemaining} days remaining
                      </span>
                    </div>
                  </div>

                  {/* Token expiration explanation note */}
                  <div className="font-mono text-[10px] text-[#A6A69F] leading-relaxed">
                    Tokens expire every 180 days in Spotify Developer mode. Re-link to keep sync and playback active.
                  </div>

                  {/* Actions */}
                  <div className="pt-1 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={isBusy}
                      className="flex-1 py-2 px-3 border border-amber-400 text-amber-400 hover:bg-amber-400/10 font-mono text-[11px] font-bold tracking-[0.08em] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isBusy ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Renewing...</span>
                        </>
                      ) : (
                        <span>Re-link / Refresh Token</span>
                      )}
                    </button>
                    {status?.source !== "environment" && (
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        disabled={isBusy}
                        className="py-2 px-3 border border-[#26261F] text-[#6A6A64] hover:text-[#EDEDE8] hover:border-[#3A3A32] font-mono text-[10px] tracking-[0.12em] uppercase transition-colors cursor-pointer disabled:opacity-50"
                        title="Disconnect Spotify account"
                      >
                        Disconnect
                      </button>
                    )}
                  </div>

                  {/* SCHEDULED SYNC (CRON) */}
                  <ScheduledSyncCard
                    displaySyncUrl={displaySyncUrl}
                    placeholderSyncUrl={placeholderSyncUrl}
                    hasValidSyncKey={hasValidSyncKey}
                    copiedSyncUrl={copiedSyncUrl}
                    isBusy={isBusy}
                    isRegeneratingKey={isRegeneratingKey}
                    onCopySyncUrl={handleCopySyncUrl}
                    onRegenerateSyncKey={handleRegenerateSyncKey}
                    accentColorClass="text-amber-400"
                    focusBorderClass="focus-within:border-amber-400"
                    hoverColorClass="hover:text-amber-400"
                  />
                </div>
              )}
            </>
          )}

          {/* Error Banner */}
          {error && (
            <div className="font-mono text-[10px] tracking-[0.06em] text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-1.5">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
