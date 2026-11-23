"use client";

import React from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Artwork } from "@/components/Artwork";
import { SyncStatus, type SyncStatusProps } from "./SyncStatus";

export interface MiniPlayerBarProps {
  track: { name: string; artist: string; imageUrl: string | null; id: string | null };
  isPlaying: boolean;
  progress: number;            // 0..1
  controlsDisabled: boolean;   // Spotify SDK connection is not ready
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onOpenPlayer: () => void;    // switches to Mode 3
  /** The footer's sync status, which this bar replaces while it shows. */
  sync?: Omit<SyncStatusProps, "compact">;
}

export const MiniPlayerBar: React.FC<MiniPlayerBarProps> = ({
  track,
  isPlaying,
  progress,
  controlsDisabled,
  onTogglePlay,
  onPrevious,
  onNext,
  onOpenPlayer,
  sync,
}) => {
  const clampedProgress = Math.min(1, Math.max(0, progress));

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 h-[56px] border-t border-[#1C1C1A] bg-[#080808]">
      {/* 2px Progress line along top edge */}
      <div
        className="absolute top-0 left-0 h-[2px] bg-music-accent pointer-events-none transition-all duration-150"
        style={{ width: `${clampedProgress * 100}%` }}
        aria-hidden="true"
      />

      {/* Inner row matching horizontal padding of <main>. From sm up, three columns
          keep the transport centered however long the title or sync label gets. */}
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 md:px-10 h-full flex items-center justify-between gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr]">
        {/* Track info & button to open live player */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Artwork
            src={track.imageUrl}
            alt={track.name || "Track artwork"}
            size={40}
            className="shrink-0"
          />
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <button
              type="button"
              onClick={onOpenPlayer}
              aria-label="Open Live Player"
              title="Open Live Player"
              className="min-w-0 max-w-full flex flex-col items-start text-left bg-transparent border-0 p-0 cursor-pointer overflow-hidden focus-visible:outline-music-accent hover:opacity-90 transition-opacity"
            >
              <span className="w-full truncate text-[13px] font-medium text-[#EDEDE8] leading-tight">
                {track.name}
              </span>
              <span
                className={`w-full truncate text-[11px] text-[#8A8A82] leading-tight mt-0.5 ${sync ? "hidden sm:block" : ""}`}
              >
                {track.artist}
              </span>
            </button>
            {/* Phones: no room for a third column, so the sync shares the artist line */}
            {sync && (
              <div className="sm:hidden flex items-baseline gap-1.5 text-[11px] leading-tight mt-0.5 min-w-0">
                <span className="truncate text-[#8A8A82]">{track.artist}</span>
                <span className="text-[#3A3A36] shrink-0" aria-hidden="true">·</span>
                <span className="shrink-0 text-[11px] [&_button]:text-[11px]">
                  <SyncStatus {...sync} compact />
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Transport controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onPrevious}
            disabled={controlsDisabled}
            aria-label="Previous"
            title="Previous"
            className="p-2 border border-[#22221E] text-[#8A8A82] hover:text-[#EDEDE8] hover:border-[#3A3A32] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[#8A8A82] disabled:hover:border-[#22221E] bg-transparent cursor-pointer select-none transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            disabled={controlsDisabled}
            aria-label={isPlaying ? "Pause" : "Play"}
            title={isPlaying ? "Pause" : "Play"}
            className={`p-2 border transition-colors cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#22221E] disabled:hover:text-[#8A8A82] ${
              isPlaying
                ? "border-music-accent text-music-accent hover:bg-music-accent/10"
                : "border-[#22221E] text-[#8A8A82] hover:text-[#EDEDE8] hover:border-[#3A3A32]"
            } bg-transparent`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={controlsDisabled}
            aria-label="Next"
            title="Next"
            className="p-2 border border-[#22221E] text-[#8A8A82] hover:text-[#EDEDE8] hover:border-[#3A3A32] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[#8A8A82] disabled:hover:border-[#22221E] bg-transparent cursor-pointer select-none transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Desktop: sync status on the right, where the footer had it */}
        {sync ? (
          <div className="hidden sm:flex items-center justify-end min-w-0">
            <SyncStatus {...sync} />
          </div>
        ) : (
          <div className="hidden sm:block" aria-hidden="true" />
        )}
      </div>
    </div>
  );
};
