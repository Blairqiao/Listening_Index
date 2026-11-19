import React from "react";
import { artistShare, formatShare, OTHER_SEGMENT_ID, type ShareSegment } from "@/lib/profile-stats";

const headingClass = "mb-2 font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] select-none";
const legendClass = "mt-2 flex justify-between gap-2 font-mono text-[11px] tracking-[0.08em] text-[#8A8A83] tabular-nums";

function playCountLabel(plays: number): string {
  return `${plays} ${plays === 1 ? "PLAY" : "PLAYS"}`;
}

export function ProportionShareBar({ heading, part, total }: { heading: string; part: number; total: number }) {
  if (total <= 0 || part <= 0) return null;

  return (
    <div>
      <div className={headingClass}>{heading}</div>
      <div aria-hidden="true" className="flex h-[10px] gap-[2px]">
        <div className="bg-music-accent" style={{ flexGrow: part }} />
        {total > part && <div className="bg-[#3A3A32]" style={{ flexGrow: total - part }} />}
      </div>
      <div className={legendClass}>
        <span className="text-music-accent">{formatShare(artistShare(part, total))} · {playCountLabel(part)}</span>
        <span className="shrink-0">OF {total}</span>
      </div>
    </div>
  );
}

interface SegmentedShareBarProps {
  heading: string;
  segments: ShareSegment[];
  total: number;
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
}

export function SegmentedShareBar({ heading, segments, total, activeId, onActiveChange }: SegmentedShareBarProps) {
  if (segments.length === 0) return null;

  const active = segments.find(({ id }) => id === activeId);

  return (
    <div>
      <div className={headingClass}>{heading}</div>
      <div aria-hidden="true" className="flex h-[10px] gap-[2px]">
        {segments.map(({ id, label, plays }, index) => {
          let color = index % 2 === 0 ? "bg-[#2A2A25]" : "bg-[#3A3A32]";
          if (id === OTHER_SEGMENT_ID) color = "bg-[#141413]";
          if (id === activeId) color = "bg-music-accent";
          return (
            <div
              key={id}
              title={label}
              className={color}
              style={{ flexGrow: plays }}
              onMouseEnter={() => onActiveChange(id)}
              onMouseLeave={() => onActiveChange(null)}
            />
          );
        })}
      </div>
      <ul className="sr-only">
        {segments.map(({ id, label, plays }) => (
          <li key={id}>{label}: {formatShare(artistShare(plays, total))}</li>
        ))}
      </ul>
      <div className={legendClass}>
        {active ? (
          <>
            <span className="truncate text-music-accent">
              {active.label.toUpperCase()} · {formatShare(artistShare(active.plays, total))}
            </span>
            <span className="shrink-0">{active.plays} OF {total}</span>
          </>
        ) : (
          <span>{total} PLAYS</span>
        )}
      </div>
    </div>
  );
}
