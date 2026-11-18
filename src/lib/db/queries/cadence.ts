import { getDb } from "../index";
import { formatDayGroupTz } from "./helpers";
import type { RangeKey, ActivityBucket } from "@/lib/types";

export type CadenceScope =
  | { kind: "track"; trackId: string }
  | { kind: "artist"; column: "artist_id" | "artist_group_key"; value: string };

export function buildCadenceQuery(range: RangeKey, tz: string, scope?: CadenceScope) {
  const sql = getDb();

  const scopeJoin = scope?.kind === "artist"
    ? sql`
      JOIN tracks t ON t.id = p.track_id`
    : sql``;

  const scopeFilter = scope?.kind === "track"
    ? sql`p.track_id = ${scope.trackId}`
    : scope?.column === "artist_id"
      ? sql`t.artist_id = ${scope.value}`
      : scope
        ? sql`t.artist_group_key = ${scope.value}`
        : sql``;

  const scopeAnd = scope ? sql` AND ${scopeFilter}` : sql``;
  const scopeWhere = scope
    ? sql`
    WHERE ${scopeFilter}`
    : sql``;

  if (range === "1d") {
    return sql`
      SELECT 
          TO_CHAR(DATE_TRUNC('hour', p.played_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:00:00"Z"') AS hour_key,
          COUNT(*)::int AS count
      FROM plays p${scopeJoin}
      WHERE p.played_at >= NOW() - INTERVAL '24 hours'${scopeAnd}
      GROUP BY hour_key;
    `;
  }

  if (range === "1w") {
    return sql`
      SELECT 
          (p.played_at AT TIME ZONE ${tz})::date::text AS day,
          FLOOR(EXTRACT(HOUR FROM p.played_at AT TIME ZONE ${tz}) / 6)::int AS block,
          COUNT(*)::int AS count
      FROM plays p${scopeJoin}
      WHERE p.played_at >= NOW() - INTERVAL '7 days'${scopeAnd}
      GROUP BY day, block;
    `;
  }

  if (range === "1m") {
    return sql`
      SELECT 
          (p.played_at AT TIME ZONE ${tz})::date::text AS day,
          COUNT(*)::int AS count
      FROM plays p${scopeJoin}
      WHERE p.played_at >= NOW() - INTERVAL '30 days'${scopeAnd}
      GROUP BY day;
    `;
  }

  if (range === "6m") {
    return sql`
      SELECT 
          (p.played_at AT TIME ZONE ${tz})::date::text AS day,
          COUNT(*)::int AS count
      FROM plays p${scopeJoin}
      WHERE p.played_at >= NOW() - INTERVAL '180 days'${scopeAnd}
      GROUP BY day;
    `;
  }

  if (range === "1y") {
    return sql`
      SELECT 
          TO_CHAR(p.played_at AT TIME ZONE ${tz}, 'YYYY-MM') AS ym,
          COUNT(*)::int AS count
      FROM plays p${scopeJoin}
      WHERE p.played_at >= NOW() - INTERVAL '365 days'${scopeAnd}
      GROUP BY ym;
    `;
  }

  if (scope) {
    return sql`
      SELECT TO_CHAR(p.played_at AT TIME ZONE ${tz}, 'YYYY-MM') AS ym, COUNT(*)::int AS count
      FROM plays p${scopeJoin}${scopeWhere}
      GROUP BY ym
      ORDER BY ym ASC;
    `;
  }

  return sql`
    SELECT
        EXTRACT(YEAR FROM p.played_at AT TIME ZONE ${tz})::int AS play_year,
        COUNT(*)::int AS count
    FROM plays p${scopeJoin}${scopeWhere}
    GROUP BY play_year
    ORDER BY play_year ASC;
  `;
}

function getLocalCalendarParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(m.year),
    month: Number(m.month),
    day: Number(m.day),
    hour: Number(m.hour),
    minute: Number(m.minute),
    second: Number(m.second),
  };
}

function offsetCalendarDay(base: { year: number; month: number; day: number }, daysAgo: number) {
  const d = new Date(Date.UTC(base.year, base.month - 1, base.day - daysAgo, 12, 0, 0));
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const dayKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, day, dayKey };
}

export function buildActivityCadence(params: {
  range: RangeKey;
  tz: string;
  now?: Date;
  cadenceRows: Record<string, unknown>[];
  minDateRow?: { log_start_date?: string | null };
}): { activityCadence: ActivityBucket[] } {
  const { range, tz, cadenceRows, minDateRow } = params;
  const now = params.now || new Date();
  const activityCadence: ActivityBucket[] = [];

  if (range === "1d") {
    const hourMap = new Map<string, number>();
    for (const r of cadenceRows) {
      const k = String(r.hour_key);
      const count = Number(r.count) || 0;
      hourMap.set(k, count);
    }

    const windowStartMs = now.getTime() - 24 * 3600000;
    const earliestHourMs = Math.floor(windowStartMs / 3600000) * 3600000;
    const latestHourMs = Math.floor(now.getTime() / 3600000) * 3600000;

    for (let h = earliestHourMs; h <= latestHourMs; h += 3600000) {
      const bucketStart = new Date(h);
      const bucketEnd = new Date(h + 3600000 - 1);

      const isoKey = bucketStart.toISOString().slice(0, 13) + ":00:00Z";

      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        hourCycle: "h23",
      }).formatToParts(bucketStart);
      const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));

      const count = hourMap.get(isoKey) ?? 0;

      activityCadence.push({
        date: `${m.hour}:00`,
        startTime: bucketStart.toISOString(),
        endTime: bucketEnd.toISOString(),
        count,
      });
    }
  } else if (range === "1w") {
    const blockMap = new Map<string, number>(
      cadenceRows.map((r) => [`${r.day}_${r.block}`, Number(r.count)])
    );
    const BLOCK_TIMES = [
      "00:00–06:00",
      "06:00–12:00",
      "12:00–18:00",
      "18:00–24:00",
    ];

    const baseDate = getLocalCalendarParts(now, tz);
    const numDaysAgo = (baseDate.hour > 0 || baseDate.minute > 0 || baseDate.second > 0) ? 7 : 6;

    for (let daysAgo = numDaysAgo; daysAgo >= 0; daysAgo--) {
      const { year, month, day, dayKey } = offsetCalendarDay(baseDate, daysAgo);
      const dayLabel = formatDayGroupTz(new Date(dayKey + "T12:00:00"), tz);
      const dayNumber = dayLabel.split(" ")[0];

      for (let b = 0; b < 4; b++) {
        const count = blockMap.get(`${dayKey}_${b}`) || 0;
        const startHour = b * 6;
        const startTime = new Date(Date.UTC(year, month - 1, day, startHour, 0, 0, 0)).toISOString();
        const endTime = b === 3
          ? new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)).toISOString()
          : new Date(Date.UTC(year, month - 1, day, startHour + 6, 0, 0, 0)).toISOString();

        activityCadence.push({
          date: `${dayLabel} ${BLOCK_TIMES[b]}`,
          startTime,
          endTime,
          count,
          isMarker: b === 0,
          markerLabel: b === 0 ? dayNumber : undefined,
        });
      }
    }
  } else if (range === "1m") {
    const countMap = new Map<string, number>(
      cadenceRows.map((r) => [String(r.day), Number(r.count)])
    );
    const baseDate = getLocalCalendarParts(now, tz);
    const numDaysAgo = (baseDate.hour > 0 || baseDate.minute > 0 || baseDate.second > 0) ? 30 : 29;

    for (let daysAgo = numDaysAgo; daysAgo >= 0; daysAgo--) {
      const { year, month, day, dayKey } = offsetCalendarDay(baseDate, daysAgo);
      const label = formatDayGroupTz(new Date(dayKey + "T12:00:00"), tz);
      const idx = numDaysAgo - daysAgo;
      const isMarker = idx === 0 || idx === 7 || idx === 14 || idx === 21 || idx === numDaysAgo;
      const startTime = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)).toISOString();
      const endTime = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)).toISOString();

      activityCadence.push({
        date: label,
        startTime,
        endTime,
        count: countMap.get(dayKey) || 0,
        isMarker,
        markerLabel: isMarker ? label : undefined,
      });
    }
  } else if (range === "6m") {
    const countMap = new Map<string, number>(
      cadenceRows.map((r) => [String(r.day), Number(r.count)])
    );
    const baseDate = getLocalCalendarParts(now, tz);
    let lastMonth = "";
    for (let w = 25; w >= 0; w--) {
      let weekCount = 0;
      let weekStartKey = "";
      let weekEndKey = "";
      for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
        const totalDaysAgo = w * 7 + dayOffset;
        if (totalDaysAgo > 180) continue;
        const { dayKey } = offsetCalendarDay(baseDate, totalDaysAgo);
        if (!weekStartKey) weekStartKey = dayKey;
        if (dayOffset === 0 || totalDaysAgo === 0) weekEndKey = dayKey;
        weekCount += countMap.get(dayKey) || 0;
      }
      if (!weekEndKey) weekEndKey = weekStartKey;

      const monthAbbr = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        month: "short",
      }).format(new Date(weekStartKey + "T12:00:00")).toUpperCase();

      const isNewMonth = monthAbbr !== lastMonth;
      if (isNewMonth) lastMonth = monthAbbr;

      const [sYear, sMonth, sDay] = weekStartKey.split("-").map(Number);
      const [eYear, eMonth, eDay] = weekEndKey.split("-").map(Number);
      const startTime = new Date(Date.UTC(sYear, sMonth - 1, sDay, 0, 0, 0, 0)).toISOString();
      const endTime = new Date(Date.UTC(eYear, eMonth - 1, eDay, 23, 59, 59, 999)).toISOString();

      activityCadence.push({
        date: `W${26 - w}`,
        startTime,
        endTime,
        count: weekCount,
        isMarker: isNewMonth,
        markerLabel: isNewMonth ? monthAbbr : undefined,
      });
    }
  } else if (range === "1y") {
    const countMap = new Map<string, number>(
      cadenceRows.map((r) => [String(r.ym), Number(r.count)])
    );

    const baseDate = getLocalCalendarParts(now, tz);
    const curYear = baseDate.year;
    const curMonth = baseDate.month;
    const numMonths = (baseDate.day > 1 || baseDate.hour > 0 || baseDate.minute > 0 || baseDate.second > 0) ? 12 : 11;

    for (let m = numMonths; m >= 0; m--) {
      let targetMonth = curMonth - m;
      let targetYear = curYear;
      while (targetMonth <= 0) {
        targetMonth += 12;
        targetYear -= 1;
      }

      const ymKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
      const bucketDateUtc = new Date(Date.UTC(targetYear, targetMonth - 1, 15, 12, 0, 0));
      const monthAbbr = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        month: "short",
      }).format(bucketDateUtc).toUpperCase();

      const startTime = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0)).toISOString();
      const endTime = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999)).toISOString();

      activityCadence.push({
        date: monthAbbr,
        startTime,
        endTime,
        count: countMap.get(ymKey) || 0,
      });
    }
  } else {
    // range === "all"
    const countMap = new Map<number, number>(
      cadenceRows.map((r) => [Number(r.play_year), Number(r.count)])
    );
    const nowLocal = getLocalCalendarParts(now, tz);
    const currentYear = nowLocal.year;
    const minRowYear = minDateRow?.log_start_date
      ? getLocalCalendarParts(new Date(minDateRow.log_start_date), tz).year
      : currentYear - 1;

    let minYear = minRowYear;
    if (cadenceRows && cadenceRows.length > 0) {
      const minPlayYear = Math.min(...cadenceRows.map((r) => Number(r.play_year)));
      if (Number.isFinite(minPlayYear)) {
        minYear = Math.min(minYear, minPlayYear);
      }
    }
    const startYear = Math.min(minYear, currentYear);
    const maxPlayYear = cadenceRows.length > 0
      ? Math.max(...cadenceRows.map((r) => Number(r.play_year)))
      : currentYear;
    const endYear = Math.max(currentYear, Number.isFinite(maxPlayYear) ? maxPlayYear : currentYear);

    for (let yr = startYear; yr <= endYear; yr++) {
      const count = countMap.get(yr) || 0;
      activityCadence.push({
        date: String(yr),
        startTime: new Date(Date.UTC(yr, 0, 1, 0, 0, 0, 0)).toISOString(),
        endTime: new Date(Date.UTC(yr, 11, 31, 23, 59, 59, 999)).toISOString(),
        count,
      });
    }
  }

  return { activityCadence };
}


export function buildProfileCadence(
  params: Parameters<typeof buildActivityCadence>[0],
): { activityCadence: ActivityBucket[]; monthlyCadence?: ActivityBucket[] } {
  if (params.range !== "all" || params.cadenceRows.length === 0) {
    return buildActivityCadence(params);
  }

  const monthCounts = new Map<string, number>();
  const yearCounts = new Map<number, number>();
  for (const row of params.cadenceRows) {
    const month = String(row.ym);
    const year = Number(month.slice(0, 4));
    const count = Number(row.count);
    monthCounts.set(month, count);
    yearCounts.set(year, (yearCounts.get(year) ?? 0) + count);
  }

  const monthKeys = [...monthCounts.keys()].sort();
  const firstMonth = new Date(monthKeys[0] + "-01T00:00:00Z");
  const latestMonth = new Date(monthKeys[monthKeys.length - 1] + "-01T00:00:00Z");
  const now = getLocalCalendarParts(params.now ?? new Date(), params.tz);
  const end = Math.max(latestMonth.getTime(), Date.UTC(now.year, now.month - 1, 1));
  const label = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  const monthlyCadence: ActivityBucket[] = [];
  for (const month = new Date(firstMonth); month.getTime() <= end; month.setUTCMonth(month.getUTCMonth() + 1)) {
    const startTime = month.toISOString();
    const endTime = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1) - 1).toISOString();
    monthlyCadence.push({
      date: label.format(month).toUpperCase(),
      count: monthCounts.get(startTime.slice(0, 7)) ?? 0,
      startTime,
      endTime,
    });
  }

  const cadenceRows = [...yearCounts].map(([play_year, count]) => ({ play_year, count }));
  return { ...buildActivityCadence({ ...params, cadenceRows }), monthlyCadence };
}
