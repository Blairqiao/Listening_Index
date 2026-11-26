"use client";

import React, { useEffect, useRef } from "react";
import { changedIndexes, METRIC_SWAP_KEYFRAMES, METRIC_SWAP_TIMING } from "@/lib/choreography";
import { Mode } from "@/lib/types";

interface MetricRibbonProps {
  mode: Mode;
  metrics: [string, string, string, string];
  overviewTimeUnit?: "minutes" | "hours";
  onToggleTimeUnit?: () => void;
  trackRankFormat?: "rank" | "percentile";
  artistRankFormat?: "rank" | "percentile";
  onToggleTrackRank?: () => void;
  onToggleArtistRank?: () => void;
  onToggleProfileRank?: () => void;
  isLoading?: boolean;
}

export const getRibbonLabels = (
  mode: Mode,
  overviewTimeUnit: "minutes" | "hours" = "minutes"
): [string, string, string, string] => {
  switch (mode) {
    case 0:
      return [
        overviewTimeUnit === "hours" ? "Hours" : "Minutes",
        "Tracks",
        "Artists",
        "Daily avg",
      ];
    case 1:
      return ["Total plays", "Unique tracks", "Unique artists", "Current streak"];
    case 2:
      return ["Session runtime", "Total tracks", "Unique artists", "Start time"];
    case 3:
      return [
        "Track rank",
        "Track plays",
        "Artist rank",
        "Artist plays",
      ];
    case 4:
      return ["Plays", "Rank", "First played", "Last played"];
    case 5:
      return ["Plays", "Active days", "Daily avg", "Peak day"];
  }
};


export const MetricRibbon: React.FC<MetricRibbonProps> = ({
  mode,
  metrics,
  overviewTimeUnit = "minutes",
  onToggleTimeUnit,
  onToggleTrackRank,
  onToggleArtistRank,
  onToggleProfileRank,
  isLoading = false,
}) => {
  const labels = getRibbonLabels(mode, overviewTimeUnit);

  // Values that change in place clear from a blur. The first render keeps them still.
  const valueRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const prevMetricsRef = useRef<readonly string[]>(metrics);
  useEffect(() => {
    for (const i of changedIndexes(prevMetricsRef.current, metrics)) {
      valueRefs.current[i]?.animate(METRIC_SWAP_KEYFRAMES, METRIC_SWAP_TIMING);
    }
    prevMetricsRef.current = metrics;
  }, [metrics]);

  return (
    <section
      aria-label="Metric ribbon summary"
      className="grid grid-cols-2 sm:grid-cols-4 gap-[1px] bg-[#1C1C1A] border-t border-b border-[#1C1C1A] my-1 sm:my-1.5 md:my-2"
    >
      {labels.map((label, i) => {
        let isToggleable = false;
        let onToggle: (() => void) | undefined;
        let ariaLabel: string | undefined;
        let title: string | undefined;

        if (mode === 0 && i === 0 && onToggleTimeUnit) {
          isToggleable = true;
          onToggle = onToggleTimeUnit;
          ariaLabel = "Toggle time unit between minutes and hours";
          title = "Click to toggle between minutes and hours";
        } else if (mode === 3 && i === 0 && onToggleTrackRank) {
          isToggleable = true;
          onToggle = onToggleTrackRank;
          ariaLabel = "Toggle track rank format between rank position and percentile";
          title = "Click to toggle between rank and percentile";
        } else if (mode === 3 && i === 2 && onToggleArtistRank) {
          isToggleable = true;
          onToggle = onToggleArtistRank;
          ariaLabel = "Toggle artist rank format between rank position and percentile";
          title = "Click to toggle between rank and percentile";
        } else if (mode === 4 && i === 1 && onToggleProfileRank) {
          isToggleable = true;
          onToggle = onToggleProfileRank;
          ariaLabel = `Rank ${metrics[i]}. Toggle between rank position and percentile`;
          title = "Click to toggle between rank and percentile";
        }

        return (
          <div
            key={i}
            role={isToggleable ? "button" : undefined}
            tabIndex={isToggleable ? 0 : undefined}
            aria-label={ariaLabel}
            onClick={isToggleable ? onToggle : undefined}
            onKeyDown={
              isToggleable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggle?.();
                    }
                  }
                : undefined
            }
            title={title}
            className={`bg-[#080808] px-3.5 sm:px-4 py-2.5 md:py-3 flex flex-col justify-between select-none ${
              isToggleable
                ? "cursor-pointer hover:bg-[#121210] motion-hover focus:outline-none focus-visible:ring-1 focus-visible:ring-[#333330]"
                : ""
            }`}
          >
            <div className="font-mono text-[12px] text-[#5A5A55] flex items-center justify-between">
              <span>{label}</span>
            </div>
            <div
              className={`font-display text-[18px] sm:text-[19px] text-[#EDEDE8] tabular-nums mt-1.5 leading-tight select-all ${
                isLoading ? "opacity-60 transition-opacity duration-150" : ""
              }`}
            >
              <span
                ref={(el) => {
                  valueRefs.current[i] = el;
                }}
                className="inline-block"
              >
                {metrics[i]}
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
};
