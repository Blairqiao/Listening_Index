"use client";

import React from "react";
import { Mode } from "@/lib/mock-listening-data";
import { useConfig } from "@/context/ConfigContext";
import { Menu, Upload, Lock, Unlock } from "lucide-react";

interface ModeTabsProps {
  activeMode: Mode;
  onSelectMode: (mode: Mode) => void;
  onOpenUpload?: () => void;
  isSyncing?: boolean;
}

export const BASE_MODES: Array<{ id: Mode; label: string; abbrev: string }> = [
  { id: 0, label: "[ 1 · OVERVIEW ]", abbrev: "[ OVR ]" },
  { id: 1, label: "[ 2 · STREAM LOG ]", abbrev: "[ LOG ]" },
  { id: 2, label: "[ 3 · SESSIONS ]", abbrev: "[ SES ]" },
];

export const ADMIN_MODES: Array<{ id: Mode; label: string; abbrev: string }> = [
  ...BASE_MODES,
  { id: 3, label: "[ 4 · LIVE PLAYER ]", abbrev: "[ LIVE ]" },
];

export function getAvailableModes(isAuthenticated: boolean): Array<{ id: Mode; label: string; abbrev: string }> {
  return isAuthenticated ? ADMIN_MODES : BASE_MODES;
}

export const ModeTabs: React.FC<ModeTabsProps> = ({
  activeMode,
  onSelectMode,
  onOpenUpload,
  isSyncing = false,
}) => {
  const { openModal, isAuthenticated, openAdminLoginModal, logout } = useConfig();
  const modes = getAvailableModes(isAuthenticated);

  return (
    <nav
      aria-label="Listening index view modes"
      className="flex items-center justify-between mt-4 md:mt-5 border-b border-[#1C1C1A] select-none"
    >
      <div className="flex gap-4 sm:gap-6 mr-4">
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
              className={`font-mono text-[11px] tracking-[0.12em] pb-2 sm:pb-2.5 bg-transparent transition-none select-none border-0 border-b focus:outline-none focus-visible:outline-none whitespace-nowrap ${isSyncing ? "cursor-wait" : "cursor-pointer"
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

      <div className="flex items-center gap-2 sm:gap-2.5">
        {isAuthenticated && onOpenUpload && (
          <button
            type="button"
            onClick={onOpenUpload}
            title="Import Spotify Extended Streaming History (.zip / .json) [Key: U]"
            aria-label="Import Spotify Extended Streaming History"
            className="inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.12em] pb-2 sm:pb-2.5 text-[#5A5A55] hover:text-music-accent transition-colors uppercase cursor-pointer bg-transparent border-0 border-b border-transparent hover:border-music-accent focus:outline-none focus-visible:outline-none whitespace-nowrap"
          >
            <span>[</span>
            <Upload className="w-3 h-3" />
            <span>]</span>
          </button>
        )}

        <button
          type="button"
          onClick={openModal}
          title={isAuthenticated ? "Open configuration settings [Key: C]" : "Open appearance settings [Key: C]"}
          aria-label="Appearance and configuration settings"
          className="inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.12em] pb-2 sm:pb-2.5 text-[#5A5A55] hover:text-music-accent transition-colors uppercase cursor-pointer bg-transparent border-0 border-b border-transparent hover:border-music-accent focus:outline-none focus-visible:outline-none whitespace-nowrap"
        >
          <span>[</span>
          <Menu className="w-3 h-3" />
          <span>]</span>
        </button>

        {isAuthenticated ? (
          <button
            type="button"
            onClick={logout}
            title="Admin session active · click to lock [Key: L]"
            aria-label="Lock admin session"
            className="inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.12em] pb-2 sm:pb-2.5 text-music-accent hover:text-[#EDEDE8] transition-colors uppercase cursor-pointer bg-transparent border-0 border-b border-transparent hover:border-music-accent focus:outline-none focus-visible:outline-none whitespace-nowrap"
          >
            <span>[</span>
            <Unlock className="w-3 h-3 text-music-accent" />
            <span>]</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={openAdminLoginModal}
            title="Admin login [Key: L]"
            aria-label="Admin login"
            className="inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.12em] pb-2 sm:pb-2.5 text-[#5A5A55] hover:text-music-accent transition-colors uppercase cursor-pointer bg-transparent border-0 border-b border-transparent hover:border-music-accent focus:outline-none focus-visible:outline-none whitespace-nowrap"
          >
            <span>[</span>
            <Lock className="w-3 h-3" />
            <span>]</span>
          </button>
        )}
      </div>
    </nav>
  );
};

