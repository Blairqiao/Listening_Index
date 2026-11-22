import { RANGE_KEYS, type ActivityBucket, type RangeKey } from "@/lib/types";

export type RangeSelection =
  | { kind: "preset"; key: RangeKey }
  | { kind: "window"; from: string; to: string };

/** Half-open UTC time window [from, to) encoded as ISO-8601 instants. */
export interface TimeWindow {
  from: string;
  to: string;
}

export type CadenceGranularity =
  | "hour"
  | "block6h"
  | "day"
  | "week"
  | "month"
  | "year";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const RANGE_KEY_SET = new Set<string>(RANGE_KEYS);
const WINDOW_PARAM_RE = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;
const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export const PRESET_SPAN_MS: Record<Exclude<RangeKey, "all">, number> = {
  "1d": 24 * HOUR_MS,
  "1w": 7 * DAY_MS,
  "1m": 30 * DAY_MS,
  "6m": 180 * DAY_MS,
  "1y": 365 * DAY_MS,
};

export const PRESET_GRANULARITY: Record<RangeKey, CadenceGranularity> = {
  "1d": "hour",
  "1w": "block6h",
  "1m": "day",
  "6m": "week",
  "1y": "month",
  all: "year",
};

export const DEFAULT_OVERVIEW_RANGE: RangeSelection = {
  kind: "preset",
  key: "1w",
};

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

function compareLocalDateTime(
  a: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  b: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  if (a.day !== b.day) return a.day - b.day;
  if (a.hour !== b.hour) return a.hour - b.hour;
  if (a.minute !== b.minute) return a.minute - b.minute;
  return a.second - b.second;
}

function parseCalendarDate(
  dateKey: string,
): { year: number; month: number; day: number } | null {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const d = new Date(utcMs(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function formatCalendarDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const d = new Date(utcMs(year, month - 1, day + days));
  return formatCalendarDate(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
  );
}

function daysInMonth(year: number, month: number): number {
  return new Date(utcMs(year, month, 0)).getUTCDate();
}

export function presetRange(key: RangeKey): RangeSelection {
  return { kind: "preset", key };
}

export function parseRangeParam(
  raw: string | null | undefined,
): RangeSelection | null {
  if (!raw) return null;
  if (RANGE_KEY_SET.has(raw)) {
    return { kind: "preset", key: raw as RangeKey };
  }

  const match = WINDOW_PARAM_RE.exec(raw);
  if (!match) return null;

  const [, from, to] = match;
  const fromParts = parseCalendarDate(from);
  const toParts = parseCalendarDate(to);
  if (!fromParts || !toParts) return null;
  if (from > to) return null;

  const maxYear = fromParts.year + 100;
  if (
    toParts.year > maxYear ||
    (toParts.year === maxYear &&
      (toParts.month > fromParts.month ||
        (toParts.month === fromParts.month && toParts.day > fromParts.day)))
  ) {
    return null;
  }

  return { kind: "window", from, to };
}

export function formatRangeParam(sel: RangeSelection): string {
  return sel.kind === "preset" ? sel.key : `${sel.from}..${sel.to}`;
}

export function isSameRange(a: RangeSelection, b: RangeSelection): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "preset" && b.kind === "preset") {
    return a.key === b.key;
  }
  if (a.kind === "window" && b.kind === "window") {
    return a.from === b.from && a.to === b.to;
  }
  return false;
}

export function getLocalCalendarParts(
  date: Date,
  tz: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    era: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const rawYear = Number(m.year);
  return {
    year: m.era === "BC" ? 1 - rawYear : rawYear,
    month: Number(m.month),
    day: Number(m.day),
    hour: Number(m.hour),
    minute: Number(m.minute),
    second: Number(m.second),
  };
}

export function localDateKey(instant: Date, tz: string): string {
  const p = getLocalCalendarParts(instant, tz);
  return formatCalendarDate(p.year, p.month, p.day);
}

export function localWallClockToInstant(
  dateKey: string,
  hour: number,
  tz: string,
): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const targetParts = { year: y, month: m, day: d, hour, minute: 0, second: 0 };
  const target = utcMs(y, m - 1, d, hour);
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const p = getLocalCalendarParts(new Date(guess), tz);
    const offset =
      utcMs(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - guess;
    const next = target - offset;
    if (next === guess) break;
    guess = next;
  }

  const isBeforeTarget = (ms: number): boolean =>
    compareLocalDateTime(
      getLocalCalendarParts(new Date(ms), tz),
      targetParts,
    ) < 0;

  if (!isBeforeTarget(guess) && isBeforeTarget(guess - 1)) {
    return new Date(guess);
  }

  let lo: number;
  let hi: number;
  if (isBeforeTarget(guess)) {
    lo = guess;
    hi = guess + HOUR_MS;
    for (let step = 0; step < 48 && isBeforeTarget(hi); step++) {
      lo = hi;
      hi += HOUR_MS;
    }
  } else {
    hi = guess;
    lo = guess - HOUR_MS;
    for (let step = 0; step < 48 && !isBeforeTarget(lo); step++) {
      hi = lo;
      lo -= HOUR_MS;
    }
  }

  while (hi - lo > 1) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (isBeforeTarget(mid)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return new Date(hi);
}

export function localDateToInstant(dateKey: string, tz: string): Date {
  return localWallClockToInstant(dateKey, 0, tz);
}

export function resolveRangeWindow(
  sel: RangeSelection,
  opts: { now: Date; tz: string; logStart: string | null },
): TimeWindow {
  if (sel.kind === "preset") {
    if (sel.key === "all") {
      const logStartDate = opts.logStart ? new Date(opts.logStart) : null;
      const anchor =
        logStartDate && !Number.isNaN(logStartDate.getTime())
          ? logStartDate
          : opts.now;
      const startYear = getLocalCalendarParts(anchor, opts.tz).year;
      return {
        from: localDateToInstant(
          formatCalendarDate(startYear, 1, 1),
          opts.tz,
        ).toISOString(),
        to: opts.now.toISOString(),
      };
    }

    return {
      from: new Date(
        opts.now.getTime() - PRESET_SPAN_MS[sel.key],
      ).toISOString(),
      to: opts.now.toISOString(),
    };
  }

  return {
    from: localDateToInstant(sel.from, opts.tz).toISOString(),
    to: localDateToInstant(addCalendarDays(sel.to, 1), opts.tz).toISOString(),
  };
}

export function previousWindow(w: TimeWindow): TimeWindow {
  const fromMs = Date.parse(w.from);
  const toMs = Date.parse(w.to);
  const spanMs = toMs - fromMs;
  return {
    from: new Date(fromMs - spanMs).toISOString(),
    to: w.from,
  };
}

export function rangeGranularity(
  sel: RangeSelection,
  w: TimeWindow,
): CadenceGranularity {
  if (sel.kind === "preset") {
    return PRESET_GRANULARITY[sel.key];
  }

  const spanMs = Date.parse(w.to) - Date.parse(w.from);
  if (spanMs <= 2 * DAY_MS) return "hour";
  if (spanMs <= 8 * DAY_MS) return "block6h";
  if (spanMs <= 45 * DAY_MS) return "day";
  if (spanMs <= 200 * DAY_MS) return "week";
  if (spanMs <= 400 * DAY_MS) return "month";
  return "year";
}

export function elapsedWindowDays(w: TimeWindow, now: Date): number {
  const fromMs = Date.parse(w.from);
  const effectiveEndMs = Math.min(Date.parse(w.to), now.getTime());
  return Math.max(1, Math.round((effectiveEndMs - fromMs) / DAY_MS));
}

export function drillSelection(
  bucket: Pick<ActivityBucket, "startTime" | "endTime">,
  granularity: CadenceGranularity,
  tz: string,
): RangeSelection | null {
  if (granularity === "hour") return null;

  const start = new Date(bucket.startTime);

  if (granularity === "day" || granularity === "block6h") {
    const day = localDateKey(start, tz);
    return { kind: "window", from: day, to: day };
  }

  if (granularity === "week") {
    return {
      kind: "window",
      from: localDateKey(start, tz),
      to: localDateKey(new Date(bucket.endTime), tz),
    };
  }

  const p = getLocalCalendarParts(start, tz);
  if (granularity === "month") {
    return {
      kind: "window",
      from: formatCalendarDate(p.year, p.month, 1),
      to: formatCalendarDate(p.year, p.month, daysInMonth(p.year, p.month)),
    };
  }

  return {
    kind: "window",
    from: formatCalendarDate(p.year, 1, 1),
    to: formatCalendarDate(p.year, 12, 31),
  };
}

export function formatRangeLabel(sel: RangeSelection): string {
  if (sel.kind === "preset") return sel.key;

  const [fy, fm, fd] = sel.from.split("-").map(Number);
  const [ty, tm, td] = sel.to.split("-").map(Number);

  if (fy === ty && fm === 1 && fd === 1 && tm === 12 && td === 31) {
    return String(fy);
  }
  if (fy === ty && fm === tm && fd === 1 && td === daysInMonth(fy, fm)) {
    return `${SHORT_MONTHS[fm - 1]} ${fy}`;
  }
  if (fy === ty && fm === tm && fd === td) {
    return `${SHORT_MONTHS[fm - 1]} ${fd}, ${fy}`;
  }
  if (fy === ty && fm === tm) {
    return `${SHORT_MONTHS[fm - 1]} ${fd}–${td}, ${fy}`;
  }
  if (fy === ty) {
    return `${SHORT_MONTHS[fm - 1]} ${fd} – ${SHORT_MONTHS[tm - 1]} ${td}, ${fy}`;
  }
  return `${SHORT_MONTHS[fm - 1]} ${fd}, ${fy} – ${SHORT_MONTHS[tm - 1]} ${td}, ${ty}`;
}
