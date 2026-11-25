import {
  addCalendarDays,
  daysBetween,
  exactUnitOf,
  formatRangeLabel,
  normalizeLegacyRange,
  unitBounds,
  weekdayIndex,
  type CalendarUnit,
  type RangeSelection,
} from "@/lib/range";

export type RulerLevel = "all" | CalendarUnit;

/** Zoom levels ordered from zoomed out to zoomed in. */
export const LEVELS: readonly RulerLevel[] = [
  "all",
  "year",
  "month",
  "week",
  "day",
];

/** Phantom unit padding on each side of the archive per calendar unit. */
export const PAD: Record<CalendarUnit, number> = {
  day: 60,
  week: 30,
  month: 24,
  year: 8,
};

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

export interface RulerUnit {
  from: string;
  to: string;
  phantom: boolean;
  monthStart: boolean;
  yearStart: boolean;
  weekStart: boolean;
  short: string;
}

export type TickRank = "major" | "medium" | "minor";

export interface RulerPlacement {
  level: RulerLevel;
  anchorKey: string;
  exact: boolean;
  label: string | null;
}

function parseParts(dateKey: string): [number, number, number] {
  const [y, m, d] = dateKey.split("-").map(Number);
  return [y, m, d];
}

function buildUnitFlags(
  unit: CalendarUnit,
  from: string,
  to: string,
): { monthStart: boolean; yearStart: boolean; weekStart: boolean; short: string } {
  const [fy, fm, fd] = parseParts(from);
  if (unit === "day") {
    return {
      monthStart: fd === 1,
      yearStart: fm === 1 && fd === 1,
      weekStart: weekdayIndex(from) === 0,
      short: String(fd),
    };
  }
  if (unit === "week") {
    const [ty, tm, td] = parseParts(to);
    return {
      monthStart: fm !== tm || fd === 1,
      yearStart: fy !== ty || (fm === 1 && fd === 1),
      weekStart: true,
      short: String(td),
    };
  }
  if (unit === "month") {
    return {
      monthStart: true,
      yearStart: fm === 1,
      weekStart: false,
      short: SHORT_MONTHS[fm - 1],
    };
  }
  return {
    monthStart: true,
    yearStart: true,
    weekStart: false,
    short: from.slice(0, 4),
  };
}

/**
 * Builds an unclamped, padded list of calendar units spanning from `PAD[unit]`
 * units before `firstKey` to `PAD[unit]` units after `todayKey`.
 */
export function buildRulerUnits(
  unit: CalendarUnit,
  firstKey: string,
  todayKey: string,
): { units: RulerUnit[]; realFirst: number; realLast: number } {
  const padCount = PAD[unit];
  let curStart = unitBounds(firstKey, unit).from;
  for (let i = 0; i < padCount; i++) {
    curStart = unitBounds(addCalendarDays(curStart, -1), unit).from;
  }

  let curEnd = unitBounds(todayKey, unit).to;
  for (let i = 0; i < padCount; i++) {
    curEnd = unitBounds(addCalendarDays(curEnd, 1), unit).to;
  }

  const units: RulerUnit[] = [];
  let realFirst = -1;
  let realLast = -1;
  let cur = curStart;

  while (cur <= curEnd) {
    const { from, to } = unitBounds(cur, unit);
    const phantom = to < firstKey || from > todayKey;
    const { monthStart, yearStart, weekStart, short } = buildUnitFlags(unit, from, to);

    if (!phantom) {
      if (realFirst === -1) realFirst = units.length;
      realLast = units.length;
    }

    units.push({ from, to, phantom, monthStart, yearStart, weekStart, short });
    cur = addCalendarDays(to, 1);
  }

  return { units, realFirst, realLast };
}

/** Binary-searches a sorted ruler unit list for `dateKey`, or -1 when outside. */
export function indexForDate(units: RulerUnit[], dateKey: string): number {
  if (!units.length || !dateKey) return -1;
  let low = 0;
  let high = units.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const u = units[mid];
    if (dateKey < u.from) {
      high = mid - 1;
    } else if (dateKey > u.to) {
      low = mid + 1;
    } else {
      return mid;
    }
  }
  return -1;
}

/** Returns the boundary label for a unit at the given zoom level, or null. */
export function boundaryLabel(level: RulerLevel, u: RulerUnit): string | null {
  if (level === "day") {
    if (!u.monthStart) return null;
    if (u.yearStart) return u.from.slice(0, 4);
    return SHORT_MONTHS[Number(u.from.slice(5, 7)) - 1];
  }
  if (level === "week") {
    if (!u.monthStart) return null;
    if (u.yearStart) return u.to.slice(0, 4);
    return SHORT_MONTHS[Number(u.to.slice(5, 7)) - 1];
  }
  if (level === "month") {
    return u.yearStart ? u.from.slice(0, 4) : u.short;
  }
  return u.short;
}

/** Structural major-tick rule; ignores `u.phantom`. */
export function isMajorTick(level: RulerLevel, u: RulerUnit): boolean {
  if (level === "day" || level === "week") return u.monthStart;
  if (level === "month") return u.yearStart;
  return true;
}

/** Structural tick rank rule; ignores `u.phantom`. */
export function tickRank(level: RulerLevel, u: RulerUnit): TickRank {
  if (isMajorTick(level, u)) return "major";
  if (level === "day" && u.weekStart && !u.monthStart) return "medium";
  return "minor";
}

/** Returns the Sunday day-number label at the day level (non-month-start), else null. */
export function weekStartLabel(level: RulerLevel, u: RulerUnit): string | null {
  if (level === "day" && u.weekStart && !u.monthStart) return u.short;
  return null;
}

function clampDateKey(key: string, firstKey: string, todayKey: string): string {
  if (key < firstKey) return firstKey;
  if (key > todayKey) return todayKey;
  return key;
}

function levelForSpan(spanDays: number): RulerLevel {
  if (spanDays <= 1) return "day";
  if (spanDays <= 7) return "week";
  if (spanDays <= 31) return "month";
  if (spanDays <= 366) return "year";
  return "all";
}

/** Maps a range selection to its ruler zoom level, clamped anchor date, and label. */
export function placementForRange(
  sel: RangeSelection,
  firstKey: string,
  todayKey: string,
): RulerPlacement {
  if (sel.kind === "preset" && sel.key === "all") {
    return { level: "all", anchorKey: todayKey, exact: true, label: null };
  }

  const normalized = normalizeLegacyRange(sel, todayKey);
  const exact = exactUnitOf(normalized);
  if (exact && normalized.kind === "window") {
    // The anchor decides which unit a zoom lands on, so it sits where the
    // reticle would after a pan: today inside the current unit, else the
    // unit's middle day. Anchoring on `from` made + open the wrong child unit.
    const { from, to } = normalized;
    const anchor =
      from <= todayKey && todayKey <= to
        ? todayKey
        : addCalendarDays(from, Math.floor(daysBetween(from, to) / 2));
    return {
      level: exact.unit,
      anchorKey: clampDateKey(anchor, firstKey, todayKey),
      exact: true,
      label: null,
    };
  }

  if (normalized.kind !== "window") {
    return { level: "all", anchorKey: todayKey, exact: true, label: null };
  }

  const diffDays = daysBetween(normalized.from, normalized.to);
  const middleKey = addCalendarDays(normalized.from, Math.floor(diffDays / 2));

  return {
    level: levelForSpan(diffDays + 1),
    anchorKey: clampDateKey(middleKey, firstKey, todayKey),
    exact: false,
    label: formatRangeLabel(normalized),
  };
}
