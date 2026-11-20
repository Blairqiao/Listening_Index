"use client";

import React from "react";
import { Mode, RangeKey } from "@/lib/types";
import { compactDate } from "@/lib/format-utils";
import type { ProfileHistoryEntry, ProfileKind } from "@/lib/search-types";

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
  syncError?: string | null;
  returnsTo?: ProfileKind | null;
  onProfileBack?: () => void;
  profileKind?: ProfileKind | null;
  profileHistory?: ProfileHistoryEntry[];
  onJumpToHistory?: (index: number) => void;
  onReturnToSearch?: () => void;
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
  syncError,
  profileKind,
  onProfileBack,
  returnsTo,
  profileHistory,
  onJumpToHistory,
  onReturnToSearch,
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
      case 4:
        if (profileKind === "track") return "TRACK PROFILE";
        if (profileKind === "artist") return "ARTIST PROFILE";
        if (profileKind === "album") return "ALBUM PROFILE";
        return "SEARCH";
    }
  };

  const renderRangeButtons = () => (
    <div
      className="grid grid-cols-6 gap-1.5 w-full sm:flex sm:w-auto sm:gap-1.5 shrink-0"
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
            className={`font-mono text-[11px] tracking-[0.08em] whitespace-nowrap px-1 sm:px-2.5 py-1 sm:py-[3px] rounded-none transition-none border focus:outline-none focus-visible:outline-none flex items-center justify-center text-center shrink-0 ${
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

  const renderControls = () => {
    switch (mode) {
      case 0:
        return renderRangeButtons();
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
        const sessionContent = syncError
          ? `[ ${syncError.toUpperCase()} ]`
          : isSyncing
          ? "[ SYNCING... ]"
          : isSessionOpen
          ? `[ ▪ ACTIVE · SINCE ${sessionTagTime} ]`
          : `[ CLOSED ${sessionTagTime} AGO ]`;

        if (!isAuthenticated) {
          return (
            <span
              className={`font-mono text-[11px] tracking-[0.08em] ${
                syncError
                  ? "text-[#FF6B6B]"
                  : isSessionOpen
                  ? "text-music-accent"
                  : "text-[#6A6A64]"
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
            title={syncError || "Click to trigger manual sync"}
            className={`font-mono text-[11px] tracking-[0.08em] bg-transparent border-0 cursor-pointer p-0 transition-none hover:text-[#EDEDE8] focus-visible:outline-none focus-visible:text-music-accent ${
              syncError
                ? "text-[#FF6B6B]"
                : isSyncing
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
      case 4:
        return profileKind ? renderRangeButtons() : null;
    }
  };

  const showsRanges = mode === 0 || (mode === 4 && !!profileKind);
  const showsProfileNav = mode === 4 && profileKind && (onProfileBack || onJumpToHistory);

  const Scope = showsProfileNav ? "div" : "span";
  const renderProfileNav = () => {
    if (!profileHistory?.length || !onJumpToHistory) {
      return (
        <button
          type="button"
          onClick={onProfileBack ?? onReturnToSearch ?? (() => onJumpToHistory?.(-1))}
          className="min-h-7 cursor-pointer text-[#A0A099] hover:text-[#EDEDE8] focus-visible:outline-music-accent"
        >
          {`← BACK TO ${(returnsTo ?? "search").toUpperCase()}`}
        </button>
      );
    }

    const directParent = profileHistory[profileHistory.length - 1];
    const directParentName = directParent.name || directParent.target.kind.toUpperCase();
    const hasOverflow = profileHistory.length > 2;
    const startIdx = Math.max(0, profileHistory.length - 2);
    const visibleAncestors = profileHistory.slice(startIdx).map((entry, offset) => {
      const index = startIdx + offset;
      const isDirectParent = index === profileHistory.length - 1;
      return { entry, index, isDirectParent };
    });

    return (
      <>
        {/* Mobile (< sm): direct parent + subtle search escape link */}
        <div className="flex sm:hidden items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={onProfileBack ?? (() => onJumpToHistory?.(profileHistory.length - 1))}
            className="min-h-7 cursor-pointer text-[#A0A099] hover:text-[#EDEDE8] max-w-[170px] truncate focus-visible:outline-music-accent"
            title={`Back to ${directParentName}`}
          >
            {`← ${directParentName}`}
          </button>
          <span className="text-[#3A3A36]" aria-hidden="true">/</span>
          <button
            type="button"
            onClick={onReturnToSearch ?? (() => onJumpToHistory?.(-1))}
            className="min-h-7 cursor-pointer text-[#6A6A64] hover:text-[#EDEDE8] shrink-0 focus-visible:outline-music-accent"
            title="Return to search"
          >
            SEARCH
          </button>
        </div>

        {/* Desktop (>= sm): full breadcrumb trail */}
        <div className="hidden sm:flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={onReturnToSearch ?? (() => onJumpToHistory?.(-1))}
            className="min-h-7 cursor-pointer text-[#6A6A64] hover:text-[#EDEDE8] shrink-0 focus-visible:outline-music-accent"
            title="Return to search"
          >
            ← SEARCH
          </button>
          {hasOverflow && (
            <>
              <span className="text-[#3A3A36]" aria-hidden="true">/</span>
              <span className="text-[#5A5A55] select-none" aria-hidden="true">…</span>
            </>
          )}
          {visibleAncestors.map(({ entry, index, isDirectParent }) => {
            const name = entry.name || entry.target.kind.toUpperCase();
            return (
              <React.Fragment key={`${entry.target.kind}-${entry.target.key}-${index}`}>
                <span className="text-[#3A3A36]" aria-hidden="true">/</span>
                <button
                  type="button"
                  onClick={() => onJumpToHistory?.(index)}
                  className={`min-h-7 cursor-pointer max-w-[140px] truncate focus-visible:outline-music-accent ${
                    isDirectParent
                      ? "text-[#A0A099] hover:text-[#EDEDE8]"
                      : "text-[#6A6A64] hover:text-[#EDEDE8]"
                  }`}
                  title={name}
                >
                  {name}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div
      className={`my-3.5 sm:my-4 md:my-5 select-none ${
        showsRanges
          ? "flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center sm:h-[28px]"
          : "flex justify-between items-center h-[28px]"
      }`}
    >
      {/* Left Slot: Scope Label or Profile Navigation */}
      <Scope className={`font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] whitespace-nowrap sm:mr-4 ${showsProfileNav ? "min-w-0 flex items-center" : ""}`}>
        {showsProfileNav ? (
          <nav aria-label="Profile navigation" className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            {renderProfileNav()}
          </nav>
        ) : (
          getScopeLabel()
        )}
        {syncError && mode !== 2 && (
          <span className="ml-2 text-[#FF6B6B] tracking-[0.08em]">
            [ {syncError.toUpperCase()} ]
          </span>
        )}
      </Scope>

      <div className={`flex items-center ${showsRanges ? "w-full sm:w-auto" : "overflow-x-auto scrollbar-hidden"} ${showsProfileNav ? "shrink-0" : ""}`}>
        {renderControls()}
      </div>
    </div>
  );
};
