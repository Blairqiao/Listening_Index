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
  };

  if (!isDbConfigured()) {
    return fallback;
  }

  return siteConfigCache.get(async () => {
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
      siteConfigCache.invalidate();
    } catch (error) {
      console.warn("[SITE CONFIG] Failed to reset active config in Neon DB:", error);
    }
  }

  return defaults;
}
