import { getDb, isDbConfigured } from "../index";

let isSchemaReady = false;
let schemaReadyPromise: Promise<void> | null = null;

/**
 * Ensures all required PostgreSQL tables, columns, constraints, and indexes exist.
 * Executes in strict foreign-key order within a single atomic DO block,
 * reducing cold-start database roundtrips from 18 sequential calls to 1 single call.
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

          -- Migrate legacy schema only if unmigrated tracks or columns are detected
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tracks' AND column_name = 'api_duration_ms'
          ) OR EXISTS (
            SELECT 1 FROM tracks WHERE artist_group_key IS NULL LIMIT 1
          ) THEN
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'tracks' AND column_name = 'duration_ms' AND is_generated = 'ALWAYS'
            ) THEN
              ALTER TABLE tracks DROP COLUMN duration_ms;
              ALTER TABLE tracks ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 0;
              IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'tracks' AND column_name = 'api_duration_ms'
              ) THEN
                UPDATE tracks SET duration_ms = GREATEST(COALESCE(api_duration_ms, 0), COALESCE(max_observed_ms_played, 0));
              END IF;
            END IF;

            ALTER TABLE artists DROP COLUMN IF EXISTS created_at;
            ALTER TABLE albums DROP COLUMN IF EXISTS created_at;
            ALTER TABLE tracks 
              DROP COLUMN IF EXISTS api_duration_ms,
              DROP COLUMN IF EXISTS max_observed_ms_played,
              DROP COLUMN IF EXISTS leased_at,
              DROP COLUMN IF EXISTS lease_token,
              DROP COLUMN IF EXISTS lease_expires_at,
              DROP COLUMN IF EXISTS retry_count,
              DROP COLUMN IF EXISTS next_eligible_at,
              DROP COLUMN IF EXISTS last_error,
              DROP COLUMN IF EXISTS leased_until,
              DROP COLUMN IF EXISTS created_at;
            ALTER TABLE plays DROP COLUMN IF EXISTS source;

            UPDATE tracks 
            SET enrichment_status = 'pending' 
            WHERE enrichment_status = 'leasing';

            DROP INDEX IF EXISTS idx_tracks_leasing;
            DROP TABLE IF EXISTS oauth_tokens;

            ALTER TABLE tracks ALTER COLUMN artist_id DROP NOT NULL;
            ALTER TABLE tracks ALTER COLUMN album_id DROP NOT NULL;
            ALTER TABLE albums ALTER COLUMN artist_id DROP NOT NULL;

            UPDATE tracks t
            SET 
              artist_name = ar.name,
              album_name = al.name
            FROM artists ar, albums al
            WHERE t.artist_id = ar.id AND t.album_id = al.id
              AND (t.artist_name IS NULL OR t.artist_name = 'Unknown Artist' OR t.album_name IS NULL OR t.album_name = 'Unknown Album');

            UPDATE tracks SET 
              artist_name = COALESCE(artist_name, 'Unknown Artist'),
              album_name = COALESCE(album_name, 'Unknown Album')
            WHERE artist_name IS NULL OR album_name IS NULL;

            UPDATE tracks SET 
              artist_group_key = lower(trim(artist_name)),
              album_group_key = lower(trim(artist_name)) || '::' || lower(trim(album_name))
            WHERE artist_group_key IS NULL OR album_group_key IS NULL 
               OR (artist_group_key = 'unknown artist' AND artist_name != 'Unknown Artist');

            UPDATE tracks
            SET enrichment_status = 'enriched'
            WHERE enrichment_status = 'pending'
              AND artist_id IS NOT NULL 
              AND album_id IS NOT NULL
              AND artist_id NOT LIKE 'art_%'
              AND album_id NOT LIKE 'alb_%';

            UPDATE tracks SET artist_id = NULL WHERE artist_id LIKE 'art_%';
            UPDATE tracks SET album_id = NULL WHERE album_id LIKE 'alb_%';
            DELETE FROM albums WHERE id LIKE 'alb_%';
            DELETE FROM artists WHERE id LIKE 'art_%';

            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'albums_artist_id_fkey') THEN
              ALTER TABLE albums DROP CONSTRAINT albums_artist_id_fkey;
            END IF;
            ALTER TABLE albums ADD CONSTRAINT albums_artist_id_fkey 
              FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL;

            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tracks_artist_id_fkey') THEN
              ALTER TABLE tracks DROP CONSTRAINT tracks_artist_id_fkey;
            END IF;
            ALTER TABLE tracks ADD CONSTRAINT tracks_artist_id_fkey 
              FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL;

            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tracks_album_id_fkey') THEN
              ALTER TABLE tracks DROP CONSTRAINT tracks_album_id_fkey;
            END IF;
            ALTER TABLE tracks ADD CONSTRAINT tracks_album_id_fkey 
              FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL;
          END IF;

          -- Purge legacy delisted tracks
          IF EXISTS (SELECT 1 FROM tracks WHERE enrichment_status = 'delisted' LIMIT 1) THEN
            DELETE FROM plays WHERE track_id IN (SELECT id FROM tracks WHERE enrichment_status = 'delisted');
            DELETE FROM tracks WHERE enrichment_status = 'delisted';
          END IF;

          -- 2. Plays Ledger
          CREATE TABLE IF NOT EXISTS plays (
            id BIGSERIAL PRIMARY KEY,
            played_at TIMESTAMPTZ NOT NULL,
            track_id TEXT NOT NULL REFERENCES tracks(id),
            ms_played INTEGER NOT NULL,
            CONSTRAINT plays_played_at_track_id_key UNIQUE (played_at, track_id)
          );

          -- Ensure unique constraint on plays
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plays') THEN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plays_played_at_track_id_key') THEN
              IF EXISTS (SELECT 1 FROM plays WHERE played_at != date_trunc('second', played_at) LIMIT 1) THEN
                UPDATE plays p2
                SET ms_played = GREATEST(p1.ms_played, p2.ms_played)
                FROM plays p1
                WHERE p1.id < p2.id
                  AND date_trunc('second', p1.played_at) = date_trunc('second', p2.played_at)
                  AND p1.track_id = p2.track_id;

                DELETE FROM plays p1
                USING plays p2
                WHERE p1.id < p2.id
                  AND date_trunc('second', p1.played_at) = date_trunc('second', p2.played_at)
                  AND p1.track_id = p2.track_id;

                UPDATE plays
                SET played_at = date_trunc('second', played_at)
                WHERE played_at != date_trunc('second', played_at);
              END IF;

              DELETE FROM plays p1
              USING plays p2
              WHERE p1.id < p2.id
                AND p1.played_at = p2.played_at
                AND p1.track_id = p2.track_id;

              ALTER TABLE plays ADD CONSTRAINT plays_played_at_track_id_key UNIQUE (played_at, track_id);
            END IF;
          END IF;

          -- 3. Indexes
          CREATE INDEX IF NOT EXISTS idx_plays_played_at ON plays(played_at DESC);
          CREATE INDEX IF NOT EXISTS idx_plays_track_id ON plays(track_id);
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
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

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

          -- Migrate legacy cooldowns if table exists
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_cooldowns') THEN
            INSERT INTO daily_api_usage (usage_date, cron_count, dynamic_count, total_count, cooldown_until, cooldown_reason, updated_at)
            SELECT CURRENT_DATE, 0, 0, 0, cooldown_until, reason, NOW()
            FROM api_cooldowns
            WHERE cooldown_until > NOW()
            ORDER BY cooldown_until DESC
            LIMIT 1
            ON CONFLICT (usage_date) DO UPDATE SET
              cooldown_until = GREATEST(daily_api_usage.cooldown_until, EXCLUDED.cooldown_until),
              cooldown_reason = EXCLUDED.cooldown_reason;

            DROP TABLE api_cooldowns;
          END IF;

          -- Migrate legacy sync_state if table exists
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sync_state') THEN
            INSERT INTO daily_api_usage (usage_date, cron_count, dynamic_count, total_count, last_synced_at, updated_at)
            SELECT CURRENT_DATE, 0, 0, 0, synced_at, NOW()
            FROM sync_state
            WHERE synced_at IS NOT NULL
            ORDER BY synced_at DESC
            LIMIT 1
            ON CONFLICT (usage_date) DO UPDATE SET
              last_synced_at = EXCLUDED.last_synced_at,
              updated_at = NOW();

            DROP TABLE sync_state;
          END IF;
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
