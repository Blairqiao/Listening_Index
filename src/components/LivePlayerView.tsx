"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import { useConfig } from "@/context/ConfigContext";
import { usePlayer } from "@/context/PlayerContext";
import { hexToHsv, hsvToHex, normalizeHex } from "@/lib/color-utils";
import {
  BAND_COUNT,
  LiveAudioSpectrumSource,
  SpectrumSource,
  SyntheticSpectrumSource,
} from "@/lib/spectrum-source";

export interface LivePlayerProps {
  latestPlay?: {
    title: string;
    artist: string;
    album: string;
    albumImageUrl?: string | null;
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

const DEFAULT_FALLBACK_TRACK = {
  name: "Starless",
  artist: "King Crimson",
  album: "Red",
  imageUrl: "https://i.scdn.co/image/ab67616d0000b2734a7428cead5a49479b8c0a87",
  durationMs: 738000,
};

export function msToClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function gradientStops(accent: string): [string, string, string] {
  const { h, s, v } = hexToHsv(normalizeHex(accent));
  return [
    hsvToHex(h, Math.min(100, s + 10), Math.max(30, v - 45)),
    hsvToHex(h, s, v),
    hsvToHex((h + 18) % 360, Math.max(0, s - 35), Math.min(100, v + 12)),
  ];
}

/**
 * Reusable Canvas Visualizer component
 */
const SpectrumCanvas: React.FC<{
  trackKey: string;
  isLive: boolean;
  accentColor: string;
  sourceMode: "synthetic" | "live";
  onToggleSource: () => void;
  className?: string;
  heightClass?: string;
}> = ({
  trackKey,
  isLive,
  accentColor,
  sourceMode,
  onToggleSource,
  className = "",
  heightClass = "h-[220px]",
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sourceRef = useRef<SpectrumSource | null>(null);
    const syntheticRef = useRef<SyntheticSpectrumSource | null>(null);
    const liveRef = useRef<LiveAudioSpectrumSource | null>(null);
    const bandsRef = useRef(new Float32Array(BAND_COUNT));
    const peaksRef = useRef(new Float32Array(BAND_COUNT));
    const accentRef = useRef(accentColor);
    accentRef.current = accentColor;

    const trackRef = useRef({ trackKey, isLive });
    trackRef.current = { trackKey, isLive };

    useEffect(() => {
      syntheticRef.current?.setTrack(trackKey, isLive);
    }, [trackKey, isLive]);

    // Handle switching between synthetic and live audio modes
    useEffect(() => {
      let cancelled = false;

      if (sourceMode === "live") {
        void (async () => {
          try {
            const live = await LiveAudioSpectrumSource.create();
            if (cancelled) {
              live.stop();
              return;
            }
            live.onEnded(() => {
              onToggleSource();
            });
            sourceRef.current?.stop();
            liveRef.current = live;
            sourceRef.current = live;
            syntheticRef.current = null;
          } catch (e) {
            console.warn("[SPECTRUM] Live audio stream declined or unavailable:", e);
            if (!cancelled) onToggleSource();
          }
        })();
      } else {
        sourceRef.current?.stop();
        liveRef.current = null;
        const { trackKey: k, isLive: l } = trackRef.current;
        const synthetic = new SyntheticSpectrumSource(k, l);
        syntheticRef.current = synthetic;
        sourceRef.current = synthetic;
      }

      return () => {
        cancelled = true;
        sourceRef.current?.stop();
      };
    }, [sourceMode, onToggleSource]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let raf = 0;
      let last = performance.now();
      let cssWidth = 0;
      let cssHeight = 0;
      let lastAccent = "";
      let stops: [string, string, string] = gradientStops(accentRef.current);

      const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        cssWidth = canvas.clientWidth;
        cssHeight = canvas.clientHeight;
        if (
          canvas.width !== Math.floor(cssWidth * dpr) ||
          canvas.height !== Math.floor(cssHeight * dpr)
        ) {
          canvas.width = Math.floor(cssWidth * dpr);
          canvas.height = Math.floor(cssHeight * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);

      const frame = (now: number) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;

        const source = sourceRef.current;
        const bands = bandsRef.current;
        const peaks = peaksRef.current;
        if (source) source.read(bands, dt);

        if (accentRef.current !== lastAccent) {
          lastAccent = accentRef.current;
          stops = gradientStops(lastAccent);
        }

        ctx.clearRect(0, 0, cssWidth, cssHeight);
        if (cssWidth <= 0 || cssHeight <= 0) {
          raf = requestAnimationFrame(frame);
          return;
        }

        const reflectH = Math.max(8, Math.min(30, cssHeight * 0.12));
        const baseline = cssHeight - reflectH;
        const availableH = baseline - 8;

        const gap = 3;
        const barW = Math.max(2, (cssWidth - gap * (BAND_COUNT - 1)) / BAND_COUNT);

        const grad = ctx.createLinearGradient(0, baseline, 0, 8);
        grad.addColorStop(0, stops[0]);
        grad.addColorStop(0.55, stops[1]);
        grad.addColorStop(1, stops[2]);

        const reflGrad = ctx.createLinearGradient(0, baseline, 0, cssHeight);
        reflGrad.addColorStop(0, stops[0] + "55");
        reflGrad.addColorStop(1, "transparent");

        ctx.fillStyle = grad;
        for (let i = 0; i < BAND_COUNT; i++) {
          const v = bands[i];
          const h = Math.max(2, Math.pow(Math.max(0, v), 0.85) * availableH);
          const x = i * (barW + gap);
          ctx.fillRect(x, baseline - h, barW, h);

          if (v > peaks[i]) {
            peaks[i] = v;
          } else {
            peaks[i] = Math.max(0, peaks[i] - 0.55 * dt);
          }
          const peakY = baseline - Math.max(2, Math.pow(peaks[i], 0.85) * availableH);
          ctx.fillStyle = stops[2];
          ctx.fillRect(x, peakY - 1, barW, 1.5);
          ctx.fillStyle = grad;
        }

        // Reflection
        ctx.fillStyle = reflGrad;
        for (let i = 0; i < BAND_COUNT; i++) {
          const v = bands[i];
          const h = Math.max(2, Math.pow(Math.max(0, v), 0.85) * reflectH);
          const x = i * (barW + gap);
          ctx.fillRect(x, baseline, barW, h);
        }

        // Baseline separator line
        ctx.strokeStyle = "#1C1C1A";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, baseline + 0.5);
        ctx.lineTo(cssWidth, baseline + 0.5);
        ctx.stroke();

        raf = requestAnimationFrame(frame);
      };

      raf = requestAnimationFrame(frame);

      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
      };
    }, []);

    return (
      <div
        className={`relative border border-[#1C1C1A] bg-[#0A0A09] ${heightClass} ${className} overflow-hidden select-none`}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    );
  };

export const LivePlayerView: React.FC<LivePlayerProps> = ({
  latestPlay,
  initialTrack,
  sourceMode: externalSourceMode,
  onToggleSourceMode,
}) => {
  const { config, updateConfig } = useConfig();
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
  } = usePlayer();

  const [internalSourceMode, setInternalSourceMode] = useState<"synthetic" | "live">("synthetic");
  const sourceMode = externalSourceMode ?? internalSourceMode;
  const toggleSourceMode = onToggleSourceMode ?? useCallback(() => {
    setInternalSourceMode((m) => (m === "synthetic" ? "live" : "synthetic"));
  }, []);

  const handleToggleLayout = useCallback(() => {
    const next = config.livePlayerLayout === "stacked" ? "split" : "stacked";
    updateConfig({ livePlayerLayout: next });
    void fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ livePlayerLayout: next }),
    }).catch(() => { });
  }, [config.livePlayerLayout, updateConfig]);

  const displayTrack = {
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
    durationMs: duration || DEFAULT_FALLBACK_TRACK.durationMs,
  };

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

      {/* Connection & Device State Banner */}
      <div className="text-[10px] tracking-[0.12em] py-1 border-y border-[#161614] flex items-center justify-between min-h-[30px]">
        {playerStatus === "checking" && (
          <span className="text-[#5A5A55]">[ CHECKING CONNECTION... ]</span>
        )}

        {playerStatus === "unlinked" && (
          <span className="text-[#8A8A82]">[ UNLINKED ]</span>
        )}

        {playerStatus === "connecting" && (
          <span className="text-[#5A5A55]">[ CONNECTING TO SPOTIFY... ]</span>
        )}

        {playerStatus === "ready" && (
          <div className="flex items-center justify-between w-full">
            <span className="text-music-accent">
              {activeDevice?.isThisBrowser
                ? "[ DEVICE: LISTENING INDEX · ACTIVE ]"
                : `[ REMOTE: ${activeDevice?.name?.toUpperCase() || "EXTERNAL"} ]`}
            </span>
            <div className="flex items-center gap-2">
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
          </div>
        )}

        {playerStatus === "error" && (
          <div className="flex items-center justify-between w-full">
            <span className="text-[#FF6B6B] truncate max-w-[200px] sm:max-w-[260px]">
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
          heightClass="h-[180px] sm:h-[220px]"
        />
      </div>

      {/* Bottom Section: Deck & Transport Console */}
      <div className="border border-[#1C1C1A] bg-[#080808] p-4 sm:p-5 select-none font-mono">
        {renderDeck(true)}
      </div>
    </section>
  );
};
