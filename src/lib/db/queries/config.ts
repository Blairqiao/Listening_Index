import crypto from "node:crypto";
import { getDb, isDbConfigured } from "../index";
import { DEFAULT_SITE_CONFIG } from "@/lib/config-utils";
import { ensureTablesExist } from "./schema";
import { siteConfigCache } from "./cache";
import type { SiteConfigState } from "./types";

/**
 * Ensures the singleton 'active' row exists in site_settings.
 */
async function ensureActiveSettingsRow(sql = getDb()): Promise<void> {
  await sql`
    INSERT INTO site_settings (id, title, owner_name, accent_color, site_url, github_url, live_player_layout, updated_at)
    VALUES (
      'active',
      ${DEFAULT_SITE_CONFIG.title},
      ${DEFAULT_SITE_CONFIG.ownerName},
      ${DEFAULT_SITE_CONFIG.accentColor},
      ${DEFAULT_SITE_CONFIG.siteUrl},
      ${DEFAULT_SITE_CONFIG.githubUrl},
      ${DEFAULT_SITE_CONFIG.livePlayerLayout},
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  `;
}

/**
 * Retrieves the active site configuration.
 * Priority:
 * 1. Neon Database (site_settings table with id = 'active')
 * 2. Fallback to DEFAULT_SITE_CONFIG
 * Deduplicates concurrent calls via in-flight promise latch and caches for 60 seconds.
 */
export async function getActiveSiteConfig(): Promise<SiteConfigState> {
  if (!isDbConfigured()) {
    return DEFAULT_SITE_CONFIG;
  }

  return siteConfigCache.get(async () => {
    try {
      await ensureTablesExist();
      const sql = getDb();
      const rows = ((await sql`
        SELECT title, owner_name, accent_color, site_url, github_url, live_player_layout
        FROM site_settings
        WHERE id = 'active'
        LIMIT 1;
      `));

      if (rows && rows.length > 0 && rows[0]) {
        const row = rows[0];
        return {
          title: row.title || DEFAULT_SITE_CONFIG.title,
          ownerName: row.owner_name || DEFAULT_SITE_CONFIG.ownerName,
          accentColor: row.accent_color || DEFAULT_SITE_CONFIG.accentColor,
          siteUrl: row.site_url || DEFAULT_SITE_CONFIG.siteUrl,
          githubUrl: row.github_url || DEFAULT_SITE_CONFIG.githubUrl,
          livePlayerLayout:
            row.live_player_layout === "stacked" || row.live_player_layout === "split"
              ? row.live_player_layout
              : DEFAULT_SITE_CONFIG.livePlayerLayout,
        };
      }

      await ensureActiveSettingsRow(sql);
      return DEFAULT_SITE_CONFIG;
    } catch (error) {
      console.warn("[SITE CONFIG] Could not load active config from Neon DB, falling back to src/config.ts:", error);
      return DEFAULT_SITE_CONFIG;
    }
  });
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
    await ensureActiveSettingsRow(sql);
    await sql`
      UPDATE site_settings
      SET
        title = ${config.title},
        owner_name = ${config.ownerName},
        accent_color = ${config.accentColor},
        site_url = ${config.siteUrl},
        github_url = ${config.githubUrl},
        live_player_layout = ${config.livePlayerLayout || "split"},
        updated_at = NOW()
      WHERE id = 'active';
    `;
    siteConfigCache.invalidate();
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
  if (isDbConfigured()) {
    await ensureTablesExist();
    const sql = getDb();
    await ensureActiveSettingsRow(sql);
    await sql`
      UPDATE site_settings
      SET
        title = ${DEFAULT_SITE_CONFIG.title},
        owner_name = ${DEFAULT_SITE_CONFIG.ownerName},
        accent_color = ${DEFAULT_SITE_CONFIG.accentColor},
        site_url = ${DEFAULT_SITE_CONFIG.siteUrl},
        github_url = ${DEFAULT_SITE_CONFIG.githubUrl},
        live_player_layout = ${DEFAULT_SITE_CONFIG.livePlayerLayout},
        updated_at = NOW()
      WHERE id = 'active';
    `;
    siteConfigCache.invalidate();
  }

  return DEFAULT_SITE_CONFIG;
}

/**
 * Retrieves the owner's Spotify playback refresh token from site_settings.
 * Returns null if not set or database is unconfigured.
 */
export async function getOwnerPlaybackCredential(): Promise<{
  refreshToken: string;
  displayName: string | null;
  revision: string;
} | null> {
  if (!isDbConfigured()) return null;
  await ensureTablesExist();
  const rows = await getDb()`
    SELECT owner_playback_token, owner_spotify_name, owner_token_revision
    FROM site_settings WHERE id = 'active' LIMIT 1;
  `;
  const row = rows[0];
  return row?.owner_playback_token ? {
    refreshToken: row.owner_playback_token,
    displayName: row.owner_spotify_name || null,
    revision: String(row.owner_token_revision),
  } : null;
}

export async function getOwnerPlaybackToken(): Promise<string | null> {
  return (await getOwnerPlaybackCredential())?.refreshToken ?? null;
}

/** A refresh may rotate tokens only while its original connection still exists. */
export async function rotateOwnerPlaybackToken(
  expectedRevision: string,
  previousToken: string,
  token: string
): Promise<string | null> {
  if (!isDbConfigured()) return null;
  await ensureTablesExist();
  const rows = await getDb()`
    UPDATE site_settings
    SET owner_playback_token = ${token},
        owner_token_updated_at = NOW(),
        updated_at = NOW()
    WHERE id = 'active' AND owner_token_revision = ${expectedRevision}::bigint
      AND owner_playback_token = ${previousToken}
    RETURNING owner_token_revision;
  `;
  return rows[0] ? String(rows[0].owner_token_revision) : null;
}

/** Register one pending owner authorization attempt without changing the connection. */
export async function beginOwnerAuthorization(nonce: string): Promise<string> {
  if (!isDbConfigured()) throw new Error("A database is required to connect Spotify.");
  await ensureTablesExist();
  const sql = getDb();
  await ensureActiveSettingsRow(sql);
  const rows = await sql`
    UPDATE site_settings
    SET owner_oauth_nonce = ${nonce}
    WHERE id = 'active'
    RETURNING owner_token_revision;
  `;
  return String(rows[0].owner_token_revision);
}

/** Claim a sealed attempt once, including when the callback changes loopback hosts. */
export async function consumeOwnerAuthorization(nonce: string, revision: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  await ensureTablesExist();
  const rows = await getDb()`
    UPDATE site_settings SET owner_oauth_nonce = NULL
    WHERE id = 'active' AND owner_oauth_nonce = ${nonce}
      AND owner_token_revision = ${revision}::bigint
    RETURNING owner_token_revision;
  `;
  return rows.length === 1;
}

/**
 * Persists the owner's Spotify playback refresh token in site_settings.
 */
export async function saveOwnerPlaybackToken(
  token: string,
  displayName?: string | null,
  profileUrl?: string | null,
  expectedRevision?: string
): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    await ensureTablesExist();
    const sql = getDb();
    await ensureActiveSettingsRow(sql);
    if (expectedRevision !== undefined) {
      const rows = await sql`
        UPDATE site_settings SET owner_playback_token = ${token},
          owner_spotify_name = ${displayName || null}, owner_spotify_url = ${profileUrl || null},
          owner_token_revision = owner_token_revision + 1,
          owner_oauth_nonce = NULL,
          owner_token_updated_at = NOW(), updated_at = NOW()
        WHERE id = 'active' AND owner_token_revision = ${expectedRevision}::bigint
        RETURNING owner_token_revision;
      `;
      return rows.length === 1;
    }
    await sql`
      UPDATE site_settings
      SET
        owner_playback_token = ${token},
        owner_token_revision = site_settings.owner_token_revision + 1,
        owner_oauth_nonce = NULL,
        owner_spotify_name = COALESCE(${displayName || null}, site_settings.owner_spotify_name),
        owner_spotify_url = COALESCE(${profileUrl || null}, site_settings.owner_spotify_url),
        owner_token_updated_at = NOW(),
        updated_at = NOW()
      WHERE id = 'active';
    `;
    return true;
  } catch (error) {
    console.error("[SITE CONFIG] Failed to save owner playback token to Neon DB:", error);
    throw error;
  }
}

/**
 * Retrieves the owner's Spotify connection status, display name, profile URL, and last token update timestamp.
 */
export async function getOwnerSpotifyStatus(): Promise<{
  connected: boolean;
  displayName: string | null;
  profileUrl: string | null;
  updatedAt: string | null;
}> {
  if (!isDbConfigured()) {
    return { connected: false, displayName: null, profileUrl: null, updatedAt: null };
  }
  try {
    await ensureTablesExist();
    const sql = getDb();
    const rows = (await sql`
      SELECT owner_playback_token, owner_spotify_name, owner_spotify_url, owner_token_updated_at
      FROM site_settings
      WHERE id = 'active'
      LIMIT 1;
    `);
    if (rows && rows.length > 0 && rows[0]?.owner_playback_token) {
      return {
        connected: true,
        displayName: rows[0].owner_spotify_name || null,
        profileUrl: rows[0].owner_spotify_url || null,
        updatedAt: rows[0].owner_token_updated_at ? new Date(rows[0].owner_token_updated_at).toISOString() : null,
      };
    }
    return { connected: false, displayName: null, profileUrl: null, updatedAt: null };
  } catch (error) {
    console.error("[SITE CONFIG] Failed to get owner Spotify status:", error);
    return { connected: false, displayName: null, profileUrl: null, updatedAt: null };
  }
}

/**
 * Clears the owner's Spotify playback refresh token from site_settings.
 */
export async function deleteOwnerPlaybackToken(): Promise<void> {
  if (!isDbConfigured()) {
    return;
  }
  try {
    await ensureTablesExist();
    const sql = getDb();
    await sql`
      UPDATE site_settings
      SET owner_playback_token = NULL,
          owner_token_revision = owner_token_revision + 1,
          owner_oauth_nonce = NULL,
          owner_spotify_name = NULL,
          owner_spotify_url = NULL,
          owner_token_updated_at = NULL,
          updated_at = NOW()
      WHERE id = 'active';
    `;
  } catch (error) {
    console.error("[SITE CONFIG] Failed to delete owner playback token from Neon DB:", error);
    throw error;
  }
}

/**
 * Retrieves the scheduled sync key (cron_key) from site_settings.
 * If null or unseeded on database connection, auto-generates a 32-character hex key and saves it.
 * Falls back to process.env.CRON_SECRET if the database is unconfigured.
 */
export async function getCronKey(options: {allowLegacyFallback?: boolean} = {}): Promise<string | null> {
  if (!isDbConfigured()) {
    return options.allowLegacyFallback === false ? null : process.env.CRON_SECRET || null;
  }

  try {
    await ensureTablesExist();
    const sql = getDb();
    const rows = (await sql`
      SELECT cron_key
      FROM site_settings
      WHERE id = 'active'
      LIMIT 1;
    `);

    if (rows && rows.length > 0 && rows[0]?.cron_key) {
      return rows[0].cron_key;
    }

    // Auto-generate 32-character random hex string if missing on database connection
    await ensureActiveSettingsRow(sql);
    const newKey = crypto.randomBytes(16).toString("hex");
    const seeded = await sql`
      UPDATE site_settings
      SET
        cron_key = COALESCE(site_settings.cron_key, ${newKey}),
        updated_at = NOW()
      WHERE id = 'active'
      RETURNING cron_key;
    `;
    return seeded[0]?.cron_key ?? null;
  } catch (error) {
    console.error("[SITE CONFIG] Failed to get or seed cron key from Neon DB:", error);
    return options.allowLegacyFallback === false ? null : process.env.CRON_SECRET || null;
  }
}

/**
 * Rotates the scheduled sync key (cron_key) in site_settings.
 * Generates a new 32-character hex string, persists it, and returns it.
 * Throws when the database is not configured.
 */
export async function regenerateCronKey(): Promise<string> {
  if (!isDbConfigured()) {
    throw new Error("A database is required to rotate the sync key.");
  }

  const newKey = crypto.randomBytes(16).toString("hex");

  try {
    await ensureTablesExist();
    const sql = getDb();
    await ensureActiveSettingsRow(sql);
    await sql`
      UPDATE site_settings
      SET
        cron_key = ${newKey},
        updated_at = NOW()
      WHERE id = 'active';
    `;
    return newKey;
  } catch (error) {
    console.error("[SITE CONFIG] Failed to regenerate cron key in Neon DB:", error);
    throw error;
  }
}

