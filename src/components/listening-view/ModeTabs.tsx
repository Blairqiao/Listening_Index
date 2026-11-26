"use client";

import React from "react";
import { Mode } from "@/lib/types";
import { useConfig } from "@/context/ConfigContext";
import { Menu, Upload, Lock, Unlock, Music2 } from "lucide-react";

interface ModeTabsProps {
  activeMode: Mode;
  onSelectMode: (mode: Mode) => void;
  onOpenUpload?: () => void;
  onOpenSpotifyModal?: () => void;
  spotifyStatus?: SpotifyTabStatusProp | null;
  isAuthenticated?: boolean;
  isSyncing?: boolean;
}

export const BASE_MODES: Array<{ id: Mode; label: string; abbrev: string }> = [
  { id: 0, label: "Overview", abbrev: "Overview" },
  { id: 1, label: "Stream log", abbrev: "Log" },
  { id: 2, label: "Sessions", abbrev: "Sessions" },
  { id: 5, label: "Calendar", abbrev: "Cal" },
  { id: 4, label: "Search", abbrev: "Search" },
];

export const ADMIN_MODES: Array<{ id: Mode; label: string; abbrev: string }> = [
  ...BASE_MODES,
  { id: 3, label: "Live player", abbrev: "Live" },
];

export function getAvailableModes(isAuthenticated: boolean): Array<{ id: Mode; label: string; abbrev: string }> {
  return isAuthenticated ? ADMIN_MODES : BASE_MODES;
}

export interface SpotifyTabStatusProp {
  connected: boolean;
  isExpiringSoon: boolean;
  daysRemaining?: number | null;
}

export interface SpotifyTabState {
  visible: boolean;
  variant: "setup" | "expiring" | "connected";
  title: string;
}

export function getSpotifyTabState(
  isAuthenticated?: boolean,
  spotifyStatus?: SpotifyTabStatusProp | null
): SpotifyTabState | null {
  if (!isAuthenticated) return null;
  if (!spotifyStatus) {
    return {
      visible: true,
      variant: "connected",
      title: "Manage Spotify connection & refresh token",
    };
  }
  if (!spotifyStatus.connected) {
    return {
      visible: true,
      variant: "setup",
      title: "Setup Spotify connection & refresh token",
    };
  }
  if (spotifyStatus.isExpiringSoon) {
    const daysStr =
      spotifyStatus.daysRemaining !== null && spotifyStatus.daysRemaining !== undefined
        ? `${spotifyStatus.daysRemaining}d`
        : "?d";
    return {
      visible: true,
      variant: "expiring",
      title: `Spotify token expiring in ${daysStr} · click to renew`,
    };
  }
  return {
    visible: true,
    variant: "connected",
    title: "Manage Spotify connection & refresh token",
  };
}

export const ModeTabs: React.FC<ModeTabsProps> = ({
  activeMode,
  onSelectMode,
  onOpenUpload,
  onOpenSpotifyModal,
  spotifyStatus,
  isAuthenticated: propIsAuthenticated,
  isSyncing = false,
}) => {
  const { openModal, isAuthenticated: contextIsAuthenticated, openAdminLoginModal, logout, openAdminSpotifyModal } = useConfig();
  const isAuthenticated = propIsAuthenticated !== undefined ? propIsAuthenticated : contextIsAuthenticated;
  const modes = getAvailableModes(isAuthenticated);
  const spotifyTab = getSpotifyTabState(isAuthenticated, spotifyStatus);
  const handleOpenSpotify = onOpenSpotifyModal || openAdminSpotifyModal;

  return (
    <nav
      aria-label="Listening index view modes"
      className="flex flex-wrap items-center justify-between gap-y-1 sm:flex-nowrap mt-4 md:mt-5 border-b border-[#1C1C1A] select-none"
    >
      <div className="flex gap-3.5 sm:gap-6 mr-3 sm:mr-4">
        {modes.map((m) => {
          const isActive = activeMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={isSyncing}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.currentTarget.blur();
                if (!isSyncing) onSelectMode(m.id);
              }}
              className={`relative hit-area focus-ring font-mono text-[11px] sm:text-[13px] pb-2 sm:pb-2.5 bg-transparent transition-none select-none border-0 border-b whitespace-nowrap ${isSyncing ? "cursor-wait" : "cursor-pointer"
                } ${isActive
                  ? "text-music-accent border-music-accent"
                  : "text-[#5A5A55] border-transparent hover:text-[#EDEDE8]"
                }`}
            >
              <span className="min-[800px]:hidden">{m.abbrev}</span>
              <span className="hidden min-[800px]:inline">{m.label}</span>
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-3 sm:gap-3.5 shrink-0">
        
        {isAuthenticated && onOpenUpload && (
          <button
            type="button"
            onClick={onOpenUpload}
            title="Import Spotify Extended Streaming History (.zip / .json)"
            aria-label="Import Spotify Extended Streaming History"
            className="relative hit-area focus-ring inline-flex items-center gap-0.5 sm:gap-1 font-mono text-[11px] sm:text-[12px] pb-2 sm:pb-2.5 text-[#5A5A55] hover:text-music-accent transition-colors cursor-pointer bg-transparent border-0 border-b border-transparent hover:border-music-accent whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}

        {spotifyTab && spotifyTab.visible && (
          <button
            type="button"
            onClick={handleOpenSpotify}
            title={spotifyTab.title}
            aria-label="Manage Spotify connection"
            className={`relative hit-area focus-ring inline-flex items-center gap-0.5 sm:gap-1 font-mono text-[11px] sm:text-[12px] pb-2 sm:pb-2.5 transition-colors cursor-pointer bg-transparent border-0 border-b border-transparent hover:border-music-accent whitespace-nowrap ${
              spotifyTab.variant === "setup"
                ? "text-music-accent hover:text-[#EDEDE8] animate-slow-blink"
                : spotifyTab.variant === "expiring"
                ? "text-amber-400 hover:text-amber-300 animate-slow-blink"
                : "text-[#5A5A55] hover:text-music-accent"
            }`}
          >
            <Music2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}


        <button
          type="button"
          onClick={openModal}
          title={isAuthenticated ? "Open configuration settings" : "Open appearance settings"}
          aria-label="Appearance and configuration settings"
          className="relative hit-area focus-ring inline-flex items-center gap-0.5 sm:gap-1 font-mono text-[11px] sm:text-[12px] pb-2 sm:pb-2.5 text-[#5A5A55] hover:text-music-accent transition-colors cursor-pointer bg-transparent border-0 border-b border-transparent hover:border-music-accent whitespace-nowrap"
        >
          <Menu className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {isAuthenticated ? (
          <button
            type="button"
            onClick={logout}
            title="Admin session active · click to lock"
            aria-label="Lock admin session"
            className="relative hit-area focus-ring inline-flex items-center gap-0.5 sm:gap-1 font-mono text-[11px] sm:text-[12px] pb-2 sm:pb-2.5 text-music-accent hover:text-[#EDEDE8] transition-colors cursor-pointer bg-transparent border-0 border-b border-transparent hover:border-music-accent whitespace-nowrap"
          >
            <Unlock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-music-accent" />
          </button>
        ) : (
          <button
            type="button"
            onClick={openAdminLoginModal}
            title="Admin login"
            aria-label="Admin login"
            className="relative hit-area focus-ring inline-flex items-center gap-0.5 sm:gap-1 font-mono text-[11px] sm:text-[12px] pb-2 sm:pb-2.5 text-[#5A5A55] hover:text-music-accent transition-colors cursor-pointer bg-transparent border-0 border-b border-transparent hover:border-music-accent whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}
      </div>
    </nav>
  );
};

