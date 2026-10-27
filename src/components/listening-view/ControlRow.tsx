"use client";

import React from "react";
import { Mode, RangeKey } from "@/lib/mock-listening-data";
import { compactDate } from "@/lib/format-utils";

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
  streamLogDateSpan?: string;
  sessionNumber?: number;
  sessionIndex?: number;
  totalSessions?: number;
  // Mode 3: Live Player page-level controls
  layout?: "split" | "stacked";
  onToggleLayout?: () => void;
  isAuthenticated?: boolean;
  activeDevice?: { name?: string; isThisBrowser?: boolean } | null;
  playerStatus?: "idle" | "checking" | "unlinked" | "connecting" | "ready" | "error";
  onTransferPlayback?: () => void;
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
  streamLogDateSpan,
  sessionNumber,
  sessionIndex,
  totalSessions,
  layout = "split",
  onToggleLayout,
  isAuthenticated = false,
  activeDevice,
  playerStatus,
  onTransferPlayback,
}) => {
  const getScopeLabel = (): React.ReactNode => {
    switch (mode) {
      case 0:
        return `SINCE ${compactDate(logStartDate)}`;
      case 1:
        return streamLogDateSpan || "STREAM LOG";
      case 2: {
        const num = sessionNumber ?? (sessionIndex != null ? sessionIndex + 1 : 1);
        const total = totalSessions ?? 1;
        const padNum = String(num).padStart(2, "0");
        const padTotal = String(total).padStart(2, "0");
        return `SESSION ${padNum} / ${padTotal}`;
      }
      case 3: {
        if (playerStatus === "checking") {
          return "CHECKING CONNECTION...";
        }
        if (playerStatus === "unlinked") {
          return "SPOTIFY NOT LINKED";
        }
        if (playerStatus === "connecting") {
          return "CONNECTING TO SPOTIFY...";
        }
        if (playerStatus === "error") {
          return <span className="text-[#FF6B6B]">PLAYER ERROR</span>;
        }
        if (activeDevice?.isThisBrowser) {
          return (
            <span className="text-music-accent">
              DEVICE: LISTENING INDEX · ACTIVE
            </span>
          );
        }
        if (activeDevice && !activeDevice.isThisBrowser) {
          return (
            <span className="inline-flex items-center gap-2">
              <span className="text-[#8A8A82] truncate max-w-[200px] sm:max-w-none">
                LISTENING ON: {activeDevice.name?.toUpperCase() || "EXTERNAL"}
              </span>
              {onTransferPlayback && (
                <>
                  <span className="text-[#3A3A36]">·</span>
                  <button
                    type="button"
                    onClick={onTransferPlayback}
                    className="font-mono text-[11px] tracking-[0.08em] whitespace-nowrap bg-transparent border-0 cursor-pointer p-0 text-[#6A6A64] hover:text-music-accent focus-visible:outline-none focus-visible:text-music-accent transition-none shrink-0"
                    title="Transfer playback to this browser"
                  >
                    <span className="sm:hidden">[ TRANSFER ]</span>
                    <span className="hidden sm:inline">[ TRANSFER HERE ]</span>
                  </button>
                </>
              )}
            </span>
          );
        }
        return <span className="text-music-accent">DEVICE: LISTENING INDEX</span>;
      }
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
        const count = streamLogCount ?? 50;
        if (count === 0) {
          return (
            <span className="font-mono text-[11px] tracking-[0.08em] text-[#6A6A64]">
              [ NO TRACKS ]
            </span>
          );
        }
        return (
          <>
            <span className="md:hidden font-mono text-[11px] tracking-[0.08em] text-[#6A6A64]">
              [ LAST {count} ]
            </span>
            <span className="hidden md:inline font-mono text-[11px] tracking-[0.08em] text-[#6A6A64]">
              [ LAST {count} TRACKS ]
            </span>
          </>
        );
      }
      case 2: {
        const sessionContent = isSyncing
          ? "[ SYNCING... ]"
          : isSessionOpen
          ? `[ ▪ ACTIVE · SINCE ${sessionTagTime} ]`
          : `[ CLOSED ${sessionTagTime} AGO ]`;

        if (!isAuthenticated) {
          return (
            <span
              className={`font-mono text-[11px] tracking-[0.08em] ${
                isSessionOpen ? "text-music-accent" : "text-[#6A6A64]"
              }`}
            >
              {sessionContent}
            </span>
          );
        }

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
            {sessionContent}
          </button>
        );
      }
      case 3:
        return (
          <div className="hidden md:flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onToggleLayout}
              aria-label="Toggle player layout between split and stacked"
              className="font-mono text-[11px] tracking-[0.08em] whitespace-nowrap bg-transparent border-0 cursor-pointer p-0 text-[#6A6A64] hover:text-[#EDEDE8] focus-visible:outline-none focus-visible:text-music-accent transition-none"
              title="Toggle between Split Console and Stacked Stage"
            >
              <span>{layout === "stacked" ? "[ LAYOUT: STACKED ]" : "[ LAYOUT: SPLIT ]"}</span>
            </button>
          </div>
        );
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
