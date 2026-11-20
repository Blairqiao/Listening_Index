import React from "react";
import { peakDayOfWeek } from "@/lib/profile-stats";

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

const headingClass = "font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] mb-2 select-none";

export function DayOfWeekChart({
  counts,
  headerAside,
  heading,
}: {
  counts: number[];
  headerAside?: React.ReactNode;
  heading?: React.ReactNode;
}) {
  const peak = peakDayOfWeek(counts);
  const max = peak === null ? 0 : counts[peak];

  return (
    <div>
      {heading !== undefined ? (
        headerAside == null ? (
          heading
        ) : (
          <div className="flex justify-between items-baseline gap-2">
            {heading}
            {headerAside}
          </div>
        )
      ) : headerAside == null ? (
        <div className={headingClass}>[ WHEN IT PLAYS ]</div>
      ) : (
        <div className="flex justify-between items-baseline gap-2">
          <span className={headingClass}>[ WHEN IT PLAYS ]</span>
          {headerAside}
        </div>
      )}
      <div
        role="img"
        aria-label={peak === null ? "No plays by day of week" : `Plays by day of week, peak ${DAY_LABELS[peak]}`}
      >
        <div className="h-[80px] w-full flex gap-[4px] items-end">
          {DAY_LABELS.map((dayLabel, index) => {
            const count = counts[index] ?? 0;
            const ratio = max === 0 ? 0 : count / max;
            const isHot = count > 0 && ratio > 0.8;
            return (
              <div
                key={dayLabel}
                title={`${dayLabel} · ${count} plays`}
                className={`flex-1 rounded-none select-none transition-none cursor-default ${
                  isHot ? "bg-music-accent" : "bg-[#1C1C1A] hover:bg-[#2E2E2A]"
                }`}
                style={{ height: `${Math.max(Math.round(ratio * 100), 4)}%` }}
              />
            );
          })}
        </div>
        <div
          aria-hidden="true"
          className="grid grid-cols-7 text-center gap-[4px] mt-1.5 font-mono text-[10px] text-[#5A5A55] select-none h-[14px] leading-[14px]"
        >
          {DAY_LABELS.map((dayLabel) => (
            <span key={dayLabel}>{dayLabel}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
