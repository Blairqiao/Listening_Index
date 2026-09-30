"use client";

import React from "react";
import type { NowPlaying } from "@/app/api/now-playing/route";

interface NowPlayingBarProps {
  data: NowPlaying | null;
  progressMs: number;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * The owner's live Spotify playback, shown on every tab. Hidden entirely when
 * no credentials are configured, so a fresh clone looks the same as before.
 */
export const NowPlayingBar: React.FC<NowPlayingBarProps> = ({ data, progressMs }) => {
  if (!data || !data.configured) return null;

  const track = data.track;
  const duration = track?.durationMs ?? 0;
  const pct = duration ? Math.min(100, (progressMs / duration) * 100) : 0;

  return (
    <section
      aria-label="Now playing"
      className="flex items-center gap-3 sm:gap-4 border border-[#1C1C1A] bg-[#080808] px-3 py-2.5 mb-1 sm:mb-1.5 select-none"
    >
      {track?.albumImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.albumImageUrl}
          alt=""
          className="w-11 h-11 sm:w-12 sm:h-12 object-cover border border-[#1C1C1A] shrink-0"
        />
      ) : (
        <div className="w-11 h-11 sm:w-12 sm:h-12 border border-[#1C1C1A] shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.14em]">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              data.isPlaying ? "bg-music-accent animate-pulse" : "bg-[#5A5A55]"
            }`}
          />
          <span className={data.isPlaying ? "text-music-accent" : "text-[#5A5A55]"}>
            {track ? (data.isPlaying ? "NOW PLAYING" : "PAUSED") : "NOTHING PLAYING"}
          </span>
        </div>

        {track ? (
          <>
            <div className="flex items-baseline gap-2 min-w-0 mt-0.5">
              {track.url ? (
                <a
                  href={track.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[13px] sm:text-[14px] text-[#EDEDE8] truncate hover:text-music-accent"
                >
                  {track.name}
                </a>
              ) : (
                <span className="font-mono text-[13px] sm:text-[14px] text-[#EDEDE8] truncate">
                  {track.name}
                </span>
              )}
              <span className="font-mono text-[11px] text-[#8A8A82] truncate hidden sm:inline">
                {track.artists}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="font-mono text-[10px] text-[#5A5A55] tabular-nums w-[32px]">
                {clock(progressMs)}
              </span>
              <div className="flex-1 h-[2px] bg-[#1C1C1A]">
                <div className="h-full bg-music-accent" style={{ width: `${pct}%` }} />
              </div>
              <span className="font-mono text-[10px] text-[#5A5A55] tabular-nums w-[32px] text-right">
                {clock(duration)}
              </span>
            </div>
          </>
        ) : (
          <div className="font-mono text-[12px] text-[#5A5A55] mt-0.5">
            Nothing is playing on Spotify right now.
          </div>
        )}
      </div>
    </section>
  );
};
