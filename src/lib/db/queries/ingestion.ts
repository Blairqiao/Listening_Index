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
 * 1. Upserts an artist record into the artists table.
 */
export async function upsertArtist(id: string, name: string): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO artists (id, name)
    VALUES (${id}, ${name})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
  `;
}

/**
 * 2. Upserts an album record into the albums table.
 */
export async function upsertAlbum(
  id: string,
  name: string,
  imageUrl: string | null,
  artistId: string
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO albums (id, name, image_url, artist_id)
    VALUES (${id}, ${name}, ${imageUrl}, ${artistId})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      image_url = EXCLUDED.image_url,
      artist_id = EXCLUDED.artist_id;
  `;
}

/**
 * 3. Upserts a track record into the tracks table.
 */
export async function upsertTrack(
  id: string,
  name: string,
  artistId: string | null,
  albumId: string | null,
  durationMs: number,
  artistName?: string,
  albumName?: string
): Promise<void> {
  const sql = getDb();
  const artName = artistName || "Unknown Artist";
  const albName = albumName || "Unknown Album";
  const artKey = makeArtistGroupKey(artName);
  const albKey = makeAlbumGroupKey(artName, albName);

  await sql`
    INSERT INTO tracks (
      id, name, artist_name, album_name,
      artist_group_key, album_group_key,
      artist_id, album_id,
      duration_ms,
      enrichment_status
    )
    VALUES (
      ${id}, ${name}, ${artName}, ${albName},
      ${artKey}, ${albKey},
      ${artistId}, ${albumId},
      ${durationMs},
      'enriched'
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      artist_name = CASE 
        WHEN EXCLUDED.artist_name = 'Unknown Artist' THEN tracks.artist_name 
        ELSE COALESCE(EXCLUDED.artist_name, tracks.artist_name) 
      END,
      album_name = CASE 
        WHEN EXCLUDED.album_name = 'Unknown Album' THEN tracks.album_name 
        ELSE COALESCE(EXCLUDED.album_name, tracks.album_name) 
      END,
      artist_group_key = CASE 
        WHEN EXCLUDED.artist_group_key = 'unknown artist' THEN tracks.artist_group_key 
        ELSE COALESCE(EXCLUDED.artist_group_key, tracks.artist_group_key) 
      END,
      album_group_key = CASE 
        WHEN EXCLUDED.album_group_key LIKE 'unknown artist::%' THEN tracks.album_group_key 
        ELSE COALESCE(EXCLUDED.album_group_key, tracks.album_group_key) 
      END,
      artist_id = COALESCE(EXCLUDED.artist_id, tracks.artist_id),
      album_id = COALESCE(EXCLUDED.album_id, tracks.album_id),
      duration_ms = GREATEST(tracks.duration_ms, EXCLUDED.duration_ms),
      enrichment_status = 'enriched';
  `;
  catalogStatusCache.invalidate();
}

/**
 * 4. Inserts a play event ledger row into the plays table.
 * Returns true if newly inserted, false if skipped due to conflict or sub-30s duplicate.
 */
export async function insertPlay(
  playedAt: string | Date,
  trackId: string,
  msPlayed: number
): Promise<boolean> {
  const sql = getDb();
  const timestamp = truncateToSeconds(playedAt);
  const timeMs = new Date(timestamp).getTime();
  const minTime = new Date(timeMs - 30_000).toISOString();
  const maxTime = new Date(timeMs + 30_000).toISOString();

  // Guard against rapid duplicate plays within 30 seconds for the same track
  const existing = (await sql`
    SELECT 1 FROM plays
    WHERE track_id = ${trackId}
      AND played_at >= ${minTime}::timestamptz
      AND played_at <= ${maxTime}::timestamptz
    LIMIT 1;
  `) as any;
  if (existing.length > 0) {
    return false;
  }

  const rows = ((await sql`
    INSERT INTO plays (played_at, track_id, ms_played)
    VALUES (${timestamp}::timestamptz, ${trackId}, ${msPlayed})
    ON CONFLICT (played_at, track_id) DO NOTHING
    RETURNING id;
  `) as any);
  return rows.length > 0;
}

/**
 * 5. Retrieves existing (played_at, track_id) keys in a batch to pre-filter duplicates.
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
  `) as any);

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
  ])) as any;

  return {
    existingArtistIds: new Set<string>(artists.map((r: any) => r.id)),
    existingAlbumIds: new Set<string>(albums.map((r: any) => r.id)),
    existingTrackIds: new Set<string>(tracks.map((r: any) => r.id)),
  };
}

/**
 * 7. Records the most recent sync execution timestamp in daily_api_usage.
 */
export async function recordLastSync(key: string = "spotify"): Promise<Date> {
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
  `) as any);
  lastSyncCache.invalidate();
  return new Date(rows[0].last_synced_at);
}

/**
 * 8. Retrieves the most recent sync execution timestamp from daily_api_usage.
 * Deduplicates concurrent calls via in-flight promise latch and caches for 15 seconds.
 */
export async function getLastSync(key: string = "spotify"): Promise<string | undefined> {
  return lastSyncCache.get(async () => {
    try {
      await ensureTablesExist();
      const sql = getDb();
      const rows = ((await sql`
        SELECT last_synced_at FROM daily_api_usage WHERE last_synced_at IS NOT NULL ORDER BY last_synced_at DESC LIMIT 1;
      `) as any);
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

  // 1. In-batch 30-second debounce per track
  const { debounced } = debouncePlays(plays, 30_000);
  if (debounced.length === 0) return { insertedCount: 0 };

  // 2. Cross-batch boundary check against recent DB plays within 30s
  const candidateTrackIds = Array.from(new Set(debounced.map((p) => p.trackId)));
  const timesMs = debounced.map((p) => new Date(p.playedAt).getTime());
  const minTime = new Date(Math.min(...timesMs) - 30_000).toISOString();
  const maxTime = new Date(Math.max(...timesMs) + 30_000).toISOString();

  const sql = getDb();
  const existingRecentPlays = (await sql`
    SELECT track_id, played_at
    FROM plays
    WHERE track_id = ANY(${candidateTrackIds}::text[])
      AND played_at >= ${minTime}::timestamptz
      AND played_at <= ${maxTime}::timestamptz;
  `) as Array<{ track_id: string; played_at: Date | string }>;

  const eligiblePlays: PlayInsertItem[] = [];
  for (const p of debounced) {
    const pTime = new Date(p.playedAt).getTime();
    const hasConflict = existingRecentPlays.some(
      (ep) =>
        ep.track_id === p.trackId &&
        Math.abs(new Date(ep.played_at).getTime() - pTime) < 30_000
    );
    if (!hasConflict) {
      eligiblePlays.push(p);
    }
  }

  if (eligiblePlays.length === 0) return { insertedCount: 0 };

  // 3. Deduplicate on truncated UTC seconds in JS to prevent Postgres ON CONFLICT batch error
  const seen = new Map<string, PlayInsertItem>();
  for (const p of eligiblePlays) {
    const truncated = truncateToSeconds(p.playedAt);
    const key = `${truncated}::${p.trackId}`;
    if (!seen.has(key)) {
      seen.set(key, { ...p, playedAt: truncated });
    }
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
      ms_played = EXCLUDED.ms_played
    RETURNING (xmax = 0) AS was_inserted;
  `) as any);

  const insertedCount = inserted.filter((r: any) => Boolean(r.was_inserted)).length;
  return { insertedCount };
}
