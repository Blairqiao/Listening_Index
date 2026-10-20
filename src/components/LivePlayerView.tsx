"use client";

import React, { useCallback, useState } from "react";
import { useConfig } from "@/context/ConfigContext";
import { usePlayer } from "@/context/PlayerContext";
import { formatDurationMs } from "@/lib/format-utils";
import { SpectrumCanvas, gradientStops } from "./live-player-view/SpectrumCanvas";

export { gradientStops };

export interface LivePlayerProps {
  latestPlay?: {
    title: string;
    artist: string;
    album: string;
    albumImageUrl?: string | null;
    durationMs?: number;
    duration?: string;
  } | null;
  initialTrack?: {
    name: string;
    artist: string;
    album: string;
    imageUrl?: string;
    durationMs: number;
  };
  sourceMode?: "synthetic" | "live";
  onToggleSourceMode?: () => void;
}

export const DEFAULT_FALLBACK_TRACK = {
  name: "Weird Fishes / Arpeggi",
  artist: "Radiohead",
  album: "In Rainbows",
  imageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
  durationMs: 318000,
};

export function clockToMs(clock?: string | null): number {
  if (!clock) return 0;
  const parts = clock.split(":").map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return (parts[0] * 60 + parts[1]) * 1000;
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  return 0;
}

export interface DisplayTrackParams {
  currentTrack?: {
    id?: string | null;
    name?: string;
    artists?: Array<{ name: string }>;
    album?: { name?: string; images?: Array<{ url: string }> };
  } | null;
  duration?: number;
  latestPlay?: {
    id?: string;
    trackId?: string;
    title?: string;
    artist?: string;
    album?: string;
    albumImageUrl?: string | null;
    durationMs?: number;
    duration?: string;
  } | null;
  initialTrack?: {
    id?: string;
    name?: string;
    artist?: string;
    album?: string;
    imageUrl?: string;
    durationMs?: number;
  } | null;
}

export function resolveDisplayTrack(params: DisplayTrackParams) {
  const { currentTrack, duration = 0, latestPlay, initialTrack } = params;
  return {
    trackId: currentTrack?.id || latestPlay?.trackId || initialTrack?.id || null,
    name:
      currentTrack?.name ||
      latestPlay?.title ||
      initialTrack?.name ||
      DEFAULT_FALLBACK_TRACK.name,
    artist:
      currentTrack?.artists?.map((a) => a.name).join(", ") ||
      latestPlay?.artist ||
      initialTrack?.artist ||
      DEFAULT_FALLBACK_TRACK.artist,
    album:
      currentTrack?.album?.name ||
      latestPlay?.album ||
      initialTrack?.album ||
      DEFAULT_FALLBACK_TRACK.album,
    imageUrl:
      currentTrack?.album?.images?.[0]?.url ||
      latestPlay?.albumImageUrl ||
      initialTrack?.imageUrl ||
      DEFAULT_FALLBACK_TRACK.imageUrl,
    durationMs:
      (duration > 0 ? duration : undefined) ||
      latestPlay?.durationMs ||
      (latestPlay?.duration ? clockToMs(latestPlay.duration) : undefined) ||
      initialTrack?.durationMs ||
      DEFAULT_FALLBACK_TRACK.durationMs,
  };
}

export const msToClock = formatDurationMs;

export const LivePlayerView: React.FC<LivePlayerProps> = ({
  latestPlay,
  initialTrack,
  sourceMode: externalSourceMode,
  onToggleSourceMode,
}) => {
  const config = useConfig().config;
  const {
    playerStatus,
    errorMessage,
    isLinked,
    activeDevice,
    currentTrack,
    position,
    duration,
    isPlaying,
    volume,
    shuffle,
    repeatMode,
    checkTokenStatus,
    handleTransferPlayback,
    handleTogglePlay,
    handlePrevious,
    handleNext,
    handleSeek,
    handleVolume,
    handleToggleShuffle,
    handleCycleRepeat,
    selectedContext,
    selectContext,
    userPlaylists,
  } = usePlayer();

  const [isContextSelectorOpen, setIsContextSelectorOpen] = useState(false);
  const [internalSourceMode, setInternalSourceMode] = useState<"synthetic" | "live">("synthetic");
  const sourceMode = externalSourceMode ?? internalSourceMode;
  const toggleSourceMode = onToggleSourceMode ?? useCallback(() => {
    setInternalSourceMode((m) => (m === "synthetic" ? "live" : "synthetic"));
  }, []);

  // const handleToggleLayout = useCallback(() => {
  //   const next = config.livePlayerLayout === "stacked" ? "split" : "stacked";
  //   updateConfig({ livePlayerLayout: next });
  //   void fetch("/api/config", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ livePlayerLayout: next }),
  //   }).catch(() => { });
  // }, [config.livePlayerLayout, updateConfig]);

  const displayTrack = resolveDisplayTrack({
    currentTrack,
    duration,
    latestPlay,
    initialTrack,
  });

  const repeatLabel =
    repeatMode === 2 ? "[REP: 1]" : repeatMode === 1 ? "[REP: ALL]" : "[REP: OFF]";

  // Shared Player Deck Component
  const renderDeck = (isStacked = false) => (
    <div className={`flex flex-col justify-between space-y-4 ${isStacked ? "" : "md:border-r md:border-[#1C1C1A] md:pr-5"}`}>
      {/* Top Deck Info */}
      <div className="flex items-center gap-4">
        <div className="w-[100px] sm:w-[120px] aspect-square shrink-0 border border-[#1C1C1A] bg-[#121210] overflow-hidden">
          {displayTrack.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayTrack.imageUrl}
              alt={displayTrack.album}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#5A5A55] text-[10px]">
              NO ART
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-music-accent tracking-[0.16em] uppercase">
              {isPlaying ? "NOW STREAMING" : isLinked ? "PAUSED" : "OFFLINE"}
            </span>
          </div>
          <div className="text-[16px] sm:text-[18px] text-[#EDEDE8] truncate font-bold mt-0.5">
            {displayTrack.name}
          </div>
          <div className="text-[12px] text-[#8A8A82] truncate mt-0.5">
            {displayTrack.artist}
          </div>
          <div className="text-[11px] text-[#5A5A55] truncate mt-0.5">
            {displayTrack.album}
          </div>
        </div>
      </div>

      {/* Device & Playback Context Row */}
      <div className="text-[10px] tracking-[0.12em] py-1 border-y border-[#161614] flex flex-wrap items-center justify-between gap-2 min-h-[30px] font-mono relative">
        {/* Left Side: Connection & Device State */}
        <div className="flex items-center gap-2 min-w-0">
          {playerStatus === "checking" && (
            <span className="text-[#5A5A55]">[ CHECKING CONNECTION... ]</span>
          )}

          {playerStatus === "unlinked" && (
            <span className="text-[#8A8A82] truncate">
              [ SPOTIFY NOT LINKED · OPEN MODAL (S) ]
            </span>
          )}

          {playerStatus === "connecting" && (
            <span className="text-[#5A5A55]">[ CONNECTING TO SPOTIFY... ]</span>
          )}

          {playerStatus === "ready" && (
            <div className="flex items-center gap-2">
              <span className="text-music-accent">
                {activeDevice?.isThisBrowser
                  ? "[ DEVICE: LISTENING INDEX · ACTIVE ]"
                  : `[ LISTENING ON: ${activeDevice?.name?.toUpperCase() || "EXTERNAL"} ]`}
              </span>
              {activeDevice && !activeDevice.isThisBrowser && (
                <button
                  type="button"
                  onClick={() => void handleTransferPlayback()}
                  className="px-2 py-0.5 border border-music-accent text-music-accent hover:bg-music-accent/10 bg-transparent cursor-pointer"
                >
                  [ TRANSFER HERE ]
                </button>
              )}
            </div>
          )}

          {playerStatus === "error" && (
            <div className="flex items-center gap-2">
              <span className="text-[#FF6B6B] truncate max-w-[160px] sm:max-w-[220px]">
                {errorMessage || "[ PLAYER ERROR ]"}
              </span>
              <button
                type="button"
                onClick={() => void checkTokenStatus()}
                className="px-2 py-0.5 border border-[#22221E] text-[#8A8A82] hover:text-[#EDEDE8] bg-transparent cursor-pointer"
              >
                [ RETRY ]
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Playback Context Selector */}
        <div className="flex items-center gap-1.5 shrink-0 relative">
          <span className="text-[#6A6A64] uppercase font-bold shrink-0">
            CONTEXT:
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsContextSelectorOpen((prev) => !prev)}
              className="px-2 py-0.5 border border-[#22221E] text-music-accent hover:border-music-accent hover:bg-music-accent/10 bg-[#0E0E0D] cursor-pointer transition-colors flex items-center gap-1.5 uppercase font-mono max-w-[220px] sm:max-w-[300px] truncate"
              title="Select playback context (Auto Play or user playlist)"
            >
              <span className="truncate">
                {selectedContext.type === "auto"
                  ? "[⚡ AUTO PLAY · RECENT FAVORITES]"
                  : `[♫ ${selectedContext.name.toUpperCase()}]`}
              </span>
              <span className="text-[8px] text-[#6A6A64]">▼</span>
            </button>

            {isContextSelectorOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsContextSelectorOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-30 w-[280px] sm:w-[320px] bg-[#0E0E0D] border border-[#26261F] shadow-2xl py-1 max-h-[220px] overflow-y-auto scrollbar-hidden font-mono text-[10px]">
                  <div className="px-2.5 py-1 text-[#6A6A64] text-[9px] uppercase tracking-wider border-b border-[#1A1A18]">
                    CHOOSE PLAYBACK CONTEXT
                  </div>

                  {/* Auto Play option */}
                  <button
                    type="button"
                    onClick={() => {
                      void selectContext({ type: "auto", name: "Recent Favorites" });
                      setIsContextSelectorOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between hover:bg-[#1A1A18] cursor-pointer transition-colors ${
                      selectedContext.type === "auto" ? "text-music-accent font-bold bg-music-accent/5" : "text-[#EDEDE8]"
                    }`}
                  >
                    <div className="truncate">
                      <span>[⚡ AUTO PLAY]</span>
                      <span className="text-[#6A6A64] ml-1.5 text-[9px]">RECENT FAVORITES (TOP 100)</span>
                    </div>
                    {selectedContext.type === "auto" && <span className="text-music-accent text-[9px]">[ACTIVE]</span>}
                  </button>

                  {/* Playlists section */}
                  {userPlaylists.length > 0 && (
                    <>
                      <div className="px-2.5 py-1 text-[#6A6A64] text-[9px] uppercase tracking-wider border-t border-b border-[#1A1A18] mt-1">
                        SPOTIFY PLAYLISTS ({userPlaylists.length})
                      </div>
                      {userPlaylists.map((pl) => {
                        const isSelected = selectedContext.type === "playlist" && selectedContext.uri === pl.uri;
                        return (
                          <button
                            key={pl.id}
                            type="button"
                            onClick={() => {
                              void selectContext({ type: "playlist", name: pl.name, uri: pl.uri });
                              setIsContextSelectorOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between hover:bg-[#1A1A18] cursor-pointer transition-colors ${
                              isSelected ? "text-music-accent font-bold bg-music-accent/5" : "text-[#EDEDE8]"
                            }`}
                          >
                            <span className="truncate pr-2">
                              [♫ {pl.name.toUpperCase()}]
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0 text-[9px] text-[#6A6A64]">
                              <span>{pl.trackCount} tracks</span>
                              {isSelected && <span className="text-music-accent">[ACTIVE]</span>}
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Scrubber */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-[#5A5A55] tabular-nums">
          <span>{msToClock(position)}</span>
          <span>{msToClock(displayTrack.durationMs)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={displayTrack.durationMs}
          value={position}
          onChange={(e) => handleSeek(Number(e.target.value))}
          className="w-full accent-[var(--music-accent)] cursor-pointer h-1.5 bg-[#1C1C1A]"
        />
      </div>

      {/* Transport & Volume Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-[#161614] text-[11px] gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handlePrevious}
            className="px-2 py-0.5 border border-[#22221E] text-[#8A8A82] hover:text-[#EDEDE8] hover:border-[#3A3A32] bg-transparent cursor-pointer select-none transition-colors"
          >
            [PREV]
          </button>

          <button
            type="button"
            onClick={() => void handleTogglePlay()}
            className={`px-2 py-0.5 border transition-colors cursor-pointer select-none ${
              isPlaying
                ? "border-music-accent text-music-accent hover:bg-music-accent/10 font-bold"
                : "border-[#22221E] text-[#8A8A82] hover:text-[#EDEDE8] hover:border-[#3A3A32]"
            } bg-transparent`}
          >
            {isPlaying ? "[PAUSE]" : "[PLAY]"}
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="px-2 py-0.5 border border-[#22221E] text-[#8A8A82] hover:text-[#EDEDE8] hover:border-[#3A3A32] bg-transparent cursor-pointer select-none transition-colors"
          >
            [NEXT]
          </button>

          <button
            type="button"
            onClick={() => void handleToggleShuffle()}
            className={`px-2 py-0.5 border transition-colors cursor-pointer select-none ${
              shuffle
                ? "border-music-accent text-music-accent font-bold"
                : "border-[#22221E] text-[#8A8A82] hover:text-[#EDEDE8] hover:border-[#3A3A32]"
            } bg-transparent`}
            title="Toggle Shuffle"
          >
            [SHUFFLE]
          </button>

          <button
            type="button"
            onClick={() => void handleCycleRepeat()}
            className={`px-2 py-0.5 border transition-colors cursor-pointer select-none ${
              repeatMode > 0
                ? "border-music-accent text-music-accent font-bold"
                : "border-[#22221E] text-[#8A8A82] hover:text-[#EDEDE8] hover:border-[#3A3A32]"
            } bg-transparent`}
            title="Cycle Repeat Mode"
          >
            {repeatLabel}
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-[#5A5A55] shrink-0 font-mono">
          <span className="tracking-wider">VOL</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => handleVolume(Number(e.target.value))}
            className="w-[60px] accent-[var(--music-accent)] cursor-pointer h-1 bg-[#1C1C1A]"
          />
        </div>
      </div>
    </div>
  );

  // Layout 1: Variant B (Split Console)
  if (config.livePlayerLayout === "split") {
    return (
      <section aria-label="Variant B: Split Console" className="font-mono">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 border border-[#1C1C1A] bg-[#080808] p-4 sm:p-5 select-none font-mono">
          {/* Left Side: Deck & Track Info (5 cols) */}
          <div className="md:col-span-5">{renderDeck(false)}</div>

          {/* Right Side: Spectrum Tower (7 cols) - Hidden on mobile (< 768px) */}
          <div className="hidden md:flex md:col-span-7 flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] tracking-[0.14em] text-[#5A5A55] mb-2">
              <span>SPECTRUM VISUALIZER · 32 BANDS</span>
              <button
                type="button"
                onClick={toggleSourceMode}
                className="font-mono text-[10px] tracking-[0.14em] bg-transparent border-0 cursor-pointer p-0 text-music-accent hover:text-[#EDEDE8] focus-visible:outline-none focus-visible:text-music-accent transition-colors"
                title="Click to toggle visualizer audio source (synthetic oscillator vs live hardware audio)"
              >
                {sourceMode === "live" ? "[ LIVE AUDIO ]" : "[ SYNTHETIC ]"}
              </button>
            </div>
            <SpectrumCanvas
              trackKey={displayTrack.name}
              isLive={isPlaying}
              accentColor={config.accentColor}
              sourceMode={sourceMode}
              onToggleSource={toggleSourceMode}
              heightClass="h-[180px] sm:h-[220px] md:h-[240px]"
            />
          </div>
        </div>
      </section>
    );
  }

  // Layout 2: Variant A (Stacked Stage)
  return (
    <section aria-label="Variant A: Stacked Stage" className="space-y-3 font-mono">
      {/* Top Section: Spectrum Stage - Hidden on mobile (< 768px) */}
      <div className="hidden md:block border border-[#1C1C1A] bg-[#080808] p-3 sm:p-4 select-none">
        <div className="flex items-center justify-between text-[10px] tracking-[0.14em] text-[#5A5A55] mb-2">
          <span>SPECTRUM VISUALIZER · 32 BANDS</span>
          <button
            type="button"
            onClick={toggleSourceMode}
            className="font-mono text-[10px] tracking-[0.14em] bg-transparent border-0 cursor-pointer p-0 text-music-accent hover:text-[#EDEDE8] focus-visible:outline-none focus-visible:text-music-accent transition-colors"
            title="Click to toggle visualizer audio source (synthetic oscillator vs live hardware audio)"
          >
            {sourceMode === "live" ? "[ LIVE AUDIO ]" : "[ SYNTHETIC ]"}
          </button>
        </div>
        <SpectrumCanvas
          trackKey={displayTrack.name}
          isLive={isPlaying}
          accentColor={config.accentColor}
          sourceMode={sourceMode}
          onToggleSource={toggleSourceMode}
          heightClass="h-[120px] sm:h-[140px] md:h-[160px]"
        />
      </div>

      {/* Bottom Section: Deck & Transport Console */}
      <div className="border border-[#1C1C1A] bg-[#080808] p-4 sm:p-5 select-none font-mono">
        {renderDeck(true)}
      </div>
    </section>
  );
};
