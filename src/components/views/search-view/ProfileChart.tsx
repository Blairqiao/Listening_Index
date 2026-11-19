"use client";

import React, { useState } from "react";
import type { ActivityBucket, RangeKey } from "@/lib/types";
import { ActivityChart } from "../ActivityChart";
import { peakHour } from "@/lib/profile-stats";
import { HourChart } from "./HourChart";

type ChartView = "time" | "hour";

// Combined label + toggle button on the left: bracketed view label in the style of the live player's [ SYNTHETIC ] toggle.
const toggleHeadingClass =
  "font-mono text-[11px] tracking-[0.14em] bg-transparent border-0 cursor-pointer p-0 text-music-accent hover:text-[#EDEDE8] focus-visible:outline-none focus-visible:text-music-accent transition-colors select-none mb-2 block text-left";
const staticHeadingClass = "font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] mb-2 select-none";

export interface ProfileChartProps {
  range: RangeKey;
  activityCadence: ActivityBucket[];
  monthlyCadence?: ActivityBucket[];
  isLoading: boolean;
  visitorTimezone: string;
  hourOfDay?: number[];
  streakDays?: number;
}

function readout(showHours: boolean, hourOfDay: number[], streakDays: number): string | null {
  if (showHours) {
    const peak = peakHour(hourOfDay);
    return peak === null ? null : `PEAK ${String(peak).padStart(2, "0")}:00`;
  }
  if (streakDays <= 0) return null;
  return `LONGEST STREAK · ${streakDays.toLocaleString()} ${streakDays === 1 ? "DAY" : "DAYS"}`;
}

export function ProfileChart({ range, activityCadence, monthlyCadence, isLoading, visitorTimezone, hourOfDay, streakDays = 0 }: ProfileChartProps) {
  const [view, setView] = useState<ChartView>("time");
  const showHours = hourOfDay !== undefined && view === "hour";

  const heading = hourOfDay ? (
    <button
      type="button"
      onClick={() => setView(view === "time" ? "hour" : "time")}
      title="Click to switch between plays over time and plays by hour of day"
      className={toggleHeadingClass}
    >
      {view === "time" ? "[ OVER TIME ]" : "[ BY HOUR ]"}
      <span className="sr-only">{view === "time" ? ", switch to plays by hour" : ", switch to plays over time"}</span>
    </button>
  ) : (
    <div className={staticHeadingClass}>[ PLAYS ]</div>
  );

  return (
    <div>
      {showHours ? (
        <HourChart counts={hourOfDay} heading={heading} />
      ) : (
        <ActivityChart
          label="PLAYS"
          range={range}
          activityCadence={activityCadence}
          monthlyCadence={monthlyCadence}
          isLoading={isLoading}
          visitorTimezone={visitorTimezone}
          heading={heading}
          showRange={false}
        />
      )}
      {hourOfDay && <div className="mt-1 h-4 text-right font-mono text-[11px] leading-4 tracking-[0.08em] text-[#8A8A83] tabular-nums">{readout(showHours, hourOfDay, streakDays)}</div>}
    </div>
  );
}
