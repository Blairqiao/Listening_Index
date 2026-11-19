"use client";

import React, { useState } from "react";
import type { ActivityBucket, RangeKey } from "@/lib/types";
import { ActivityChart } from "../ActivityChart";
import { peakHour } from "@/lib/profile-stats";
import { HourChart } from "./HourChart";

type ChartView = "time" | "hour";

// Same look as the live player's [ SYNTHETIC ] source toggle: one bracketed label naming the current view.
const toggleClass = "font-mono text-[10px] tracking-[0.14em] bg-transparent border-0 cursor-pointer p-0 text-music-accent hover:text-[#EDEDE8] focus-visible:outline-none focus-visible:text-music-accent transition-colors";

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

  const toggle = hourOfDay ? (
    <button
      type="button"
      onClick={() => setView(view === "time" ? "hour" : "time")}
      title="Click to switch between plays over time and plays by hour of day"
      className={toggleClass}
    >
      {view === "time" ? "[ OVER TIME ]" : "[ BY HOUR ]"}
      <span className="sr-only">{view === "time" ? ", switch to plays by hour" : ", switch to plays over time"}</span>
    </button>
  ) : undefined;

  return (
    <div>
      {showHours ? (
        <HourChart counts={hourOfDay} headerAside={toggle} />
      ) : (
        <ActivityChart
          label="PLAYS"
          range={range}
          activityCadence={activityCadence}
          monthlyCadence={monthlyCadence}
          isLoading={isLoading}
          visitorTimezone={visitorTimezone}
          headerAside={toggle}
          showRange={false}
        />
      )}
      {hourOfDay && <div className="mt-1 h-4 text-right font-mono text-[11px] leading-4 tracking-[0.08em] text-[#8A8A83] tabular-nums">{readout(showHours, hourOfDay, streakDays)}</div>}
    </div>
  );
}
