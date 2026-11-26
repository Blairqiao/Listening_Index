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

export type TasteRowItem = TasteCardItem;

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

function formatIsoUtc(ms: number): string {
  const d = new Date(ms);
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysIso(date: string, days: number): string {
  return formatIsoUtc(toUtcMs(date) + days * MS_PER_DAY);
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

export function mergeAdjacentGaps(gaps: readonly TasteGap[]): TasteGap[] {
  if (gaps.length <= 1) return gaps.map((g) => ({ ...g }));
  const sorted = [...gaps].sort((a, b) => a.start.localeCompare(b.start));
  const merged: TasteGap[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = sorted[i];
    if (addDaysIso(prev.end, 1) >= cur.start) {
      if (cur.end > prev.end) prev.end = cur.end;
      if (prev.plays !== undefined || cur.plays !== undefined) {
        prev.plays = (prev.plays ?? 0) + (cur.plays ?? 0);
      }
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

function splitPhaseAroundGaps(
  phase: TastePhase,
  gaps: readonly TasteGap[],
): TastePhase[] {
  if (gaps.length === 0) return [phase];
  const pieces: TastePhase[] = [];
  let curStart = phase.start;
  const curEnd = phase.end;

  for (const gap of gaps) {
    if (gap.end < curStart) continue;
    if (gap.start > curEnd) break;
    if (gap.start > curStart) {
      const pieceEnd = addDaysIso(gap.start, -1);
      pieces.push({
        ...phase,
        id: `${curStart}_${pieceEnd}`,
        start: curStart,
        end: pieceEnd,
      });
    }
    curStart = addDaysIso(gap.end, 1);
    if (curStart > curEnd) break;
  }

  if (curStart <= curEnd) {
    if (curStart === phase.start && pieces.length === 0) {
      pieces.push(phase);
    } else {
      pieces.push({
        ...phase,
        id: `${curStart}_${curEnd}`,
        start: curStart,
        end: curEnd,
      });
    }
  }
  return pieces;
}

export function phasesAtLevel(data: TastePhasesData, k: number): TastePhase[] {
  const rawActive = data.phases
    .filter((p) => !p.isGap && p.minK <= k && p.maxK >= k)
    .sort((a, b) => a.start.localeCompare(b.start));

  const gaps = visibleGaps(data);
  if (gaps.length === 0) return rawActive;

  const active = rawActive.flatMap((p) => splitPhaseAroundGaps(p, gaps));
  const gapPhases: TastePhase[] = gaps.map((gap) => ({
    id: `${gap.start}_${gap.end}`,
    start: gap.start,
    end: gap.end,
    minK: 1,
    maxK: data.kFine,
    plays: gap.plays ?? 0,
    topArtists: [],
    inShift: false,
    isGap: true,
  }));

  const combined = [...active, ...gapPhases].sort((a, b) =>
    a.start.localeCompare(b.start),
  );

  // Merge any back-to-back gap phases that have no active phase between them.
  const result: TastePhase[] = [];
  for (const phase of combined) {
    const prev = result[result.length - 1];
    if (prev && prev.isGap && phase.isGap) {
      const end = phase.end > prev.end ? phase.end : prev.end;
      result[result.length - 1] = {
        ...prev,
        end,
        id: `${prev.start}_${end}`,
        plays: prev.plays + phase.plays,
      };
    } else {
      result.push(phase);
    }
  }
  return result;
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
  const activePhases = data.phases.filter((p) => !p.isGap);
  if (activePhases.length === 0 || data.gaps.length === 0) return [];
  let firstStart = activePhases[0].start;
  let lastEnd = activePhases[0].end;
  for (let i = 1; i < activePhases.length; i++) {
    const p = activePhases[i];
    if (p.start < firstStart) firstStart = p.start;
    if (p.end > lastEnd) lastEnd = p.end;
  }
  const interior = data.gaps.filter(
    (g) => g.start > firstStart && g.end < lastEnd,
  );
  return mergeAdjacentGaps(interior);
}

export function tasteRow(data: TastePhasesData, k: number): TasteRowItem[] {
  const phases = phasesAtLevel(data, k);
  const items: TasteRowItem[] = [];
  let activeIdx = 0;

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const prev = i > 0 ? phases[i - 1] : null;
    const tone: TasteTone = phase.isGap
      ? "a"
      : activeIdx++ % 2 === 0
        ? "a"
        : "b";
    const shiftIn =
      i === 0 || phase.isGap || prev?.isGap
        ? null
        : shiftAtLevel(data, phase.start, k);

    items.push({
      kind: "phase",
      phase,
      tone,
      shiftIn,
    });
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

/** The count the Calendar slider shows beside it: "5 eras", "1 era", "9 phases". */
export function tasteLevelShortLabel(data: TastePhasesData, k: number): string {
  if (k === data.kEra) return `${k} ${k === 1 ? "era" : "eras"}`;
  return `${k} ${k === 1 ? "phase" : "phases"}`;
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
  const pieces: DesktopRibbonPiece[] = [];
  let activeIdx = 0;

  for (const phase of phases) {
    const span = clipSpanToDesktopCols(year, phase.start, phase.end);
    if (phase.isGap) {
      if (!span) continue;
      pieces.push({
        kind: "gap",
        colStart: span.colStart,
        colEnd: span.colEnd,
        phaseId: phase.id,
      });
    } else {
      const tone: TasteTone = activeIdx++ % 2 === 0 ? "a" : "b";
      if (!span) continue;
      pieces.push({
        kind: "phase",
        colStart: span.colStart,
        colEnd: span.colEnd,
        phaseId: phase.id,
        tone,
      });
    }
  }

  for (let i = 1; i < phases.length; i++) {
    const prev = phases[i - 1];
    const next = phases[i];
    if (prev.isGap || next.isGap) continue;
    const shift = shiftAtLevel(data, next.start, k);
    if (!shift || shift.kind !== "gradual") continue;
    const rampStart = shift.rampStart < prev.start ? prev.start : shift.rampStart;
    const rampEnd = shift.rampEnd > next.end ? next.end : shift.rampEnd;
    if (rampStart > rampEnd) continue;
    const span = clipSpanToDesktopCols(year, rampStart, rampEnd);
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
  const pieces: MobileRibbonPiece[] = [];
  let activeIdx = 0;

  for (const phase of phases) {
    const span = clipSpanToMobilePct(year, phase.start, phase.end);
    if (phase.isGap) {
      if (!span) continue;
      pieces.push({
        kind: "gap",
        leftPct: span.leftPct,
        widthPct: span.widthPct,
        phaseId: phase.id,
      });
    } else {
      const tone: TasteTone = activeIdx++ % 2 === 0 ? "a" : "b";
      if (!span) continue;
      pieces.push({
        kind: "phase",
        leftPct: span.leftPct,
        widthPct: span.widthPct,
        phaseId: phase.id,
        tone,
      });
    }
  }

  for (let i = 1; i < phases.length; i++) {
    const prev = phases[i - 1];
    const next = phases[i];
    if (prev.isGap || next.isGap) continue;
    const shift = shiftAtLevel(data, next.start, k);
    if (!shift || shift.kind !== "gradual") continue;
    const rampStart = shift.rampStart < prev.start ? prev.start : shift.rampStart;
    const rampEnd = shift.rampEnd > next.end ? next.end : shift.rampEnd;
    if (rampStart > rampEnd) continue;
    const span = clipSpanToMobilePct(year, rampStart, rampEnd);
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
