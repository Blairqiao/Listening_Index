import type { RangeSelection } from "@/lib/range";

/** One local calendar day with at least one Play. */
export interface CalendarDay {
  date: string /* "YYYY-MM-DD" in the request timezone */;
  count: number /* >= 1 */;
}

/** GET /api/listening/calendar response. */
export interface CalendarData {
  days: CalendarDay[]; // ascending by date; days with no Plays are omitted
  firstDate: string | null; // date of the first Play; null when there are no Plays
  today: string; // the server's current local date in `timezone`
  timezone: string; // resolved IANA timezone the days were grouped in
}

/** Inclusive local dates, from <= to. */
export interface CalendarSelection {
  from: string;
  to: string;
}

export type CalendarLevel = 0 | 1 | 2 | 3 | 4;

export interface CalendarSummary {
  plays: number;
  activeDays: number; // days in the span with >= 1 Play
  spanDays: number; // inclusive days of the span clipped to [firstDate, today]; 0 if no overlap
  dailyAvg: number; // plays / max(1, spanDays)
  peak: CalendarDay | null; // highest count in the span, earliest date on ties
}

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

function utcMs(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): number {
  const d = new Date(0);
  d.setUTCFullYear(year, monthIndex, day);
  d.setUTCHours(hour, minute, second, 0);
  return d.getTime();
}

/**
 * Counts > 0 only, sorted ascending. Nearest-rank 25th, 50th and 75th percentiles:
 * sorted[Math.ceil(p * n) - 1] for p = 0.25, 0.5, 0.75. No positive counts → [1, 1, 1].
 */
export function calendarThresholds(
  counts: readonly number[],
): [number, number, number] {
  const filtered = counts.filter((c) => c > 0);
  if (filtered.length === 0) {
    return [1, 1, 1];
  }
  const sorted = [...filtered].sort((a, b) => a - b);
  const n = sorted.length;
  const p25 = sorted[Math.ceil(0.25 * n) - 1];
  const p50 = sorted[Math.ceil(0.5 * n) - 1];
  const p75 = sorted[Math.ceil(0.75 * n) - 1];
  return [p25, p50, p75];
}

/**
 * count <= 0 → 0; <= t[0] → 1; <= t[1] → 2; <= t[2] → 3; else 4.
 */
export function calendarLevel(
  count: number,
  t: [number, number, number],
): CalendarLevel {
  if (count <= 0) return 0;
  if (count <= t[0]) return 1;
  if (count <= t[1]) return 2;
  if (count <= t[2]) return 3;
  return 4;
}

/** Swaps so from <= to */
export function normalizeSelection(a: string, b: string): CalendarSelection {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

/** window → {from,to}; preset → null */
export function selectionFromRange(
  sel: RangeSelection,
): CalendarSelection | null {
  if (sel.kind === "window") {
    return { from: sel.from, to: sel.to };
  }
  return null;
}

/** { kind: "window", ...sel } */
export function selectionToRange(sel: CalendarSelection): RangeSelection {
  return { kind: "window", from: sel.from, to: sel.to };
}

/** month 1–12, whole month, not clipped */
export function monthSelection(year: number, month: number): CalendarSelection {
  const yStr = String(year).padStart(4, "0");
  const mStr = String(month).padStart(2, "0");
  const lastDay = new Date(utcMs(year, month, 0)).getUTCDate();
  const dStr = String(lastDay).padStart(2, "0");
  return {
    from: `${yStr}-${mStr}-01`,
    to: `${yStr}-${mStr}-${dStr}`,
  };
}

/** Jan 1 – Dec 31, not clipped */
export function yearSelection(year: number): CalendarSelection {
  const yStr = String(year).padStart(4, "0");
  return {
    from: `${yStr}-01-01`,
    to: `${yStr}-12-31`,
  };
}

/** firstDate <= date <= today */
export function isSelectableDate(
  date: string,
  firstDate: string | null,
  today: string,
): boolean {
  if (firstDate === null) return false;
  return date >= firstDate && date <= today;
}

/** newest first, today's year down to firstDate's year; [] when firstDate is null */
export function calendarYears(firstDate: string | null, today: string): number[] {
  if (firstDate === null) return [];
  const todayYear = parseInt(today.slice(0, 4), 10);
  const firstYear = parseInt(firstDate.slice(0, 4), 10);
  const years: number[] = [];
  for (let y = todayYear; y >= firstYear; y--) {
    years.push(y);
  }
  return years;
}

/**
 * 53 columns × 7 rows, Sunday first (row 0 = Sunday). Column 0 holds Jan 1 at row (weekday of Jan 1, Sunday = 0).
 * Cells outside the year are null. Some years need 54 columns (a leap year starting on Saturday):
 * return as many columns as needed, at least 53.
 */
export function weekColumns(year: number): Array<Array<string | null>> {
  const jan1 = new Date(utcMs(year, 0, 1));
  const startRow = jan1.getUTCDay();
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const totalDays = isLeap ? 366 : 365;

  const maxCol = Math.floor((startRow + totalDays - 1) / 7);
  const numCols = Math.max(53, maxCol + 1);

  const columns: Array<Array<string | null>> = Array.from(
    { length: numCols },
    () => new Array<string | null>(7).fill(null),
  );

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(utcMs(year, 0, 1 + i));
    const yStr = String(d.getUTCFullYear()).padStart(4, "0");
    const mStr = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dStr = String(d.getUTCDate()).padStart(2, "0");
    const dateKey = `${yStr}-${mStr}-${dStr}`;

    const linearIndex = startRow + i;
    const col = Math.floor(linearIndex / 7);
    const row = linearIndex % 7;

    columns[col][row] = dateKey;
  }

  return columns;
}

/** 12 entries: the column index holding the 1st of each month */
export function monthStartColumns(year: number): number[] {
  const jan1 = new Date(utcMs(year, 0, 1));
  const startRow = jan1.getUTCDay();
  const cols: number[] = [];
  for (let m = 0; m < 12; m++) {
    const firstOfMonth = new Date(utcMs(year, m, 1));
    const dayOfYear = Math.round(
      (firstOfMonth.getTime() - jan1.getTime()) / 86_400_000,
    );
    const col = Math.floor((startRow + dayOfYear) / 7);
    cols.push(col);
  }
  return cols;
}

/** null if no overlap */
export function clipSelectionToYear(
  sel: CalendarSelection | null,
  year: number,
): CalendarSelection | null {
  if (sel === null) return null;
  const { from: yearStart, to: yearEnd } = yearSelection(year);
  if (sel.to < yearStart || sel.from > yearEnd) return null;
  return {
    from: sel.from < yearStart ? yearStart : sel.from,
    to: sel.to > yearEnd ? yearEnd : sel.to,
  };
}

export function summarizeCalendar(
  days: readonly CalendarDay[],
  sel: CalendarSelection | null,
  bounds: { firstDate: string | null; today: string },
): CalendarSummary {
  if (bounds.firstDate === null) {
    return {
      plays: 0,
      activeDays: 0,
      spanDays: 0,
      dailyAvg: 0,
      peak: null,
    };
  }

  const spanFrom = sel ? sel.from : bounds.firstDate;
  const spanTo = sel ? sel.to : bounds.today;

  const clipFrom = spanFrom < bounds.firstDate ? bounds.firstDate : spanFrom;
  const clipTo = spanTo > bounds.today ? bounds.today : spanTo;

  if (clipFrom > clipTo) {
    return {
      plays: 0,
      activeDays: 0,
      spanDays: 0,
      dailyAvg: 0,
      peak: null,
    };
  }

  const [yFrom, mFrom, dFromNum] = clipFrom.split("-").map(Number);
  const [yTo, mTo, dToNum] = clipTo.split("-").map(Number);
  const dFrom = utcMs(yFrom, mFrom - 1, dFromNum);
  const dTo = utcMs(yTo, mTo - 1, dToNum);
  const spanDays = Math.round((dTo - dFrom) / 86_400_000) + 1;

  let plays = 0;
  let activeDays = 0;
  let peak: CalendarDay | null = null;

  for (const day of days) {
    if (day.date >= clipFrom && day.date <= clipTo) {
      plays += day.count;
      activeDays += 1;
      if (
        peak === null ||
        day.count > peak.count ||
        (day.count === peak.count && day.date < peak.date)
      ) {
        peak = day;
      }
    }
  }

  const dailyAvg = plays / Math.max(1, spanDays);

  return {
    plays,
    activeDays,
    spanDays,
    dailyAvg,
    peak,
  };
}

/**
 * [plays.toLocaleString("en-US"), `${activeDays} / ${spanDays}`, dailyAvg.toFixed(1), peak]
 * peak: "--" when null. "Nov 3 · 77" when the span (sel, or firstDate..today) starts and ends in one
 * calendar year, else "Nov 3 ’25 · 77" (U+2019 then the two-digit year).
 */
export function formatCalendarMetrics(
  summary: CalendarSummary,
  sel: CalendarSelection | null,
  bounds: { firstDate: string | null; today: string },
): [string, string, string, string] {
  const playsStr = summary.plays.toLocaleString("en-US");
  const activeDaysStr = `${summary.activeDays} / ${summary.spanDays}`;
  const dailyAvgStr = summary.dailyAvg.toFixed(1);

  if (summary.peak === null) {
    return [playsStr, activeDaysStr, dailyAvgStr, "--"];
  }

  const spanFrom = sel ? sel.from : bounds.firstDate;
  const spanTo = sel ? sel.to : bounds.today;

  const startYear = spanFrom ? spanFrom.slice(0, 4) : "";
  const endYear = spanTo ? spanTo.slice(0, 4) : "";
  const sameYear = startYear !== "" && startYear === endYear;

  const [pYearStr, pMonthStr, pDayStr] = summary.peak.date.split("-");
  const pMonth = parseInt(pMonthStr, 10);
  const pDay = parseInt(pDayStr, 10);
  const monthName = SHORT_MONTHS[pMonth - 1];

  let peakStr: string;
  if (sameYear) {
    peakStr = `${monthName} ${pDay} \u00B7 ${summary.peak.count}`;
  } else {
    const twoDigitYear = pYearStr.slice(-2);
    peakStr = `${monthName} ${pDay} \u2019${twoDigitYear} \u00B7 ${summary.peak.count}`;
  }

  return [playsStr, activeDaysStr, dailyAvgStr, peakStr];
}
