import crypto from "node:crypto";
import { getDb, isDbConfigured } from "../index";
import { siteConfig } from "@/config";
import { ensureTablesExist } from "./schema";
import { siteConfigCache } from "./cache";
import type { SiteConfigState } from "./types";

/**
 * Retrieves the active site configuration.
 * Priority:
 * 1. Neon Database (site_settings table with id = 'active')
 * 2. Fallback to default siteConfig from src/config.ts
 * Deduplicates concurrent calls via in-flight promise latch and caches for 60 seconds.
 */
export async function getActiveSiteConfig(): Promise<SiteConfigState> {
  const fallback: SiteConfigState = {
    title: siteConfig.title,
    ownerName: siteConfig.ownerName,
    accentColor: siteConfig.accentColor,
    siteUrl: siteConfig.siteUrl,
    githubUrl: siteConfig.githubUrl,
    spotifyClientId: "",
    livePlayerLayout: (siteConfig as { livePlayerLayout?: string }).livePlayerLayout === "stacked" ? "stacked" : "split",
  };

  if (!isDbConfigured()) {
    return fallback;
  }

  return siteConfigCache.get(async () => {
    try {
      await ensureTablesExist();
      const sql = getDb();
      const rows = ((await sql`
        SELECT title, owner_name, accent_color, site_url, github_url, spotify_client_id, live_player_layout
        FROM site_settings
        WHERE id = 'active'
        LIMIT 1;
      `));

      if (rows && rows.length > 0 && rows[0]) {
        const row = rows[0];
        return {
          title: row.title || fallback.title,
          ownerName: row.owner_name || fallback.ownerName,
          accentColor: row.accent_color || fallback.accentColor,
          siteUrl: row.site_url || fallback.siteUrl,
          githubUrl: row.github_url || fallback.githubUrl,
          // Empty string is a legitimate value here (player disabled), so
          // fall back only when the column is absent or null.
          spotifyClientId: row.spotify_client_id ?? fallback.spotifyClientId,
          livePlayerLayout:
            row.live_player_layout === "stacked" || row.live_player_layout === "split"
              ? row.live_player_layout
              : fallback.livePlayerLayout,
        };
      }

      // Auto-seed table on first cold start with default config
      await sql`
        INSERT INTO site_settings (id, title, owner_name, accent_color, site_url, github_url, spotify_client_id, live_player_layout, updated_at)
        VALUES (
          'active',
          ${fallback.title},
          ${fallback.ownerName},
          ${fallback.accentColor},
          ${fallback.siteUrl},
          ${fallback.githubUrl},
          ${fallback.spotifyClientId},
          ${fallback.livePlayerLayout},
          NOW()
        )
        ON CONFLICT (id) DO NOTHING;
      `;

      return fallback;
    } catch (error) {
      console.warn("[SITE CONFIG] Could not load active config from Neon DB, falling back to src/config.ts:", error);
      return fallback;
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
    await sql`
      INSERT INTO site_settings (id, title, owner_name, accent_color, site_url, github_url, spotify_client_id, live_player_layout, updated_at)
      VALUES (
        'active',
        ${config.title},
        ${config.ownerName},
        ${config.accentColor},
        ${config.siteUrl},
        ${config.githubUrl},
        ${config.spotifyClientId},
        ${config.livePlayerLayout || "split"},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        owner_name = EXCLUDED.owner_name,
        accent_color = EXCLUDED.accent_color,
        site_url = EXCLUDED.site_url,
        github_url = EXCLUDED.github_url,
        spotify_client_id = EXCLUDED.spotify_client_id,
        live_player_layout = EXCLUDED.live_player_layout,
        updated_at = NOW();
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
  const defaults: SiteConfigState = {
    title: siteConfig.title,
    ownerName: siteConfig.ownerName,
    accentColor: siteConfig.accentColor,
    siteUrl: siteConfig.siteUrl,
    githubUrl: siteConfig.githubUrl,
    spotifyClientId: "",
    livePlayerLayout: (siteConfig as { livePlayerLayout?: string }).livePlayerLayout === "stacked" ? "stacked" : "split",
  };

  if (isDbConfigured()) {
    await ensureTablesExist();
    const sql = getDb();
    await sql`
      INSERT INTO site_settings (id, title, owner_name, accent_color, site_url, github_url, spotify_client_id, live_player_layout, updated_at)
      VALUES (
        'active',
        ${defaults.title},
        ${defaults.ownerName},
        ${defaults.accentColor},
        ${defaults.siteUrl},
        ${defaults.githubUrl},
        ${defaults.spotifyClientId},
        ${defaults.livePlayerLayout},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        owner_name = EXCLUDED.owner_name,
        accent_color = EXCLUDED.accent_color,
        site_url = EXCLUDED.site_url,
        github_url = EXCLUDED.github_url,
        spotify_client_id = EXCLUDED.spotify_client_id,
        live_player_layout = EXCLUDED.live_player_layout,
        updated_at = NOW();
    `;
    siteConfigCache.invalidate();
  }

  return defaults;
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
  const rows = await getDb()`
    INSERT INTO site_settings (id, title, owner_name, accent_color, site_url, github_url, owner_oauth_nonce)
    VALUES ('active', ${siteConfig.title}, ${siteConfig.ownerName}, ${siteConfig.accentColor},
      ${siteConfig.siteUrl}, ${siteConfig.githubUrl}, ${nonce})
    ON CONFLICT (id) DO UPDATE SET owner_oauth_nonce = EXCLUDED.owner_oauth_nonce
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
      INSERT INTO site_settings (id, title, owner_name, accent_color, site_url, github_url, owner_playback_token, owner_spotify_name, owner_spotify_url, owner_token_updated_at, updated_at)
      VALUES (
        'active',
        ${siteConfig.title},
        ${siteConfig.ownerName},
        ${siteConfig.accentColor},
        ${siteConfig.siteUrl},
        ${siteConfig.githubUrl},
        ${token},
        ${displayName || null},
        ${profileUrl || null},
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        owner_playback_token = EXCLUDED.owner_playback_token,
        owner_token_revision = site_settings.owner_token_revision + 1,
        owner_oauth_nonce = NULL,
        owner_spotify_name = COALESCE(EXCLUDED.owner_spotify_name, site_settings.owner_spotify_name),
        owner_spotify_url = COALESCE(EXCLUDED.owner_spotify_url, site_settings.owner_spotify_url),
        owner_token_updated_at = NOW(),
        updated_at = NOW();
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
    const newKey = crypto.randomBytes(16).toString("hex");
    const seeded = await sql`
      INSERT INTO site_settings (id, title, owner_name, accent_color, site_url, github_url, cron_key, updated_at)
      VALUES (
        'active',
        ${siteConfig.title},
        ${siteConfig.ownerName},
        ${siteConfig.accentColor},
        ${siteConfig.siteUrl},
        ${siteConfig.githubUrl},
        ${newKey},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        cron_key = COALESCE(site_settings.cron_key, EXCLUDED.cron_key),
        updated_at = NOW()
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
 */
export async function regenerateCronKey(): Promise<string> {
  const newKey = crypto.randomBytes(16).toString("hex");

  if (!isDbConfigured()) {
    return newKey;
  }

  try {
    await ensureTablesExist();
    const sql = getDb();
    await sql`
      INSERT INTO site_settings (id, title, owner_name, accent_color, site_url, github_url, cron_key, updated_at)
      VALUES (
        'active',
        ${siteConfig.title},
        ${siteConfig.ownerName},
        ${siteConfig.accentColor},
        ${siteConfig.siteUrl},
        ${siteConfig.githubUrl},
        ${newKey},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        cron_key = EXCLUDED.cron_key,
        updated_at = NOW();
    `;
    return newKey;
  } catch (error) {
    console.error("[SITE CONFIG] Failed to regenerate cron key in Neon DB:", error);
    throw error;
  }
}

