"use client";

import React from "react";
import { Mode } from "@/lib/mock-listening-data";

interface MetricRibbonProps {
  mode: Mode;
  metrics: [string, string, string, string];
}

const RIBBON_LABELS: Record<Mode, [string, string, string, string]> = {
  0: ["MINUTES", "TRACKS", "ARTISTS", "DAILY AVG"],
  1: ["TOTAL PLAYS", "LOGGED TIME", "UNIQUE ARTISTS", "CURRENT STREAK"],
  2: ["SESSION RUNTIME", "TOTAL TRACKS", "UNIQUE ARTISTS", "START TIME"],
};

export const MetricRibbon: React.FC<MetricRibbonProps> = ({
  mode,
  metrics,
}) => {
  const labels = RIBBON_LABELS[mode];

  return (
    <section
      aria-label="Metric ribbon summary"
      className="grid grid-cols-2 sm:grid-cols-4 gap-[1px] bg-[#1C1C1A] border-t border-b border-[#1C1C1A] my-1 sm:my-1.5 md:my-2"
    >
      {labels.map((label, i) => (
        <div
          key={label}
          className="bg-[#080808] px-3.5 sm:px-4 py-2.5 md:py-3 flex flex-col justify-between select-none"
        >
          <div className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
            {label}
          </div>
          <div className="font-mono text-[19px] sm:text-[20px] text-[#EDEDE8] tabular-nums mt-1.5 leading-tight select-all">
            {metrics[i]}
          </div>
        </div>
      ))}
    </section>
  );
};
