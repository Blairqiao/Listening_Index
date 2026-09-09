"use client";

import React from "react";
import { Mode } from "@/lib/mock-listening-data";

interface ModeTabsProps {
  activeMode: Mode;
  onSelectMode: (mode: Mode) => void;
  isSyncing?: boolean;
}

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 0, label: "[ 1 · OVERVIEW ]" },
  { id: 1, label: "[ 2 · STREAM LOG ]" },
  { id: 2, label: "[ 3 · SESSIONS ]" },
];

export const ModeTabs: React.FC<ModeTabsProps> = ({
  activeMode,
  onSelectMode,
  isSyncing = false,
}) => {
  return (
    <nav
      aria-label="Listening index view modes"
      className="flex gap-6 mt-4 md:mt-5 border-b border-[#1C1C1A]"
    >
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
            className={`font-mono text-[11px] tracking-[0.12em] pb-2 sm:pb-2.5 bg-transparent transition-none select-none border-0 border-b focus:outline-none focus-visible:outline-none ${
              isSyncing ? "cursor-wait" : "cursor-pointer"
            } ${
              isActive
                ? "text-music-accent border-music-accent"
                : "text-[#5A5A55] border-transparent hover:text-[#EDEDE8]"
            }`}
          >
            {m.label}
          </button>
        );
      })}
    </nav>
  );
};
