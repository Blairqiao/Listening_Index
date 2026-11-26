"use client";

import React from "react";
import { Mode } from "@/lib/types";
import {
  formatRangeLabel,
  normalizeLegacyRange,
  type CalendarUnit,
  type RangeSelection,
} from "@/lib/range";
import { compactDate } from "@/lib/format-utils";
import { selectionToRange, type CalendarSelection } from "@/lib/calendar";
import type { ProfileHistoryEntry, ProfileKind } from "@/lib/search-types";
import { CalendarLegend } from "@/components/views/CalendarView";
import { ZoomRuler } from "@/components/listening-view/zoom-ruler/ZoomRuler";

interface ControlRowProps {
  mode: Mode;
  range: RangeSelection;
  onSelectRange: (sel: RangeSelection) => void;
  firstKey: string;
  todayKey: string;
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
  isAuthenticated?: boolean;
  activeDevice?: { name?: string; isThisBrowser?: boolean } | null;
  playerStatus?: "idle" | "checking" | "unlinked" | "connecting" | "ready" | "error";
  onTransferPlayback?: () => void;
  calendarSelection?: CalendarSelection | null;
  onRandomRange?: (unit: CalendarUnit) => void;
  randomRangeReady?: boolean;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const ControlRow: React.FC<ControlRowProps> = ({
  mode,
  range,
  onSelectRange,
  firstKey,
  todayKey,
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
  isAuthenticated = false,
  activeDevice,
  playerStatus,
  onTransferPlayback,
  calendarSelection,
  onRandomRange,
  randomRangeReady = false,
}) => {
  const getScopeLabel = (): React.ReactNode => {
    switch (mode) {
      case 0:
        return `Since ${compactDate(logStartDate)}`;
      case 5:
        return calendarSelection
          ? formatRangeLabel(selectionToRange(calendarSelection))
          : `Since ${compactDate(logStartDate)}`;
      case 1:
        return streamLogDateSpan || "Stream log";
      case 2: {
        const num = sessionNumber ?? (sessionIndex != null ? sessionIndex + 1 : 1);
        const total = totalSessions ?? 1;
        const padNum = String(num).padStart(2, "0");
        const padTotal = String(total).padStart(2, "0");
        return `Session ${padNum} / ${padTotal}`;
      }
      case 3: {
        if (playerStatus === "checking") {
          return "Checking connection...";
        }
        if (playerStatus === "unlinked") {
          return "Spotify not linked";
        }
        if (playerStatus === "connecting") {
          return "Connecting to Spotify...";
        }
        if (playerStatus === "error") {
          return <span className="text-[#FF6B6B]">Player error</span>;
        }
        if (activeDevice?.isThisBrowser) {
          return (
            <span className="text-music-accent">
              Device: Listening Index · active
            </span>
          );
        }
        if (activeDevice && !activeDevice.isThisBrowser) {
          return (
            <span className="inline-flex items-center gap-2">
              <span className="text-[#8A8A82] truncate max-w-[200px] sm:max-w-none">
                Listening on: {activeDevice.name || "external"}
              </span>
              {onTransferPlayback && (
                <>
                  <span className="text-[#3A3A36]">·</span>
                  <button
                    type="button"
                    onClick={onTransferPlayback}
                    className="font-mono text-[12px] whitespace-nowrap bg-transparent border-0 cursor-pointer p-0 text-[#6A6A64] hover:text-music-accent focus-visible:outline-none focus-visible:text-music-accent motion-hover shrink-0"
                    title="Transfer playback to this browser"
                  >
                    <span className="sm:hidden">Transfer</span>
                    <span className="hidden sm:inline">Transfer here</span>
                  </button>
                </>
              )}
            </span>
          );
        }
        return <span className="text-music-accent">Device: Listening Index</span>;
      }
      case 4:
        if (profileKind === "track") return "Track profile";
        if (profileKind === "artist") return "Artist profile";
        if (profileKind === "album") return "Album profile";
        return "Search";
    }
  };

  const renderControls = () => {
    switch (mode) {
      case 0:
        return (
          <ZoomRuler
            range={range}
            onSelectRange={onSelectRange}
            firstKey={firstKey}
            todayKey={todayKey}
            disabled={isSyncing}
          />
        );
      case 1: {
        const count = streamLogCount ?? 50;
        if (count === 0) {
          return (
            <span className="font-mono text-[12px] text-[#6A6A64]">
              No tracks
            </span>
          );
        }
        return (
          <>
            <span className="md:hidden font-mono text-[12px] text-[#6A6A64]">
              Last {count}
            </span>
            <span className="hidden md:inline font-mono text-[12px] text-[#6A6A64]">
              Last {count} tracks
            </span>
          </>
        );
      }
      case 2: {
        const sessionContent = syncError
          ? syncError
          : isSyncing
          ? "Syncing..."
          : isSessionOpen
          ? `▪ Active · since ${sessionTagTime}`
          : `Closed ${sessionTagTime} ago`;

        if (!isAuthenticated) {
          return (
            <span
              className={`font-mono text-[12px] ${
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
            className={`font-mono text-[12px] bg-transparent border-0 cursor-pointer p-0 motion-hover hover:text-[#EDEDE8] focus-visible:outline-none focus-visible:text-music-accent ${
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
        return null;
      case 4:
        return profileKind ? (
          <ZoomRuler
            range={range}
            onSelectRange={onSelectRange}
            firstKey={firstKey}
            todayKey={todayKey}
            disabled={isSyncing}
          />
        ) : null;
      case 5:
        return <CalendarLegend />;
    }
  };

  const showsRanges = mode === 4 && !!profileKind;
  const showsProfileNav = mode === 4 && profileKind && (onProfileBack || onJumpToHistory);

  if (mode === 0) {
    const isAllRange = range.kind === "preset" && range.key === "all";
    const overviewLabel = (
      <span className="font-mono text-[12px] whitespace-nowrap text-[#5A5A55]">
        {isAllRange
          ? `Since ${compactDate(logStartDate)}`
          : formatRangeLabel(normalizeLegacyRange(range, todayKey))}
        {syncError && (
          <span className="ml-2 text-[#FF6B6B]">
            {syncError}
          </span>
        )}
      </span>
    );

    return (
      <div className="my-3.5 sm:my-4 md:my-5 select-none">
        <ZoomRuler
          range={range}
          onSelectRange={onSelectRange}
          firstKey={firstKey}
          todayKey={todayKey}
          disabled={isSyncing}
          label={overviewLabel}
          onRandom={onRandomRange}
          randomDisabled={!randomRangeReady}
        />
      </div>
    );
  }

  const Scope = showsProfileNav ? "div" : "span";
  const renderProfileNav = () => {
    if (!profileHistory?.length || !onJumpToHistory) {
      return (
        <button
          type="button"
          onClick={onProfileBack ?? onReturnToSearch ?? (() => onJumpToHistory?.(-1))}
          className="min-h-7 cursor-pointer text-[#A0A099] hover:text-[#EDEDE8] focus-visible:outline-music-accent"
        >
          {`← Back to ${returnsTo ?? "search"}`}
        </button>
      );
    }

    const directParent = profileHistory[profileHistory.length - 1];
    const directParentName = directParent.name || capitalize(directParent.target.kind);
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
            Search
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
            ← Search
          </button>
          {hasOverflow && (
            <>
              <span className="text-[#3A3A36]" aria-hidden="true">/</span>
              <span className="text-[#5A5A55] select-none" aria-hidden="true">…</span>
            </>
          )}
          {visibleAncestors.map(({ entry, index, isDirectParent }) => {
            const name = entry.name || capitalize(entry.target.kind);
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
      <Scope className={`font-mono text-[12px] text-[#5A5A55] whitespace-nowrap sm:mr-4 ${showsProfileNav ? "min-w-0 flex items-center" : ""}`}>
        {showsProfileNav ? (
          <nav aria-label="Profile navigation" className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            {renderProfileNav()}
          </nav>
        ) : (
          getScopeLabel()
        )}
        {syncError && mode !== 2 && (
          <span className="ml-2 text-[#FF6B6B]">
            {syncError}
          </span>
        )}
      </Scope>

      <div className={`flex items-center ${showsRanges ? "w-full sm:w-auto" : "overflow-x-auto scrollbar-hidden"} ${showsProfileNav ? "shrink-0" : ""}`}>
        {renderControls()}
      </div>
    </div>
  );
};
