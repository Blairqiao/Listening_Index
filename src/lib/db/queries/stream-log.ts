import { getDb } from "../index";
import { getLastSync } from "./ingestion";
import { isCatalogFullyEnriched } from "./enrichment";
import {
  sanitizeTimezone,
  formatDayGroupTz,
  formatHHmmTz,
  formatDurationMs,
  formatDurationHoursMinutes,
} from "./helpers";
import { getSwatchColor } from "@/lib/color-utils";
import type { StreamLogData, StreamLogItem, StreamLogMetricsRaw } from "./types";

/**
 * Mode 2: Retrieves the chronological stream log buffer of recent plays and lifetime metrics.
 */
export async function getStreamLog(
  limit = 50,
  tzOverride?: string,
  cursorTimestamp?: string,
  cursorId?: string,
  prevDayGroup?: string,
  prevPlayedAt?: string
): Promise<StreamLogData> {
  const sql = getDb();
  const clampedLimit = Math.max(1, limit);
  const tz = sanitizeTimezone(tzOverride);

  // Keyset Query & Lifetime Metrics: Fetched concurrently via Promise.all
  interface StreamRow {
    id: string;
    track_id: string;
    artist_id: string;
    album_id: string;
    album_image_url: string | null;
    played_at: string;
    title: string;
    artist: string;
    album: string;
    duration_ms: number;
    status: string;
  }

  let rawMetrics: StreamLogMetricsRaw = {
    totalPlays: 0,
    uniqueTracks: 0,
    uniqueArtists: 0,
    streakDays: 0,
  };
  let metrics: [string, string, string, string] = ["--", "--", "--", "--"];
  let streamRows: StreamRow[];
  let lastSync: string | undefined;

  const lastSyncPromise = getLastSync("spotify");

  const isNumericCursorId = Boolean(cursorId && /^\d+$/.test(cursorId));
  const cursorClause = !cursorTimestamp
    ? sql`TRUE`
    : isNumericCursorId
    ? sql`(p.played_at < ${cursorTimestamp}::timestamptz) OR (p.played_at = ${cursorTimestamp}::timestamptz AND p.id < ${cursorId}::bigint)`
    : sql`p.played_at < ${cursorTimestamp}::timestamptz`;

  const streamRowsPromise = sql`
    SELECT 
        p.id::text,
        p.played_at,
        p.track_id,
        ar.id AS artist_id,
        al.id AS album_id,
        al.image_url AS album_image_url,
        t.name AS title,
        COALESCE(ar.name, t.artist_name, '') AS artist,
        COALESCE(al.name, t.album_name, '') AS album,
        t.duration_ms,
        CASE 
            WHEN t.enrichment_status = 'delisted' THEN '[DELISTED]'
            WHEN p.played_at >= NOW() - INTERVAL '30 minutes' THEN '[PLAYING]'
            ELSE '[FULL]'
        END AS status
    FROM plays p
    JOIN tracks t ON p.track_id = t.id
    LEFT JOIN albums al ON t.album_id = al.id
    LEFT JOIN artists ar ON t.artist_id = ar.id
    WHERE ${cursorClause}
    ORDER BY p.played_at DESC, p.id DESC
    LIMIT ${clampedLimit + 1};
  `;

  if (!cursorTimestamp) {
    const isEnrichedPromise = isCatalogFullyEnriched();

    const totalsPromise = isEnrichedPromise.then((isEnriched) => {
      const artistExpr = isEnriched
        ? sql`COUNT(DISTINCT t.artist_id)::bigint`
        : sql`COUNT(DISTINCT t.artist_group_key)::bigint`;
      return sql`
        SELECT 
          COUNT(*)::bigint AS total_plays,
          COUNT(DISTINCT p.track_id)::bigint AS unique_tracks,
          ${artistExpr} AS unique_artists
        FROM plays p
        JOIN tracks t ON p.track_id = t.id;
      `;
    });

    const streakPromise = sql`
      WITH RECURSIVE streak_days AS (
        -- Anchor: check if today or yesterday has any plays
        SELECT
          CASE
            WHEN EXISTS (
              SELECT 1 FROM plays 
              WHERE played_at >= ((NOW() AT TIME ZONE ${tz})::date::timestamp AT TIME ZONE ${tz}) 
                AND played_at < (((NOW() AT TIME ZONE ${tz})::date + 1)::timestamp AT TIME ZONE ${tz})
            ) THEN (NOW() AT TIME ZONE ${tz})::date
            WHEN EXISTS (
              SELECT 1 FROM plays 
              WHERE played_at >= (((NOW() AT TIME ZONE ${tz})::date - 1)::timestamp AT TIME ZONE ${tz}) 
                AND played_at < ((NOW() AT TIME ZONE ${tz})::date::timestamp AT TIME ZONE ${tz})
            ) THEN (NOW() AT TIME ZONE ${tz})::date - 1
            ELSE NULL
          END AS d
        UNION ALL
        -- Step backward 1 day as long as that previous day has plays
        SELECT d - 1
        FROM streak_days
        WHERE d IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM plays
            WHERE played_at >= ((d - 1)::timestamp AT TIME ZONE ${tz})
              AND played_at < (d::timestamp AT TIME ZONE ${tz})
          )
      )
      SELECT COUNT(*)::int AS streak FROM streak_days WHERE d IS NOT NULL;
    `;

    const [totalsResult, streakResult, streamRowsResult, lastSyncResult] =
      await Promise.all([
        totalsPromise,
        streakPromise,
        streamRowsPromise,
        lastSyncPromise,
      ]);

    const totalsRow = (totalsResult)[0];
    const currentStreak = Number((streakResult)[0]?.streak) || 0;
    streamRows = streamRowsResult as StreamRow[];
    lastSync = lastSyncResult;

    const totalPlays = Number(totalsRow?.total_plays || 0);
    const uniqueTracks = Number(totalsRow?.unique_tracks || 0);
    const uniqueArtists = Number(totalsRow?.unique_artists || 0);

    rawMetrics = {
      totalPlays,
      uniqueTracks,
      uniqueArtists,
      streakDays: currentStreak,
    };

    const totalPlaysStr = totalPlays.toLocaleString();
    const uniqueTracksStr = uniqueTracks.toLocaleString();
    const uniqueArtistsStr = uniqueArtists.toLocaleString();
    const streakStr = `${currentStreak} ${currentStreak === 1 ? "DAY" : "DAYS"}`;

    metrics = [
      totalPlaysStr,
      uniqueTracksStr,
      uniqueArtistsStr,
      streakStr,
    ];
  } else {
    const [streamRowsResult, lastSyncResult] = await Promise.all([
      streamRowsPromise,
      lastSyncPromise,
    ]);
    streamRows = streamRowsResult as StreamRow[];
    lastSync = lastSyncResult;
  }

  const hasMore = streamRows.length > clampedLimit;
  const pagedRows = streamRows.slice(0, clampedLimit);

  const lastRow = pagedRows[pagedRows.length - 1];
  const nextCursor = lastRow ? new Date(lastRow.played_at).toISOString() : null;
  const nextCursorId = lastRow ? String(lastRow.id) : null;

  // 3. Group pagedRows into sessions bounded by >30-min gap
  interface SittingGroup {
    startIndex: number;
    rows: StreamRow[];
  }

  const sittings: SittingGroup[] = [];
  let currentGroupRows: StreamRow[] = [];
  let currentGroupStartIndex = 0;

  for (let i = 0; i < pagedRows.length; i++) {
    const row = pagedRows[i];
    currentGroupRows.push(row);

    const nextRow = pagedRows[i + 1];
    if (nextRow) {
      const currentMs = new Date(row.played_at).getTime();
      const nextMs = new Date(nextRow.played_at).getTime();
      const gapMs = currentMs - nextMs;

      if (gapMs > 30 * 60 * 1000) {
        sittings.push({
          startIndex: currentGroupStartIndex,
          rows: currentGroupRows,
        });
        currentGroupRows = [];
        currentGroupStartIndex = i + 1;
      }
    } else {
      sittings.push({
        startIndex: currentGroupStartIndex,
        rows: currentGroupRows,
      });
      currentGroupRows = [];
    }
  }

  // 4. Map session startIndex -> sessionGap with summary (# tracks · duration)
  const sittingGapMap = new Map<number, { durationStr: string; sittingLabel: string }>();

  // Cross-chunk boundary stitching: detect gap between prevPlayedAt and row 0
  if (prevPlayedAt && pagedRows.length > 0 && sittings.length > 0) {
    const boundaryGapMs = new Date(prevPlayedAt).getTime() - new Date(pagedRows[0].played_at).getTime();
    if (boundaryGapMs > 30 * 60 * 1000) {
      const sitting0 = sittings[0];
      const count = sitting0.rows.length;
      const tracksLabel = `${count} ${count === 1 ? "TRACK" : "TRACKS"}`;
      const sittingStartMs = new Date(sitting0.rows[sitting0.rows.length - 1].played_at).getTime();
      const sittingEndMs = new Date(sitting0.rows[0].played_at).getTime();
      const lastTrackDurationMs = sitting0.rows[sitting0.rows.length - 1].duration_ms || 0;
      const sumDurationMs = sitting0.rows.reduce((sum, r) => sum + (r.duration_ms || 0), 0);
      const runtimeMs = Math.max(sittingEndMs - sittingStartMs + lastTrackDurationMs, sumDurationMs);
      const sittingDurationStr = formatDurationHoursMinutes(runtimeMs);

      sittingGapMap.set(0, {
        durationStr: formatDurationHoursMinutes(boundaryGapMs),
        sittingLabel: `${tracksLabel} · ${sittingDurationStr.toUpperCase()}`,
      });
    }
  }

  for (let k = 1; k < sittings.length; k++) {
    const prevSitting = sittings[k - 1];
    const sitting = sittings[k];

    const prevOldestMs = new Date(prevSitting.rows[prevSitting.rows.length - 1].played_at).getTime();
    const currentNewestMs = new Date(sitting.rows[0].played_at).getTime();
    const gapMs = prevOldestMs - currentNewestMs;
    const gapDurationStr = formatDurationHoursMinutes(gapMs);

    const count = sitting.rows.length;
    const tracksLabel = `${count} ${count === 1 ? "TRACK" : "TRACKS"}`;

    const sittingStartMs = new Date(sitting.rows[sitting.rows.length - 1].played_at).getTime();
    const sittingEndMs = new Date(sitting.rows[0].played_at).getTime();
    const lastTrackDurationMs = sitting.rows[sitting.rows.length - 1].duration_ms || 0;
    const sumDurationMs = sitting.rows.reduce((sum, r) => sum + (r.duration_ms || 0), 0);
    const runtimeMs = Math.max(sittingEndMs - sittingStartMs + lastTrackDurationMs, sumDurationMs);
    const sittingDurationStr = formatDurationHoursMinutes(runtimeMs);

    const sittingLabel = `${tracksLabel} · ${sittingDurationStr.toUpperCase()}`;

    sittingGapMap.set(sitting.startIndex, {
      durationStr: gapDurationStr,
      sittingLabel,
    });
  }

  let lastDayGroup = prevDayGroup || "";
  const entries: StreamLogItem[] = [];

  for (let i = 0; i < pagedRows.length; i++) {
    const row = pagedRows[i];
    const playDate = new Date(row.played_at);
    const dayGroup = formatDayGroupTz(playDate, tz);
    const isNewDay = dayGroup !== lastDayGroup;
    lastDayGroup = dayGroup;

    const sessionGap = sittingGapMap.get(i);

    entries.push({
      id: row.id,
      trackId: row.track_id,
      artistId: row.artist_id,
      albumId: row.album_id,
      albumImageUrl: row.album_image_url || null,
      swatchColor: getSwatchColor(row.track_id + row.title),
      playedAt: new Date(row.played_at).toISOString(),
      timeStr: formatHHmmTz(playDate, tz),
      title: row.title,
      artist: row.artist,
      album: row.album,
      duration: formatDurationMs(row.duration_ms),
      durationMs: row.duration_ms,
      status: row.status,
      dayGroup: isNewDay ? dayGroup : undefined,
      sessionGap,
    });
  }

  return {
    rawMetrics,
    metrics,
    entries,
    nextCursor,
    nextCursorId,
    hasMore,
    lastSyncedAt: lastSync ?? (pagedRows[0]?.played_at
      ? new Date(pagedRows[0].played_at).toISOString()
      : undefined),
  };
}
