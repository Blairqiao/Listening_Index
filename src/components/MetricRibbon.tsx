"use client";

import React from "react";
import { Mode } from "@/lib/mock-listening-data";

interface MetricRibbonProps {
  mode: Mode;
  metrics: [string, string, string, string];
  overviewTimeUnit?: "minutes" | "hours";
  onToggleTimeUnit?: () => void;
}

const getRibbonLabels = (
  mode: Mode,
  overviewTimeUnit: "minutes" | "hours" = "minutes"
): [string, string, string, string] => {
  switch (mode) {
    case 0:
      return [
        overviewTimeUnit === "hours" ? "HOURS" : "MINUTES",
        "TRACKS",
        "ARTISTS",
        "DAILY AVG",
      ];
    case 1:
      return ["TOTAL PLAYS", "UNIQUE TRACKS", "UNIQUE ARTISTS", "CURRENT STREAK"];
    case 2:
      return ["SESSION RUNTIME", "TOTAL TRACKS", "UNIQUE ARTISTS", "START TIME"];
  }
};

export const MetricRibbon: React.FC<MetricRibbonProps> = ({
  mode,
  metrics,
  overviewTimeUnit = "minutes",
  onToggleTimeUnit,
}) => {
  const labels = getRibbonLabels(mode, overviewTimeUnit);

  return (
    <section
      aria-label="Metric ribbon summary"
      className="grid grid-cols-2 sm:grid-cols-4 gap-[1px] bg-[#1C1C1A] border-t border-b border-[#1C1C1A] my-1 sm:my-1.5 md:my-2"
    >
      {labels.map((label, i) => {
        const isToggleable = mode === 0 && i === 0 && Boolean(onToggleTimeUnit);

        return (
          <div
            key={i}
            role={isToggleable ? "button" : undefined}
            tabIndex={isToggleable ? 0 : undefined}
            aria-label={
              isToggleable
                ? "Toggle time unit between minutes and hours"
                : undefined
            }
            onClick={isToggleable ? onToggleTimeUnit : undefined}
            onKeyDown={
              isToggleable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleTimeUnit?.();
                    }
                  }
                : undefined
            }
            title={isToggleable ? "Click to toggle between minutes and hours" : undefined}
            className={`bg-[#080808] px-3.5 sm:px-4 py-2.5 md:py-3 flex flex-col justify-between select-none ${
              isToggleable
                ? "cursor-pointer hover:bg-[#121210] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#333330]"
                : ""
            }`}
          >
            <div className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] flex items-center justify-between">
              <span>{label}</span>
              {isToggleable && (
                <span className="text-[9px] tracking-widest text-[#888882] ml-2 select-none">
                  [MIN / HRS]
                </span>
              )}
            </div>
            <div className="font-mono text-[19px] sm:text-[20px] text-[#EDEDE8] tabular-nums mt-1.5 leading-tight select-all">
              {metrics[i]}
            </div>
          </div>
        );
      })}
    </section>
  );
};
