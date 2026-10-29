"use client";

import React, { useMemo, useState } from "react";
import { SessionHistogramData } from "@/lib/types";

const DEFAULT_HISTOGRAM: SessionHistogramData = {
  avgRuntimeMinutes: 0,
  oldestDate: "--",
  newestDate: "--",
  bars: [],
};

export interface SessionHistogramProps {
  histogram?: SessionHistogramData;
  selectedSessionId?: string;
  onSelectSession?: (id: string) => void;
}

export const SessionHistogram: React.FC<SessionHistogramProps> = ({
  histogram,
  selectedSessionId,
  onSelectSession,
}) => {
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);

  const histData = histogram ?? DEFAULT_HISTOGRAM;

  const activeBars = useMemo(() => {
    return histData.bars ? histData.bars.slice(-20) : [];
  }, [histData.bars]);

  const maxHistRuntime = useMemo(() => {
    if (!activeBars || activeBars.length === 0) return 1;
    return Math.max(...activeBars.map((b) => b.runtimeMinutes), 1);
  }, [activeBars]);

  return (
    <div className="select-none">
      <div className="flex justify-between items-baseline mb-2 select-none">
        <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
          [ SESSIONS / LAST 20 ]
        </span>
        <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
          AVERAGE {histData.avgRuntimeMinutes}m
        </span>
      </div>

      {/* 20 Bars Container */}
      <div
        className="flex gap-1 items-end h-[80px] w-full"
        role="region"
        aria-label="Last 20 sessions runtime histogram"
      >
        {/* Left empty baseline bars padding up to 20 total bars */}
        {Array.from({ length: Math.max(0, 20 - activeBars.length) }).map((_, idx) => (
          <div
            key={`empty-bar-${idx}`}
            className="flex-1 h-full flex flex-col justify-end"
            aria-hidden="true"
          >
            <div
              style={{ height: "4%" }}
              className="w-full bg-[#1C1C1A]"
            />
          </div>
        ))}

        {activeBars.map((bar, idx) => {
          const isSelected = bar.id === selectedSessionId;
          const isHovered = bar.id === hoveredSessionId;
          const heightPct = Math.max(
            4,
            Math.round((bar.runtimeMinutes / maxHistRuntime) * 100)
          );

          return (
            <div
              key={`${bar.id}-${idx}`}
              role="button"
              tabIndex={0}
              title={`${bar.title || bar.runtimeMinutes + "m"}`}
              onClick={() => onSelectSession?.(bar.id)}
              onMouseEnter={() => setHoveredSessionId(bar.id)}
              onMouseLeave={() => setHoveredSessionId(null)}
              className="flex-1 h-full flex flex-col justify-end cursor-pointer group focus:outline-none"
              aria-label={`Session ${bar.dateStr}: ${bar.runtimeMinutes} minutes`}
            >
              <div
                style={{ height: `${heightPct}%` }}
                className={`w-full rounded-none transition-none ${
                  isSelected
                    ? "bg-music-accent"
                    : isHovered
                    ? "bg-[#2E2E2A]"
                    : "bg-[#1C1C1A] group-hover:bg-[#2E2E2A]"
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Date Labels below bars */}
      <div className="flex justify-between font-mono text-[10px] text-[#5A5A55] mt-1.5 select-none">
        <span>{histData.oldestDate}</span>
        <span>{histData.newestDate}</span>
      </div>
    </div>
  );
};
