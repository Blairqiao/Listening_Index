"use client";

import React, { useState } from "react";
import type { ActivityBucket, RangeKey } from "@/lib/types";
import { ActivityChart } from "../ActivityChart";
import { peakDayOfWeek, peakHour } from "@/lib/profile-stats";
import { HourChart } from "./HourChart";
import { DayOfWeekChart } from "./DayOfWeekChart";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type ChartView = "time" | "hour" | "day";

// Combined label + toggle button on the left, styled like the live player's Synthetic toggle.
const toggleHeadingClass =
  "font-mono text-[11px] bg-transparent border-0 cursor-pointer p-0 text-music-accent hover:text-[#EDEDE8] focus-visible:outline-none focus-visible:text-music-accent transition-colors select-none mb-2 block text-left";
const staticHeadingClass = "font-mono text-[11px] text-[#5A5A55] mb-2 select-none";

export interface ProfileChartProps {
  range: RangeKey;
  activityCadence: ActivityBucket[];
  monthlyCadence?: ActivityBucket[];
  isLoading: boolean;
  visitorTimezone: string;
  hourOfDay?: number[];
  dayOfWeek?: number[];
  streakDays?: number;
}

function readout(
  view: ChartView,
  hourOfDay: number[] | undefined,
  dayOfWeek: number[] | undefined,
  streakDays: number,
): string | null {
  if (view === "hour" && hourOfDay) {
    const peak = peakHour(hourOfDay);
    return peak === null ? null : `Peak ${String(peak).padStart(2, "0")}:00`;
  }
  if (view === "day" && dayOfWeek) {
    const peak = peakDayOfWeek(dayOfWeek);
    return peak === null ? null : `Peak ${DAY_LABELS[peak]}`;
  }
  if (streakDays <= 0) return null;
  return `Longest streak · ${streakDays.toLocaleString()} ${streakDays === 1 ? "day" : "days"}`;
}

export function ProfileChart({
  range,
  activityCadence,
  monthlyCadence,
  isLoading,
  visitorTimezone,
  hourOfDay,
  dayOfWeek,
  streakDays = 0,
}: ProfileChartProps) {
  const [view, setView] = useState<ChartView>("time");

  const hasHour = hourOfDay !== undefined;
  const hasDay = dayOfWeek !== undefined;
  const canToggle = hasHour || hasDay;

  // Cycle available modes: "time" -> "hour" (if present) -> "day" (if present) -> "time"
  const cycleView = () => {
    setView(() => {
      const current = currentView;
      if (current === "time") {
        if (hasHour) return "hour";
        if (hasDay) return "day";
        return "time";
      }
      if (current === "hour") {
        if (hasDay) return "day";
        return "time";
      }
      return "time";
    });
  };

  const currentView: ChartView =
    view === "hour" && !hasHour
      ? hasDay
        ? "day"
        : "time"
      : view === "day" && !hasDay
        ? "time"
        : view;

  let viewTitle = "Over time";
  let switchSrText = hasHour ? ", switch to plays by hour" : ", switch to plays by day of week";
  if (currentView === "hour") {
    viewTitle = "By hour";
    switchSrText = hasDay ? ", switch to plays by day of week" : ", switch to plays over time";
  } else if (currentView === "day") {
    viewTitle = "By day";
    switchSrText = ", switch to plays over time";
  }

  const heading = canToggle ? (
    <button
      type="button"
      onClick={cycleView}
      title="Click to switch chart view"
      className={toggleHeadingClass}
    >
      {viewTitle}
      <span className="sr-only">{switchSrText}</span>
    </button>
  ) : (
    <div className={staticHeadingClass}>Plays</div>
  );

  return (
    <div>
      {currentView === "hour" && hourOfDay ? (
        <HourChart counts={hourOfDay} heading={heading} />
      ) : currentView === "day" && dayOfWeek ? (
        <DayOfWeekChart counts={dayOfWeek} heading={heading} />
      ) : (
        <ActivityChart
          label="Plays"
          range={range}
          activityCadence={activityCadence}
          monthlyCadence={monthlyCadence}
          isLoading={isLoading}
          visitorTimezone={visitorTimezone}
          heading={heading}
          showRange={false}
        />
      )}
      {(hasHour || hasDay) && (
        <div className="mt-1 h-4 text-right font-mono text-[11px] leading-4 text-[#8A8A83] tabular-nums">
          {readout(currentView, hourOfDay, dayOfWeek, streakDays)}
        </div>
      )}
    </div>
  );
}
