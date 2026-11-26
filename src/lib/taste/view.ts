import type { CalendarSelection } from "@/lib/calendar";
import type {
  TasteGap,
  TastePhase,
  TastePhasesData,
  TasteShiftAtLevel,
} from "@/lib/taste/types";

const MS_PER_DAY = 86_400_000;

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

export type TasteTone = "a" | "b";

export interface TasteCardItem {
  kind: "phase";
  phase: TastePhase;
  tone: TasteTone;
  shiftIn: TasteShiftAtLevel | null;
}

export interface TasteGapItem {
  kind: "gap";
  gap: TasteGap;
  weeks: number;
}

export type TasteRowItem = TasteCardItem | TasteGapItem;

export interface DesktopRibbonPiece {
  kind: "phase" | "gap" | "ramp";
  colStart: number;
  colEnd: number;
  phaseId?: string;
  tone?: TasteTone;
  from?: string;
  to?: string;
}

export interface MobileRibbonPiece {
  kind: "phase" | "gap" | "ramp";
  leftPct: number;
  widthPct: number;
  phaseId?: string;
  tone?: TasteTone;
  from?: string;
  to?: string;
}

function parseIsoDate(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

function toUtcMs(date: string): number {
  const [y, m, d] = parseIsoDate(date);
  return Date.UTC(y, m - 1, d);
}

export function inclusiveWeeks(start: string, end: string): number {
  const diffDays = Math.round((toUtcMs(end) - toUtcMs(start)) / MS_PER_DAY) + 1;
  return Math.max(1, Math.round(diffDays / 7));
}

export function formatTasteMonthYear(date: string): string {
  const [y, m] = parseIsoDate(date);
  return `${SHORT_MONTHS[m - 1]} ${String(y).slice(-2)}`;
}

export function formatTasteDateSpan(start: string, end: string): string {
  return `${formatTasteMonthYear(start)} \u2013 ${formatTasteMonthYear(end)}`;
}

export function hasTastePhases(
  data: TastePhasesData | null,
): data is TastePhasesData {
  return data !== null && data.kFine > 1;
}

export function clampTasteLevel(
  data: TastePhasesData,
  k: number | null,
): number {
  if (k === null || !Number.isInteger(k) || k < data.kEra || k > data.kFine) {
    return data.kEra;
  }
  return k;
}

export function phasesAtLevel(data: TastePhasesData, k: number): TastePhase[] {
  return data.phases
    .filter((p) => p.minK <= k && p.maxK >= k)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function shiftAtLevel(
  data: TastePhasesData,
  week: string,
  k: number,
): TasteShiftAtLevel | null {
  const shift = data.shifts.find((s) => s.week === week && s.minK <= k);
  if (!shift) return null;
  return shift.levels.find((l) => l.k === k) ?? null;
}

export function visibleGaps(data: TastePhasesData): TasteGap[] {
  if (data.phases.length === 0 || data.gaps.length === 0) return [];
  let firstStart = data.phases[0].start;
  let lastEnd = data.phases[0].end;
  for (let i = 1; i < data.phases.length; i++) {
    const p = data.phases[i];
    if (p.start < firstStart) firstStart = p.start;
    if (p.end > lastEnd) lastEnd = p.end;
  }
  return data.gaps
    .filter((g) => g.start > firstStart && g.end < lastEnd)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function tasteRow(data: TastePhasesData, k: number): TasteRowItem[] {
  const phases = phasesAtLevel(data, k);
  const gaps = visibleGaps(data);

  const gapsAfterPhase = new Map<number, TasteGap[]>();
  for (const gap of gaps) {
    let targetIdx = -1;
    for (let i = 0; i < phases.length; i++) {
      if (phases[i].start < gap.start) {
        targetIdx = i;
      } else {
        break;
      }
    }
    if (targetIdx >= 0) {
      const bucket = gapsAfterPhase.get(targetIdx);
      if (bucket) {
        bucket.push(gap);
      } else {
        gapsAfterPhase.set(targetIdx, [gap]);
      }
    }
  }

  const items: TasteRowItem[] = [];
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    items.push({
      kind: "phase",
      phase,
      tone: i % 2 === 0 ? "a" : "b",
      shiftIn: i === 0 ? null : shiftAtLevel(data, phase.start, k),
    });
    const after = gapsAfterPhase.get(i);
    if (after) {
      for (const gap of after) {
        items.push({
          kind: "gap",
          gap,
          weeks: inclusiveWeeks(gap.start, gap.end),
        });
      }
    }
  }
  return items;
}

export function phaseSelection(p: TastePhase): CalendarSelection {
  return { from: p.start, to: p.end };
}

export function selectedPhaseId(
  phases: TastePhase[],
  sel: CalendarSelection | null,
): string | null {
  if (!sel) return null;
  const match = phases.find((p) => p.start === sel.from && p.end === sel.to);
  return match ? match.id : null;
}

export function tasteLevelLabel(data: TastePhasesData, k: number): string {
  if (k === data.kEra) {
    return `${k} Taste ${k === 1 ? "Era" : "Eras"}`;
  }
  return `${k} Taste ${k === 1 ? "Phase" : "Phases"}`;
}

function clipSpanToDesktopCols(
  year: number,
  start: string,
  end: string,
): { colStart: number; colEnd: number } | null {
  const yStr = String(year).padStart(4, "0");
  const yearStart = `${yStr}-01-01`;
  const yearEnd = `${yStr}-12-31`;
  if (end < yearStart || start > yearEnd) return null;

  const jan1Ms = Date.UTC(year, 0, 1);
  const jan1Dow = new Date(jan1Ms).getUTCDay();
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const totalDays = isLeap ? 366 : 365;
  const lastCol = Math.floor((jan1Dow + totalDays - 1) / 7);

  const clippedStart = start < yearStart ? yearStart : start;
  const clippedEnd = end > yearEnd ? yearEnd : end;

  const startDay0 = Math.round((toUtcMs(clippedStart) - jan1Ms) / MS_PER_DAY);
  const endDay0 = Math.round((toUtcMs(clippedEnd) - jan1Ms) / MS_PER_DAY);

  const colStart = Math.max(0, Math.floor((jan1Dow + startDay0) / 7));
  const colEnd = Math.min(lastCol, Math.floor((jan1Dow + endDay0) / 7));
  if (colStart > colEnd) return null;
  return { colStart, colEnd };
}

export function desktopRibbon(
  year: number,
  data: TastePhasesData,
  k: number,
): DesktopRibbonPiece[] {
  const phases = phasesAtLevel(data, k);
  const gaps = visibleGaps(data);
  const pieces: DesktopRibbonPiece[] = [];

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const span = clipSpanToDesktopCols(year, phase.start, phase.end);
    if (!span) continue;
    pieces.push({
      kind: "phase",
      colStart: span.colStart,
      colEnd: span.colEnd,
      phaseId: phase.id,
      tone: i % 2 === 0 ? "a" : "b",
    });
  }

  for (const gap of gaps) {
    const span = clipSpanToDesktopCols(year, gap.start, gap.end);
    if (!span) continue;
    pieces.push({
      kind: "gap",
      colStart: span.colStart,
      colEnd: span.colEnd,
    });
  }

  for (let i = 1; i < phases.length; i++) {
    const prev = phases[i - 1];
    const next = phases[i];
    const shift = shiftAtLevel(data, next.start, k);
    if (!shift || shift.kind !== "gradual") continue;
    const span = clipSpanToDesktopCols(year, shift.rampStart, shift.rampEnd);
    if (!span) continue;
    pieces.push({
      kind: "ramp",
      colStart: span.colStart,
      colEnd: span.colEnd,
      from: prev.id,
      to: next.id,
    });
  }

  return pieces;
}

function mobileEdgePct(date: string, year: number, endOfDay: boolean): number {
  const yStr = String(year).padStart(4, "0");
  if (date < `${yStr}-01-01`) return 0;
  if (date > `${yStr}-12-31`) return 100;
  const [, month, day] = parseIsoDate(date);
  const month0 = month - 1;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return ((month0 + (day - (endOfDay ? 0 : 1)) / daysInMonth) / 12) * 100;
}

function clipSpanToMobilePct(
  year: number,
  start: string,
  end: string,
): { leftPct: number; widthPct: number } | null {
  const yStr = String(year).padStart(4, "0");
  const yearStart = `${yStr}-01-01`;
  const yearEnd = `${yStr}-12-31`;
  if (end < yearStart || start > yearEnd) return null;

  const leftPct = Math.max(0, Math.min(100, mobileEdgePct(start, year, false)));
  const rightPct = Math.max(0, Math.min(100, mobileEdgePct(end, year, true)));
  const widthPct = rightPct - leftPct;
  if (widthPct <= 0) return null;
  return { leftPct, widthPct };
}

export function mobileRibbon(
  year: number,
  data: TastePhasesData,
  k: number,
): MobileRibbonPiece[] {
  const phases = phasesAtLevel(data, k);
  const gaps = visibleGaps(data);
  const pieces: MobileRibbonPiece[] = [];

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const span = clipSpanToMobilePct(year, phase.start, phase.end);
    if (!span) continue;
    pieces.push({
      kind: "phase",
      leftPct: span.leftPct,
      widthPct: span.widthPct,
      phaseId: phase.id,
      tone: i % 2 === 0 ? "a" : "b",
    });
  }

  for (const gap of gaps) {
    const span = clipSpanToMobilePct(year, gap.start, gap.end);
    if (!span) continue;
    pieces.push({
      kind: "gap",
      leftPct: span.leftPct,
      widthPct: span.widthPct,
    });
  }

  for (let i = 1; i < phases.length; i++) {
    const prev = phases[i - 1];
    const next = phases[i];
    const shift = shiftAtLevel(data, next.start, k);
    if (!shift || shift.kind !== "gradual") continue;
    const span = clipSpanToMobilePct(year, shift.rampStart, shift.rampEnd);
    if (!span) continue;
    pieces.push({
      kind: "ramp",
      leftPct: span.leftPct,
      widthPct: span.widthPct,
      from: prev.id,
      to: next.id,
    });
  }

  return pieces;
}
