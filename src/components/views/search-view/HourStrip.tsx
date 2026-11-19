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

export function HourStrip({ counts }: { counts: number[] }) {
  const peak = peakHour(counts);
  const max = peak === null ? 0 : counts[peak];

  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <span className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] select-none">
          [ WHEN IT PLAYS ]
        </span>
        {peak !== null && (
          <span className="font-mono text-[11px] tracking-[0.08em] text-[#8A8A83] tabular-nums">
            PEAK {hourLabel(peak)}
          </span>
        )}
      </div>
      <div role="img" aria-label={peak === null ? "No plays by hour" : `Plays by hour of day, peak ${hourLabel(peak)}`}>
        <div aria-hidden="true" className="grid grid-cols-24 gap-[2px] h-[18px]">
          {counts.map((count, hour) => (
            <div
              key={hour}
              title={`${hourLabel(hour)} · ${count} plays`}
              className={count === 0 ? "bg-[#141413]" : undefined}
              style={count > 0 ? {
                background: `color-mix(in srgb, var(--music-accent) ${Math.round((0.18 + 0.82 * count / max) * 100)}%, #191917)`,
              } : undefined}
            />
          ))}
        </div>
        <div aria-hidden="true" className="mt-1 grid grid-cols-24 gap-[2px] font-mono text-[10px] text-[#5A5A55]">
          {axis.map(({ label, position }) => <span key={label} className={position}>{label}</span>)}
        </div>
      </div>
    </div>
  );
}
