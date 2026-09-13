import { getDb, isDbConfigured } from "./index";
import {
  getCachedOverview,
  setCachedOverview,
  getCachedStreamLog,
  setCachedStreamLog,
  getCachedSession,
  setCachedSession,
} from "./server-cache";
import {
  TrackSummary,
  AlbumSummary,
  StreamLogItem,
  SittingItem,
  PreviousSitting,
  SittingSession,
  SessionHistogramData,
  SessionHistogramBar,
  RangeKey,
  ActivityDay,
} from "@/lib/mock-listening-data";

import { siteConfig } from "@/config";

export type { StreamLogItem, RangeKey, AlbumSummary, ActivityDay };

export interface OverviewData {
  logStartDate: string;
  metrics: [string, string, string, string]; // Minutes, Tracks, Artists, Daily Avg
  topTracks: TrackSummary[];
  topArtists: Array<{ rank: string; name: string; count: number; id?: string }>;
  topAlbums: AlbumSummary[];
  clockBuckets?: number[]; // 24 values representing hourly distribution (0-23)
  activityCadence?: ActivityDay[];
  lastSyncedAt?: string;
}

export interface StreamLogData {
  metrics: [string, string, string, string]; // Total Plays, Logged Time, Unique Artists, Current Streak
  entries: StreamLogItem[];
  nextCursor?: string | null;
  nextCursorId?: string | null;
  hasMore?: boolean;
  lastSyncedAt?: string;
}

export interface SessionData {
  isOpen: boolean;
  tagTime: string; // e.g. '22:15 CDT' or '42M'
  metrics: [string, string, string, string]; // Runtime, Tracks, Unique Artists, Start Time
  sittingTracks: SittingItem[];
  previousSittings: PreviousSitting[];
  lastSyncedAt?: string;
  sittings?: SittingSession[];
  histogram?: SessionHistogramData;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDurationHoursMinutes(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  }
  return `${m}m`;
}

export function getTimezone(): string {
  return siteConfig.timezone || "America/Chicago";
}

function formatTimeTz(date: Date, tz = getTimezone()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
    }).formatToParts(date);
    const hour = parts.find((p) => p.type === "hour")?.value || "00";
    const minute = parts.find((p) => p.type === "minute")?.value || "00";
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "";
    return tzName ? `${hour}:${minute} ${tzName}` : `${hour}:${minute}`;
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

function formatHHmmTz(date: Date, tz = getTimezone()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const hour = parts.find((p) => p.type === "hour")?.value || "00";
    const minute = parts.find((p) => p.type === "minute")?.value || "00";
    return `${hour}:${minute}`;
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

function formatDayGroupTz(date: Date, tz = getTimezone()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      day: "2-digit",
      month: "short",
    }).formatToParts(date);
    const day = parts.find((p) => p.type === "day")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value.toUpperCase() || "";
    return `${day} ${month}`;
  } catch {
    return date.toISOString().slice(5, 10).toUpperCase();
  }
}

function formatLogStartDate(date: Date, tz = getTimezone()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).formatToParts(date);
    const day = parts.find((p) => p.type === "day")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value.toUpperCase() || "";
    const year = parts.find((p) => p.type === "year")?.value || "";
    return `${day} ${month} ${year}`;
  } catch {
    return date.toISOString().slice(0, 10).toUpperCase();
  }
}

const formatTimeChicago = formatTimeTz;
const formatHHmmChicago = formatHHmmTz;
const formatDayGroupChicago = formatDayGroupTz;

function formatSittingAge(ageMs: number): string {
  const ageMins = Math.max(1, Math.round(ageMs / 60000));
  if (ageMins < 60) {
    return `${ageMins}M`;
  }
  const ageHours = Math.floor(ageMins / 60);
  if (ageHours < 24) {
    return `${ageHours}H`;
  }
  const ageDays = Math.floor(ageHours / 24);
  return `${ageDays}D`;
}

function getSwatchColor(str: string): string {
  const PALETTE = [
    "#2E4B3C",
    "#2A2A4A",
    "#3A3A22",
    "#52302A",
    "#1E3A4C",
    "#3D2B4A",
    "#4A3B2A",
    "#2B4A45",
    "#4A2B33",
    "#334A2B",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}

let isSchemaReady = false;

/**
 * Ensures all required PostgreSQL tables and indexes exist.
 * Executes in strict foreign-key order using IF NOT EXISTS.
 * Uses an in-memory latch so the check only runs once per cold-start instance (~10ms).
 */
export async function ensureTablesExist(): Promise<void> {
  if (isSchemaReady) return;

  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS artists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS albums (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image_url TEXT,
      artist_id TEXT REFERENCES artists(id)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      artist_id TEXT REFERENCES artists(id),
      album_id TEXT REFERENCES albums(id),
      duration_ms INTEGER NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS plays (
      id BIGSERIAL PRIMARY KEY,
      played_at TIMESTAMPTZ NOT NULL,
      track_id TEXT NOT NULL REFERENCES tracks(id),
      ms_played INTEGER NOT NULL,
      CONSTRAINT plays_played_at_track_id_key UNIQUE (played_at, track_id)
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_plays_played_at ON plays(played_at DESC);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_plays_track_id ON plays(track_id);
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      synced_at TIMESTAMPTZ NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS site_settings (
      id TEXT PRIMARY KEY DEFAULT 'active',
      title TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      accent_color TEXT NOT NULL,
      site_url TEXT NOT NULL,
      github_url TEXT NOT NULL,
      timezone TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  isSchemaReady = true;
}

// ---------------------------------------------------------------------------
// Ingestion Mutation Queries (Strict FK Cascade Order)
// ---------------------------------------------------------------------------

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
  artistId: string,
  albumId: string,
  durationMs: number
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO tracks (id, name, artist_id, album_id, duration_ms)
    VALUES (${id}, ${name}, ${artistId}, ${albumId}, ${durationMs})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      artist_id = EXCLUDED.artist_id,
      album_id = EXCLUDED.album_id,
      duration_ms = EXCLUDED.duration_ms;
  `;
}

/**
 * 4. Inserts a play event ledger row into the plays table.
 * Returns true if newly inserted, false if skipped due to conflict.
 */
export async function insertPlay(
  playedAt: string | Date,
  trackId: string,
  msPlayed: number
): Promise<boolean> {
  const sql = getDb();
  const timestamp = typeof playedAt === "string" ? playedAt : playedAt.toISOString();
  const rows = ((await sql`
    INSERT INTO plays (played_at, track_id, ms_played)
    VALUES (${timestamp}, ${trackId}, ${msPlayed})
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

  const timestamps = items.map((i) => new Date(i.playedAt).getTime());
  const minDate = new Date(Math.min(...timestamps)).toISOString();
  const maxDate = new Date(Math.max(...timestamps)).toISOString();

  const existingRows = ((await sql`
    SELECT played_at, track_id
    FROM plays
    WHERE played_at >= ${minDate}::timestamptz 
      AND played_at <= ${maxDate}::timestamptz;
  `) as any);

  const existingKeys = new Set<string>();
  for (const row of existingRows) {
    const timeIso = new Date(row.played_at).toISOString();
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
  const [artists, albums, tracks] = await Promise.all([
    params.artistIds.length > 0
      ? ((await sql`
          SELECT id FROM artists WHERE id = ANY(${params.artistIds}::text[]);
        `) as any)
      : [],
    params.albumIds.length > 0
      ? ((await sql`
          SELECT id FROM albums WHERE id = ANY(${params.albumIds}::text[]);
        `) as any)
      : [],
    params.trackIds.length > 0
      ? ((await sql`
          SELECT id FROM tracks WHERE id = ANY(${params.trackIds}::text[]);
        `) as any)
      : [],
  ]);

  return {
    existingArtistIds: new Set<string>(artists.map((r: any) => r.id)),
    existingAlbumIds: new Set<string>(albums.map((r: any) => r.id)),
    existingTrackIds: new Set<string>(tracks.map((r: any) => r.id)),
  };
}

/**
 * 7. Records the most recent sync execution timestamp in sync_state.
 */
export async function recordLastSync(key: string = "spotify"): Promise<Date> {
  await ensureTablesExist();
  const sql = getDb();
  const rows = ((await sql`
    INSERT INTO sync_state (key, synced_at)
    VALUES (${key}, NOW())
    ON CONFLICT (key) DO UPDATE SET synced_at = EXCLUDED.synced_at
    RETURNING synced_at;
  `) as any);
  return new Date(rows[0].synced_at);
}

/**
 * 8. Retrieves the most recent sync execution timestamp from sync_state.
 */
export async function getLastSync(key: string = "spotify"): Promise<string | undefined> {
  try {
    await ensureTablesExist();
    const sql = getDb();
    const rows = ((await sql`
      SELECT synced_at FROM sync_state WHERE key = ${key} LIMIT 1;
    `) as any);
    if (rows && rows.length > 0 && rows[0].synced_at) {
      return new Date(rows[0].synced_at).toISOString();
    }
  } catch {
    // Graceful fallback if query fails
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Active Site Settings Configuration (Neon DB Layer)
// ---------------------------------------------------------------------------

export interface SiteConfigState {
  title: string;
  ownerName: string;
  accentColor: string;
  siteUrl: string;
  githubUrl: string;
  timezone: string;
}

/**
 * Retrieves the active site configuration.
 * Priority:
 * 1. Neon Database (site_settings table with id = 'active')
 * 2. Fallback to default siteConfig from src/config.ts
 */
export async function getActiveSiteConfig(): Promise<SiteConfigState> {
  const fallback: SiteConfigState = {
    title: siteConfig.title,
    ownerName: siteConfig.ownerName,
    accentColor: siteConfig.accentColor,
    siteUrl: siteConfig.siteUrl,
    githubUrl: siteConfig.githubUrl,
    timezone: siteConfig.timezone || "America/Chicago",
  };

  if (!isDbConfigured()) {
    return fallback;
  }

  try {
    await ensureTablesExist();
    const sql = getDb();
    const rows = ((await sql`
      SELECT title, owner_name, accent_color, site_url, github_url, timezone
      FROM site_settings
      WHERE id = 'active'
      LIMIT 1;
    `) as any);

    if (rows && rows.length > 0 && rows[0]) {
      const row = rows[0];
      return {
        title: row.title || fallback.title,
        ownerName: row.owner_name || fallback.ownerName,
        accentColor: row.accent_color || fallback.accentColor,
        siteUrl: row.site_url || fallback.siteUrl,
        githubUrl: row.github_url || fallback.githubUrl,
        timezone: row.timezone || fallback.timezone,
      };
    }

    // Auto-seed table on first cold start with default config
    await sql`
      INSERT INTO site_settings (id, title, owner_name, accent_color, site_url, github_url, timezone, updated_at)
      VALUES (
        'active',
        ${fallback.title},
        ${fallback.ownerName},
        ${fallback.accentColor},
        ${fallback.siteUrl},
        ${fallback.githubUrl},
        ${fallback.timezone},
        NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    `;

    return fallback;
  } catch (error) {
    console.warn("[SITE CONFIG] Could not load active config from Neon DB, falling back to src/config.ts:", error);
    return fallback;
  }
}

/**
 * Persists customized settings to Neon database (active configuration).
 */
export async function saveActiveSiteConfig(config: SiteConfigState): Promise<boolean> {
  if (!isDbConfigured()) {
    return false;
  }

  try {
    await ensureTablesExist();
    const sql = getDb();
    await sql`
      INSERT INTO site_settings (id, title, owner_name, accent_color, site_url, github_url, timezone, updated_at)
      VALUES (
        'active',
        ${config.title},
        ${config.ownerName},
        ${config.accentColor},
        ${config.siteUrl},
        ${config.githubUrl},
        ${config.timezone},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        owner_name = EXCLUDED.owner_name,
        accent_color = EXCLUDED.accent_color,
        site_url = EXCLUDED.site_url,
        github_url = EXCLUDED.github_url,
        timezone = EXCLUDED.timezone,
        updated_at = NOW();
    `;
    return true;
  } catch (error) {
    console.error("[SITE CONFIG] Failed to save active config to Neon DB:", error);
    throw error;
  }
}

/**
 * Resets the active configuration in Neon database back to default src/config.ts
 */
export async function resetActiveSiteConfig(): Promise<SiteConfigState> {
  const defaults: SiteConfigState = {
    title: siteConfig.title,
    ownerName: siteConfig.ownerName,
    accentColor: siteConfig.accentColor,
    siteUrl: siteConfig.siteUrl,
    githubUrl: siteConfig.githubUrl,
    timezone: siteConfig.timezone || "America/Chicago",
  };

  if (isDbConfigured()) {
    try {
      await ensureTablesExist();
      const sql = getDb();
      await sql`
        INSERT INTO site_settings (id, title, owner_name, accent_color, site_url, github_url, timezone, updated_at)
        VALUES (
          'active',
          ${defaults.title},
          ${defaults.ownerName},
          ${defaults.accentColor},
          ${defaults.siteUrl},
          ${defaults.githubUrl},
          ${defaults.timezone},
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          owner_name = EXCLUDED.owner_name,
          accent_color = EXCLUDED.accent_color,
          site_url = EXCLUDED.site_url,
          github_url = EXCLUDED.github_url,
          timezone = EXCLUDED.timezone,
          updated_at = NOW();
      `;
    } catch (error) {
      console.warn("[SITE CONFIG] Failed to reset active config in Neon DB:", error);
    }
  }

  return defaults;
}

// ---------------------------------------------------------------------------
// Analytical Dashboard Queries
// ---------------------------------------------------------------------------

/**
 * Mode 1: Computes Overview statistics and rankings for a given range.
 */
export async function getOverviewData(range: RangeKey, tzOverride?: string): Promise<OverviewData> {
  const sql = getDb();
  const tz = tzOverride || getTimezone();

  // 1. Log start date
  const [minDateRow] = ((await sql`
    SELECT MIN(played_at) AS log_start_date FROM plays;
  `) as any);
  const logStartDate = minDateRow?.log_start_date
    ? formatLogStartDate(new Date(minDateRow.log_start_date), tz)
    : "--";

  // 2. Metrics Ribbon
  let metricRow: {
    minutes: string;
    tracks: string;
    artists: string;
    total_ms: string;
    window_min_date: string | null;
  } | undefined;
  let elapsedDays = 1;

  if (range === "1d") {
    elapsedDays = 1;
    [metricRow] = ((await sql`
      SELECT 
        COALESCE(SUM(p.ms_played) / 60000, 0)::bigint AS minutes,
        COUNT(DISTINCT p.track_id)::bigint AS tracks,
        COUNT(DISTINCT t.artist_id)::bigint AS artists,
        COALESCE(SUM(p.ms_played), 0)::bigint AS total_ms,
        MIN(p.played_at) AS window_min_date
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      WHERE p.played_at >= NOW() - INTERVAL '24 hours';
    `) as any);
  } else if (range === "1w") {
    elapsedDays = 7;
    [metricRow] = ((await sql`
      SELECT 
        COALESCE(SUM(p.ms_played) / 60000, 0)::bigint AS minutes,
        COUNT(DISTINCT p.track_id)::bigint AS tracks,
        COUNT(DISTINCT t.artist_id)::bigint AS artists,
        COALESCE(SUM(p.ms_played), 0)::bigint AS total_ms,
        MIN(p.played_at) AS window_min_date
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      WHERE p.played_at >= NOW() - INTERVAL '7 days';
    `) as any);
  } else if (range === "1m") {
    elapsedDays = 30;
    [metricRow] = ((await sql`
      SELECT 
        COALESCE(SUM(p.ms_played) / 60000, 0)::bigint AS minutes,
        COUNT(DISTINCT p.track_id)::bigint AS tracks,
        COUNT(DISTINCT t.artist_id)::bigint AS artists,
        COALESCE(SUM(p.ms_played), 0)::bigint AS total_ms,
        MIN(p.played_at) AS window_min_date
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      WHERE p.played_at >= NOW() - INTERVAL '30 days';
    `) as any);
  } else if (range === "6m") {
    elapsedDays = 180;
    [metricRow] = ((await sql`
      SELECT 
        COALESCE(SUM(p.ms_played) / 60000, 0)::bigint AS minutes,
        COUNT(DISTINCT p.track_id)::bigint AS tracks,
        COUNT(DISTINCT t.artist_id)::bigint AS artists,
        COALESCE(SUM(p.ms_played), 0)::bigint AS total_ms,
        MIN(p.played_at) AS window_min_date
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      WHERE p.played_at >= NOW() - INTERVAL '180 days';
    `) as any);
  } else if (range === "1y") {
    elapsedDays = 365;
    [metricRow] = ((await sql`
      SELECT 
        COALESCE(SUM(p.ms_played) / 60000, 0)::bigint AS minutes,
        COUNT(DISTINCT p.track_id)::bigint AS tracks,
        COUNT(DISTINCT t.artist_id)::bigint AS artists,
        COALESCE(SUM(p.ms_played), 0)::bigint AS total_ms,
        MIN(p.played_at) AS window_min_date
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      WHERE p.played_at >= NOW() - INTERVAL '365 days';
    `) as any);
  } else {
    [metricRow] = ((await sql`
      SELECT 
        COALESCE(SUM(p.ms_played) / 60000, 0)::bigint AS minutes,
        COUNT(DISTINCT p.track_id)::bigint AS tracks,
        COUNT(DISTINCT t.artist_id)::bigint AS artists,
        COALESCE(SUM(p.ms_played), 0)::bigint AS total_ms,
        MIN(p.played_at) AS window_min_date
      FROM plays p
      JOIN tracks t ON p.track_id = t.id;
    `) as any);
    if (metricRow?.window_min_date) {
      const ms = Date.now() - new Date(metricRow.window_min_date).getTime();
      elapsedDays = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
    } else {
      elapsedDays = 1;
    }
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

  // 3. Top Tracks with Drift
  interface TopTrackRow {
    rank: number;
    drift: string;
    track_id: string;
    artist_id: string;
    album_id: string;
    title: string;
    artist: string;
    album: string;
    duration_ms: number;
    album_image_url: string | null;
    plays: number;
  }

  let rawTopTracks: TopTrackRow[] = [];

  if (range === "1d") {
    rawTopTracks = ((await sql`
      WITH current_window AS (
          SELECT p.track_id, COUNT(*) AS plays,
                 DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS rank
          FROM plays p
          WHERE p.played_at >= NOW() - INTERVAL '24 hours'
          GROUP BY p.track_id
      ),
      previous_window AS (
          SELECT p.track_id,
                 DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS prev_rank
          FROM plays p
          WHERE p.played_at >= NOW() - INTERVAL '48 hours'
            AND p.played_at < NOW() - INTERVAL '24 hours'
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
          ar.id AS artist_id,
          al.id AS album_id,
          t.name AS title,
          ar.name AS artist,
          al.name AS album,
          t.duration_ms,
          al.image_url AS album_image_url,
          c.plays::int
      FROM current_window c
      JOIN tracks t ON c.track_id = t.id
      JOIN artists ar ON t.artist_id = ar.id
      JOIN albums al ON t.album_id = al.id
      LEFT JOIN previous_window pw ON c.track_id = pw.track_id
      ORDER BY c.rank ASC, c.plays DESC, t.name ASC
      LIMIT 10;
    `) as any);
  } else if (range === "1w") {
    rawTopTracks = ((await sql`
      WITH current_window AS (
          SELECT p.track_id, COUNT(*) AS plays,
                 DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS rank
          FROM plays p
          WHERE p.played_at >= NOW() - INTERVAL '7 days'
          GROUP BY p.track_id
      ),
      previous_window AS (
          SELECT p.track_id,
                 DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS prev_rank
          FROM plays p
          WHERE p.played_at >= NOW() - INTERVAL '14 days'
            AND p.played_at < NOW() - INTERVAL '7 days'
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
          ar.id AS artist_id,
          al.id AS album_id,
          t.name AS title,
          ar.name AS artist,
          al.name AS album,
          t.duration_ms,
          al.image_url AS album_image_url,
          c.plays::int
      FROM current_window c
      JOIN tracks t ON c.track_id = t.id
      JOIN artists ar ON t.artist_id = ar.id
      JOIN albums al ON t.album_id = al.id
      LEFT JOIN previous_window pw ON c.track_id = pw.track_id
      ORDER BY c.rank ASC, c.plays DESC, t.name ASC
      LIMIT 10;
    `) as any);
  } else if (range === "1m") {
    rawTopTracks = ((await sql`
      WITH current_window AS (
          SELECT p.track_id, COUNT(*) AS plays,
                 DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS rank
          FROM plays p
          WHERE p.played_at >= NOW() - INTERVAL '30 days'
          GROUP BY p.track_id
      ),
      previous_window AS (
          SELECT p.track_id,
                 DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS prev_rank
          FROM plays p
          WHERE p.played_at >= NOW() - INTERVAL '60 days'
            AND p.played_at < NOW() - INTERVAL '30 days'
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
          ar.id AS artist_id,
          al.id AS album_id,
          t.name AS title,
          ar.name AS artist,
          al.name AS album,
          t.duration_ms,
          al.image_url AS album_image_url,
          c.plays::int
      FROM current_window c
      JOIN tracks t ON c.track_id = t.id
      JOIN artists ar ON t.artist_id = ar.id
      JOIN albums al ON t.album_id = al.id
      LEFT JOIN previous_window pw ON c.track_id = pw.track_id
      ORDER BY c.rank ASC, c.plays DESC, t.name ASC
      LIMIT 10;
    `) as any);
  } else if (range === "6m") {
    rawTopTracks = ((await sql`
      WITH current_window AS (
          SELECT p.track_id, COUNT(*) AS plays,
                 DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS rank
          FROM plays p
          WHERE p.played_at >= NOW() - INTERVAL '180 days'
          GROUP BY p.track_id
      ),
      previous_window AS (
          SELECT p.track_id,
                 DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS prev_rank
          FROM plays p
          WHERE p.played_at >= NOW() - INTERVAL '360 days'
            AND p.played_at < NOW() - INTERVAL '180 days'
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
          ar.id AS artist_id,
          al.id AS album_id,
          t.name AS title,
          ar.name AS artist,
          al.name AS album,
          t.duration_ms,
          al.image_url AS album_image_url,
          c.plays::int
      FROM current_window c
      JOIN tracks t ON c.track_id = t.id
      JOIN artists ar ON t.artist_id = ar.id
      JOIN albums al ON t.album_id = al.id
      LEFT JOIN previous_window pw ON c.track_id = pw.track_id
      ORDER BY c.rank ASC, c.plays DESC, t.name ASC
      LIMIT 10;
    `) as any);
  } else if (range === "1y") {
    rawTopTracks = ((await sql`
      WITH current_window AS (
          SELECT p.track_id, COUNT(*) AS plays,
                 DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS rank
          FROM plays p
          WHERE p.played_at >= NOW() - INTERVAL '365 days'
          GROUP BY p.track_id
      ),
      previous_window AS (
          SELECT p.track_id,
                 DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS prev_rank
          FROM plays p
          WHERE p.played_at >= NOW() - INTERVAL '730 days'
            AND p.played_at < NOW() - INTERVAL '365 days'
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
          ar.id AS artist_id,
          al.id AS album_id,
          t.name AS title,
          ar.name AS artist,
          al.name AS album,
          t.duration_ms,
          al.image_url AS album_image_url,
          c.plays::int
      FROM current_window c
      JOIN tracks t ON c.track_id = t.id
      JOIN artists ar ON t.artist_id = ar.id
      JOIN albums al ON t.album_id = al.id
      LEFT JOIN previous_window pw ON c.track_id = pw.track_id
      ORDER BY c.rank ASC, c.plays DESC, t.name ASC
      LIMIT 10;
    `) as any);
  } else {
    rawTopTracks = ((await sql`
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
          ar.id AS artist_id,
          al.id AS album_id,
          t.name AS title,
          ar.name AS artist,
          al.name AS album,
          t.duration_ms,
          al.image_url AS album_image_url,
          c.plays::int
      FROM current_window c
      JOIN tracks t ON c.track_id = t.id
      JOIN artists ar ON t.artist_id = ar.id
      JOIN albums al ON t.album_id = al.id
      ORDER BY c.rank ASC, c.plays DESC, t.name ASC
      LIMIT 10;
    `) as any);
  }

  const topTracks: TrackSummary[] = rawTopTracks.map((row) => ({
    id: row.track_id,
    rank: String(row.rank).padStart(2, "0"),
    drift: (row.drift as TrackSummary["drift"]) || "·",
    name: row.title,
    artist: row.artist,
    artistId: row.artist_id,
    album: row.album,
    albumId: row.album_id,
    duration: formatDurationMs(row.duration_ms),
    plays: Number(row.plays),
    swatchColor: getSwatchColor(row.track_id + row.title),
    albumImageUrl: row.album_image_url || null,
  }));

  // 4. Top Artists (Top 5)
  interface TopArtistRow {
    id: string;
    name: string;
    count: number;
  }
  let rawTopArtists: TopArtistRow[] = [];

  if (range === "1d") {
    rawTopArtists = ((await sql`
      SELECT ar.id, ar.name, COUNT(p.id)::int AS count
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      JOIN artists ar ON t.artist_id = ar.id
      WHERE p.played_at >= NOW() - INTERVAL '24 hours'
      GROUP BY ar.id, ar.name
      ORDER BY count DESC, ar.name ASC
      LIMIT 5;
    `) as any);
  } else if (range === "1w") {
    rawTopArtists = ((await sql`
      SELECT ar.id, ar.name, COUNT(p.id)::int AS count
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      JOIN artists ar ON t.artist_id = ar.id
      WHERE p.played_at >= NOW() - INTERVAL '7 days'
      GROUP BY ar.id, ar.name
      ORDER BY count DESC, ar.name ASC
      LIMIT 5;
    `) as any);
  } else if (range === "1m") {
    rawTopArtists = ((await sql`
      SELECT ar.id, ar.name, COUNT(p.id)::int AS count
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      JOIN artists ar ON t.artist_id = ar.id
      WHERE p.played_at >= NOW() - INTERVAL '30 days'
      GROUP BY ar.id, ar.name
      ORDER BY count DESC, ar.name ASC
      LIMIT 5;
    `) as any);
  } else if (range === "6m") {
    rawTopArtists = ((await sql`
      SELECT ar.id, ar.name, COUNT(p.id)::int AS count
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      JOIN artists ar ON t.artist_id = ar.id
      WHERE p.played_at >= NOW() - INTERVAL '180 days'
      GROUP BY ar.id, ar.name
      ORDER BY count DESC, ar.name ASC
      LIMIT 5;
    `) as any);
  } else if (range === "1y") {
    rawTopArtists = ((await sql`
      SELECT ar.id, ar.name, COUNT(p.id)::int AS count
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      JOIN artists ar ON t.artist_id = ar.id
      WHERE p.played_at >= NOW() - INTERVAL '365 days'
      GROUP BY ar.id, ar.name
      ORDER BY count DESC, ar.name ASC
      LIMIT 5;
    `) as any);
  } else {
    rawTopArtists = ((await sql`
      SELECT ar.id, ar.name, COUNT(p.id)::int AS count
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      JOIN artists ar ON t.artist_id = ar.id
      GROUP BY ar.id, ar.name
      ORDER BY count DESC, ar.name ASC
      LIMIT 5;
    `) as any);
  }

  const topArtists = rawTopArtists.map((row, idx) => ({
    id: row.id,
    rank: String(idx + 1).padStart(2, "0"),
    name: row.name,
    count: Number(row.count),
  }));

  // 5. Top Albums (Top 5)
  interface TopAlbumRow {
    id: string;
    name: string;
    artist: string;
    artist_id: string;
    count: number;
  }
  let rawTopAlbums: TopAlbumRow[] = [];

  if (range === "1d") {
    rawTopAlbums = ((await sql`
      SELECT 
          al.id,
          al.name AS name,
          ar.name AS artist,
          ar.id AS artist_id,
          COUNT(p.id)::int AS count
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      JOIN albums al ON t.album_id = al.id
      JOIN artists ar ON al.artist_id = ar.id
      WHERE p.played_at >= NOW() - INTERVAL '24 hours'
      GROUP BY al.id, al.name, ar.id, ar.name
      ORDER BY count DESC, al.name ASC
      LIMIT 5;
    `) as any);
  } else if (range === "1w") {
    rawTopAlbums = ((await sql`
      SELECT 
          al.id,
          al.name AS name,
          ar.name AS artist,
          ar.id AS artist_id,
          COUNT(p.id)::int AS count
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      JOIN albums al ON t.album_id = al.id
      JOIN artists ar ON al.artist_id = ar.id
      WHERE p.played_at >= NOW() - INTERVAL '7 days'
      GROUP BY al.id, al.name, ar.id, ar.name
      ORDER BY count DESC, al.name ASC
      LIMIT 5;
    `) as any);
  } else if (range === "1m") {
    rawTopAlbums = ((await sql`
      SELECT 
          al.id,
          al.name AS name,
          ar.name AS artist,
          ar.id AS artist_id,
          COUNT(p.id)::int AS count
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      JOIN albums al ON t.album_id = al.id
      JOIN artists ar ON al.artist_id = ar.id
      WHERE p.played_at >= NOW() - INTERVAL '30 days'
      GROUP BY al.id, al.name, ar.id, ar.name
      ORDER BY count DESC, al.name ASC
      LIMIT 5;
    `) as any);
  } else if (range === "6m") {
    rawTopAlbums = ((await sql`
      SELECT 
          al.id,
          al.name AS name,
          ar.name AS artist,
          ar.id AS artist_id,
          COUNT(p.id)::int AS count
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      JOIN albums al ON t.album_id = al.id
      JOIN artists ar ON al.artist_id = ar.id
      WHERE p.played_at >= NOW() - INTERVAL '180 days'
      GROUP BY al.id, al.name, ar.id, ar.name
      ORDER BY count DESC, al.name ASC
      LIMIT 5;
    `) as any);
  } else if (range === "1y") {
    rawTopAlbums = ((await sql`
      SELECT 
          al.id,
          al.name AS name,
          ar.name AS artist,
          ar.id AS artist_id,
          COUNT(p.id)::int AS count
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      JOIN albums al ON t.album_id = al.id
      JOIN artists ar ON al.artist_id = ar.id
      WHERE p.played_at >= NOW() - INTERVAL '365 days'
      GROUP BY al.id, al.name, ar.id, ar.name
      ORDER BY count DESC, al.name ASC
      LIMIT 5;
    `) as any);
  } else {
    rawTopAlbums = ((await sql`
      SELECT 
          al.id,
          al.name AS name,
          ar.name AS artist,
          ar.id AS artist_id,
          COUNT(p.id)::int AS count
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      JOIN albums al ON t.album_id = al.id
      JOIN artists ar ON al.artist_id = ar.id
      GROUP BY al.id, al.name, ar.id, ar.name
      ORDER BY count DESC, al.name ASC
      LIMIT 5;
    `) as any);
  }

  const topAlbums: AlbumSummary[] = rawTopAlbums.map((row, idx) => ({
    id: row.id,
    rank: String(idx + 1).padStart(2, "0"),
    name: row.name,
    artist: row.artist,
    artistId: row.artist_id,
    count: Number(row.count),
  }));

  // 6. Activity: Cadence across time ranges (24 hourly buckets for 1d; days/weeks/months for others)
  let clockBuckets: number[] | undefined = undefined;
  let activityCadence: ActivityDay[] = [];

  if (range === "1d") {
    interface ClockRow {
      hour_key: string;
      count: number;
    }
    const clockRows: ClockRow[] = ((await sql`
      SELECT 
          TO_CHAR(p.played_at AT TIME ZONE ${tz}, 'YYYY-MM-DD HH24') AS hour_key,
          COUNT(*)::int AS count
      FROM plays p
      WHERE p.played_at >= NOW() - INTERVAL '24 hours'
      GROUP BY hour_key;
    `) as any);

    const hourMap = new Map<string, number>(clockRows.map((r) => [r.hour_key, Number(r.count)]));
    clockBuckets = new Array(24).fill(0);
    activityCadence = [];

    const now = new Date();
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
  } else {
    const now = new Date();
    activityCadence = [];

    if (range === "1w") {
      const rows = ((await sql`
        SELECT 
            (p.played_at AT TIME ZONE ${tz})::date::text AS day,
            FLOOR(EXTRACT(HOUR FROM p.played_at AT TIME ZONE ${tz}) / 6)::int AS block,
            COUNT(*)::int AS count
        FROM plays p
        WHERE p.played_at >= NOW() - INTERVAL '8 days'
        GROUP BY day, block;
      `) as any);
      const blockMap = new Map<string, number>(
        rows.map((r: any) => [`${r.day}_${r.block}`, Number(r.count)])
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
      const rows = ((await sql`
        SELECT 
            (p.played_at AT TIME ZONE ${tz})::date::text AS day,
            COUNT(*)::int AS count
        FROM plays p
        WHERE p.played_at >= NOW() - INTERVAL '30 days'
        GROUP BY day;
      `) as any);
      const countMap = new Map<string, number>(rows.map((r: any) => [String(r.day), Number(r.count)]));

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
      const rows = ((await sql`
        SELECT 
            (p.played_at AT TIME ZONE ${tz})::date::text AS day,
            COUNT(*)::int AS count
        FROM plays p
        WHERE p.played_at >= NOW() - INTERVAL '182 days'
        GROUP BY day;
      `) as any);
      const countMap = new Map<string, number>(rows.map((r: any) => [String(r.day), Number(r.count)]));

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
    } else if (range === "1y") {
      const rows = ((await sql`
        SELECT 
            TO_CHAR(p.played_at AT TIME ZONE ${tz}, 'YYYY-MM') AS ym,
            COUNT(*)::int AS count
        FROM plays p
        WHERE p.played_at >= NOW() - INTERVAL '365 days'
        GROUP BY ym;
      `) as any);
      const countMap = new Map<string, number>(rows.map((r: any) => [String(r.ym), Number(r.count)]));

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
    } else {
      // "all": Display monthly cadence across all lifetime plays (minimum 12 months)
      const rows = ((await sql`
        SELECT 
            TO_CHAR(p.played_at AT TIME ZONE ${tz}, 'YYYY-MM') AS ym,
            COUNT(*)::int AS count
        FROM plays p
        GROUP BY ym;
      `) as any);
      const countMap = new Map<string, number>(rows.map((r: any) => [String(r.ym), Number(r.count)]));

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
  }

  const lastSync = await getLastSync("spotify");

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

/**
 * Mode 2: Retrieves the chronological stream log buffer of recent plays and lifetime metrics.
 */
/**
 * Mode 2: Retrieves the chronological stream log buffer of recent plays and lifetime metrics.
 * Supports keyset cursor pagination and cross-chunk session/day boundary stitching.
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
  const clampedLimit = Math.min(Math.max(1, limit), 250);
  const tz = tzOverride || getTimezone();

  // 1. Lifetime metrics (only computed on initial top slice)
  let metrics: [string, string, string, string] = ["--", "--", "--", "--"];

  if (!cursorTimestamp) {
    const [totalsRow] = ((await sql`
      SELECT 
        COUNT(*)::bigint AS total_plays,
        COALESCE(ROUND(SUM(ms_played) / 3600000.0), 0)::bigint AS logged_hours,
        COUNT(DISTINCT t.artist_id)::bigint AS unique_artists
      FROM plays p
      JOIN tracks t ON p.track_id = t.id;
    `) as any);

    const totalPlaysStr = Number(totalsRow?.total_plays || 0).toLocaleString();
    const loggedHoursStr = `${Number(totalsRow?.logged_hours || 0)}h`;
    const uniqueArtistsStr = Number(totalsRow?.unique_artists || 0).toLocaleString();

    // Streak calculation
    const dateRows = ((await sql`
      SELECT DISTINCT (played_at AT TIME ZONE ${tz})::date AS play_date
      FROM plays
      ORDER BY play_date DESC;
    `) as any);

    let currentStreak = 0;
    if (dateRows.length > 0) {
      const playDateStrs = new Set(
        dateRows.map((r: any) => {
          const d = new Date(r.play_date);
          return d.toISOString().slice(0, 10);
        })
      );

      const nowTz = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      const checkDate = new Date(nowTz + "T12:00:00Z");
      let checkDateStr = nowTz;

      if (!playDateStrs.has(checkDateStr)) {
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
        checkDateStr = checkDate.toISOString().slice(0, 10);
      }

      while (playDateStrs.has(checkDateStr)) {
        currentStreak++;
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
        checkDateStr = checkDate.toISOString().slice(0, 10);
      }
    }

    const streakStr = `${currentStreak} ${currentStreak === 1 ? "DAY" : "DAYS"}`;
    metrics = [
      totalPlaysStr,
      loggedHoursStr,
      uniqueArtistsStr,
      streakStr,
    ];
  }

  // 2. Keyset Query: Fetches (clampedLimit + 1) rows to detect hasMore
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

  let streamRows: StreamRow[];
  if (cursorTimestamp) {
    if (cursorId) {
      streamRows = ((await sql`
        SELECT 
            p.id::text,
            p.played_at,
            p.track_id,
            ar.id AS artist_id,
            al.id AS album_id,
            al.image_url AS album_image_url,
            t.name AS title,
            COALESCE(ar.name, '') AS artist,
            COALESCE(al.name, '') AS album,
            t.duration_ms,
            CASE 
                WHEN p.played_at >= NOW() - INTERVAL '30 minutes' THEN '[PLAYING]'
                ELSE '[FULL]'
            END AS status
        FROM plays p
        JOIN tracks t ON p.track_id = t.id
        LEFT JOIN albums al ON t.album_id = al.id
        LEFT JOIN artists ar ON t.artist_id = ar.id
        WHERE (p.played_at < ${cursorTimestamp}::timestamptz)
           OR (p.played_at = ${cursorTimestamp}::timestamptz AND p.id < ${cursorId}::bigint)
        ORDER BY p.played_at DESC, p.id DESC
        LIMIT ${clampedLimit + 1};
      `) as any);
    } else {
      streamRows = ((await sql`
        SELECT 
            p.id::text,
            p.played_at,
            p.track_id,
            ar.id AS artist_id,
            al.id AS album_id,
            al.image_url AS album_image_url,
            t.name AS title,
            COALESCE(ar.name, '') AS artist,
            COALESCE(al.name, '') AS album,
            t.duration_ms,
            CASE 
                WHEN p.played_at >= NOW() - INTERVAL '30 minutes' THEN '[PLAYING]'
                ELSE '[FULL]'
            END AS status
        FROM plays p
        JOIN tracks t ON p.track_id = t.id
        LEFT JOIN albums al ON t.album_id = al.id
        LEFT JOIN artists ar ON t.artist_id = ar.id
        WHERE p.played_at < ${cursorTimestamp}::timestamptz
        ORDER BY p.played_at DESC, p.id DESC
        LIMIT ${clampedLimit + 1};
      `) as any);
    }
  } else {
    streamRows = ((await sql`
      SELECT 
          p.id::text,
          p.played_at,
          p.track_id,
          ar.id AS artist_id,
          al.id AS album_id,
          al.image_url AS album_image_url,
          t.name AS title,
          COALESCE(ar.name, '') AS artist,
          COALESCE(al.name, '') AS album,
          t.duration_ms,
          CASE 
              WHEN p.played_at >= NOW() - INTERVAL '30 minutes' THEN '[PLAYING]'
              ELSE '[FULL]'
          END AS status
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      LEFT JOIN albums al ON t.album_id = al.id
      LEFT JOIN artists ar ON t.artist_id = ar.id
      ORDER BY p.played_at DESC, p.id DESC
      LIMIT ${clampedLimit + 1};
    `) as any);
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
      playedAt: new Date(row.played_at).toISOString(),
      timeStr: formatHHmmTz(playDate, tz),
      title: row.title,
      artist: row.artist,
      album: row.album,
      duration: formatDurationMs(row.duration_ms),
      status: row.status,
      dayGroup: isNewDay ? dayGroup : undefined,
      sessionGap,
    });
  }

  const lastSync = await getLastSync("spotify");

  return {
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

/**
 * Mode 3: Retrieves current listening session data and historical sittings bounded by 30-minute gap.
 */
export async function getCurrentSession(tzOverride?: string): Promise<SessionData> {
  const sql = getDb();
  const tz = tzOverride || getTimezone();

  interface SessionPlayRow {
    id: string;
    track_id: string;
    artist_id: string;
    album_id: string;
    played_at: string;
    title: string;
    artist: string;
    album: string;
    album_image_url: string | null;
    duration_ms: number;
    is_first_play: boolean;
  }

  const rawPlays: SessionPlayRow[] = ((await sql`
    WITH recent_plays AS (
      SELECT 
          p.id::text,
          p.played_at,
          p.track_id,
          ar.id AS artist_id,
          al.id AS album_id,
          t.name AS title,
          ar.name AS artist,
          al.name AS album,
          al.image_url AS album_image_url,
          t.duration_ms
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      JOIN albums al ON t.album_id = al.id
      JOIN artists ar ON t.artist_id = ar.id
      ORDER BY p.played_at DESC
      LIMIT 600
    ),
    first_plays AS (
      SELECT track_id, MIN(played_at) as min_played_at
      FROM plays
      WHERE track_id IN (SELECT DISTINCT track_id FROM recent_plays)
      GROUP BY track_id
    )
    SELECT rp.*, (rp.played_at = fp.min_played_at) AS is_first_play
    FROM recent_plays rp
    JOIN first_plays fp ON rp.track_id = fp.track_id
    ORDER BY rp.played_at DESC;
  `) as any);

  if (rawPlays.length === 0) {
    return {
      isOpen: false,
      tagTime: "--",
      metrics: ["0m", "0", "0", "--"],
      sittingTracks: [],
      previousSittings: [],
      sittings: [],
      histogram: {
        avgRuntimeMinutes: 0,
        oldestDate: "--",
        newestDate: "--",
        bars: [],
      },
    };
  }

  // Segment plays into sittings bounded by 30-minute gap
  const sittingsPlays: SessionPlayRow[][] = [];
  let currentSitting: SessionPlayRow[] = [];

  for (let i = 0; i < rawPlays.length; i++) {
    const play = rawPlays[i];
    currentSitting.push(play);

    const nextPlay = rawPlays[i + 1];
    if (nextPlay) {
      const currentMs = new Date(play.played_at).getTime();
      const nextMs = new Date(nextPlay.played_at).getTime();
      const gapMs = currentMs - nextMs;

      if (gapMs > 30 * 60 * 1000) {
        sittingsPlays.push(currentSitting);
        currentSitting = [];
      }
    } else {
      sittingsPlays.push(currentSitting);
      currentSitting = [];
    }
  }

  // Construct complete SittingSession[] objects
  const sittings: SittingSession[] = sittingsPlays.slice(0, 20).map((sittingPlays, k) => {
    const sittingLatest = sittingPlays[0];
    const sittingOldest = sittingPlays[sittingPlays.length - 1];
    const dateStr = formatDayGroupTz(new Date(sittingLatest.played_at), tz);

    let sRuntimeMs =
      new Date(sittingLatest.played_at).getTime() -
      new Date(sittingOldest.played_at).getTime();
    if (sRuntimeMs === 0 && sittingLatest.duration_ms) {
      sRuntimeMs = sittingLatest.duration_ms;
    }
    const runtimeStr = formatDurationHoursMinutes(sRuntimeMs);
    const runtimeMinutes = Math.max(1, Math.round(sRuntimeMs / 60000));
    const trackCount = sittingPlays.length;
    const uniqueArtistsCount = new Set(sittingPlays.map((p) => p.artist)).size;
    const startTime = formatHHmmTz(new Date(sittingOldest.played_at), tz);

    const isThisOpen =
      k === 0 &&
      Date.now() - new Date(sittingLatest.played_at).getTime() <= 30 * 60 * 1000;

    let tagTime = "--";
    if (k === 0 && isThisOpen) {
      tagTime = formatTimeTz(new Date(sittingLatest.played_at), tz);
    } else {
      const ageMs = Math.max(0, Date.now() - new Date(sittingLatest.played_at).getTime());
      tagTime = formatSittingAge(ageMs);
    }

    const tracks: SittingItem[] = sittingPlays.map((p, pIdx) => ({
      id: p.track_id,
      artistId: p.artist_id,
      albumId: p.album_id,
      albumImageUrl: p.album_image_url || null,
      timestamp: formatHHmmTz(new Date(p.played_at), tz),
      title: p.title,
      artist: p.artist,
      album: p.album,
      swatchColor: getSwatchColor(p.track_id + p.title),
      isActive: isThisOpen && pIdx === 0,
      isFirstPlay: Boolean(p.is_first_play),
      duration: formatDurationMs(p.duration_ms || 0),
    }));

    // Analysis
    const firstPlaysCount = sittingPlays.filter((p) => p.is_first_play).length;
    const songCounts = new Map<string, number>();
    for (const p of sittingPlays) {
      songCounts.set(p.title, (songCounts.get(p.title) || 0) + 1);
    }
    let maxSongCount = 0;
    for (const count of songCounts.values()) {
      if (count > maxSongCount) maxSongCount = count;
    }
    let topSong: { title: string; count: number } | null = null;
    if (sittingPlays.length > 0 && maxSongCount > 0) {
      const latestPlay = sittingPlays.find((p) => songCounts.get(p.title) === maxSongCount);
      if (latestPlay) {
        topSong = { title: latestPlay.title, count: maxSongCount };
      }
    }

    const albumCounts = new Map<string, number>();
    for (const p of sittingPlays) {
      if (p.album) {
        albumCounts.set(p.album, (albumCounts.get(p.album) || 0) + 1);
      }
    }
    let topAlbumEntry: [string, number] | null = null;
    for (const [album, count] of albumCounts.entries()) {
      if (!topAlbumEntry || count > topAlbumEntry[1]) {
        topAlbumEntry = [album, count];
      }
    }
    const topAlbum = topAlbumEntry
      ? { title: topAlbumEntry[0], count: topAlbumEntry[1] }
      : { title: "None", count: 0 };

    const artistCounts = new Map<string, number>();
    for (const p of sittingPlays) {
      if (p.artist) {
        artistCounts.set(p.artist, (artistCounts.get(p.artist) || 0) + 1);
      }
    }
    let topArtistEntry: [string, number] | null = null;
    for (const [artist, count] of artistCounts.entries()) {
      if (!topArtistEntry || count > topArtistEntry[1]) {
        topArtistEntry = [artist, count];
      }
    }
    const topArtist = topArtistEntry
      ? { name: topArtistEntry[0], count: topArtistEntry[1] }
      : { name: "None", count: 0 };

    return {
      id: `s${k + 1}`,
      dateStr,
      runtimeMinutes,
      runtimeStr,
      trackCount,
      uniqueArtistsCount,
      startTime,
      tagTime,
      isOpen: isThisOpen,
      tracks,
      analysis: {
        firstPlaysCount,
        totalTracks: trackCount,
        topSong,
        topAlbum,
        topArtist,
      },
    };
  });

  // Previous sittings matching s1..sN
  const previousSittings: PreviousSitting[] = sittings.map((s) => ({
    id: s.id,
    dateStr: s.dateStr,
    durationStr: s.runtimeStr,
    tracksCountStr: `${s.trackCount} ${s.trackCount === 1 ? "track" : "tracks"}`,
    runtimeMinutes: s.runtimeMinutes,
    trackCount: s.trackCount,
  }));

  // Histogram: last 20 sittings ordered chronologically (oldest to newest)
  const recentForHist = sittings.slice(0, 20);
  const chrono = [...recentForHist].reverse();
  const bars: SessionHistogramBar[] = chrono.map((s) => ({
    id: s.id,
    runtimeMinutes: s.runtimeMinutes,
    dateStr: s.dateStr,
    title: `${s.runtimeMinutes}m`,
  }));

  const runtimes = chrono.map((c) => c.runtimeMinutes);
  const avg =
    runtimes.length === 0
      ? 0
      : runtimes.reduce((a, b) => a + b, 0) / runtimes.length;
  const avgRuntimeMinutes = Math.round(avg);

  const oldestDate = chrono[0]?.dateStr || "--";
  const newestDate = chrono[chrono.length - 1]?.dateStr || "--";

  const histogram: SessionHistogramData = {
    avgRuntimeMinutes,
    oldestDate,
    newestDate,
    bars,
  };

  const activeSitting = sittings[0];
  const isOpen = activeSitting ? activeSitting.isOpen : false;
  const tagTime = activeSitting ? activeSitting.tagTime || "--" : "--";
  const metrics: [string, string, string, string] = activeSitting
    ? [
        activeSitting.runtimeStr,
        String(activeSitting.trackCount),
        String(activeSitting.uniqueArtistsCount),
        activeSitting.startTime,
      ]
    : ["0m", "0", "0", "--"];
  const sittingTracks: SittingItem[] = activeSitting ? activeSitting.tracks : [];

  const lastSync = await getLastSync("spotify");

  return {
    isOpen,
    tagTime,
    metrics,
    sittingTracks,
    previousSittings,
    sittings,
    histogram,
    lastSyncedAt: lastSync ?? (rawPlays[0]
      ? new Date(rawPlays[0].played_at).toISOString()
      : undefined),
  };
}

export async function getInitialMusicData(): Promise<{
  overview: OverviewData | null;
  streamLog: StreamLogData | null;
  session: SessionData | null;
}> {
  try {
    let overview = getCachedOverview("1w");
    if (!overview) {
      overview = await getOverviewData("1w");
      setCachedOverview("1w", overview);
    }

    let streamLog = getCachedStreamLog(50);
    if (!streamLog) {
      streamLog = await getStreamLog(50);
      setCachedStreamLog(50, streamLog);
    }

    let session = getCachedSession();
    if (!session) {
      session = await getCurrentSession();
      setCachedSession(session);
    }

    return { overview, streamLog, session };
  } catch {
    // If DB is unreachable during build or cold start, fallback gracefully to null
    return { overview: null, streamLog: null, session: null };
  }
}

