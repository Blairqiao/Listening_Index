import { getDb } from "../index";
import { isCatalogFullyEnriched } from "./enrichment";
import { getLastSync } from "./ingestion";
import {
  sanitizeTimezone,
  formatLogStartDate,
  formatDurationMs,
} from "./helpers";
import { getSwatchColor } from "@/lib/color-utils";
import { formatOverviewMetrics } from "@/lib/format-utils";
import {
  elapsedWindowDays,
  formatRangeParam,
  previousWindow,
  type RangeSelection,
} from "@/lib/range";
import {
  buildCadenceQuery,
  buildActivityCadence,
  cadenceRowGranularity,
  type CadenceRow,
} from "./cadence";
import { buildTimeFilter, resolveServerRange } from "./range-filter";
import type { OverviewData, RangeKey } from "./types";
import type {
  TrackSummary,
  ArtistSummary,
  AlbumSummary,
} from "@/lib/types";

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
 * Computes Overview statistics and rankings for a preset or fixed date window.
 * Runs component queries concurrently via Promise.all.
 */
export async function getOverviewData(sel: RangeSelection, tzOverride?: string): Promise<OverviewData> {
  const sql = getDb();
  const tz = sanitizeTimezone(tzOverride);
  const now = new Date();
  const { window, granularity, logStart } = await resolveServerRange(sel, tz, now);
  const isEnrichedPromise = isCatalogFullyEnriched();
  const isAll = sel.kind === "preset" && sel.key === "all";
  const timeFilter = buildTimeFilter(sel, window);
  const prev = isAll ? null : previousWindow(window);

  // 1. Min Date (Log Start Date); reuse resolveServerRange result for the all preset
  const minDatePromise = isAll
    ? Promise.resolve([{ log_start_date: logStart }])
    : sql`
        SELECT MIN(played_at) AS log_start_date FROM plays;
      `;

  // 2. Metrics Ribbon
  const metricPromise = isEnrichedPromise.then((isEnriched) => {
    const artistExpr = isEnriched
      ? sql`COUNT(DISTINCT t.artist_id)::bigint`
      : sql`COUNT(DISTINCT t.artist_group_key)::bigint`;
    return sql`
      SELECT 
        COUNT(DISTINCT p.track_id)::bigint AS tracks,
        ${artistExpr} AS artists,
        COALESCE(SUM(p.ms_played), 0)::bigint AS total_ms,
        MIN(p.played_at) AS window_min_date
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      WHERE ${timeFilter};
    `;
  });

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
            COALESCE(t.artist_id, t.artist_group_key) AS artist_key,
            COALESCE(t.album_id, t.album_group_key) AS album_key,
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
            WHERE ${timeFilter}
            GROUP BY p.track_id
        ),
        previous_window AS (
            SELECT p.track_id,
                   DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS prev_rank
            FROM plays p
            WHERE p.played_at >= ${prev!.from}::timestamptz
              AND p.played_at < ${prev!.to}::timestamptz
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
            COALESCE(t.artist_id, t.artist_group_key) AS artist_key,
            COALESCE(t.album_id, t.album_group_key) AS album_key,
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
  const topArtistsPromise = isEnrichedPromise.then((isEnriched) => {
    const artistGroupCol = isEnriched ? sql`t.artist_id` : sql`t.artist_group_key`;
    const enrichedFilter = isEnriched ? sql`t.artist_id IS NOT NULL` : sql`TRUE`;
    return sql`
      SELECT 
        ${isEnriched ? sql`t.artist_id` : sql`MAX(t.artist_id)`} AS id,
        ${artistGroupCol} AS profile_key,
        COALESCE(MAX(ar.name), MAX(t.artist_name)) AS name,
        COUNT(p.id)::int AS count
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      LEFT JOIN artists ar ON t.artist_id = ar.id
      WHERE ${timeFilter} AND ${enrichedFilter}
      GROUP BY ${artistGroupCol}
      ORDER BY count DESC, name ASC
      LIMIT 5;
    `;
  });

  // 5. Top Albums (Top 5)
  const topAlbumsPromise = isEnrichedPromise.then((isEnriched) => {
    const albumGroupCol = isEnriched ? sql`t.album_id` : sql`t.album_group_key`;
    const enrichedFilter = isEnriched ? sql`t.album_id IS NOT NULL` : sql`TRUE`;
    return sql`
      SELECT 
        ${isEnriched ? sql`t.album_id` : sql`MAX(t.album_id)`} AS id,
        ${albumGroupCol} AS profile_key,
        COALESCE(MAX(al.name), MAX(t.album_name)) AS name,
        COALESCE(MAX(ar.name), MAX(t.artist_name)) AS artist,
        MAX(t.artist_id) AS artist_id,
        COALESCE(MAX(t.artist_id), MAX(t.artist_group_key)) AS artist_key,
        COUNT(p.id)::int AS count
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      LEFT JOIN albums al ON t.album_id = al.id
      LEFT JOIN artists ar ON t.artist_id = ar.id
      WHERE ${timeFilter} AND ${enrichedFilter}
      GROUP BY ${albumGroupCol}
      ORDER BY count DESC, name ASC
      LIMIT 5;
    `;
  });

  // 6. Activity cadence query
  const cadenceQueryPromise = buildCadenceQuery(window, cadenceRowGranularity(granularity), tz);

  // 7. Last sync
  const lastSyncPromise = getLastSync();

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
  ]));

  // Format log start date
  const logStartDate = minDateRow?.log_start_date
    ? formatLogStartDate(new Date(minDateRow.log_start_date), tz)
    : "--";

  // Calculate elapsed days for daily average
  let elapsedDays: number;
  if (isAll) {
    if (metricRow?.window_min_date) {
      const ms = now.getTime() - new Date(metricRow.window_min_date).getTime();
      elapsedDays = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
    } else {
      elapsedDays = 1;
    }
  } else {
    elapsedDays = elapsedWindowDays(window, now);
  }

  const totalMs = Number(metricRow?.total_ms || 0);
  const trackCount = Number(metricRow?.tracks || 0);
  const artistCount = Number(metricRow?.artists || 0);

  const rawMetrics = {
    totalMs,
    trackCount,
    artistCount,
    elapsedDays,
  };

  const metrics = formatOverviewMetrics(rawMetrics, "minutes", granularity);

  // Process top tracks
  const topTracks: TrackSummary[] = rawTopTracks.map((row) => ({
    id: row.track_id,
    rank: String(row.rank).padStart(2, "0"),
    drift: (row.drift as TrackSummary["drift"]) || "·",
    name: row.title,
    artist: row.artist,
    artistId: row.artist_id || undefined,
    artistKey: row.artist_key || undefined,
    album: row.album,
    albumId: row.album_id || undefined,
    albumKey: row.album_key || undefined,
    duration: formatDurationMs(row.duration_ms || 0),
    plays: Number(row.plays),
    swatchColor: getSwatchColor(row.track_id + row.title),
    albumImageUrl: row.album_image_url || null,
  }));

  // Process top artists
  const topArtists: ArtistSummary[] = rawTopArtists.map((row, idx) => ({
    id: row.id || undefined,
    key: row.profile_key || undefined,
    rank: String(idx + 1).padStart(2, "0"),
    name: row.name,
    count: Number(row.count),
  }));

  // Process top albums
  const topAlbums: AlbumSummary[] = rawTopAlbums.map((row, idx) => ({
    id: row.id || undefined,
    key: row.profile_key || undefined,
    rank: String(idx + 1).padStart(2, "0"),
    name: row.name,
    artist: row.artist,
    artistId: row.artist_id || undefined,
    artistKey: row.artist_key || undefined,
    count: Number(row.count),
  }));

  // Process activity cadence
  const { activityCadence } = buildActivityCadence({
    window,
    granularity,
    tz,
    now,
    cadenceRows: cadenceRows as CadenceRow[],
  });

  return {
    range: formatRangeParam(sel),
    granularity,
    logStartDate,
    rawMetrics,
    metrics,
    topTracks,
    topArtists,
    topAlbums,
    activityCadence,
    lastSyncedAt: lastSync,
  };
}
