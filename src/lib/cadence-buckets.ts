import {
  getLocalCalendarParts,
  localDateKey,
  localDateToInstant,
  localWallClockToInstant,
  type CadenceGranularity,
  type TimeWindow,
} from "@/lib/range";
import { formatDayGroup } from "@/lib/format-utils";
import type { ActivityBucket } from "@/lib/types";

export interface CadenceRow {
  bucket_key: string;
  count: number;
}

const HOUR_MS = 3_600_000;
const BLOCK_TIMES = [
  "00:00–06:00",
  "06:00–12:00",
  "12:00–18:00",
  "18:00–24:00",
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

function formatDateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const d = new Date(utcMs(year, month - 1, day + days));
  return formatDateKey(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
  );
}

// A day key is already the visitor's local calendar date, so labels are formatted in UTC.
function calendarDayNoonUtc(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(utcMs(year, month - 1, day, 12));
}

function enumerateLocalDays(startKey: string, endKey: string): string[] {
  const days: string[] = [];
  let cursor = startKey;
  while (cursor <= endKey) {
    days.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return days;
}

function buildRowMap(rows: CadenceRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = String(r.bucket_key);
    const count = Number(r.count) || 0;
    map.set(key, (map.get(key) ?? 0) + count);
  }
  return map;
}

export function cadenceRowGranularity(g: CadenceGranularity): CadenceGranularity {
  return g === "week" ? "day" : g;
}

export function cadenceBucketKey(
  playedAt: Date,
  granularity: CadenceGranularity,
  tz: string,
): string {
  if (granularity === "hour") {
    return playedAt.toISOString().slice(0, 13) + ":00:00Z";
  }
  const p = getLocalCalendarParts(playedAt, tz);
  if (granularity === "block6h") {
    return `${formatDateKey(p.year, p.month, p.day)}#${Math.floor(p.hour / 6)}`;
  }
  if (granularity === "day" || granularity === "week") {
    return formatDateKey(p.year, p.month, p.day);
  }
  if (granularity === "month") {
    return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}`;
  }
  return String(p.year).padStart(4, "0");
}

export function buildActivityCadence(params: {
  window: TimeWindow;
  granularity: CadenceGranularity;
  tz: string;
  now?: Date;
  cadenceRows: CadenceRow[];
}): { activityCadence: ActivityBucket[] } {
  const { window, granularity, tz, cadenceRows } = params;
  const fromMs = Date.parse(window.from);
  const toMs = Date.parse(window.to);
  const nowMs = (params.now ?? new Date()).getTime();
  const effectiveToMs = Math.min(toMs, nowMs);

  if (
    !Number.isFinite(fromMs) ||
    !Number.isFinite(effectiveToMs) ||
    effectiveToMs <= fromMs
  ) {
    return { activityCadence: [] };
  }

  const endMs = effectiveToMs - 1;
  const fromDate = new Date(fromMs);
  const endDate = new Date(endMs);
  const rowMap = buildRowMap(cadenceRows);
  const activityCadence: ActivityBucket[] = [];

  if (granularity === "hour") {
    const earliestHourMs = Math.floor(fromMs / HOUR_MS) * HOUR_MS;
    const latestHourMs = Math.floor(endMs / HOUR_MS) * HOUR_MS;
    const hourFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      hourCycle: "h23",
    });

    for (let h = earliestHourMs; h <= latestHourMs; h += HOUR_MS) {
      const bucketStart = new Date(h);
      const bucketEnd = new Date(h + HOUR_MS - 1);
      const isoKey = bucketStart.toISOString().slice(0, 13) + ":00:00Z";
      const hourPart =
        hourFormatter.formatToParts(bucketStart).find((p) => p.type === "hour")?.value ?? "00";

      activityCadence.push({
        date: `${hourPart}:00`,
        startTime: bucketStart.toISOString(),
        endTime: bucketEnd.toISOString(),
        count: rowMap.get(isoKey) ?? 0,
      });
    }
    return { activityCadence };
  }

  if (granularity === "block6h") {
    const days = enumerateLocalDays(localDateKey(fromDate, tz), localDateKey(endDate, tz));

    for (const dayKey of days) {
      const nextDayKey = addCalendarDays(dayKey, 1);
      const dayLabel = formatDayGroup(calendarDayNoonUtc(dayKey), "UTC");
      const dayNumber = dayLabel.split(" ")[0];
      const boundaries = [
        localDateToInstant(dayKey, tz),
        localWallClockToInstant(dayKey, 6, tz),
        localWallClockToInstant(dayKey, 12, tz),
        localWallClockToInstant(dayKey, 18, tz),
        localDateToInstant(nextDayKey, tz),
      ];

      let markedDay = false;
      for (let b = 0; b < 4; b++) {
        if (boundaries[b + 1].getTime() <= boundaries[b].getTime()) continue;
        const isMarker = !markedDay;
        markedDay = true;
        activityCadence.push({
          date: `${dayLabel} ${BLOCK_TIMES[b]}`,
          startTime: boundaries[b].toISOString(),
          endTime: new Date(boundaries[b + 1].getTime() - 1).toISOString(),
          count: rowMap.get(`${dayKey}#${b}`) ?? 0,
          isMarker,
          markerLabel: isMarker ? dayNumber : undefined,
        });
      }
    }
    return { activityCadence };
  }

  if (granularity === "day") {
    const rawDays = enumerateLocalDays(localDateKey(fromDate, tz), localDateKey(endDate, tz));
    const rawBoundaries = rawDays.map((d) => localDateToInstant(d, tz).getTime());
    rawBoundaries.push(localDateToInstant(addCalendarDays(rawDays[rawDays.length - 1], 1), tz).getTime());

    const frames: { dayKey: string; startMs: number; endMs: number }[] = [];
    for (let i = 0; i < rawDays.length; i++) {
      if (rawBoundaries[i + 1] <= rawBoundaries[i]) continue;
      frames.push({
        dayKey: rawDays[i],
        startMs: rawBoundaries[i],
        endMs: rawBoundaries[i + 1] - 1,
      });
    }

    const totalDays = frames.length;
    for (let idx = 0; idx < totalDays; idx++) {
      const { dayKey, startMs, endMs } = frames[idx];
      const label = formatDayGroup(calendarDayNoonUtc(dayKey), "UTC");
      const isMarker =
        idx === 0 || idx === 7 || idx === 14 || idx === 21 || idx === totalDays - 1;

      activityCadence.push({
        date: label,
        startTime: new Date(startMs).toISOString(),
        endTime: new Date(endMs).toISOString(),
        count: rowMap.get(dayKey) ?? 0,
        isMarker,
        markerLabel: isMarker ? label : undefined,
      });
    }
    return { activityCadence };
  }

  if (granularity === "week") {
    const days = enumerateLocalDays(localDateKey(fromDate, tz), localDateKey(endDate, tz));
    const monthFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
    });

    const firstGroupLen = days.length % 7 || 7;
    let cursor = 0;
    let weekNum = 1;
    let lastMonth = "";

    while (cursor < days.length) {
      const groupLen = cursor === 0 ? firstGroupLen : 7;
      const groupDays = days.slice(cursor, cursor + groupLen);
      cursor += groupLen;

      const weekStartKey = groupDays[0];
      const weekEndKey = groupDays[groupDays.length - 1];
      let weekCount = 0;
      for (const d of groupDays) {
        weekCount += rowMap.get(d) ?? 0;
      }

      const monthAbbr = monthFormatter.format(calendarDayNoonUtc(weekStartKey));
      const isNewMonth = monthAbbr !== lastMonth;
      if (isNewMonth) lastMonth = monthAbbr;

      const startTime = localDateToInstant(weekStartKey, tz).toISOString();
      const endTime = new Date(
        localDateToInstant(addCalendarDays(weekEndKey, 1), tz).getTime() - 1,
      ).toISOString();

      activityCadence.push({
        date: `W${weekNum}`,
        startTime,
        endTime,
        count: weekCount,
        isMarker: isNewMonth,
        markerLabel: isNewMonth ? monthAbbr : undefined,
      });
      weekNum += 1;
    }
    return { activityCadence };
  }

  if (granularity === "month") {
    const fromParts = getLocalCalendarParts(fromDate, tz);
    const endParts = getLocalCalendarParts(endDate, tz);
    const monthFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
    });

    let y = fromParts.year;
    let m = fromParts.month;
    while (y < endParts.year || (y === endParts.year && m <= endParts.month)) {
      const ymKey = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
      const nextY = m === 12 ? y + 1 : y;
      const nextM = m === 12 ? 1 : m + 1;
      const nextYmKey = `${String(nextY).padStart(4, "0")}-${String(nextM).padStart(2, "0")}`;

      const monthAbbr = monthFormatter.format(new Date(utcMs(y, m - 1, 15, 12)));
      const startTime = localDateToInstant(`${ymKey}-01`, tz).toISOString();
      const endTime = new Date(
        localDateToInstant(`${nextYmKey}-01`, tz).getTime() - 1,
      ).toISOString();

      activityCadence.push({
        date: monthAbbr,
        startTime,
        endTime,
        count: rowMap.get(ymKey) ?? 0,
      });

      y = nextY;
      m = nextM;
    }
    return { activityCadence };
  }

  // granularity === "year"
  const startYear = getLocalCalendarParts(fromDate, tz).year;
  const endLocalYear = getLocalCalendarParts(endDate, tz).year;
  let maxRowYear = endLocalYear;
  for (const r of cadenceRows) {
    const yr = Number(r.bucket_key);
    if (Number.isFinite(yr) && yr > maxRowYear) {
      maxRowYear = yr;
    }
  }
  const endYear = Math.max(endLocalYear, maxRowYear);

  for (let yr = startYear; yr <= endYear; yr++) {
    const yearKey = String(yr).padStart(4, "0");
    const nextYearKey = String(yr + 1).padStart(4, "0");
    activityCadence.push({
      date: yearKey,
      startTime: localDateToInstant(`${yearKey}-01-01`, tz).toISOString(),
      endTime: new Date(
        localDateToInstant(`${nextYearKey}-01-01`, tz).getTime() - 1,
      ).toISOString(),
      count: rowMap.get(yearKey) ?? 0,
    });
  }

  return { activityCadence };
}

export function buildProfileCadence(
  params: Parameters<typeof buildActivityCadence>[0],
): { activityCadence: ActivityBucket[]; monthlyCadence?: ActivityBucket[] } {
  if (params.granularity !== "year" || params.cadenceRows.length === 0) {
    return buildActivityCadence(params);
  }

  const yearTotals = new Map<string, number>();
  const monthKeys: string[] = [];
  for (const row of params.cadenceRows) {
    const ym = String(row.bucket_key);
    const yr = ym.slice(0, 4);
    const count = Number(row.count) || 0;
    monthKeys.push(ym);
    yearTotals.set(yr, (yearTotals.get(yr) ?? 0) + count);
  }

  monthKeys.sort();
  const firstYm = monthKeys[0];
  const monthFrom = localDateToInstant(`${firstYm}-01`, params.tz);

  const { activityCadence: rawMonthly } = buildActivityCadence({
    window: { from: monthFrom.toISOString(), to: params.window.to },
    granularity: "month",
    tz: params.tz,
    now: params.now,
    cadenceRows: params.cadenceRows,
  });

  const monthlyCadence = rawMonthly.map((bucket) => ({
    ...bucket,
    date: `${bucket.date} ${getLocalCalendarParts(new Date(bucket.startTime), params.tz).year}`,
  }));

  const yearRows: CadenceRow[] = [...yearTotals.entries()].map(
    ([bucket_key, count]) => ({ bucket_key, count }),
  );
  return {
    ...buildActivityCadence({ ...params, cadenceRows: yearRows }),
    monthlyCadence,
  };
}
