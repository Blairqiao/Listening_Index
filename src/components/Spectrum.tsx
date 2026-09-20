"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { hexToHsv, hsvToHex, normalizeHex } from "@/lib/color-utils";
import {
  BAND_COUNT,
  LiveAudioSpectrumSource,
  SpectrumSource,
  SyntheticSpectrumSource,
} from "@/lib/spectrum-source";

/** Reserved strip under the baseline for the mirrored reflection, as a
 *  share of canvas height. The tab panel is much taller than the original
 *  ribbon strip, where a fixed 14px would read as a rounding error. */
function reflectHeight(h: number) {
  return Math.max(8, Math.min(40, h * 0.12));
}
/** How fast a peak cap slides back down, in band units per second. */
const PEAK_FALL = 0.55;
/** Display curve applied to bar heights only, never to the band data. A full
 *  tab panel is several times taller than the strip these levels were tuned
 *  against, so linear mapping leaves typical values hugging the floor. */
const DISPLAY_GAMMA = 0.6;

function barHeight(v: number, available: number) {
  return Math.max(2, Math.pow(Math.max(0, v), DISPLAY_GAMMA) * available);
}

export type SourceMode = "synthetic" | "live";

interface SpectrumProps {
  /** Identifies the current track so the synthetic pattern changes with it. */
  trackKey: string;
  /** True while a listening session is open; damps the bars when idle. */
  isLive: boolean;
  accentColor: string;
  /** Lets the page surface which source is driving the bars. */
  onSourceChange?: (source: SourceMode) => void;
}

/**
 * Three gradient stops derived from the accent: darker at the baseline,
 * brightening toward the top, so tall bars read as louder at a glance.
 */
function gradientStops(accent: string): [string, string, string] {
  const { h, s, v } = hexToHsv(normalizeHex(accent));
  return [
    hsvToHex(h, Math.min(100, s + 10), Math.max(30, v - 45)),
    hsvToHex(h, s, v),
    hsvToHex((h + 18) % 360, Math.max(0, s - 35), Math.min(100, v + 12)),
  ];
}

export const Spectrum: React.FC<SpectrumProps> = ({
  trackKey,
  isLive,
  accentColor,
  onSourceChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<SpectrumSource | null>(null);
  const syntheticRef = useRef<SyntheticSpectrumSource | null>(null);
  const bandsRef = useRef(new Float32Array(BAND_COUNT));
  const peaksRef = useRef(new Float32Array(BAND_COUNT));
  const accentRef = useRef(accentColor);
  const trackRef = useRef({ trackKey, isLive });
  const onSourceChangeRef = useRef(onSourceChange);

  const [mode, setMode] = useState<SourceMode>("synthetic");
  const [note, setNote] = useState<string | null>(null);

  accentRef.current = accentColor;
  trackRef.current = { trackKey, isLive };
  onSourceChangeRef.current = onSourceChange;

  // Keep the synthetic pattern in step with the track without restarting the
  // animation loop, which would reset every bar to zero.
  useEffect(() => {
    syntheticRef.current?.setTrack(trackKey, isLive);
  }, [trackKey, isLive]);

  const revertToSynthetic = useCallback(() => {
    const { trackKey: key, isLive: live } = trackRef.current;
    sourceRef.current?.stop();
    const synthetic = new SyntheticSpectrumSource(key, live);
    syntheticRef.current = synthetic;
    sourceRef.current = synthetic;
    setMode("synthetic");
    onSourceChangeRef.current?.("synthetic");
  }, []);

  const enableLiveAudio = useCallback(async () => {
    try {
      const live = await LiveAudioSpectrumSource.create();
      live.onEnded(() => {
        setNote(null);
        revertToSynthetic();
      });
      sourceRef.current?.stop();
      sourceRef.current = live;
      syntheticRef.current = null;
      setMode("live");
      setNote(null);
      onSourceChangeRef.current?.("live");
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      const message = err instanceof Error ? err.message : "";
      if (name === "NotAllowedError") {
        setNote("AUDIO SHARE DECLINED");
      } else if (message === "NO_AUDIO_TRACK") {
        setNote("NO AUDIO IN THAT SHARE");
      } else {
        setNote("AUDIO CAPTURE UNAVAILABLE");
      }
    }
  }, [revertToSynthetic]);

  const toggleMode = useCallback(() => {
    if (mode === "live") {
      setNote(null);
      revertToSynthetic();
    } else {
      void enableLiveAudio();
    }
  }, [mode, enableLiveAudio, revertToSynthetic]);

  // Animation loop. Mounted once: the source swaps behind a ref so changing
  // modes never tears down the canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { trackKey: key, isLive: live } = trackRef.current;
    const synthetic = new SyntheticSpectrumSource(key, live);
    syntheticRef.current = synthetic;
    sourceRef.current = synthetic;

    let raf = 0;
    let last = performance.now();
    let cssWidth = 0;
    let cssHeight = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      cssWidth = canvas.clientWidth;
      cssHeight = canvas.clientHeight;
      if (!cssWidth || !cssHeight) return false;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const dpr = window.devicePixelRatio || 1;
      if (!cssWidth || Math.abs(canvas.width - cssWidth * dpr) > 1) {
        if (!resize()) {
          raf = requestAnimationFrame(frame);
          return;
        }
      }

      const bands = bandsRef.current;
      const peaks = peaksRef.current;
      sourceRef.current?.read(bands, dt);

      const w = cssWidth;
      const h = cssHeight;
      ctx.clearRect(0, 0, w, h);

      const reflect = reflectHeight(h);
      const baseY = h - reflect;
      const gap = 3;
      const bw = Math.max(2, (w - gap * (BAND_COUNT - 1)) / BAND_COUNT);
      const [c1, c2, c3] = gradientStops(accentRef.current);
      const grad = ctx.createLinearGradient(0, baseY, 0, 2);
      grad.addColorStop(0, c1);
      grad.addColorStop(0.55, c2);
      grad.addColorStop(1, c3);

      for (let i = 0; i < BAND_COUNT; i++) {
        const v = bands[i];
        const x = i * (bw + gap);
        const bh = barHeight(v, baseY);

        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.25 + v * 0.75;
        roundRect(ctx, x, baseY - bh, bw, bh, Math.min(3, bw / 2));
        ctx.fill();

        // Mirrored reflection, kept inside the reserved strip.
        ctx.globalAlpha = 0.1 + v * 0.12;
        roundRect(
          ctx,
          x,
          baseY + 2,
          bw,
          Math.min(reflect - 2, bh * 0.35),
          Math.min(3, bw / 2)
        );
        ctx.fill();

        // Falling peak cap.
        peaks[i] = v >= peaks[i] ? v : Math.max(v, peaks[i] - PEAK_FALL * dt);
        if (peaks[i] > 0.02) {
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = "#EDEDE8";
          roundRect(ctx, x, baseY - barHeight(peaks[i], baseY) - 3, bw, 2, 1);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // Browsers throttle rAF in hidden tabs, which leaves dt huge on return.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      sourceRef.current?.stop();
      sourceRef.current = null;
      syntheticRef.current = null;
    };
    // Mount-only: track changes reach the source through the effect above.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section
      aria-label="Audio spectrum visualizer"
      className="h-full min-h-[320px] md:min-h-0 flex flex-col border border-[#1C1C1A] bg-[#080808] px-3.5 sm:px-4 pt-2.5 pb-3 select-none"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
          SPECTRUM
        </span>
        <div className="flex items-center gap-3">
          {note && (
            <span className="font-mono text-[10px] tracking-[0.1em] text-[#8A6A2A]">
              {note}
            </span>
          )}
          <button
            type="button"
            onClick={toggleMode}
            aria-pressed={mode === "live"}
            title={
              mode === "live"
                ? "Stop reading shared audio"
                : "Share a tab or screen with audio to drive the bars from real sound"
            }
            className={`font-mono text-[10px] tracking-[0.14em] px-2 py-0.5 border transition-colors ${
              mode === "live"
                ? "border-music-accent text-music-accent"
                : "border-[#1C1C1A] text-[#5A5A55] hover:text-[#EDEDE8] hover:border-[#5A5A55]"
            }`}
          >
            {mode === "live" ? "[ LIVE AUDIO ]" : "[ USE LIVE AUDIO ]"}
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="block w-full flex-1 min-h-0"
      />
    </section>
  );
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}
