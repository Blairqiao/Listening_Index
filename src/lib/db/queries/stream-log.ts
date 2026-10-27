import { getDb } from "../index";
import { getCompleteSessionRows } from "./session-context";
import { calculateSessions, SESSION_GAP_MS } from "@/lib/session-calculation";
import { getLastSync } from "./ingestion";
import { isCatalogFullyEnriched } from "./enrichment";
import {
  sanitizeTimezone,
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
  _prevDayGroup?: string,
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

  const context = pagedRows.length ? await getCompleteSessionRows({newest:pagedRows[0],oldest:pagedRows[pagedRows.length-1]}) : [];
  const sessions = calculateSessions(context.map(p=>({...p,playedAt:new Date(p.played_at).toISOString(),durationMs:p.duration_ms,trackId:p.track_id,artistId:p.artist_id,albumId:p.album_id})));
  const summaryByPlay = new Map(sessions.flatMap(session=>session.plays.map(play=>[play.id,session] as const)));
  const sittingGapMap = new Map<number,NonNullable<StreamLogItem["sessionGap"]>>();
  for (let i=0;i<pagedRows.length;i++) {
    const previous = i ? pagedRows[i-1].played_at : prevPlayedAt;
    if (!previous) continue;
    const gap=Date.parse(previous)-new Date(pagedRows[i].played_at).getTime();
    if (gap<=SESSION_GAP_MS) continue;
    const session=summaryByPlay.get(pagedRows[i].id);
    if (!session) continue;
    const count=session.plays.length;
    sittingGapMap.set(i,{durationMs:gap,sessionId:session.id,trackCount:count,runtimeMs:session.runtimeMs});
  }

  const entries: StreamLogItem[] = [];

  for (let i = 0; i < pagedRows.length; i++) {
    const row = pagedRows[i];

    const sessionGap = sittingGapMap.get(i);

    entries.push({
      id: row.id,
      trackId: row.track_id,
      artistId: row.artist_id,
      albumId: row.album_id,
      albumImageUrl: row.album_image_url || null,
      swatchColor: getSwatchColor(row.track_id + row.title),
      playedAt: new Date(row.played_at).toISOString(),
      title: row.title,
      artist: row.artist,
      album: row.album,
      durationMs: row.duration_ms,
      status: row.status,
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
