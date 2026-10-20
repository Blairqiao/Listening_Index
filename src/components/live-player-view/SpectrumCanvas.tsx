import React, { useRef, useEffect } from "react";
import {
  BAND_COUNT,
  SpectrumSource,
  SyntheticSpectrumSource,
  LiveAudioSpectrumSource,
} from "@/lib/spectrum-source";
import { hexToHsv, hsvToHex, normalizeHex } from "@/lib/color-utils";

export function gradientStops(accent: string): [string, string, string] {
  const { h, s, v } = hexToHsv(normalizeHex(accent));
  return [
    hsvToHex(h, Math.min(100, s + 10), Math.max(30, v - 45)),
    hsvToHex(h, s, v),
    hsvToHex((h + 18) % 360, Math.max(0, s - 35), Math.min(100, v + 12)),
  ];
}

export interface SpectrumCanvasProps {
  trackKey: string;
  isLive: boolean;
  accentColor: string;
  sourceMode: "synthetic" | "live";
  onToggleSource: () => void;
  className?: string;
  heightClass?: string;
}

/**
 * Reusable Canvas Visualizer component
 */
export const SpectrumCanvas: React.FC<SpectrumCanvasProps> = ({
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
