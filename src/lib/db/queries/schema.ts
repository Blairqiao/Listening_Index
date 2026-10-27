import { getDb, isDbConfigured } from "../index";

let isSchemaReady = false;
let schemaReadyPromise: Promise<void> | null = null;

/**
 * Ensures all required PostgreSQL tables, columns, constraints, and indexes exist.
 * Executes in strict foreign-key order within a single atomic DO block,
 * reducing cold-start database roundtrips from sequential calls to a single call.
 * Uses an in-flight promise latch to guarantee thread-safe execution across concurrent cold starts.
 */
export async function ensureTablesExist(): Promise<void> {
  if (isSchemaReady) return;
  if (!isDbConfigured()) return;
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      try {
        const sql = getDb();
        await sql`
        DO $$
        BEGIN
          -- 1. Base Entities (strict FK cascade order)
          CREATE TABLE IF NOT EXISTS artists (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS albums (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            image_url TEXT,
            artist_id TEXT REFERENCES artists(id) ON DELETE SET NULL
          );

          CREATE TABLE IF NOT EXISTS tracks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            artist_name TEXT,
            album_name TEXT,
            artist_group_key TEXT,
            album_group_key TEXT,
            artist_id TEXT REFERENCES artists(id) ON DELETE SET NULL,
            album_id TEXT REFERENCES albums(id) ON DELETE SET NULL,
            duration_ms INTEGER NOT NULL DEFAULT 0,
            enrichment_status TEXT NOT NULL DEFAULT 'pending'
          );

          -- Idempotently ensure base columns exist on tracks table
          ALTER TABLE tracks 
            ADD COLUMN IF NOT EXISTS artist_name TEXT,
            ADD COLUMN IF NOT EXISTS album_name TEXT,
            ADD COLUMN IF NOT EXISTS artist_group_key TEXT,
            ADD COLUMN IF NOT EXISTS album_group_key TEXT,
            ADD COLUMN IF NOT EXISTS duration_ms INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS enrichment_status TEXT NOT NULL DEFAULT 'pending';

          -- 2. Plays Ledger
          CREATE TABLE IF NOT EXISTS plays (
            id BIGSERIAL PRIMARY KEY,
            played_at TIMESTAMPTZ NOT NULL,
            track_id TEXT NOT NULL REFERENCES tracks(id),
            ms_played INTEGER NOT NULL,
            CONSTRAINT plays_played_at_track_id_key UNIQUE (played_at, track_id)
          );

          -- 3. Indexes
          CREATE INDEX IF NOT EXISTS idx_plays_played_at ON plays(played_at DESC);
          CREATE INDEX IF NOT EXISTS idx_plays_track_id ON plays(track_id);
          CREATE INDEX IF NOT EXISTS idx_plays_track_played_at ON plays(track_id, played_at DESC);
          CREATE INDEX IF NOT EXISTS idx_tracks_artist_group_key ON tracks(artist_group_key);
          CREATE INDEX IF NOT EXISTS idx_tracks_album_group_key ON tracks(album_group_key);
          CREATE INDEX IF NOT EXISTS idx_tracks_enrichment_status ON tracks(enrichment_status)
          WHERE enrichment_status = 'pending';

          -- 3b. Schema Migrations Ledger
          CREATE TABLE IF NOT EXISTS schema_migrations (
            name TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          -- Idempotent Migration: Purge historical duplicate plays spaced < 30 seconds apart for the same track
          IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE name = 'purge_sub_30s_duplicate_plays') THEN
            DELETE FROM plays
            WHERE id IN (
              SELECT id FROM (
                SELECT id, 
                       track_id, 
                       played_at,
                       LAG(played_at) OVER (PARTITION BY track_id ORDER BY played_at) as prev_played_at
                FROM plays
              ) sub
              WHERE prev_played_at IS NOT NULL
                AND EXTRACT(EPOCH FROM (played_at - prev_played_at)) < 30
            );

            INSERT INTO schema_migrations (name) VALUES ('purge_sub_30s_duplicate_plays')
            ON CONFLICT (name) DO NOTHING;
          END IF;

          -- 4. Site Settings & Quota Usage
          CREATE TABLE IF NOT EXISTS site_settings (
            id TEXT PRIMARY KEY DEFAULT 'active',
            title TEXT NOT NULL,
            owner_name TEXT NOT NULL,
            accent_color TEXT NOT NULL,
            site_url TEXT NOT NULL,
            github_url TEXT NOT NULL,
            timezone TEXT NOT NULL,
            spotify_client_id TEXT NOT NULL DEFAULT '',
            owner_playback_token TEXT,
            owner_token_revision BIGINT NOT NULL DEFAULT 0,
            owner_oauth_nonce TEXT,
            live_player_layout TEXT NOT NULL DEFAULT 'split',
            owner_token_updated_at TIMESTAMPTZ DEFAULT NOW(),
            owner_spotify_name TEXT,
            owner_spotify_url TEXT,
            cron_key TEXT,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          -- Added after the table shipped, so existing databases need it too.
          ALTER TABLE site_settings
            ADD COLUMN IF NOT EXISTS spotify_client_id TEXT NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS owner_playback_token TEXT,
            ADD COLUMN IF NOT EXISTS owner_token_revision BIGINT NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS owner_oauth_nonce TEXT,
            ADD COLUMN IF NOT EXISTS live_player_layout TEXT NOT NULL DEFAULT 'split',
            ADD COLUMN IF NOT EXISTS owner_token_updated_at TIMESTAMPTZ DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS owner_spotify_name TEXT,
            ADD COLUMN IF NOT EXISTS owner_spotify_url TEXT,
            ADD COLUMN IF NOT EXISTS cron_key TEXT;

          CREATE TABLE IF NOT EXISTS daily_api_usage (
            usage_date DATE PRIMARY KEY,
            cron_count INT NOT NULL DEFAULT 0,
            dynamic_count INT NOT NULL DEFAULT 0,
            total_count INT NOT NULL DEFAULT 0,
            cooldown_until TIMESTAMPTZ,
            cooldown_reason TEXT,
            last_synced_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          ALTER TABLE daily_api_usage
            ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS cooldown_reason TEXT,
            ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
        END $$;
      `;
        isSchemaReady = true;
      } catch (err) {
        schemaReadyPromise = null;
        throw err;
      }
    })();
  }
  return schemaReadyPromise;
}
