"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  calendarYears,
  clipSelectionToYear,
  calendarThresholds,
  calendarLevel,
  isSelectableDate,
  monthSelection,
  yearSelection,
  normalizeSelection,
  selectionContourPath,
  selectionToRange,
  summarizeCalendar,
  weekColumns,
  monthStartColumns,
  type CalendarData,
  type CalendarSelection,
} from "@/lib/calendar";
import { formatRangeLabel } from "@/lib/range";
import type { TastePhase, TastePhasesData } from "@/lib/taste/types";
import {
  clampTasteLevel,
  desktopRibbon,
  formatTasteDateSpan,
  hasTastePhases,
  mobileRibbon,
  phasesAtLevel,
  phaseSelection,
  selectedPhaseId,
  tasteLevelLabel,
  tasteRow,
  type DesktopRibbonPiece,
  type MobileRibbonPiece,
  type TasteTone,
} from "@/lib/taste/view";
import { TastePhaseCards } from "@/components/views/TastePhaseCards";

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const CalendarLegend: React.FC = () => {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#5A5A55] select-none">
      <span>Less</span>
      <div className="flex items-center gap-[3px]">
        <div className="w-[10px] h-[10px] rounded-[1px] calendar-level-0" title="0 plays" />
        <div className="w-[10px] h-[10px] rounded-[1px] calendar-level-1" title="Level 1" />
        <div className="w-[10px] h-[10px] rounded-[1px] calendar-level-2" title="Level 2" />
        <div className="w-[10px] h-[10px] rounded-[1px] calendar-level-3" title="Level 3" />
        <div className="w-[10px] h-[10px] rounded-[1px] calendar-level-4" title="Level 4" />
      </div>
      <span>More</span>
    </div>
  );
};

interface YearRibbonData {
  desktop: DesktopRibbonPiece[];
  mobile: MobileRibbonPiece[];
  phaseById: Map<string, { phase: TastePhase; tone: TasteTone }>;
}

function formatRibbonPhaseLabel(phase: TastePhase): string {
  const span = formatTasteDateSpan(phase.start, phase.end);
  const topArtist = phase.topArtists[0]?.name;
  return topArtist ? `${span} \u00B7 ${topArtist}` : span;
}

function rampEndColor(
  phaseId: string | undefined,
  phaseById: Map<string, { phase: TastePhase; tone: TasteTone }>,
  selectedId: string | null,
): string {
  if (!phaseId) return "transparent";
  if (phaseId === selectedId) return "var(--music-accent)";
  const meta = phaseById.get(phaseId);
  if (!meta) return "transparent";
  return meta.tone === "b" ? "var(--taste-tone-b)" : "var(--taste-tone-a)";
}

const DESKTOP_CONTOUR_CELL = 14;
const DESKTOP_CONTOUR_GAP = 3;
const MOBILE_CONTOUR_CELL_W = 25;
const MOBILE_CONTOUR_CELL_H = 10;
const MOBILE_CONTOUR_GAP = 2;

interface YearMonthMeta {
  monthNum: number;
  label: string;
  selection: CalendarSelection;
  maxDays: number;
}

export interface YearDayGridComparisonProps {
  year: number;
  firstDate: string | null;
  today: string;
  clippedSelection: CalendarSelection | null;
  hasActiveSelection: boolean;
  dayCounts: Map<string, number>;
  thresholds: [number, number, number];
}

export function areYearDayGridPropsEqual(
  prev: YearDayGridComparisonProps,
  next: YearDayGridComparisonProps,
): boolean {
  if (prev.year !== next.year) return false;
  if (prev.firstDate !== next.firstDate) return false;
  if (prev.today !== next.today) return false;
  if (prev.hasActiveSelection !== next.hasActiveSelection) return false;
  if (prev.dayCounts !== next.dayCounts) return false;
  if (
    prev.thresholds[0] !== next.thresholds[0] ||
    prev.thresholds[1] !== next.thresholds[1] ||
    prev.thresholds[2] !== next.thresholds[2]
  ) {
    return false;
  }

  const pSel = prev.clippedSelection;
  const nSel = next.clippedSelection;
  if (pSel === null && nSel === null) return true;
  if (pSel === null || nSel === null) return false;
  return pSel.from === nSel.from && pSel.to === nSel.to;
}

interface YearMobileRibbonProps {
  ribbon: YearRibbonData | null;
  selectedPhaseId: string | null;
  onSelectPhase: (phase: TastePhase) => void;
}

const YearMobileRibbon = React.memo<YearMobileRibbonProps>(
  function YearMobileRibbon({ ribbon, selectedPhaseId, onSelectPhase }) {
    if (ribbon === null) return null;

    return (
      <div
        className="grid gap-[2px] items-center w-full mb-1"
        style={{ gridTemplateColumns: "18px 1fr" }}
      >
        <div />
        <div className="relative h-[8px] w-full">
          {ribbon.mobile.map((piece, idx) => {
            const posStyle: React.CSSProperties = {
              left: `${piece.leftPct}%`,
              width: `calc(${piece.widthPct}% - 1.5px)`,
            };
            if (piece.kind === "phase" && piece.phaseId) {
              const meta = ribbon.phaseById.get(piece.phaseId);
              const isSelected = piece.phaseId === selectedPhaseId;
              const label = meta
                ? formatRibbonPhaseLabel(meta.phase)
                : "Select Taste Phase";
              const toneClass = isSelected
                ? "bg-music-accent"
                : piece.tone === "b"
                  ? "taste-tone-b"
                  : "taste-tone-a";
              return (
                <button
                  key={`m-phase-${piece.phaseId}-${idx}`}
                  type="button"
                  data-taste-ribbon="phase"
                  onClick={() => meta && onSelectPhase(meta.phase)}
                  style={posStyle}
                  title={label}
                  aria-label={label}
                  className={`absolute top-0 h-[8px] rounded-[2px] border-0 p-0 cursor-pointer motion-hover hover:brightness-125 focus-ring hit-area-y ${toneClass}`}
                />
              );
            }
            if (piece.kind === "gap") {
              return (
                <div
                  key={`m-gap-${idx}`}
                  aria-hidden="true"
                  style={posStyle}
                  className="absolute top-0 h-[8px] rounded-[2px] taste-gap"
                />
              );
            }
            if (piece.kind === "ramp") {
              const fromColor = rampEndColor(
                piece.from,
                ribbon.phaseById,
                selectedPhaseId,
              );
              const toColor = rampEndColor(
                piece.to,
                ribbon.phaseById,
                selectedPhaseId,
              );
              return (
                <div
                  key={`m-ramp-${idx}`}
                  aria-hidden="true"
                  style={{
                    ...posStyle,
                    background: `linear-gradient(90deg, ${fromColor}, ${toColor})`,
                  }}
                  className="absolute top-0 h-[8px] rounded-[2px] pointer-events-none"
                />
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.ribbon === next.ribbon && prev.selectedPhaseId === next.selectedPhaseId,
);

interface YearDesktopRibbonProps {
  numCols: number;
  ribbon: YearRibbonData | null;
  selectedPhaseId: string | null;
  onSelectPhase: (phase: TastePhase) => void;
}

const YearDesktopRibbon = React.memo<YearDesktopRibbonProps>(
  function YearDesktopRibbon({ numCols, ribbon, selectedPhaseId, onSelectPhase }) {
    if (ribbon === null) return null;

    return (
      <div
        className="grid h-[10px] mb-1 select-none"
        style={{
          gridTemplateColumns: `20px repeat(${numCols}, minmax(0, 1fr))`,
          gap: "3px",
        }}
      >
        {ribbon.desktop.map((piece, idx) => {
          const gridStyle: React.CSSProperties = {
            gridRow: 1,
            gridColumn: `${piece.colStart + 2} / ${piece.colEnd + 3}`,
          };
          if (piece.kind === "phase" && piece.phaseId) {
            const meta = ribbon.phaseById.get(piece.phaseId);
            const isSelected = piece.phaseId === selectedPhaseId;
            const label = meta
              ? formatRibbonPhaseLabel(meta.phase)
              : "Select Taste Phase";
            const toneClass = isSelected
              ? "bg-music-accent"
              : piece.tone === "b"
                ? "taste-tone-b"
                : "taste-tone-a";
            return (
              <button
                key={`d-phase-${piece.phaseId}-${idx}`}
                type="button"
                data-taste-ribbon="phase"
                onClick={() => meta && onSelectPhase(meta.phase)}
                style={gridStyle}
                title={label}
                aria-label={label}
                className={`h-[10px] w-full rounded-[2px] border-0 p-0 cursor-pointer motion-hover hover:brightness-125 focus-ring ${toneClass}`}
              />
            );
          }
          if (piece.kind === "gap") {
            return (
              <div
                key={`d-gap-${piece.colStart}-${idx}`}
                aria-hidden="true"
                style={gridStyle}
                className="h-[10px] w-full rounded-[2px] taste-gap"
              />
            );
          }
          if (piece.kind === "ramp") {
            const fromColor = rampEndColor(
              piece.from,
              ribbon.phaseById,
              selectedPhaseId,
            );
            const toColor = rampEndColor(
              piece.to,
              ribbon.phaseById,
              selectedPhaseId,
            );
            return (
              <div
                key={`d-ramp-${piece.colStart}-${idx}`}
                aria-hidden="true"
                style={{
                  ...gridStyle,
                  background: `linear-gradient(90deg, ${fromColor}, ${toColor})`,
                }}
                className="h-[10px] w-full rounded-[2px] pointer-events-none"
              />
            );
          }
          return null;
        })}
      </div>
    );
  },
  (prev, next) =>
    prev.numCols === next.numCols &&
    prev.ribbon === next.ribbon &&
    prev.selectedPhaseId === next.selectedPhaseId,
);

interface YearMobileDayGridProps extends YearDayGridComparisonProps {
  months: YearMonthMeta[];
  onSelectMonth: (year: number, month: number) => void;
}

const YearMobileDayGrid = React.memo<YearMobileDayGridProps>(
  function YearMobileDayGrid({
    year,
    firstDate,
    today,
    clippedSelection,
    hasActiveSelection,
    dayCounts,
    thresholds,
    months,
    onSelectMonth,
  }) {
    const yearStr = String(year).padStart(4, "0");

    const mobileContourPath = useMemo(() => {
      if (!hasActiveSelection || clippedSelection === null) return "";
      return selectionContourPath({
        cols: months.length,
        rows: 31,
        cellWidth: MOBILE_CONTOUR_CELL_W,
        cellHeight: MOBILE_CONTOUR_CELL_H,
        gap: MOBILE_CONTOUR_GAP,
        radius: 2,
        isSelected: (mIdx, dayIdx) => {
          if (mIdx < 0 || mIdx >= months.length) return false;
          const dNum = dayIdx + 1;
          const m = months[mIdx];
          if (dNum < 1 || dNum > m.maxDays) return false;
          const key = `${yearStr}-${String(m.monthNum).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`;
          return (
            isSelectableDate(key, firstDate, today) &&
            key >= clippedSelection.from &&
            key <= clippedSelection.to
          );
        },
      });
    }, [hasActiveSelection, clippedSelection, months, yearStr, firstDate, today]);

    return (
      <>
        {/* Top row: spacer + 12 month buttons */}
        <div
          className="grid gap-[2px] items-center w-full mb-[2px]"
          style={{ gridTemplateColumns: "18px repeat(12, minmax(0, 1fr))" }}
        >
          <div />
          {months.map((month) => {
            const isDisabled =
              firstDate === null ||
              month.selection.to < firstDate ||
              month.selection.from > today;
            return (
              <button
                key={month.monthNum}
                type="button"
                disabled={isDisabled}
                onClick={() => onSelectMonth(year, month.monthNum)}
                className="font-display text-[10px] text-[#5A5A55] font-medium py-1 text-center hover:text-music-accent motion-hover focus-ring disabled:opacity-20 disabled:pointer-events-none disabled:cursor-not-allowed bg-transparent border-0 cursor-pointer"
                title={
                  isDisabled
                    ? `No data for ${month.label} ${year}`
                    : `Select ${month.label} ${year}`
                }
              >
                {month.label}
              </button>
            );
          })}
        </div>

        {/* 31 Day rows + SVG contour overlay */}
        <div
          className="relative grid gap-[2px] items-center w-full"
          style={{ gridTemplateColumns: "18px repeat(12, minmax(0, 1fr))" }}
        >
          {Array.from({ length: 31 }, (_, dayIdx) => {
            const dayNum = dayIdx + 1;
            const isLabelDay =
              dayNum === 1 || dayNum === 10 || dayNum === 20 || dayNum === 30;

            return (
              <React.Fragment key={dayNum}>
                <div className="h-[10px] leading-[10px] text-[10px] text-[#5A5A55] text-right pr-[3px] select-none font-mono">
                  {isLabelDay ? dayNum : ""}
                </div>
                {months.map((month) => {
                  if (dayNum > month.maxDays) {
                    return (
                      <div
                        key={`empty-${month.monthNum}-${dayNum}`}
                        className="h-[10px] w-full rounded-[1px] opacity-[0.12] pointer-events-none"
                      />
                    );
                  }
                  const mStr = String(month.monthNum).padStart(2, "0");
                  const dStr = String(dayNum).padStart(2, "0");
                  const dateKey = `${yearStr}-${mStr}-${dStr}`;
                  const selectable = isSelectableDate(dateKey, firstDate, today);
                  if (!selectable) {
                    return (
                      <div
                        key={dateKey}
                        className="h-[10px] w-full rounded-[1px] opacity-[0.12] pointer-events-none"
                      />
                    );
                  }

                  const count = dayCounts.get(dateKey) ?? 0;
                  const level = calendarLevel(count, thresholds);
                  const isSelected =
                    clippedSelection !== null &&
                    dateKey >= clippedSelection.from &&
                    dateKey <= clippedSelection.to;

                  const opacityClass =
                    hasActiveSelection && !isSelected ? "opacity-40" : "opacity-100";
                  const inRangeClass =
                    hasActiveSelection && isSelected ? "calendar-in-range" : "";

                  return (
                    <div
                      key={dateKey}
                      data-date={dateKey}
                      title={`${dateKey} · ${count} plays`}
                      className={`h-[10px] w-full rounded-[1px] calendar-level-${level} ${opacityClass} ${inRangeClass} cursor-pointer transition-[opacity,box-shadow] duration-75 group-data-[dragging=true]:transition-none`}
                      style={{ touchAction: "pan-y" }}
                    />
                  );
                })}
              </React.Fragment>
            );
          })}
          {mobileContourPath && (
            <svg
              data-selection-contour="true"
              aria-hidden="true"
              viewBox={`0 0 ${months.length * (MOBILE_CONTOUR_CELL_W + MOBILE_CONTOUR_GAP) - MOBILE_CONTOUR_GAP} ${31 * (MOBILE_CONTOUR_CELL_H + MOBILE_CONTOUR_GAP) - MOBILE_CONTOUR_GAP}`}
              preserveAspectRatio="none"
              className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 overflow-visible"
              style={{ left: "20px", width: "calc(100% - 20px)", height: "100%" }}
            >
              <path
                d={mobileContourPath}
                fill="none"
                stroke="rgba(237, 237, 232, 0.82)"
                strokeWidth="1.5"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
        </div>
      </>
    );
  },
  areYearDayGridPropsEqual,
);

interface YearDesktopDayGridProps extends YearDayGridComparisonProps {
  cols: (string | null)[][];
  monthCols: number[];
  months: YearMonthMeta[];
  onSelectMonth: (year: number, month: number) => void;
}

const YearDesktopDayGrid = React.memo<YearDesktopDayGridProps>(
  function YearDesktopDayGrid({
    year,
    firstDate,
    today,
    clippedSelection,
    hasActiveSelection,
    dayCounts,
    thresholds,
    cols,
    monthCols,
    months,
    onSelectMonth,
  }) {
    const numCols = cols.length;

    const desktopContourPath = useMemo(() => {
      if (!hasActiveSelection || clippedSelection === null) return "";
      return selectionContourPath({
        cols: numCols,
        rows: 7,
        cellWidth: DESKTOP_CONTOUR_CELL,
        cellHeight: DESKTOP_CONTOUR_CELL,
        gap: DESKTOP_CONTOUR_GAP,
        radius: 3,
        isSelected: (cIdx, rIdx) => {
          if (cIdx < 0 || cIdx >= numCols || rIdx < 0 || rIdx >= 7) return false;
          const key = cols[cIdx][rIdx];
          if (!key) return false;
          return (
            isSelectableDate(key, firstDate, today) &&
            key >= clippedSelection.from &&
            key <= clippedSelection.to
          );
        },
      });
    }, [hasActiveSelection, clippedSelection, numCols, cols, firstDate, today]);

    return (
      <>
        {/* Desktop Month Header Row */}
        <div
          className="grid items-center mb-1 text-[10px] text-[#5A5A55] font-mono select-none"
          style={{
            gridTemplateColumns: `20px repeat(${numCols}, minmax(0, 1fr))`,
            gap: "3px",
          }}
        >
          <div />
          {months.map((month, m) => {
            const colIndex = monthCols[m];
            const isDisabled =
              firstDate === null ||
              month.selection.to < firstDate ||
              month.selection.from > today;
            return (
              <button
                key={month.monthNum}
                type="button"
                disabled={isDisabled}
                onClick={() => onSelectMonth(year, month.monthNum)}
                style={{ gridColumnStart: colIndex + 2 }}
                className="font-display text-[10px] text-[#5A5A55] hover:text-music-accent motion-hover focus-ring disabled:opacity-20 disabled:pointer-events-none disabled:cursor-not-allowed whitespace-nowrap overflow-visible text-left p-0 bg-transparent border-0 cursor-pointer"
                title={
                  isDisabled
                    ? `No data for ${month.label} ${year}`
                    : `Select ${month.label} ${year}`
                }
              >
                {month.label}
              </button>
            );
          })}
        </div>

        {/* Desktop Grid (Weekdays M/W/F + Cells sharing the same row tracks) */}
        <div
          className="grid select-none"
          style={{
            gridTemplateColumns: `20px repeat(${numCols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(7, minmax(0, 1fr))`,
            gap: "3px",
          }}
        >
          {/* Weekday labels in column 1 aligned to rows 2, 4, 6 (M, W, F) */}
          <div
            style={{ gridColumn: 1, gridRow: 2 }}
            className="text-[10px] text-[#5A5A55] text-right font-mono select-none flex items-center justify-end leading-none pr-[3px]"
          >
            M
          </div>
          <div
            style={{ gridColumn: 1, gridRow: 4 }}
            className="text-[10px] text-[#5A5A55] text-right font-mono select-none flex items-center justify-end leading-none pr-[3px]"
          >
            W
          </div>
          <div
            style={{ gridColumn: 1, gridRow: 6 }}
            className="text-[10px] text-[#5A5A55] text-right font-mono select-none flex items-center justify-end leading-none pr-[3px]"
          >
            F
          </div>

          {/* Week grid cells */}
          {cols.map((colDays, colIdx) =>
            colDays.map((dateKey, rowIdx) => {
              const colNum = colIdx + 2;
              const rowNum = rowIdx + 1;
              if (!dateKey) {
                return (
                  <div
                    key={`empty-${colIdx}-${rowIdx}`}
                    style={{ gridColumn: colNum, gridRow: rowNum }}
                    className="aspect-square rounded-[1.5px] opacity-[0.12] pointer-events-none"
                  />
                );
              }
              const selectable = isSelectableDate(dateKey, firstDate, today);
              if (!selectable) {
                return (
                  <div
                    key={dateKey}
                    style={{ gridColumn: colNum, gridRow: rowNum }}
                    className="aspect-square rounded-[1.5px] opacity-[0.12] pointer-events-none"
                  />
                );
              }
              const count = dayCounts.get(dateKey) ?? 0;
              const level = calendarLevel(count, thresholds);
              const isSelected =
                clippedSelection !== null &&
                dateKey >= clippedSelection.from &&
                dateKey <= clippedSelection.to;

              const opacityClass =
                hasActiveSelection && !isSelected ? "opacity-40" : "opacity-100";
              const inRangeClass =
                hasActiveSelection && isSelected ? "calendar-in-range" : "";

              return (
                <div
                  key={dateKey}
                  data-date={dateKey}
                  style={{ gridColumn: colNum, gridRow: rowNum, touchAction: "pan-y" }}
                  title={`${dateKey} · ${count} plays`}
                  className={`aspect-square rounded-[1.5px] calendar-level-${level} ${opacityClass} ${inRangeClass} cursor-pointer transition-[opacity,box-shadow] duration-75 group-data-[dragging=true]:transition-none hover:outline hover:outline-1.5 hover:outline-[#EDEDE8] hover:z-20`}
                />
              );
            })
          )}
          {desktopContourPath && (
            <svg
              data-selection-contour="true"
              aria-hidden="true"
              viewBox={`0 0 ${numCols * (DESKTOP_CONTOUR_CELL + DESKTOP_CONTOUR_GAP) - DESKTOP_CONTOUR_GAP} ${7 * (DESKTOP_CONTOUR_CELL + DESKTOP_CONTOUR_GAP) - DESKTOP_CONTOUR_GAP}`}
              preserveAspectRatio="none"
              className="pointer-events-none w-full h-full z-10 overflow-visible"
              style={{ gridColumn: `2 / ${numCols + 2}`, gridRow: "1 / 8" }}
            >
              <path
                d={desktopContourPath}
                fill="none"
                stroke="rgba(237, 237, 232, 0.82)"
                strokeWidth="1.5"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
        </div>
      </>
    );
  },
  areYearDayGridPropsEqual,
);

interface YearBlockProps {
  year: number;
  firstDate: string | null;
  today: string;
  clippedSelection: CalendarSelection | null;
  hasActiveSelection: boolean;
  isAnchorYear: boolean;
  dayCounts: Map<string, number>;
  thresholds: [number, number, number];
  ribbon: YearRibbonData | null;
  selectedPhaseId: string | null;
  onSelectMonth: (year: number, month: number) => void;
  onSelectYear: (year: number) => void;
  onSelectPhase: (phase: TastePhase) => void;
}

const YearBlock = React.memo<YearBlockProps>(
  function YearBlock({
    year,
    firstDate,
    today,
    clippedSelection,
    hasActiveSelection,
    isAnchorYear,
    dayCounts,
    thresholds,
    ribbon,
    selectedPhaseId,
    onSelectMonth,
    onSelectYear,
    onSelectPhase,
  }) {
    const cols = useMemo(() => weekColumns(year), [year]);
    const monthCols = useMemo(() => monthStartColumns(year), [year]);
    const months = useMemo<YearMonthMeta[]>(
      () =>
        Array.from({ length: 12 }, (_, m) => {
          const monthNum = m + 1;
          const selection = monthSelection(year, monthNum);
          return {
            monthNum,
            label: SHORT_MONTHS[m],
            selection,
            maxDays: Number(selection.to.slice(8, 10)),
          };
        }),
      [year]
    );
    const numCols = cols.length;

    // Calculate total plays in this year
    const yearPlays = useMemo(() => {
      let total = 0;
      const prefix = `${String(year).padStart(4, "0")}-`;
      for (const [d, count] of dayCounts.entries()) {
        if (d.startsWith(prefix)) {
          total += count;
        }
      }
      return total;
    }, [year, dayCounts]);

    return (
      <section
        className={`border bg-[#0B0B0A] p-3 md:p-4 transition-colors ${
          isAnchorYear ? "border-[#383830]" : "border-[#1C1C1A]"
        }`}
        data-year={year}
      >
        {/* Header */}
        <div className="flex items-baseline justify-between gap-2 mb-3 select-none">
          <div className="flex items-baseline gap-2.5">
            <button
              type="button"
              onClick={() => onSelectYear(year)}
              className="font-display text-[15px] font-medium text-[#EDEDE8] hover:text-music-accent motion-hover focus-ring bg-transparent border-0 p-0 cursor-pointer text-left"
              title={`Select year ${year}`}
            >
              {year}
            </button>
            <span className="font-mono text-[11px] text-[#5A5A55]">
              {yearPlays.toLocaleString("en-US")} plays
            </span>
          </div>
        </div>

        {/* 1. Mobile Heatmap (md:hidden) */}
        <div className="md:hidden w-full select-none">
          <YearMobileRibbon
            ribbon={ribbon}
            selectedPhaseId={selectedPhaseId}
            onSelectPhase={onSelectPhase}
          />
          <YearMobileDayGrid
            year={year}
            firstDate={firstDate}
            today={today}
            clippedSelection={clippedSelection}
            hasActiveSelection={hasActiveSelection}
            dayCounts={dayCounts}
            thresholds={thresholds}
            months={months}
            onSelectMonth={onSelectMonth}
          />
        </div>

        {/* 2. Desktop Heatmap (hidden md:block) */}
        <div className="hidden md:block w-full select-none">
          <YearDesktopRibbon
            numCols={numCols}
            ribbon={ribbon}
            selectedPhaseId={selectedPhaseId}
            onSelectPhase={onSelectPhase}
          />
          <YearDesktopDayGrid
            year={year}
            firstDate={firstDate}
            today={today}
            clippedSelection={clippedSelection}
            hasActiveSelection={hasActiveSelection}
            dayCounts={dayCounts}
            thresholds={thresholds}
            cols={cols}
            monthCols={monthCols}
            months={months}
            onSelectMonth={onSelectMonth}
          />
        </div>
      </section>
    );
  },
  (prev, next) => {
    if (prev.isAnchorYear !== next.isAnchorYear) return false;
    if (prev.ribbon !== next.ribbon) return false;
    if (prev.selectedPhaseId !== next.selectedPhaseId) return false;
    return areYearDayGridPropsEqual(prev, next);
  }
);

export interface CalendarViewProps {
  data: CalendarData | null;
  isLoading: boolean; // true only for a first load with no data
  selection: CalendarSelection | null; // committed selection, owned by ListeningView
  onSelectionChange: (sel: CalendarSelection | null) => void; // called on drag end, a tap pair, month/year click, Clear
  onOpenInOverview: (sel: CalendarSelection) => void;
  taste?: TastePhasesData | null;
  tasteLevel?: number | null;
  onTasteLevelChange?: (k: number) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  data,
  isLoading,
  selection,
  onSelectionChange,
  onOpenInOverview,
  taste = null,
  tasteLevel = null,
  onTasteLevelChange,
}) => {
  // Sync draft from selection prop
  const [draft, setDraft] = useState<CalendarSelection | null>(selection);
  const draftRef = useRef<CalendarSelection | null>(selection);
  const [pendingTouchAnchor, setPendingTouchAnchor] = useState<string | null>(null);
  const pendingTouchAnchorRef = useRef<string | null>(null);
  pendingTouchAnchorRef.current = pendingTouchAnchor;

  useEffect(() => {
    setDraft(selection);
    draftRef.current = selection;
    if (selection === null) {
      setPendingTouchAnchor(null);
    }
  }, [selection]);

  // Container ref for scoped hit testing
  const heatmapsContainerRef = useRef<HTMLDivElement | null>(null);

  // Pointer drag state
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const capturedTargetRef = useRef<HTMLElement | null>(null);
  const anchorRef = useRef<string | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchDateRef = useRef<string | null>(null);

  const windowPointerMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const windowPointerUpRef = useRef<((e: PointerEvent) => void) | null>(null);
  const windowPointerCancelRef = useRef<((e: PointerEvent) => void) | null>(null);
  const lostCaptureCleanupRef = useRef<(() => void) | null>(null);

  const removeWindowListeners = useCallback(() => {
    if (windowPointerMoveRef.current) {
      window.removeEventListener("pointermove", windowPointerMoveRef.current);
      windowPointerMoveRef.current = null;
    }
    if (windowPointerUpRef.current) {
      window.removeEventListener("pointerup", windowPointerUpRef.current);
      windowPointerUpRef.current = null;
    }
    if (windowPointerCancelRef.current) {
      window.removeEventListener("pointercancel", windowPointerCancelRef.current);
      windowPointerCancelRef.current = null;
    }
  }, []);

  const cleanupCaptureLoss = useCallback(() => {
    if (lostCaptureCleanupRef.current) {
      lostCaptureCleanupRef.current();
      lostCaptureCleanupRef.current = null;
    }
  }, []);

  const endDrag = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    cleanupCaptureLoss();

    const activeId = activePointerIdRef.current;
    const captured = capturedTargetRef.current;
    if (captured && activeId !== null) {
      try {
        if (captured.hasPointerCapture(activeId)) {
          captured.releasePointerCapture(activeId);
        }
      } catch {
        // Pointer capture may have already been released
      }
    }
    capturedTargetRef.current = null;
    activePointerIdRef.current = null;
    anchorRef.current = null;

    removeWindowListeners();

    if (draftRef.current) {
      onSelectionChange(draftRef.current);
    }
  }, [cleanupCaptureLoss, onSelectionChange, removeWindowListeners]);

  const handleWindowPointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current || e.pointerId !== activePointerIdRef.current) return;
    const container = heatmapsContainerRef.current;
    if (!container) return;

    // Scope pointer hit testing to current heatmap container
    const elem = document.elementFromPoint(e.clientX, e.clientY);
    if (!elem || !container.contains(elem)) return;

    const cell = elem.closest<HTMLElement>("[data-date]");
    if (cell && cell.dataset.date && anchorRef.current) {
      const nextDate = cell.dataset.date;
      const next = normalizeSelection(anchorRef.current, nextDate);
      if (
        !draftRef.current ||
        draftRef.current.from !== next.from ||
        draftRef.current.to !== next.to
      ) {
        draftRef.current = next;
        setDraft(next);
      }
    }
    e.preventDefault();
  }, []);

  const handleWindowPointerUp = useCallback(
    (e: PointerEvent) => {
      if (
        activePointerIdRef.current === null ||
        e.pointerId === activePointerIdRef.current
      ) {
        endDrag();
      }
    },
    [endDrag]
  );

  const handleWindowPointerCancel = useCallback(
    (e: PointerEvent) => {
      if (
        activePointerIdRef.current === null ||
        e.pointerId === activePointerIdRef.current
      ) {
        endDrag();
      }
    },
    [endDrag]
  );

  // Clean unmount of window listeners and capture-loss handlers
  useEffect(() => {
    return () => {
      cleanupCaptureLoss();
      removeWindowListeners();
    };
  }, [cleanupCaptureLoss, removeWindowListeners]);

  const handleContainerPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      if (
        activePointerIdRef.current !== null &&
        e.pointerId !== activePointerIdRef.current
      ) {
        return;
      }

      const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-date]");
      if (!cell || !cell.dataset.date) return;
      const d = cell.dataset.date;

      if (e.pointerType === "touch") {
        activePointerIdRef.current = e.pointerId;
        touchStartPosRef.current = { x: e.clientX, y: e.clientY };
        touchDateRef.current = d;
        return;
      }

      if (e.pointerType === "mouse" && e.button !== 0) return;

      cleanupCaptureLoss();

      activePointerIdRef.current = e.pointerId;
      anchorRef.current = d;
      capturedTargetRef.current = cell;
      isDraggingRef.current = true;
      setIsDragging(true);

      let hasCapture = false;
      try {
        cell.setPointerCapture(e.pointerId);
        hasCapture = true;
      } catch {
        // Element may not support capture in test/mock environment
      }

      const initialDraft = { from: d, to: d };
      draftRef.current = initialDraft;
      setDraft(initialDraft);
      setPendingTouchAnchor(null);

      windowPointerMoveRef.current = handleWindowPointerMove;
      windowPointerUpRef.current = handleWindowPointerUp;
      windowPointerCancelRef.current = handleWindowPointerCancel;

      window.addEventListener("pointermove", handleWindowPointerMove, {
        passive: false,
      });
      window.addEventListener("pointerup", handleWindowPointerUp);
      window.addEventListener("pointercancel", handleWindowPointerCancel);

      if (hasCapture) {
        const onLostCapture = () => {
          cleanupCaptureLoss();
          endDrag();
        };
        cell.addEventListener("lostpointercapture", onLostCapture);
        lostCaptureCleanupRef.current = () => {
          cell.removeEventListener("lostpointercapture", onLostCapture);
        };
      }

      e.preventDefault();
    },
    [
      cleanupCaptureLoss,
      handleWindowPointerMove,
      handleWindowPointerUp,
      handleWindowPointerCancel,
      endDrag,
    ]
  );

  const handleContainerPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (
        e.pointerType === "touch" &&
        e.pointerId === activePointerIdRef.current
      ) {
        const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-date]");
        const d = cell?.dataset.date ?? touchDateRef.current;
        if (d && touchStartPosRef.current) {
          const dist = Math.hypot(
            e.clientX - touchStartPosRef.current.x,
            e.clientY - touchStartPosRef.current.y
          );
          if (dist <= 10) {
            const pending = pendingTouchAnchorRef.current;
            if (!pending) {
              const next = { from: d, to: d };
              draftRef.current = next;
              setDraft(next);
              setPendingTouchAnchor(d);
              onSelectionChange(next);
            } else {
              const next = normalizeSelection(pending, d);
              draftRef.current = next;
              setDraft(next);
              setPendingTouchAnchor(null);
              onSelectionChange(next);
            }
          }
        }
        activePointerIdRef.current = null;
        touchStartPosRef.current = null;
        touchDateRef.current = null;
      }
    },
    [onSelectionChange]
  );

  const handleContainerPointerCancel = useCallback((e: React.PointerEvent) => {
    if (
      e.pointerType === "touch" &&
      e.pointerId === activePointerIdRef.current
    ) {
      activePointerIdRef.current = null;
      touchStartPosRef.current = null;
      touchDateRef.current = null;
    }
  }, []);

  const handleSelectMonth = useCallback(
    (year: number, month: number) => {
      const next = monthSelection(year, month);
      draftRef.current = next;
      setDraft(next);
      setPendingTouchAnchor(null);
      onSelectionChange(next);
    },
    [onSelectionChange]
  );

  const handleSelectYear = useCallback(
    (year: number) => {
      const next = yearSelection(year);
      draftRef.current = next;
      setDraft(next);
      setPendingTouchAnchor(null);
      onSelectionChange(next);
    },
    [onSelectionChange]
  );

  const handleClear = useCallback(() => {
    draftRef.current = null;
    setDraft(null);
    setPendingTouchAnchor(null);
    onSelectionChange(null);
  }, [onSelectionChange]);

  const handleOpenInOverview = useCallback(() => {
    if (draftRef.current) {
      onOpenInOverview(draftRef.current);
    }
  }, [onOpenInOverview]);

  // Memoize data calculations before any conditional returns
  const dayCounts = useMemo(() => {
    if (!data) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const d of data.days) {
      map.set(d.date, d.count);
    }
    return map;
  }, [data]);

  const thresholds = useMemo<[number, number, number]>(() => {
    if (!data) return [1, 1, 1];
    return calendarThresholds(data.days.map((d) => d.count));
  }, [data]);

  const years = useMemo(() => {
    if (!data || !data.firstDate) return [];
    return calendarYears(data.firstDate, data.today);
  }, [data]);

  const draftSummary = useMemo(() => {
    if (!data || !data.firstDate || !draft) return null;
    return summarizeCalendar(data.days, draft, {
      firstDate: data.firstDate,
      today: data.today,
    });
  }, [data, draft]);

  const activeTaste = hasTastePhases(taste) ? taste : null;
  const activeTasteLevel = activeTaste
    ? clampTasteLevel(activeTaste, tasteLevel)
    : null;

  const activePhases = useMemo(() => {
    if (!activeTaste || activeTasteLevel === null) return [];
    return phasesAtLevel(activeTaste, activeTasteLevel);
  }, [activeTaste, activeTasteLevel]);

  const phaseRowItems = useMemo(() => {
    if (!activeTaste || activeTasteLevel === null) return [];
    return tasteRow(activeTaste, activeTasteLevel);
  }, [activeTaste, activeTasteLevel]);

  const activePhaseId = useMemo(
    () => selectedPhaseId(activePhases, selection),
    [activePhases, selection],
  );
  const activePhaseIdRef = useRef<string | null>(activePhaseId);
  activePhaseIdRef.current = activePhaseId;

  const handleSelectPhase = useCallback(
    (phase: TastePhase) => {
      if (activePhaseIdRef.current === phase.id) {
        handleClear();
        return;
      }
      const next = phaseSelection(phase);
      draftRef.current = next;
      setDraft(next);
      setPendingTouchAnchor(null);
      onSelectionChange(next);
    },
    [handleClear, onSelectionChange],
  );

  const ribbonsByYear = useMemo(() => {
    if (!activeTaste || activeTasteLevel === null) return null;
    const phaseById = new Map<string, { phase: TastePhase; tone: TasteTone }>();
    activePhases.forEach((phase, idx) => {
      phaseById.set(phase.id, { phase, tone: idx % 2 === 0 ? "a" : "b" });
    });
    const map = new Map<number, YearRibbonData>();
    for (const year of years) {
      map.set(year, {
        desktop: desktopRibbon(year, activeTaste, activeTasteLevel),
        mobile: mobileRibbon(year, activeTaste, activeTasteLevel),
        phaseById,
      });
    }
    return map;
  }, [activeTaste, activeTasteLevel, activePhases, years]);

  // Skeleton only when loading with no data; return no content otherwise when data is null
  if (!data) {
    if (isLoading) {
      return (
        <div className="w-full flex flex-col gap-6">
          <div className="w-full border border-[#1C1C1A] bg-[#0B0B0A] p-4 animate-pulse">
            <div className="h-5 w-28 bg-[#141413] mb-4" />
            <div className="h-[180px] w-full bg-[#141413]" />
          </div>
        </div>
      );
    }
    return null;
  }

  // Loaded empty data state
  if (data.days.length === 0 || !data.firstDate) {
    return (
      <div className="w-full py-8 text-center font-mono text-[12px] text-[#5A5A55]">
        No Plays yet.
      </div>
    );
  }

  const draftFrom = draft?.from ?? null;
  const hasActiveSelection = Boolean(draft);
  const showSlider =
    activeTaste !== null &&
    activeTasteLevel !== null &&
    activeTaste.kEra < activeTaste.kFine;
  const levelLabel =
    activeTaste !== null && activeTasteLevel !== null
      ? tasteLevelLabel(activeTaste, activeTasteLevel)
      : "";

  const heatmapsContainer = (
    <div
      ref={heatmapsContainerRef}
      data-dragging={isDragging ? "true" : undefined}
      className="group w-full flex flex-col gap-6"
      onPointerDown={handleContainerPointerDown}
      onPointerUp={handleContainerPointerUp}
      onPointerCancel={handleContainerPointerCancel}
    >
      {years.map((year) => {
        const clipped = clipSelectionToYear(draft, year);
        const isAnchorYear =
          draftFrom !== null && draftFrom.slice(0, 4) === String(year);

        return (
          <YearBlock
            key={year}
            year={year}
            firstDate={data.firstDate}
            today={data.today}
            clippedSelection={clipped}
            hasActiveSelection={hasActiveSelection}
            isAnchorYear={isAnchorYear}
            dayCounts={dayCounts}
            thresholds={thresholds}
            ribbon={ribbonsByYear?.get(year) ?? null}
            selectedPhaseId={activePhaseId}
            onSelectMonth={handleSelectMonth}
            onSelectYear={handleSelectYear}
            onSelectPhase={handleSelectPhase}
          />
        );
      })}
    </div>
  );

  return (
    <div className="w-full flex flex-col">
      {/* Sticky selection bar */}
      <div className="sticky top-0 z-20 bg-[#080808] border-b border-[#26261F] py-2 px-3 sm:px-4 mb-4 flex items-center justify-between gap-3 flex-wrap font-mono text-[12px]">
        <div className="flex items-center content-center gap-x-2.5 gap-y-0 flex-wrap leading-[18px] min-h-[36px] sm:min-h-[26px]">
          {pendingTouchAnchor ? (
            <>
              {draft && (
                <span className="text-music-accent font-semibold">
                  {formatRangeLabel(selectionToRange(draft))}
                </span>
              )}
              <span className="text-[#5A5A55]">Tap an end day</span>
            </>
          ) : draft ? (
            <>
              <span className="text-music-accent font-semibold">
                {formatRangeLabel(selectionToRange(draft))}
              </span>
              <span className="text-[#5A5A55]">
                {draftSummary ? `${draftSummary.plays.toLocaleString("en-US")} plays` : ""}
              </span>
            </>
          ) : (
            <span className="text-[#5A5A55]">
              {activeTaste
                ? "Drag across days, pick a month, or pick a phase"
                : "Drag across days or pick a month"}
            </span>
          )}
        </div>
        <div className={showSlider ? "flex items-center gap-3 flex-wrap w-full sm:w-auto" : "flex items-center gap-3"}>
          {showSlider && activeTaste && activeTasteLevel !== null && (
            <div className="flex items-center gap-2 text-[11px] text-[#5A5A55] w-full sm:w-auto">
              <span>Eras</span>
              <input
                type="range"
                min={activeTaste.kEra}
                max={activeTaste.kFine}
                step={1}
                value={activeTasteLevel}
                onChange={(e) => onTasteLevelChange?.(Number(e.target.value))}
                aria-label="Taste detail"
                aria-valuetext={levelLabel}
                className="w-[120px] sm:w-[130px] cursor-pointer focus-ring"
                style={{ accentColor: "var(--music-accent)" }}
              />
              <span>Phases</span>
              <span className="text-[#EDEDE8] whitespace-nowrap tabular-nums min-w-[15ch]">{levelLabel}</span>
            </div>
          )}
          <button
            type="button"
            disabled={!draft}
            onClick={handleClear}
            className={`text-[#5A5A55] hover:text-[#EDEDE8] motion-hover focus-ring bg-transparent border-0 p-0 text-[12px] font-mono ${
              draft ? "cursor-pointer" : "invisible pointer-events-none"
            }`}
          >
            Clear
          </button>
          <button
            type="button"
            disabled={!draft}
            onClick={handleOpenInOverview}
            className="font-mono text-[12px] whitespace-nowrap py-[3px] px-2.5 rounded-none motion-hover focus-ring border border-music-accent text-music-accent bg-transparent hover:enabled:bg-music-accent/10 cursor-pointer flex items-center justify-center text-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:border-[#26261F] disabled:text-[#5A5A55]"
          >
            Open in Overview &rarr;
          </button>
        </div>
      </div>

      {activeTaste ? (
        <>
          <TastePhaseCards
            items={phaseRowItems}
            selectedPhaseId={activePhaseId}
            onSelectPhase={handleSelectPhase}
          />
          {heatmapsContainer}
        </>
      ) : (
        heatmapsContainer
      )}
    </div>
  );
};
