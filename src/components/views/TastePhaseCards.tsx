"use client";

import React, { useEffect, useRef } from "react";
import { scrollBehavior } from "@/lib/motion";
import type { TastePhase } from "@/lib/taste/types";
import {
  formatTasteDateSpan,
  inclusiveWeeks,
  type TasteRowItem,
} from "@/lib/taste/view";

export interface TastePhaseCardsProps {
  items: TasteRowItem[];
  selectedPhaseId: string | null;
  onSelectPhase: (phase: TastePhase) => void;
}

export const TastePhaseCards: React.FC<TastePhaseCardsProps> = ({
  items,
  selectedPhaseId,
  onSelectPhase,
}) => {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const prevSelectedRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedPhaseId && selectedPhaseId !== prevSelectedRef.current) {
      const row = rowRef.current;
      const card = cardRefs.current.get(selectedPhaseId);
      if (row && card) {
        const target =
          card.offsetLeft - (row.clientWidth - card.offsetWidth) / 2;
        row.scrollTo({ left: Math.max(0, target), behavior: scrollBehavior() });
      }
    }
    prevSelectedRef.current = selectedPhaseId;
  }, [selectedPhaseId]);

  if (items.length === 0) return null;

  const hasGradual = items.some(
    (item) => item.kind === "phase" && item.shiftIn?.kind === "gradual",
  );
  const hasGap = items.some((item) => item.kind === "gap");

  return (
    <div className="w-full mb-4">
      <div
        ref={rowRef}
        className="relative flex items-stretch gap-0 overflow-x-auto pt-1 px-1 -mt-1 -mx-1 pb-2 snap-x snap-mandatory md:snap-none"
      >
        {items.map((item, idx) => {
          const showConnector = idx > 0;
          const gradualShift =
            item.kind === "phase" && item.shiftIn?.kind === "gradual"
              ? item.shiftIn
              : null;

          const connector = showConnector ? (
            gradualShift ? (
              <div
                aria-hidden="true"
                className="flex-none w-[30px] md:w-[34px] flex flex-col items-center justify-center gap-1 font-mono text-[10px] text-[#5A5A55] select-none"
              >
                <span
                  className="block w-[22px] md:w-[24px] h-[8px] rounded-[1px]"
                  style={{
                    background: `linear-gradient(90deg, var(--taste-tone-${
                      item.kind === "phase" && item.tone === "a" ? "b" : "a"
                    }), var(--taste-tone-${
                      item.kind === "phase" ? item.tone : "b"
                    }))`,
                  }}
                />
                <span>{gradualShift.widthWeeks}w</span>
              </div>
            ) : (
              <div
                aria-hidden="true"
                className="flex-none w-[24px] md:w-[34px] flex flex-col items-center justify-center select-none"
              >
                <span className="block w-[14px] border-t border-[#C9C9C0]" />
              </div>
            )
          ) : null;

          if (item.kind === "gap") {
            return (
              <React.Fragment key={`gap-${item.gap.start}-${item.gap.end}`}>
                {connector}
                <div className="flex-none w-[110px] border border-dashed border-[#1C1C1A] bg-[#0B0B0A] px-2.5 py-2.5 flex flex-col items-center justify-center text-center font-mono text-[11px] text-[#5A5A55] select-none">
                  <span>{item.weeks} weeks</span>
                  <span>no data</span>
                </div>
              </React.Fragment>
            );
          }

          const { phase } = item;
          const isSelected = phase.id === selectedPhaseId;
          const weeks = inclusiveWeeks(phase.start, phase.end);
          const topArtists = phase.topArtists.slice(0, 3);
          const maxShare = topArtists[0]?.share || 1;

          return (
            <React.Fragment key={phase.id}>
              {connector}
              <button
                ref={(el) => {
                  if (el) {
                    cardRefs.current.set(phase.id, el);
                  } else {
                    cardRefs.current.delete(phase.id);
                  }
                }}
                type="button"
                aria-pressed={isSelected}
                data-taste-phase={phase.id}
                onClick={() => onSelectPhase(phase)}
                className={`flex-none w-[210px] snap-center border bg-[#0B0B0A] px-3 py-2.5 text-left cursor-pointer transition-colors focus-ring active:scale-[0.99] ${
                  isSelected
                    ? "border-music-accent"
                    : "border-[#1C1C1A] hover:border-[#383830]"
                }`}
              >
                <div className="font-mono text-[11px] text-[#5A5A55] leading-snug">
                  {formatTasteDateSpan(phase.start, phase.end)} &middot; {weeks}w
                </div>
                <div className="font-mono text-[12px] text-[#EDEDE8] mt-1 mb-2 leading-snug">
                  {phase.plays.toLocaleString("en-US")} plays
                </div>
                <div className="flex flex-col">
                  {topArtists.map((artist) => {
                    const barPct = Math.max(
                      0,
                      Math.min(100, Math.round((artist.share * 100) / maxShare)),
                    );
                    const sharePct = Math.round(artist.share * 100);
                    return (
                      <div
                        key={artist.name}
                        className="grid grid-cols-[minmax(0,1fr)_50px_30px] gap-2 items-center font-mono text-[11px] py-[2px]"
                      >
                        <span className="truncate text-[#EDEDE8]">
                          {artist.name}
                        </span>
                        <span className="block h-[6px] bg-[#1C1C1A]">
                          <span
                            className="block h-[6px] bg-music-accent"
                            style={{ width: `${barPct}%` }}
                          />
                        </span>
                        <span className="text-[#5A5A55] text-right tabular-nums">
                          {sharePct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {(hasGradual || hasGap) && (
        <div className="flex items-center gap-3.5 flex-wrap font-mono text-[10px] text-[#5A5A55] mt-1 select-none">
          {hasGradual && (
            <span className="inline-flex items-center">
              <i
                aria-hidden="true"
                className="inline-block w-[18px] h-[8px] rounded-[1px] mr-1.5"
                style={{
                  background:
                    "linear-gradient(90deg, var(--taste-tone-a), var(--taste-tone-b))",
                }}
              />
              gradual shift
            </span>
          )}
          {hasGap && (
            <span className="inline-flex items-center">
              <i
                aria-hidden="true"
                className="inline-block w-[14px] h-[8px] rounded-[1px] mr-1.5 taste-gap"
              />
              no data
            </span>
          )}
        </div>
      )}
    </div>
  );
};
