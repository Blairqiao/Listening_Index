import { getDb } from "../index";
import { isCatalogFullyEnriched } from "./enrichment";
import { getLastSync } from "./ingestion";
import {
  getTimezone,
  sanitizeTimezone,
  formatLogStartDate,
  formatDayGroupTz,
  formatDurationMs,
} from "./helpers";
import { getSwatchColor } from "@/lib/color-utils";
import type { OverviewData, RangeKey } from "./types";
import type {
  TrackSummary,
  AlbumSummary,
  ActivityDay,
} from "@/lib/mock-listening-data";

export const OVERVIEW_INTERVAL_CONFIG: Record<
  Exclude<RangeKey, "all">,
  { cur: string; prev: string; elapsedDays: number }
> = {
  "1d": { cur: "24 hours", prev: "48 hours", elapsedDays: 1 },
  "1w": { cur: "7 days", prev: "14 days", elapsedDays: 7 },
  "1m": { cur: "30 days", prev: "60 days", elapsedDays: 30 },
  "6m": { cur: "180 days", prev: "360 days", elapsedDays: 180 },
  "1y": { cur: "365 days", prev: "730 days", elapsedDays: 365 },
};

/**
 * Mode 1: Computes Overview statistics and rankings for a given range.
 * Executes all component queries concurrently via Promise.all for sub-150ms responses.
 */
export async function getOverviewData(range: RangeKey, tzOverride?: string): Promise<OverviewData> {
  const sql = getDb();
  const tz = sanitizeTimezone(tzOverride);
  const isEnrichedPromise = isCatalogFullyEnriched();
  const isAll = range === "all";

  // 1. Min Date (Log Start Date)
  const minDatePromise = sql`
    SELECT MIN(played_at) AS log_start_date FROM plays;
  `;

  // 2. Metrics Ribbon
  const metricPromise = isAll
    ? sql`
        SELECT 
          COALESCE(SUM(p.ms_played) / 60000, 0)::bigint AS minutes,
          COUNT(DISTINCT p.track_id)::bigint AS tracks,
          COUNT(DISTINCT t.artist_group_key)::bigint AS artists,
          COALESCE(SUM(p.ms_played), 0)::bigint AS total_ms,
          MIN(p.played_at) AS window_min_date
        FROM plays p
        JOIN tracks t ON p.track_id = t.id;
      `
    : sql`
        SELECT 
          COALESCE(SUM(p.ms_played) / 60000, 0)::bigint AS minutes,
          COUNT(DISTINCT p.track_id)::bigint AS tracks,
          COUNT(DISTINCT t.artist_group_key)::bigint AS artists,
          COALESCE(SUM(p.ms_played), 0)::bigint AS total_ms,
          MIN(p.played_at) AS window_min_date
        FROM plays p
        JOIN tracks t ON p.track_id = t.id
        WHERE p.played_at >= NOW() - (${OVERVIEW_INTERVAL_CONFIG[range].cur})::interval;
      `;

  // 3. Top Tracks with Drift
  const topTracksPromise = isAll
    ? sql`
        WITH current_window AS (
            SELECT p.track_id, COUNT(*) AS plays,
                   DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS rank
            FROM plays p
            GROUP BY p.track_id
        )
        SELECT 
            c.rank::int,
            '·' AS drift,
            t.id AS track_id,
            t.artist_id,
            t.album_id,
            t.name AS title,
            COALESCE(ar.name, t.artist_name) AS artist,
            COALESCE(al.name, t.album_name) AS album,
            t.duration_ms,
            al.image_url AS album_image_url,
            c.plays::int
        FROM current_window c
        JOIN tracks t ON c.track_id = t.id
        LEFT JOIN artists ar ON t.artist_id = ar.id
        LEFT JOIN albums al ON t.album_id = al.id
        ORDER BY c.rank ASC, c.plays DESC, t.name ASC
        LIMIT 10;
      `
    : sql`
        WITH current_window AS (
            SELECT p.track_id, COUNT(*) AS plays,
                   DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS rank
            FROM plays p
            WHERE p.played_at >= NOW() - (${OVERVIEW_INTERVAL_CONFIG[range].cur})::interval
            GROUP BY p.track_id
        ),
        previous_window AS (
            SELECT p.track_id,
                   DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS prev_rank
            FROM plays p
            WHERE p.played_at >= NOW() - (${OVERVIEW_INTERVAL_CONFIG[range].prev})::interval
              AND p.played_at < NOW() - (${OVERVIEW_INTERVAL_CONFIG[range].cur})::interval
            GROUP BY p.track_id
        )
        SELECT 
            c.rank::int,
            CASE 
                WHEN pw.prev_rank IS NULL THEN 'NEW'
                WHEN pw.prev_rank = c.rank THEN '·'
                WHEN pw.prev_rank > c.rank THEN '+' || (pw.prev_rank - c.rank)::text
                ELSE '-' || (c.rank - pw.prev_rank)::text
            END AS drift,
            t.id AS track_id,
            t.artist_id,
            t.album_id,
            t.name AS title,
            COALESCE(ar.name, t.artist_name) AS artist,
            COALESCE(al.name, t.album_name) AS album,
            t.duration_ms,
            al.image_url AS album_image_url,
            c.plays::int
        FROM current_window c
        JOIN tracks t ON c.track_id = t.id
        LEFT JOIN artists ar ON t.artist_id = ar.id
        LEFT JOIN albums al ON t.album_id = al.id
        LEFT JOIN previous_window pw ON c.track_id = pw.track_id
        ORDER BY c.rank ASC, c.plays DESC, t.name ASC
        LIMIT 10;
      `;

  // 4. Top Artists (Top 5)
  const topArtistsPromise = isEnrichedPromise.then((isEnriched) =>
    isAll
      ? isEnriched
        ? sql`
            SELECT 
              t.artist_id AS id,
              COALESCE(MAX(ar.name), MAX(t.artist_name)) AS name,
              COUNT(p.id)::int AS count
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            LEFT JOIN artists ar ON t.artist_id = ar.id
            WHERE t.artist_id IS NOT NULL
            GROUP BY t.artist_id
            ORDER BY count DESC, name ASC
            LIMIT 5;
          `
        : sql`
            SELECT 
              MAX(t.artist_id) AS id,
              COALESCE(MAX(ar.name), MAX(t.artist_name)) AS name,
              COUNT(p.id)::int AS count
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            LEFT JOIN artists ar ON t.artist_id = ar.id
            GROUP BY t.artist_group_key
            ORDER BY count DESC, name ASC
            LIMIT 5;
          `
      : isEnriched
        ? sql`
            SELECT 
              t.artist_id AS id,
              COALESCE(MAX(ar.name), MAX(t.artist_name)) AS name,
              COUNT(p.id)::int AS count
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            LEFT JOIN artists ar ON t.artist_id = ar.id
            WHERE p.played_at >= NOW() - (${OVERVIEW_INTERVAL_CONFIG[range].cur})::interval
              AND t.artist_id IS NOT NULL
            GROUP BY t.artist_id
            ORDER BY count DESC, name ASC
            LIMIT 5;
          `
        : sql`
            SELECT 
              MAX(t.artist_id) AS id,
              COALESCE(MAX(ar.name), MAX(t.artist_name)) AS name,
              COUNT(p.id)::int AS count
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            LEFT JOIN artists ar ON t.artist_id = ar.id
            WHERE p.played_at >= NOW() - (${OVERVIEW_INTERVAL_CONFIG[range].cur})::interval
            GROUP BY t.artist_group_key
            ORDER BY count DESC, name ASC
            LIMIT 5;
          `
  );

  // 5. Top Albums (Top 5)
  const topAlbumsPromise = isEnrichedPromise.then((isEnriched) =>
    isAll
      ? isEnriched
        ? sql`
            SELECT 
              t.album_id AS id,
              COALESCE(MAX(al.name), MAX(t.album_name)) AS name,
              COALESCE(MAX(ar.name), MAX(t.artist_name)) AS artist,
              MAX(t.artist_id) AS artist_id,
              MAX(al.image_url) AS image_url,
              COUNT(p.id)::int AS count
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            LEFT JOIN albums al ON t.album_id = al.id
            LEFT JOIN artists ar ON t.artist_id = ar.id
            WHERE t.album_id IS NOT NULL
            GROUP BY t.album_id
            ORDER BY count DESC, name ASC
            LIMIT 5;
          `
        : sql`
            SELECT 
              MAX(t.album_id) AS id,
              COALESCE(MAX(al.name), MAX(t.album_name)) AS name,
              COALESCE(MAX(ar.name), MAX(t.artist_name)) AS artist,
              MAX(t.artist_id) AS artist_id,
              MAX(al.image_url) AS image_url,
              COUNT(p.id)::int AS count
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            LEFT JOIN albums al ON t.album_id = al.id
            LEFT JOIN artists ar ON t.artist_id = ar.id
            GROUP BY t.album_group_key
            ORDER BY count DESC, name ASC
            LIMIT 5;
          `
      : isEnriched
        ? sql`
            SELECT 
              t.album_id AS id,
              COALESCE(MAX(al.name), MAX(t.album_name)) AS name,
              COALESCE(MAX(ar.name), MAX(t.artist_name)) AS artist,
              MAX(t.artist_id) AS artist_id,
              MAX(al.image_url) AS image_url,
              COUNT(p.id)::int AS count
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            LEFT JOIN albums al ON t.album_id = al.id
            LEFT JOIN artists ar ON t.artist_id = ar.id
            WHERE p.played_at >= NOW() - (${OVERVIEW_INTERVAL_CONFIG[range].cur})::interval
              AND t.album_id IS NOT NULL
            GROUP BY t.album_id
            ORDER BY count DESC, name ASC
            LIMIT 5;
          `
        : sql`
            SELECT 
              MAX(t.album_id) AS id,
              COALESCE(MAX(al.name), MAX(t.album_name)) AS name,
              COALESCE(MAX(ar.name), MAX(t.artist_name)) AS artist,
              MAX(t.artist_id) AS artist_id,
              MAX(al.image_url) AS image_url,
              COUNT(p.id)::int AS count
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            LEFT JOIN albums al ON t.album_id = al.id
            LEFT JOIN artists ar ON t.artist_id = ar.id
            WHERE p.played_at >= NOW() - (${OVERVIEW_INTERVAL_CONFIG[range].cur})::interval
            GROUP BY t.album_group_key
            ORDER BY count DESC, name ASC
            LIMIT 5;
          `
  );

  // 6. Activity cadence query
  let cadenceQueryPromise;
  if (range === "1d") {
    cadenceQueryPromise = sql`
      SELECT 
          TO_CHAR(p.played_at AT TIME ZONE ${tz}, 'YYYY-MM-DD HH24') AS hour_key,
          COUNT(*)::int AS count
      FROM plays p
      WHERE p.played_at >= NOW() - INTERVAL '24 hours'
      GROUP BY hour_key;
    `;
  } else if (range === "1w") {
    cadenceQueryPromise = sql`
      SELECT 
          (p.played_at AT TIME ZONE ${tz})::date::text AS day,
          FLOOR(EXTRACT(HOUR FROM p.played_at AT TIME ZONE ${tz}) / 6)::int AS block,
          COUNT(*)::int AS count
      FROM plays p
      WHERE p.played_at >= NOW() - INTERVAL '8 days'
      GROUP BY day, block;
    `;
  } else if (range === "1m") {
    cadenceQueryPromise = sql`
      SELECT 
          (p.played_at AT TIME ZONE ${tz})::date::text AS day,
          COUNT(*)::int AS count
      FROM plays p
      WHERE p.played_at >= NOW() - INTERVAL '30 days'
      GROUP BY day;
    `;
  } else if (range === "6m") {
    cadenceQueryPromise = sql`
      SELECT 
          (p.played_at AT TIME ZONE ${tz})::date::text AS day,
          COUNT(*)::int AS count
      FROM plays p
      WHERE p.played_at >= NOW() - INTERVAL '182 days'
      GROUP BY day;
    `;
  } else if (range === "1y") {
    cadenceQueryPromise = sql`
      SELECT 
          TO_CHAR(p.played_at AT TIME ZONE ${tz}, 'YYYY-MM') AS ym,
          COUNT(*)::int AS count
      FROM plays p
      WHERE p.played_at >= NOW() - INTERVAL '365 days'
      GROUP BY ym;
    `;
  } else {
    cadenceQueryPromise = sql`
      SELECT 
          TO_CHAR(p.played_at AT TIME ZONE ${tz}, 'YYYY-MM') AS ym,
          COUNT(*)::int AS count
      FROM plays p
      GROUP BY ym;
    `;
  }

  // 7. Last sync
  const lastSyncPromise = getLastSync("spotify");

  // Execute all 7 queries concurrently!
  const [
    [minDateRow],
    [metricRow],
    rawTopTracks,
    rawTopArtists,
    rawTopAlbums,
    cadenceRows,
    lastSync,
  ] = (await Promise.all([
    minDatePromise,
    metricPromise,
    topTracksPromise,
    topArtistsPromise,
    topAlbumsPromise,
    cadenceQueryPromise,
    lastSyncPromise,
  ])) as any;

  // Format log start date
  const logStartDate = minDateRow?.log_start_date
    ? formatLogStartDate(new Date(minDateRow.log_start_date), tz)
    : "--";

  // Calculate elapsed days for daily average
  let elapsedDays: number;
  if (isAll) {
    if (metricRow?.window_min_date) {
      const ms = Date.now() - new Date(metricRow.window_min_date).getTime();
      elapsedDays = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
    } else {
      elapsedDays = 1;
    }
  } else {
    elapsedDays = OVERVIEW_INTERVAL_CONFIG[range].elapsedDays;
  }

  const minutesStr = Number(metricRow?.minutes || 0).toLocaleString();
  const tracksStr = Number(metricRow?.tracks || 0).toLocaleString();
  const artistsStr = Number(metricRow?.artists || 0).toLocaleString();
  const totalHours = Number(metricRow?.total_ms || 0) / 3600000.0;
  const dailyAvgStr = `${(totalHours / elapsedDays).toFixed(1)}h`;
  const metrics: [string, string, string, string] = [
    minutesStr,
    tracksStr,
    artistsStr,
    dailyAvgStr,
  ];

  // Process top tracks
  const topTracks: TrackSummary[] = (rawTopTracks as any[]).map((row) => ({
    id: row.track_id,
    rank: String(row.rank).padStart(2, "0"),
    drift: (row.drift as TrackSummary["drift"]) || "·",
    name: row.title,
    artist: row.artist,
    artistId: row.artist_id || undefined,
    album: row.album,
    albumId: row.album_id || undefined,
    duration: formatDurationMs(row.duration_ms || 0),
    plays: Number(row.plays),
    swatchColor: getSwatchColor(row.track_id + row.title),
    albumImageUrl: row.album_image_url || null,
  }));

  // Process top artists
  const topArtists = (rawTopArtists as any[]).map((row, idx) => ({
    id: row.id || undefined,
    rank: String(idx + 1).padStart(2, "0"),
    name: row.name,
    count: Number(row.count),
  }));

  // Process top albums
  const topAlbums: AlbumSummary[] = (rawTopAlbums as any[]).map((row, idx) => ({
    id: row.id || undefined,
    rank: String(idx + 1).padStart(2, "0"),
    name: row.name,
    artist: row.artist,
    artistId: row.artist_id || undefined,
    albumImageUrl: row.image_url || null,
    count: Number(row.count),
  }));

  // Process activity cadence
  let clockBuckets: number[] | undefined = undefined;
  let activityCadence: ActivityDay[] = [];
  const now = new Date();

  if (range === "1d") {
    const hourMap = new Map<string, number>(
      (cadenceRows as any[]).map((r) => [r.hour_key, Number(r.count)])
    );
    clockBuckets = new Array(24).fill(0);
    activityCadence = [];

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
      activityCadence.push({
        date: `${m.hour}:00`,
        count,
      });
    }
  } else if (range === "1w") {
    const blockMap = new Map<string, number>(
      (cadenceRows as any[]).map((r: any) => [`${r.day}_${r.block}`, Number(r.count)])
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

      for (let b = 0; b < 4; b++) {
        const count = blockMap.get(`${dayKey}_${b}`) || 0;
        activityCadence.push({
          date: `${dayLabel} ${BLOCK_TIMES[b]}`,
          count,
          isMarker: b === 0,
          markerLabel: b === 0 ? dayNumber : undefined,
        });
      }
    }
  } else if (range === "1m") {
    const countMap = new Map<string, number>(
      (cadenceRows as any[]).map((r: any) => [String(r.day), Number(r.count)])
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
      activityCadence.push({
        date: label,
        count: countMap.get(dayKey) || 0,
        isMarker,
        markerLabel: isMarker ? label : undefined,
      });
    }
  } else if (range === "6m") {
    const countMap = new Map<string, number>(
      (cadenceRows as any[]).map((r: any) => [String(r.day), Number(r.count)])
    );
    let lastMonth = "";
    for (let w = 25; w >= 0; w--) {
      let weekCount = 0;
      let weekStartKey = "";
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
        weekCount += countMap.get(dayKey) || 0;
      }

      const monthAbbr = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        month: "short",
      }).format(new Date(weekStartKey + "T12:00:00")).toUpperCase();

      const isNewMonth = monthAbbr !== lastMonth;
      if (isNewMonth) lastMonth = monthAbbr;

      activityCadence.push({
        date: `W${26 - w}`,
        count: weekCount,
        isMarker: isNewMonth,
        markerLabel: isNewMonth ? monthAbbr : undefined,
      });
    }
  } else {
    // Both 1y and all: 12-month cadence
    const countMap = new Map<string, number>(
      (cadenceRows as any[]).map((r: any) => [String(r.ym), Number(r.count)])
    );
    for (let m = 11; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const ymKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthAbbr = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        month: "short",
      }).format(d).toUpperCase();

      activityCadence.push({
        date: monthAbbr,
        count: countMap.get(ymKey) || 0,
      });
    }
  }

  return {
    logStartDate,
    metrics,
    topTracks,
    topArtists,
    topAlbums,
    clockBuckets,
    activityCadence,
    lastSyncedAt: lastSync,
  };
}
