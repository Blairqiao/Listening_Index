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
  isSyncing?: boolean;
  onTriggerSync?: () => void;
  streamLogCount?: number;
  totalPlays?: string;
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
  isSyncing = false,
  onTriggerSync,
  streamLogCount,
  totalPlays,
}) => {
  const getScopeLabel = (): React.ReactNode => {
    switch (mode) {
      case 0:
        return (
          <>
            <span className="sm:hidden">[ SINCE {compactDate(logStartDate)} ]</span>
            <span className="hidden sm:inline">[ RANGE · LOG SINCE {logStartDate} ]</span>
          </>
        );
      case 1:
        return "[ STREAM LOG ]";
      case 2:
        return (
          <>
            <span className="sm:hidden">[ SES ]</span>
            <span className="hidden sm:inline">[ SESSION ]</span>
          </>
        );
      case 3:
        return (
          <>
            <span className="sm:hidden">[ SPC ]</span>
            <span className="hidden sm:inline">[ SPECTRUM ]</span>
          </>
        );
    }
  };

  const renderControls = () => {
    switch (mode) {
      case 0:
        return (
          <div
            className="grid grid-cols-6 gap-1.5 w-full sm:flex sm:w-auto sm:gap-1.5"
            role="group"
            aria-label="Time range filters"
          >
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
                  className={`font-mono text-[11px] tracking-[0.08em] whitespace-nowrap px-1 sm:px-2.5 py-1 sm:py-[3px] rounded-none transition-none border focus:outline-none focus-visible:outline-none flex items-center justify-center text-center ${
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
        );
      case 1: {
        const count = streamLogCount || 50;
        const total = totalPlays || "--";
        return (
          <>
            <span className="sm:hidden font-mono text-[11px] tracking-[0.08em] text-[#6A6A64]">
              [ LAST {count} ]
            </span>
            <span className="hidden sm:inline font-mono text-[11px] tracking-[0.08em] text-[#6A6A64]">
              [ LAST {count} TRACKS ]
            </span>
          </>
        );
      }
      case 2:
        return (
          <button
            type="button"
            onClick={onTriggerSync}
            disabled={isSyncing}
            title="Click to trigger manual sync"
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
        );
      case 3:
        // The spectrum has no range or sync control of its own; its only
        // control (the live-audio toggle) lives on the visualizer itself.
        return null;
    }
  };

  return (
    <div
      className={`my-3.5 sm:my-4 md:my-5 select-none ${
        mode === 0
          ? "flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center sm:h-[28px]"
          : "flex justify-between items-center h-[28px]"
      }`}
    >
      {/* Left Slot: Scope Label */}
      <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] whitespace-nowrap sm:mr-4">
        {getScopeLabel()}
      </span>

      {/* Right Slot: Range Buttons (Mode 0) or Status Tag (Modes 1 & 2) */}
      <div className={`flex items-center ${mode === 0 ? "w-full sm:w-auto" : "overflow-x-auto scrollbar-hidden"}`}>
        {renderControls()}
      </div>
    </div>
  );
};
