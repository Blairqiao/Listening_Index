import { getDb } from "../index";
import {
  makeArtistGroupKey,
  makeAlbumGroupKey,
  truncateToSeconds,
  debouncePlays,
} from "@/lib/history-parser";
import { lastSyncCache, catalogStatusCache } from "./cache";
import type { TrackUpsertItem, PlayInsertItem } from "./types";

/**
 * Records the most recent sync execution timestamp in daily_api_usage.
 */
export async function recordLastSync(): Promise<Date> {
  const sql = getDb();
  const todayUtc = new Date().toISOString().slice(0, 10);
  const rows = ((await sql`
    INSERT INTO daily_api_usage (usage_date, cron_count, dynamic_count, total_count, last_synced_at, updated_at)
    VALUES (${todayUtc}::date, 0, 0, 0, NOW(), NOW())
    ON CONFLICT (usage_date) DO UPDATE SET
      last_synced_at = NOW(),
      updated_at = NOW()
    RETURNING last_synced_at;
  `) );
  lastSyncCache.invalidate();
  return new Date(rows[0].last_synced_at);
}

/**
 * Retrieves the most recent sync execution timestamp from daily_api_usage.
 * Deduplicates concurrent calls via in-flight promise latch and caches for 15 seconds.
 */
export async function getLastSync(): Promise<string | undefined> {
  return lastSyncCache.get(async () => {
    try {
      const sql = getDb();
      const rows = ((await sql`
        SELECT last_synced_at FROM daily_api_usage WHERE last_synced_at IS NOT NULL ORDER BY last_synced_at DESC LIMIT 1;
      `) );
      return rows && rows.length > 0 && rows[0].last_synced_at
        ? new Date(rows[0].last_synced_at).toISOString()
        : undefined;
    } catch {
      return undefined;
    }
  });
}

// ---------------------------------------------------------------------------
// High-Throughput Bulk Ingestion Operations (UNNEST Array Queries)
// ---------------------------------------------------------------------------

export async function bulkUpsertArtists(artists: Array<{ id: string; name: string }>): Promise<void> {
  if (artists.length === 0) return;
  const sorted = [...artists].sort((a, b) => a.id.localeCompare(b.id));
  const ids = sorted.map((a) => a.id);
  const names = sorted.map((a) => a.name);
  const sql = getDb();
  await sql`
    INSERT INTO artists (id, name)
    SELECT * FROM UNNEST(${ids}::text[], ${names}::text[])
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
  `;
}

export async function bulkUpsertAlbums(
  albums: Array<{ id: string; name: string; imageUrl?: string | null; artistId: string }>
): Promise<void> {
  if (albums.length === 0) return;
  const sorted = [...albums].sort((a, b) => a.id.localeCompare(b.id));
  const ids = sorted.map((a) => a.id);
  const names = sorted.map((a) => a.name);
  const imageUrls = sorted.map((a) => a.imageUrl ?? null);
  const artistIds = sorted.map((a) => a.artistId);
  const sql = getDb();
  await sql`
    INSERT INTO albums (id, name, image_url, artist_id)
    SELECT * FROM UNNEST(${ids}::text[], ${names}::text[], ${imageUrls}::text[], ${artistIds}::text[])
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      image_url = COALESCE(EXCLUDED.image_url, albums.image_url),
      artist_id = EXCLUDED.artist_id;
  `;
}

export async function bulkUpsertTracks(
  tracks: TrackUpsertItem[]
): Promise<void> {
  if (tracks.length === 0) return;

  // Deduplicate and aggregate highest observed playback
  const map = new Map<string, TrackUpsertItem>();
  for (const t of tracks) {
    const existing = map.get(t.id);
    if (!existing) {
      map.set(t.id, { ...t });
    } else {
      existing.durationMs = Math.max(existing.durationMs, t.durationMs);
      if (t.artistId) existing.artistId = t.artistId;
      if (t.albumId) existing.albumId = t.albumId;
      if (t.enrichmentStatus === "enriched") existing.enrichmentStatus = "enriched";
    }
  }

  const sorted = Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));

  const ids = sorted.map((t) => t.id);
  const names = sorted.map((t) => t.name);
  const artistNames = sorted.map((t) => t.artistName);
  const albumNames = sorted.map((t) => t.albumName);
  const artistGroupKeys = sorted.map((t) => t.artistGroupKey || makeArtistGroupKey(t.artistName));
  const albumGroupKeys = sorted.map((t) => t.albumGroupKey || makeAlbumGroupKey(t.artistName, t.albumName));
  const artistIds = sorted.map((t) => t.artistId ?? null);
  const albumIds = sorted.map((t) => t.albumId ?? null);
  const durations = sorted.map((t) => Math.max(0, Math.round(t.durationMs)));
  const statuses = sorted.map((t) => t.enrichmentStatus ?? "pending");

  const sql = getDb();
  await sql`
    INSERT INTO tracks (
      id, name, artist_name, album_name,
      artist_group_key, album_group_key,
      artist_id, album_id,
      duration_ms,
      enrichment_status
    )
    SELECT 
      u.id, u.name, u.artist_name, u.album_name,
      u.artist_group_key, u.album_group_key,
      u.artist_id, u.album_id,
      u.duration_ms,
      u.enrichment_status
    FROM UNNEST(
      ${ids}::text[],
      ${names}::text[],
      ${artistNames}::text[],
      ${albumNames}::text[],
      ${artistGroupKeys}::text[],
      ${albumGroupKeys}::text[],
      ${artistIds}::text[],
      ${albumIds}::text[],
      ${durations}::int[],
      ${statuses}::text[]
    ) AS u(
      id, name, artist_name, album_name,
      artist_group_key, album_group_key,
      artist_id, album_id,
      duration_ms,
      enrichment_status
    )
    ON CONFLICT (id) DO UPDATE SET
      name = CASE 
        WHEN tracks.enrichment_status = 'enriched' THEN tracks.name 
        ELSE COALESCE(EXCLUDED.name, tracks.name) 
      END,
      artist_name = CASE 
        WHEN tracks.enrichment_status = 'enriched' THEN tracks.artist_name 
        ELSE COALESCE(EXCLUDED.artist_name, tracks.artist_name) 
      END,
      album_name = CASE 
        WHEN tracks.enrichment_status = 'enriched' THEN tracks.album_name 
        ELSE COALESCE(EXCLUDED.album_name, tracks.album_name) 
      END,
      artist_group_key = CASE 
        WHEN tracks.enrichment_status = 'enriched' THEN tracks.artist_group_key 
        ELSE COALESCE(EXCLUDED.artist_group_key, tracks.artist_group_key) 
      END,
      album_group_key = CASE 
        WHEN tracks.enrichment_status = 'enriched' THEN tracks.album_group_key 
        ELSE COALESCE(EXCLUDED.album_group_key, tracks.album_group_key) 
      END,
      artist_id = COALESCE(EXCLUDED.artist_id, tracks.artist_id),
      album_id = COALESCE(EXCLUDED.album_id, tracks.album_id),
      duration_ms = CASE 
        WHEN tracks.enrichment_status = 'enriched' THEN tracks.duration_ms
        WHEN EXCLUDED.enrichment_status = 'enriched' THEN EXCLUDED.duration_ms
        ELSE GREATEST(tracks.duration_ms, EXCLUDED.duration_ms) 
      END,
      enrichment_status = CASE 
        WHEN EXCLUDED.enrichment_status = 'enriched' THEN 'enriched' 
        ELSE tracks.enrichment_status 
      END;
  `;
  catalogStatusCache.invalidate();
}

export async function bulkInsertPlays(
  plays: PlayInsertItem[]
): Promise<{ insertedCount: number }> {
  if (plays.length === 0) return { insertedCount: 0 };

  // 1. Debounce candidate plays within the incoming batch first
  const { debounced: batchDebounced } = debouncePlays(plays, 30_000);
  if (batchDebounced.length === 0) return { insertedCount: 0 };

  // 2. Truncate to whole seconds and deduplicate on (played_at, track_id) within the batch
  const seen = new Map<string, PlayInsertItem>();
  for (const p of batchDebounced) {
    const truncated = truncateToSeconds(p.playedAt);
    const key = `${truncated}::${p.trackId}`;
    const previous = seen.get(key);
    seen.set(key, {
      ...p,
      playedAt: truncated,
      msPlayed: Math.max(previous?.msPlayed || 0, p.msPlayed || 0),
    });
  }

  // Sort deterministically by (played_at, track_id) to enforce lock ordering and prevent deadlocks
  const deduped = Array.from(seen.values()).sort(
    (a, b) => a.playedAt.localeCompare(b.playedAt) || a.trackId.localeCompare(b.trackId)
  );

  const playedAts = deduped.map((p) => p.playedAt);
  const trackIds = deduped.map((p) => p.trackId);
  const msPlayeds = deduped.map((p) => Math.max(0, Math.round(p.msPlayed || 0)));

  const sql = getDb();

  // 3. Race-safe insert and duration merge. The advisory locks are taken in a
  // separate statement first: under READ COMMITTED each statement gets a fresh
  // snapshot, so the insert sees any Play a concurrent import committed before
  // releasing its lock. A lock inside the insert statement would not.
  const distinctTrackIds = Array.from(new Set(trackIds)).sort();
  const [, insertedResult] = (await sql.transaction([
    sql`
      SELECT pg_advisory_xact_lock(hashtext(st.t))
      FROM (SELECT t FROM UNNEST(${distinctTrackIds}::text[]) AS s(t) ORDER BY t) AS st;
    `,
    sql`
    WITH candidates AS (
      SELECT
        u.played_at::timestamptz AS played_at,
        u.track_id,
        u.ms_played
      FROM UNNEST(
        ${playedAts}::text[],
        ${trackIds}::text[],
        ${msPlayeds}::int[]
      ) AS u(played_at, track_id, ms_played)
    ),
    updated AS (
      UPDATE plays p
      SET ms_played = GREATEST(p.ms_played, c_agg.max_ms)
      FROM (
        SELECT
          p.id AS play_id,
          MAX(c.ms_played) AS max_ms
        FROM plays p
        JOIN candidates c ON p.track_id = c.track_id
          AND (
            p.played_at = c.played_at
            OR ABS(EXTRACT(EPOCH FROM (p.played_at - c.played_at))) * 1000 < GREATEST(30000, ROUND(GREATEST(COALESCE(p.ms_played, 0), COALESCE(c.ms_played, 0)) * 0.90))
          )
        GROUP BY p.id
      ) c_agg
      WHERE p.id = c_agg.play_id
      RETURNING p.id
    ),
    inserted AS (
      INSERT INTO plays (played_at, track_id, ms_played)
      SELECT c.played_at, c.track_id, c.ms_played
      FROM candidates c
      WHERE NOT EXISTS (
        SELECT 1 FROM plays p
        WHERE p.track_id = c.track_id
          AND (
            p.played_at = c.played_at
            OR ABS(EXTRACT(EPOCH FROM (p.played_at - c.played_at))) * 1000 < GREATEST(30000, ROUND(GREATEST(COALESCE(p.ms_played, 0), COALESCE(c.ms_played, 0)) * 0.90))
          )
      )
      ON CONFLICT (played_at, track_id) DO UPDATE SET
        ms_played = GREATEST(plays.ms_played, EXCLUDED.ms_played)
      RETURNING (xmax = 0) AS was_inserted
    )
    SELECT COUNT(*)::int AS inserted_count FROM inserted WHERE was_inserted;
  `,
  ])) as [unknown, Array<{ inserted_count?: number | string }>];

  const insertedCount = Number(insertedResult[0]?.inserted_count ?? 0);
  return { insertedCount };
}
