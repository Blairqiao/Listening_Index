import { getDb } from "../index";
import { formatDayGroupTz } from "./helpers";
import type { RangeKey, ActivityBucket } from "@/lib/types";

export interface CadenceRow {
  day?: string;
  block?: number;
  hour_key?: string;
  ym?: string;
  play_year?: number;
  count?: number | string;
  [key: string]: unknown;
}

export function buildCadenceQuery(range: RangeKey, tz: string) {
  const sql = getDb();

  if (range === "1d") {
    return sql`
      SELECT 
          TO_CHAR(p.played_at AT TIME ZONE ${tz}, 'YYYY-MM-DD HH24') AS hour_key,
          COUNT(*)::int AS count
      FROM plays p
      WHERE p.played_at >= NOW() - INTERVAL '24 hours'
      GROUP BY hour_key;
    `;
  }

  if (range === "1w") {
    return sql`
      SELECT 
          (p.played_at AT TIME ZONE ${tz})::date::text AS day,
          FLOOR(EXTRACT(HOUR FROM p.played_at AT TIME ZONE ${tz}) / 6)::int AS block,
          COUNT(*)::int AS count
      FROM plays p
      WHERE p.played_at >= NOW() - INTERVAL '8 days'
      GROUP BY day, block;
    `;
  }

  if (range === "1m") {
    return sql`
      SELECT 
          (p.played_at AT TIME ZONE ${tz})::date::text AS day,
          COUNT(*)::int AS count
      FROM plays p
      WHERE p.played_at >= NOW() - INTERVAL '30 days'
      GROUP BY day;
    `;
  }

  if (range === "6m") {
    return sql`
      SELECT 
          (p.played_at AT TIME ZONE ${tz})::date::text AS day,
          COUNT(*)::int AS count
      FROM plays p
      WHERE p.played_at >= NOW() - INTERVAL '182 days'
      GROUP BY day;
    `;
  }

  if (range === "1y") {
    return sql`
      SELECT 
          TO_CHAR(p.played_at AT TIME ZONE ${tz}, 'YYYY-MM') AS ym,
          COUNT(*)::int AS count
      FROM plays p
      WHERE p.played_at >= NOW() - INTERVAL '365 days'
      GROUP BY ym;
    `;
  }

  return sql`
    SELECT 
        EXTRACT(YEAR FROM p.played_at AT TIME ZONE ${tz})::int AS play_year,
        COUNT(*)::int AS count
    FROM plays p
    GROUP BY play_year
    ORDER BY play_year ASC;
  `;
}

export function buildActivityCadence(params: {
  range: RangeKey;
  tz: string;
  now?: Date;
  cadenceRows: Record<string, unknown>[];
  minDateRow?: { log_start_date?: string | null };
}): { clockBuckets?: number[]; activityCadence: ActivityBucket[] } {
  const { range, tz, cadenceRows, minDateRow } = params;
  const now = params.now || new Date();
  let clockBuckets: number[] | undefined = undefined;
  const activityCadence: ActivityBucket[] = [];

  if (range === "1d") {
    const hourMap = new Map<string, number>(
      cadenceRows.map((r) => [String(r.hour_key), Number(r.count)])
    );
    clockBuckets = new Array(24).fill(0);

    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600000);
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
      }).formatToParts(d);
      const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
      const hourKey = `${m.year}-${m.month}-${m.day} ${m.hour}`;
      const count = hourMap.get(hourKey) || 0;
      clockBuckets[23 - i] = count;

      const [yr, mo, dy, hr] = [Number(m.year), Number(m.month) - 1, Number(m.day), Number(m.hour)];
      const bucketStart = new Date(Date.UTC(yr, mo, dy, hr, 0, 0, 0));
      const bucketEnd = new Date(Date.UTC(yr, mo, dy, hr, 59, 59, 999));

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

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dayKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
      const dayLabel = formatDayGroupTz(new Date(dayKey + "T12:00:00"), tz);
      const dayNumber = dayLabel.split(" ")[0];
      const [year, month, day] = dayKey.split("-").map(Number);

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
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dayKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
      const label = formatDayGroupTz(new Date(dayKey + "T12:00:00"), tz);
      const idx = 29 - i;
      const isMarker = idx === 0 || idx === 7 || idx === 14 || idx === 21 || idx === 29;
      const [year, month, day] = dayKey.split("-").map(Number);
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
    let lastMonth = "";
    for (let w = 25; w >= 0; w--) {
      let weekCount = 0;
      let weekStartKey = "";
      let weekEndKey = "";
      for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
        const totalDaysAgo = w * 7 + dayOffset;
        const d = new Date(now.getTime() - totalDaysAgo * 86400000);
        const dayKey = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(d);
        if (!weekStartKey) weekStartKey = dayKey;
        if (dayOffset === 0) weekEndKey = dayKey;
        weekCount += countMap.get(dayKey) || 0;
      }

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

    const nowParts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
    }).formatToParts(now);
    const curYear = Number(nowParts.find((p) => p.type === "year")?.value || now.getUTCFullYear());
    const curMonth = Number(nowParts.find((p) => p.type === "month")?.value || (now.getUTCMonth() + 1));

    for (let m = 11; m >= 0; m--) {
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
    const minRowYear = minDateRow?.log_start_date
      ? new Date(minDateRow.log_start_date).getFullYear()
      : now.getFullYear() - 1;

    let minYear = minRowYear;
    if (cadenceRows && cadenceRows.length > 0) {
      const minPlayYear = Math.min(...cadenceRows.map((r) => Number(r.play_year)));
      if (Number.isFinite(minPlayYear)) {
        minYear = Math.min(minYear, minPlayYear);
      }
    }
    const currentYear = now.getFullYear();
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

  return { clockBuckets, activityCadence };
}
