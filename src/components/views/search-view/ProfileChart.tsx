"use client";

import React, { useState } from "react";
import type { ActivityBucket, RangeKey } from "@/lib/types";
import { ActivityChart } from "../ActivityChart";
import { peakHour } from "@/lib/profile-stats";
import { HourChart } from "./HourChart";

type ChartView = "time" | "hour";

const chipClass = "font-mono text-[11px] tracking-[0.08em] uppercase whitespace-nowrap px-2 py-[1px] rounded-none border bg-transparent cursor-pointer transition-none focus:outline-none focus-visible:border-music-accent focus-visible:text-music-accent";
const activeChip = "border-music-accent text-music-accent";
const idleChip = "border-[#26261F] text-[#6A6A64] hover:text-[#EDEDE8] hover:border-[#3A3A32]";

const VIEWS: { id: ChartView; label: string }[] = [
  { id: "time", label: "OVER TIME" },
  { id: "hour", label: "BY HOUR" },
];

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
    <div className="flex gap-1.5 shrink-0">
      {VIEWS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-pressed={view === id}
          onClick={() => setView(id)}
          className={`${chipClass} ${view === id ? activeChip : idleChip}`}
        >{label}</button>
      ))}
    </div>
  ) : undefined;

  return (
    <div>
      {showHours ? (
        <HourChart counts={hourOfDay} range={range} headerAside={toggle} />
      ) : (
        <ActivityChart
          label="PLAYS"
          range={range}
          activityCadence={activityCadence}
          monthlyCadence={monthlyCadence}
          isLoading={isLoading}
          visitorTimezone={visitorTimezone}
          headerAside={toggle}
        />
      )}
      {hourOfDay && <div className="mt-1 h-4 text-right font-mono text-[11px] leading-4 tracking-[0.08em] text-[#8A8A83] tabular-nums">{readout(showHours, hourOfDay, streakDays)}</div>}
    </div>
  );
}
