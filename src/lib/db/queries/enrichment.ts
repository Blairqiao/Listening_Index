import { getDb } from "../index";
import { ensureTablesExist } from "./schema";
import { bulkUpsertArtists, bulkUpsertAlbums } from "./ingestion";
import { catalogStatusCache } from "./cache";
import type { EnrichedTrackItem } from "./types";

export async function getEnrichmentProgress(): Promise<{
  pending: number;
  enriched: number;
  delisted: number;
  total: number;
}> {
  await ensureTablesExist();
  const sql = getDb();
  const rows = ((await sql`
    SELECT 
      COUNT(*) FILTER (WHERE enrichment_status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE enrichment_status = 'enriched')::int AS enriched,
      0::int AS delisted,
      COUNT(*)::int AS total
    FROM tracks;
  `) as any);
  return {
    pending: rows[0]?.pending ?? 0,
    enriched: rows[0]?.enriched ?? 0,
    delisted: 0,
    total: rows[0]?.total ?? 0,
  };
}

export async function bulkApplyEnrichment(data: {
  enriched: EnrichedTrackItem[];
  delistedIds: string[];
}): Promise<void> {
  await ensureTablesExist();
  const sql = getDb();

  // 1. Purge delisted tracks and their associated plays so they never remain in the system
  if (data.delistedIds.length > 0) {
    await sql`
      DELETE FROM plays
      WHERE track_id = ANY(${data.delistedIds}::text[]);
    `;
    await sql`
      DELETE FROM tracks
      WHERE id = ANY(${data.delistedIds}::text[]);
    `;
  }

  if (data.enriched.length === 0) return;

  // 2. Collect unique artists and albums to upsert
  const artistMap = new Map<string, string>();
  const albumMap = new Map<string, { name: string; imageUrl: string | null; artistId: string }>();

  for (const item of data.enriched) {
    artistMap.set(item.artistId, item.artistName);
    albumMap.set(item.albumId, {
      name: item.albumName,
      imageUrl: item.albumImageUrl,
      artistId: item.artistId,
    });
  }

  const artists = Array.from(artistMap.entries()).map(([id, name]) => ({ id, name }));
  const albums = Array.from(albumMap.entries()).map(([id, val]) => ({
    id,
    name: val.name,
    imageUrl: val.imageUrl,
    artistId: val.artistId,
  }));

  // Upsert official artists and albums
  await bulkUpsertArtists(artists);
  await bulkUpsertAlbums(albums);

  // 3. Update enriched tracks
  const sorted = [...data.enriched].sort((a, b) => a.requestedId.localeCompare(b.requestedId));
  const ids = sorted.map((t) => t.requestedId);
  const names = sorted.map((t) => t.name);
  const artistIds = sorted.map((t) => t.artistId);
  const albumIds = sorted.map((t) => t.albumId);
  const durations = sorted.map((t) => Math.max(0, Math.round(t.durationMs)));

  await sql`
    UPDATE tracks AS t
    SET
      name = u.name,
      artist_id = u.artist_id,
      album_id = u.album_id,
      duration_ms = u.duration_ms,
      enrichment_status = 'enriched'
    FROM (
      SELECT * FROM UNNEST(
        ${ids}::text[],
        ${names}::text[],
        ${artistIds}::text[],
        ${albumIds}::text[],
        ${durations}::int[]
      ) AS v(id, name, artist_id, album_id, duration_ms)
    ) AS u
    WHERE t.id = u.id;
  `;
  catalogStatusCache.invalidate();
}

/**
 * Retrieves pending tracks for metadata enrichment.
 * Supports explicit trackIds (viewport micro-enrichment) or chronological background prioritization.
 */
export async function getPendingTracksForEnrichment(
  batchSize: number,
  options: {
    trackIds?: string[];
  } = {}
): Promise<Array<{ id: string; name: string; artistName: string; albumName: string; albumGroupKey: string }>> {
  await ensureTablesExist();
  const sql = getDb();

  const trackFilter =
    options.trackIds && options.trackIds.length > 0
      ? sql`t.id = ANY(${options.trackIds}::text[])`
      : sql`TRUE`;

  const rows = ((await sql`
    WITH latest_plays AS (
      SELECT track_id, MAX(played_at) AS max_played_at
      FROM plays
      GROUP BY track_id
    )
    SELECT t.id, t.name, t.artist_name, t.album_name, t.album_group_key
    FROM tracks t
    LEFT JOIN latest_plays lp ON t.id = lp.track_id
    WHERE t.enrichment_status = 'pending' AND ${trackFilter}
    ORDER BY lp.max_played_at DESC NULLS LAST, t.id ASC
    LIMIT ${batchSize};
  `) as any);

  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    artistName: r.artist_name,
    albumName: r.album_name,
    albumGroupKey: r.album_group_key,
  }));
}

/**
 * Records a global cooldown for an external API provider (e.g. Spotify 429).
 * Consolidated into daily_api_usage.
 */
export async function recordApiCooldown(
  provider: string,
  cooldownSeconds: number,
  reason: string
): Promise<void> {
  await ensureTablesExist();
  const sql = getDb();
  const todayUtc = new Date().toISOString().slice(0, 10);
  await sql`
    INSERT INTO daily_api_usage (usage_date, cron_count, dynamic_count, total_count, cooldown_until, cooldown_reason, updated_at)
    VALUES (${todayUtc}::date, 0, 0, 0, NOW() + (${cooldownSeconds} || ' seconds')::interval, ${reason}, NOW())
    ON CONFLICT (usage_date) DO UPDATE SET
      cooldown_until = GREATEST(daily_api_usage.cooldown_until, EXCLUDED.cooldown_until),
      cooldown_reason = EXCLUDED.cooldown_reason,
      updated_at = NOW();
  `;
}

/**
 * Checks if an active API cooldown exists.
 * Queries daily_api_usage for any active cooldown.
 */
export async function getActiveApiCooldown(provider: string = "spotify"): Promise<{
  active: boolean;
  cooldownUntil?: string;
  reason?: string;
}> {
  try {
    await ensureTablesExist();
    const sql = getDb();
    const rows = ((await sql`
      SELECT cooldown_until, cooldown_reason
      FROM daily_api_usage
      WHERE cooldown_until > NOW()
      ORDER BY cooldown_until DESC
      LIMIT 1;
    `) as any);
    if (rows && rows.length > 0) {
      return {
        active: true,
        cooldownUntil: new Date(rows[0].cooldown_until).toISOString(),
        reason: rows[0].cooldown_reason,
      };
    }
  } catch {
    // Return inactive if query fails
  }
  return { active: false };
}

export async function getPendingTracksInAlbum(
  albumGroupKey: string
): Promise<Array<{ id: string; name: string; artistName: string }>> {
  await ensureTablesExist();
  const sql = getDb();
  const rows = ((await sql`
    SELECT id, name, artist_name FROM tracks
    WHERE album_group_key = ${albumGroupKey}
      AND enrichment_status = 'pending';
  `) as any);
  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    artistName: r.artist_name,
  }));
}

export const DAILY_API_QUOTA_TOTAL = 900;
export const DAILY_API_QUOTA_CRON = 700;
export const DAILY_API_QUOTA_DYNAMIC = 200;

/**
 * Checks and atomically increments Spotify API usage in daily_api_usage.
 * Enforces 900 total ceiling, 700 cron limit, and 200 dynamic limit.
 * Resets daily at 00:00:00 UTC.
 */
export async function checkAndIncrementApiQuota(
  bucket: "cron" | "dynamic",
  requestedCount: number = 1
): Promise<{ allowed: boolean; remaining: number; totalToday: number; bucketToday: number }> {
  await ensureTablesExist();
  const sql = getDb();

  const todayUtc = new Date().toISOString().slice(0, 10);
  const bucketLimit = bucket === "cron" ? DAILY_API_QUOTA_CRON : DAILY_API_QUOTA_DYNAMIC;

  // Initialize row for today if not present, and fetch active cooldown if any
  const [existing] = ((await sql`
    INSERT INTO daily_api_usage (usage_date, cron_count, dynamic_count, total_count, updated_at)
    VALUES (${todayUtc}::date, 0, 0, 0, NOW())
    ON CONFLICT (usage_date) DO UPDATE SET updated_at = NOW()
    RETURNING cron_count, dynamic_count, total_count,
      (SELECT cooldown_until FROM daily_api_usage WHERE cooldown_until > NOW() ORDER BY cooldown_until DESC LIMIT 1) AS active_cooldown;
  `) as any);

  const currentCron = Number(existing?.cron_count || 0);
  const currentDynamic = Number(existing?.dynamic_count || 0);
  const currentTotal = Number(existing?.total_count || 0);
  const currentBucket = bucket === "cron" ? currentCron : currentDynamic;

  if (existing?.active_cooldown && new Date(existing.active_cooldown).getTime() > Date.now()) {
    return {
      allowed: false,
      remaining: 0,
      totalToday: currentTotal,
      bucketToday: currentBucket,
    };
  }

  if (requestedCount <= 0) {
    const remainingInBucket = Math.max(0, bucketLimit - currentBucket);
    const remainingInTotal = Math.max(0, DAILY_API_QUOTA_TOTAL - currentTotal);
    return {
      allowed: remainingInBucket > 0 && remainingInTotal > 0,
      remaining: Math.min(remainingInBucket, remainingInTotal),
      totalToday: currentTotal,
      bucketToday: currentBucket,
    };
  }

  if (currentTotal + requestedCount > DAILY_API_QUOTA_TOTAL || currentBucket + requestedCount > bucketLimit) {
    const remainingInBucket = Math.max(0, bucketLimit - currentBucket);
    const remainingInTotal = Math.max(0, DAILY_API_QUOTA_TOTAL - currentTotal);
    return {
      allowed: false,
      remaining: Math.min(remainingInBucket, remainingInTotal),
      totalToday: currentTotal,
      bucketToday: currentBucket,
    };
  }

  // Atomically increment
  const updatedRows = ((await sql`
    UPDATE daily_api_usage
    SET
      cron_count = CASE WHEN ${bucket} = 'cron' THEN cron_count + ${requestedCount} ELSE cron_count END,
      dynamic_count = CASE WHEN ${bucket} = 'dynamic' THEN dynamic_count + ${requestedCount} ELSE dynamic_count END,
      total_count = total_count + ${requestedCount},
      updated_at = NOW()
    WHERE usage_date = ${todayUtc}::date
    RETURNING cron_count, dynamic_count, total_count;
  `) as any);

  const updated = updatedRows[0];
  const newTotal = Number(updated.total_count);
  const newBucket = bucket === "cron" ? Number(updated.cron_count) : Number(updated.dynamic_count);
  const remainingInBucket = Math.max(0, bucketLimit - newBucket);
  const remainingInTotal = Math.max(0, DAILY_API_QUOTA_TOTAL - newTotal);

  return {
    allowed: true,
    remaining: Math.min(remainingInBucket, remainingInTotal),
    totalToday: newTotal,
    bucketToday: newBucket,
  };
}

export async function getDailyApiQuotaStatus(): Promise<{
  cronCount: number;
  dynamicCount: number;
  totalCount: number;
  remainingCron: number;
  remainingDynamic: number;
  remainingTotal: number;
}> {
  await ensureTablesExist();
  const sql = getDb();
  const todayUtc = new Date().toISOString().slice(0, 10);
  const rows = ((await sql`
    SELECT cron_count, dynamic_count, total_count
    FROM daily_api_usage
    WHERE usage_date = ${todayUtc}::date
    LIMIT 1;
  `) as any);

  const cron = Number(rows[0]?.cron_count || 0);
  const dynamic = Number(rows[0]?.dynamic_count || 0);
  const total = Number(rows[0]?.total_count || 0);

  return {
    cronCount: cron,
    dynamicCount: dynamic,
    totalCount: total,
    remainingCron: Math.max(0, DAILY_API_QUOTA_CRON - cron),
    remainingDynamic: Math.max(0, DAILY_API_QUOTA_DYNAMIC - dynamic),
    remainingTotal: Math.max(0, DAILY_API_QUOTA_TOTAL - total),
  };
}

/**
 * Checks if all tracks in the catalog are enriched.
 * Cached in memory for 60 seconds with an in-flight promise latch to deduplicate concurrent requests.
 */
export async function isCatalogFullyEnriched(): Promise<boolean> {
  return catalogStatusCache.get(async () => {
    try {
      await ensureTablesExist();
      const sql = getDb();
      const rows = ((await sql`
        SELECT 1 FROM tracks
        WHERE enrichment_status = 'pending'
        LIMIT 1;
      `) as any);
      return rows.length === 0;
    } catch {
      return false;
    }
  });
}

export async function cleanupOrphanedSyntheticEntities(): Promise<{
  deletedAlbums: number;
  deletedArtists: number;
}> {
  await ensureTablesExist();
  const sql = getDb();

  // FK constraint safety: Delete synthetic albums FIRST, then synthetic artists SECOND
  const deletedAlbumsResult = ((await sql`
    DELETE FROM albums
    WHERE id LIKE 'alb_%'
      AND id NOT IN (SELECT album_id FROM tracks WHERE album_id IS NOT NULL)
    RETURNING id;
  `) as any);

  const deletedArtistsResult = ((await sql`
    DELETE FROM artists
    WHERE id LIKE 'art_%'
      AND id NOT IN (SELECT artist_id FROM tracks WHERE artist_id IS NOT NULL)
      AND id NOT IN (SELECT artist_id FROM albums WHERE artist_id IS NOT NULL)
    RETURNING id;
  `) as any);

  return {
    deletedAlbums: deletedAlbumsResult.length,
    deletedArtists: deletedArtistsResult.length,
  };
}
