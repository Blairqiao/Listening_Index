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
    timezone: siteConfig.timezone || "America/Chicago",
    spotifyClientId: "",
    livePlayerLayout: "split",
  };

  if (!isDbConfigured()) {
    return fallback;
  }

  return siteConfigCache.get(async () => {
    try {
      await ensureTablesExist();
      const sql = getDb();
      const rows = ((await sql`
        SELECT title, owner_name, accent_color, site_url, github_url, timezone, spotify_client_id, live_player_layout
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
          timezone: row.timezone || fallback.timezone,
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
        INSERT INTO site_settings (id, title, owner_name, accent_color, site_url, github_url, timezone, spotify_client_id, live_player_layout, updated_at)
        VALUES (
          'active',
          ${fallback.title},
          ${fallback.ownerName},
          ${fallback.accentColor},
          ${fallback.siteUrl},
          ${fallback.githubUrl},
          ${fallback.timezone},
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
      INSERT INTO site_settings (id, title, owner_name, accent_color, site_url, github_url, timezone, spotify_client_id, live_player_layout, updated_at)
      VALUES (
        'active',
        ${config.title},
        ${config.ownerName},
        ${config.accentColor},
        ${config.siteUrl},
        ${config.githubUrl},
        ${config.timezone},
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
        timezone = EXCLUDED.timezone,
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
    timezone: siteConfig.timezone || "America/Chicago",
    spotifyClientId: "",
    livePlayerLayout: "split",
  };

  if (isDbConfigured()) {
    try {
      await ensureTablesExist();
      const sql = getDb();
      await sql`
        INSERT INTO site_settings (id, title, owner_name, accent_color, site_url, github_url, timezone, live_player_layout, updated_at)
        VALUES (
          'active',
          ${defaults.title},
          ${defaults.ownerName},
          ${defaults.accentColor},
          ${defaults.siteUrl},
          ${defaults.githubUrl},
          ${defaults.timezone},
          ${defaults.livePlayerLayout},
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          owner_name = EXCLUDED.owner_name,
          accent_color = EXCLUDED.accent_color,
          site_url = EXCLUDED.site_url,
          github_url = EXCLUDED.github_url,
          timezone = EXCLUDED.timezone,
          live_player_layout = EXCLUDED.live_player_layout,
          updated_at = NOW();
      `;
      siteConfigCache.invalidate();
    } catch (error) {
      console.warn("[SITE CONFIG] Failed to reset active config in Neon DB:", error);
    }
  }

  return defaults;
}

/**
 * Retrieves the owner's Spotify playback refresh token from site_settings.
 * Returns null if not set or database is unconfigured.
 */
export async function getOwnerPlaybackToken(): Promise<string | null> {
  if (!isDbConfigured()) {
    return null;
  }
  try {
    await ensureTablesExist();
    const sql = getDb();
    const rows = ((await sql`
      SELECT owner_playback_token
      FROM site_settings
      WHERE id = 'active'
      LIMIT 1;
    `));

    if (rows && rows.length > 0 && rows[0]?.owner_playback_token) {
      return rows[0].owner_playback_token;
    }
    return null;
  } catch (error) {
    console.error("[SITE CONFIG] Failed to get owner playback token from Neon DB:", error);
    return null;
  }
}

/**
 * Persists the owner's Spotify playback refresh token in site_settings.
 */
export async function saveOwnerPlaybackToken(
  token: string,
  displayName?: string | null,
  profileUrl?: string | null
): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await ensureTablesExist();
    const sql = getDb();
    await sql`
      INSERT INTO site_settings (id, title, owner_name, accent_color, site_url, github_url, timezone, owner_playback_token, owner_spotify_name, owner_spotify_url, owner_token_updated_at, updated_at)
      VALUES (
        'active',
        ${siteConfig.title},
        ${siteConfig.ownerName},
        ${siteConfig.accentColor},
        ${siteConfig.siteUrl},
        ${siteConfig.githubUrl},
        ${siteConfig.timezone || "America/Chicago"},
        ${token},
        ${displayName || null},
        ${profileUrl || null},
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        owner_playback_token = EXCLUDED.owner_playback_token,
        owner_spotify_name = COALESCE(EXCLUDED.owner_spotify_name, site_settings.owner_spotify_name),
        owner_spotify_url = COALESCE(EXCLUDED.owner_spotify_url, site_settings.owner_spotify_url),
        owner_token_updated_at = NOW(),
        updated_at = NOW();
    `;
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
export async function getCronKey(): Promise<string | null> {
  if (!isDbConfigured()) {
    return process.env.CRON_SECRET || null;
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
    await sql`
      INSERT INTO site_settings (id, title, owner_name, accent_color, site_url, github_url, timezone, cron_key, updated_at)
      VALUES (
        'active',
        ${siteConfig.title},
        ${siteConfig.ownerName},
        ${siteConfig.accentColor},
        ${siteConfig.siteUrl},
        ${siteConfig.githubUrl},
        ${siteConfig.timezone || "America/Chicago"},
        ${newKey},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        cron_key = EXCLUDED.cron_key,
        updated_at = NOW();
    `;
    return newKey;
  } catch (error) {
    console.error("[SITE CONFIG] Failed to get or seed cron key from Neon DB:", error);
    return process.env.CRON_SECRET || null;
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
      INSERT INTO site_settings (id, title, owner_name, accent_color, site_url, github_url, timezone, cron_key, updated_at)
      VALUES (
        'active',
        ${siteConfig.title},
        ${siteConfig.ownerName},
        ${siteConfig.accentColor},
        ${siteConfig.siteUrl},
        ${siteConfig.githubUrl},
        ${siteConfig.timezone || "America/Chicago"},
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

