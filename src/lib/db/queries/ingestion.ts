import { getDb } from "../index";
import { ensureTablesExist } from "./schema";
import {
  makeArtistGroupKey,
  makeAlbumGroupKey,
  truncateToSeconds,
  debouncePlays,
} from "@/lib/history-parser";
import { lastSyncCache, catalogStatusCache } from "./cache";
import type { TrackUpsertItem, PlayInsertItem } from "./types";

/**
 * Retrieves existing (played_at, track_id) keys in a batch to pre-filter duplicates.
 */
export async function getExistingPlayKeys(
  items: Array<{ playedAt: string; trackId: string }>
): Promise<Set<string>> {
  if (items.length === 0) return new Set();
  const sql = getDb();

  let minMs = Infinity;
  let maxMs = -Infinity;
  for (const i of items) {
    const t = new Date(i.playedAt).getTime();
    if (t < minMs) minMs = t;
    if (t > maxMs) maxMs = t;
  }
  const minDate = new Date(minMs).toISOString();
  const maxDate = new Date(maxMs).toISOString();

  const existingRows = ((await sql`
    SELECT played_at, track_id
    FROM plays
    WHERE played_at >= ${minDate}::timestamptz 
      AND played_at <= ${maxDate}::timestamptz;
  `));

  const existingKeys = new Set<string>();
  for (const row of existingRows) {
    const timeIso = truncateToSeconds(row.played_at);
    existingKeys.add(`${timeIso}::${row.track_id}`);
  }
  return existingKeys;
}

/**
 * 6. Retrieves existing artist, album, and track IDs in batch to skip redundant metadata queries.
 */
export async function getExistingEntityIds(params: {
  artistIds: string[];
  albumIds: string[];
  trackIds: string[];
}): Promise<{
  existingArtistIds: Set<string>;
  existingAlbumIds: Set<string>;
  existingTrackIds: Set<string>;
}> {
  const sql = getDb();
  const artistsPromise =
    params.artistIds.length > 0
      ? sql`SELECT id FROM artists WHERE id = ANY(${params.artistIds}::text[]);`
      : Promise.resolve([]);
  const albumsPromise =
    params.albumIds.length > 0
      ? sql`SELECT id FROM albums WHERE id = ANY(${params.albumIds}::text[]);`
      : Promise.resolve([]);
  const tracksPromise =
    params.trackIds.length > 0
      ? sql`SELECT id FROM tracks WHERE id = ANY(${params.trackIds}::text[]);`
      : Promise.resolve([]);

  const [artists, albums, tracks] = (await Promise.all([
    artistsPromise,
    albumsPromise,
    tracksPromise,
  ])) ;

  return {
    existingArtistIds: new Set<string>(artists.map((r) => r.id)),
    existingAlbumIds: new Set<string>(albums.map((r) => r.id)),
    existingTrackIds: new Set<string>(tracks.map((r) => r.id)),
  };
}

/**
 * 7. Records the most recent sync execution timestamp in daily_api_usage.
 */
export async function recordLastSync(_: string = "spotify"): Promise<Date> {
  await ensureTablesExist();
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
 * 8. Retrieves the most recent sync execution timestamp from daily_api_usage.
 * Deduplicates concurrent calls via in-flight promise latch and caches for 15 seconds.
 */
export async function getLastSync(_: string = "spotify"): Promise<string | undefined> {
  return lastSyncCache.get(async () => {
    try {
      await ensureTablesExist();
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
  await ensureTablesExist();
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
  await ensureTablesExist();
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
  await ensureTablesExist();

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
  await ensureTablesExist();

  // 1. Check DB boundary for candidate tracks to populate initialLastSeen
  const candidateTrackIds = Array.from(new Set(plays.map((p) => p.trackId)));
  const timesMs = plays.map((p) => new Date(p.playedAt).getTime());
  const maxCandidateDuration = Math.max(30_000, ...plays.map((p) => p.msPlayed || 0));
  const minTime = new Date(Math.min(...timesMs) - maxCandidateDuration).toISOString();
  const maxTime = new Date(Math.max(...timesMs) + 30_000).toISOString();

  const sql = getDb();
  const existingRecentPlays = (await sql`
    SELECT track_id, played_at
    FROM plays
    WHERE track_id = ANY(${candidateTrackIds}::text[])
      AND played_at >= ${minTime}::timestamptz
      AND played_at <= ${maxTime}::timestamptz
    ;
  `) as Array<{ track_id: string; played_at: Date | string }>;

  const initialLastSeen = new Map<string, number>();
  const existingKeys = new Set<string>();
  for (const ep of existingRecentPlays) {
    const timestamp = new Date(ep.played_at).getTime();
    initialLastSeen.set(ep.track_id, Math.max(initialLastSeen.get(ep.track_id) ?? -Infinity, timestamp));
    existingKeys.add(`${truncateToSeconds(ep.played_at)}::${ep.track_id}`);
  }

  // 2. Debounce candidate plays with cross-batch continuity
  const exact = plays.filter(p => existingKeys.has(`${truncateToSeconds(p.playedAt)}::${p.trackId}`));
  const candidates = plays.filter(p => !existingKeys.has(`${truncateToSeconds(p.playedAt)}::${p.trackId}`));
  const { debounced: newPlays } = debouncePlays(candidates, 30_000, initialLastSeen);
  const debounced = [...exact, ...newPlays];
  if (debounced.length === 0) return { insertedCount: 0 };

  // 3. Deduplicate on truncated UTC seconds in JS to prevent Postgres ON CONFLICT batch error
  const seen = new Map<string, PlayInsertItem>();
  for (const p of debounced) {
    const truncated = truncateToSeconds(p.playedAt);
    const key = `${truncated}::${p.trackId}`;
    const previous = seen.get(key);
    seen.set(key, { ...p, playedAt: truncated, msPlayed: Math.max(previous?.msPlayed || 0, p.msPlayed) });
  }

  // Sort by (played_at, track_id) to enforce deterministic lock ordering and prevent deadlocks
  const deduped = Array.from(seen.values()).sort(
    (a, b) => a.playedAt.localeCompare(b.playedAt) || a.trackId.localeCompare(b.trackId)
  );

  const playedAts = deduped.map((p) => p.playedAt);
  const trackIds = deduped.map((p) => p.trackId);
  const msPlayeds = deduped.map((p) => Math.max(0, Math.round(p.msPlayed)));

  const inserted = ((await sql`
    INSERT INTO plays (played_at, track_id, ms_played)
    SELECT u.played_at::timestamptz, u.track_id, u.ms_played
    FROM UNNEST(
      ${playedAts}::text[],
      ${trackIds}::text[],
      ${msPlayeds}::int[]
    ) AS u(played_at, track_id, ms_played)
    ON CONFLICT (played_at, track_id) DO UPDATE SET
      ms_played = GREATEST(plays.ms_played, EXCLUDED.ms_played)
    RETURNING (xmax = 0) AS was_inserted;
  `));

  const insertedCount = inserted.filter((r) => Boolean(r.was_inserted)).length;
  return { insertedCount };
}
