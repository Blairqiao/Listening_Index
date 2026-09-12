"use client";

import React from "react";
import { Mode, RangeKey } from "@/lib/mock-listening-data";
import { compactDate } from "@/lib/resize-utils";

interface ControlRowProps {
  mode: Mode;
  range: RangeKey;
  onSelectRange: (range: RangeKey) => void;
  logStartDate: string;
  isSessionOpen: boolean;
  sessionTagTime: string;
  onToggleSession?: () => void;
  isSyncing?: boolean;
  isSmallScreen?: boolean;
  onTriggerSync?: () => void;
}

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: "1d", label: "1 D" },
  { key: "1w", label: "1 W" },
  { key: "1m", label: "1 M" },
  { key: "6m", label: "6 M" },
  { key: "1y", label: "1 Y" },
  { key: "all", label: "ALL" },
];

export const ControlRow: React.FC<ControlRowProps> = ({
  mode,
  range,
  onSelectRange,
  logStartDate,
  isSessionOpen,
  sessionTagTime,
  onToggleSession,
  isSyncing = false,
  isSmallScreen = false,
  onTriggerSync,
}) => {

  return (
    <div className="flex justify-between items-center my-4 md:my-5 h-[28px] select-none">
      {/* Left Slot: Scope Label */}
      <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] whitespace-nowrap mr-4">
        {mode === 0 && (isSmallScreen ? `[ SINCE ${compactDate(logStartDate)} ]` : `[ RANGE · LOG SINCE ${logStartDate} ]`)}
        {mode === 1 && "[ SCOPE ]"}
        {mode === 2 && (isSmallScreen ? "[ SES ]" : "[ SESSION ]")}
      </span>

      {/* Right Slot: Range Buttons (Mode 0) or Status Tag (Modes 1 & 2) */}
      <div className="flex items-center overflow-x-auto scrollbar-hidden">
        {mode === 0 && (
          <div className="flex gap-1.5" role="group" aria-label="Time range filters">
            {RANGES.map((r) => {
              const isActive = range === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  disabled={isSyncing}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    if (!isSyncing) onSelectRange(r.key);
                  }}
                  className={`font-mono text-[11px] tracking-[0.08em] px-2.5 py-[3px] rounded-none transition-none border focus:outline-none focus-visible:outline-none ${
                    isSyncing ? "cursor-wait opacity-60" : "cursor-pointer"
                  } ${
                    isActive
                      ? "text-music-accent border-music-accent bg-transparent"
                      : "text-[#6A6A64] border-[#26261F] bg-transparent hover:text-[#EDEDE8] hover:border-[#3A3A32]"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        )}

        {mode === 1 && (
          <span className="font-mono text-[11px] tracking-[0.08em] text-[#6A6A64]">
            [ LAST 50 PLAYS ]
          </span>
        )}

        {mode === 2 && (
          <button
            type="button"
            onClick={onTriggerSync || onToggleSession}
            disabled={isSyncing}
            title="Click to trigger manual sync (or press 'S' to toggle state)"
            className={`font-mono text-[11px] tracking-[0.08em] bg-transparent border-0 cursor-pointer p-0 transition-none hover:text-[#EDEDE8] focus-visible:outline-none focus-visible:text-music-accent ${
              isSyncing
                ? "text-music-accent cursor-wait"
                : isSessionOpen
                ? "text-music-accent"
                : "text-[#6A6A64]"
            }`}
          >
            {isSyncing
              ? "[ SYNCING... ]"
              : isSessionOpen
              ? `[ ▪ ACTIVE · SINCE ${sessionTagTime} ]`
              : `[ CLOSED ${sessionTagTime} AGO ]`}
          </button>
        )}
      </div>
    </div>
  );
};
