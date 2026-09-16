"use client";

import React from "react";
import { Mode } from "@/lib/mock-listening-data";
import { useConfig } from "@/context/ConfigContext";
import { Menu, Upload } from "lucide-react";

interface ModeTabsProps {
  activeMode: Mode;
  onSelectMode: (mode: Mode) => void;
  onOpenUpload?: () => void;
  isSyncing?: boolean;
}

const MODES: Array<{ id: Mode; label: string; abbrev: string }> = [
  { id: 0, label: "[ 1 · OVERVIEW ]", abbrev: "[ OVERVIEW ]" },
  { id: 1, label: "[ 2 · STREAM LOG ]", abbrev: "[ LOG ]" },
  { id: 2, label: "[ 3 · SESSIONS ]", abbrev: "[ SESSIONS ]" },
];

export const ModeTabs: React.FC<ModeTabsProps> = ({
  activeMode,
  onSelectMode,
  onOpenUpload,
  isSyncing = false,
}) => {
  const { openModal } = useConfig();

  return (
    <nav
      aria-label="Listening index view modes"
      className="flex items-center justify-between mt-4 md:mt-5 border-b border-[#1C1C1A] select-none"
    >
      <div className="flex gap-4 sm:gap-6 mr-4">
        {MODES.map((m) => {
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

      <div className="flex items-center gap-3 sm:gap-4">
        {onOpenUpload && (
          <button
            type="button"
            onClick={onOpenUpload}
            title="Import Spotify Extended Streaming History (.zip / .json) [Key: U]"
            className="group inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.12em] pb-2 sm:pb-2.5 text-[#5A5A55] hover:text-music-accent transition-colors uppercase cursor-pointer bg-transparent border-0 border-b border-transparent hover:border-music-accent focus:outline-none focus-visible:outline-none whitespace-nowrap"
          >
            <span className="min-[800px]:hidden inline-flex items-center gap-1">
              <span>[</span>
              <Upload className="w-3 h-3" />
              <span>]</span>
            </span>
            <span className="hidden min-[800px]:inline">[ U · UPLOAD ]</span>
          </button>
        )}

        <button
          type="button"
          onClick={openModal}
          title="Open Customization GUI (Accent color, title, timezone, links) [Key: C]"
          className="group inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.12em] pb-2 sm:pb-2.5 text-[#5A5A55] hover:text-music-accent transition-colors uppercase cursor-pointer bg-transparent border-0 border-b border-transparent hover:border-music-accent focus:outline-none focus-visible:outline-none whitespace-nowrap"
        >
          <span className="min-[800px]:hidden inline-flex items-center gap-1">
            <span>[</span>
            <Menu className="w-3 h-3" />
            <span>]</span>
          </span>
          <span className="hidden min-[800px]:inline">[ C · CONFIG ]</span>
        </button>
      </div>
    </nav>
  );
};

