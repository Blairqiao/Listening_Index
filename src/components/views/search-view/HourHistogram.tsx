import React, { type JSX } from "react";

const HOURS = [0, 6, 12, 18];

export function HourHistogram({ counts }: { counts: number[] }): JSX.Element {
  const peak = Math.max(0, ...counts);
  const peakHour = String(counts.indexOf(peak)).padStart(2, "0");

  return (
    <div>
      <div className="mb-2 font-mono text-[11px] tracking-[0.14em] text-[#5A5A55]">
        [ WHEN IT PLAYS ]
      </div>
      <div role="img" aria-label={peak === 0 ? "No plays by hour" : `Plays by hour of day, peak ${peakHour}:00`}>
        <div aria-hidden="true" className="flex h-16 items-end gap-[2px]">
          {counts.map((count, hour) => (
            <div
              key={hour}
              className={`min-h-[2px] flex-1 ${count === 0 ? "bg-[#191917]" : count === peak ? "bg-music-accent" : "bg-[#3A3A32]"}`}
              style={{ height: peak === 0 ? 0 : `${count / peak * 100}%` }}
            />
          ))}
        </div>
        <div aria-hidden="true" className="mt-1 grid grid-cols-4 gap-[2px] font-mono text-[10px] text-[#5A5A55]">
          {HOURS.map((hour) => <span key={hour}>{String(hour).padStart(2, "0")}</span>)}
        </div>
      </div>
    </div>
  );
}
