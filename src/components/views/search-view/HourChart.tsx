import React from "react";
import { peakHour } from "@/lib/profile-stats";

const axis = [
  { label: "00", position: "col-start-1" },
  { label: "06", position: "col-start-7" },
  { label: "12", position: "col-start-13" },
  { label: "18", position: "col-start-19" },
  { label: "23", position: "col-start-24 justify-self-end" },
];

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

const headingClass = "font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] mb-2 select-none";

// Same frame and bar styling as ActivityChart, so switching views doesn't move the page.
export function HourChart({
  counts,
  headerAside,
  heading,
}: {
  counts: number[];
  headerAside?: React.ReactNode;
  heading?: React.ReactNode;
}) {
  const peak = peakHour(counts);
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
      <div role="img" aria-label={peak === null ? "No plays by hour" : `Plays by hour of day, peak ${hourLabel(peak)}`}>
        <div className="flex gap-[2px] items-end h-[80px] w-full">
          {counts.map((count, hour) => {
            const ratio = max === 0 ? 0 : count / max;
            const isHot = count > 0 && ratio > 0.8;
            return (
              <div
                key={hour}
                title={`${hourLabel(hour)} · ${count} plays`}
                className={`flex-1 rounded-none select-none transition-none cursor-default ${isHot ? "bg-music-accent" : "bg-[#1C1C1A] hover:bg-[#2E2E2A]"}`}
                style={{ height: `${Math.max(Math.round(ratio * 100), 4)}%` }}
              />
            );
          })}
        </div>
        <div aria-hidden="true" className="grid grid-cols-24 gap-[2px] mt-1.5 font-mono text-[10px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
          {axis.map(({ label, position }) => <span key={label} className={position}>{label}</span>)}
        </div>
      </div>
    </div>
  );
}
