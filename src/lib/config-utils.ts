import { siteConfig } from "@/config";
import { normalizeHex } from "@/lib/color-utils";

export type LivePlayerLayout = "split" | "stacked";

export interface SiteConfigState {
  title: string;
  ownerName: string;
  accentColor: string;
  siteUrl: string;
  githubUrl: string;
  timezone: string;
  spotifyClientId: string;
  livePlayerLayout: LivePlayerLayout;
}

export const DEFAULT_SITE_CONFIG: SiteConfigState = {
  title: siteConfig.title,
  ownerName: siteConfig.ownerName,
  accentColor: normalizeHex(siteConfig.accentColor),
  siteUrl: siteConfig.siteUrl,
  githubUrl: siteConfig.githubUrl,
  timezone: siteConfig.timezone || "America/Chicago",
  spotifyClientId: siteConfig.spotifyClientId || "",
  livePlayerLayout: "split",
};

/**
 * Normalizes and sanitizes a partial or untrusted site configuration patch,
 * applying clean trimming and color normalization with consistent fallbacks.
 */
export function normalizeSiteConfig(
  patch?: Partial<SiteConfigState> | null,
  base: SiteConfigState = DEFAULT_SITE_CONFIG
): SiteConfigState {
  if (!patch) return { ...base };

  const layout = patch.livePlayerLayout;
  const validLayout: LivePlayerLayout =
    layout === "stacked" || layout === "split" ? layout : base.livePlayerLayout || "split";

  return {
    title: patch.title !== undefined ? String(patch.title).trim() : base.title,
    ownerName: patch.ownerName !== undefined ? String(patch.ownerName).trim() : base.ownerName,
    accentColor: patch.accentColor ? normalizeHex(patch.accentColor) : base.accentColor,
    siteUrl: patch.siteUrl !== undefined ? String(patch.siteUrl).trim() : base.siteUrl,
    githubUrl: patch.githubUrl !== undefined ? String(patch.githubUrl).trim() : base.githubUrl,
    timezone: patch.timezone !== undefined ? String(patch.timezone).trim() : base.timezone,
    spotifyClientId:
      patch.spotifyClientId !== undefined
        ? String(patch.spotifyClientId).trim()
        : base.spotifyClientId,
    livePlayerLayout: validLayout,
  };
}

/**
 * Compares two site configurations for value equality across all fields.
 */
export function areSiteConfigsEqual(a: SiteConfigState, b: SiteConfigState): boolean {
  return (
    a.title === b.title &&
    a.ownerName === b.ownerName &&
    normalizeHex(a.accentColor) === normalizeHex(b.accentColor) &&
    a.siteUrl === b.siteUrl &&
    a.githubUrl === b.githubUrl &&
    a.timezone === b.timezone &&
    a.spotifyClientId === b.spotifyClientId &&
    a.livePlayerLayout === b.livePlayerLayout
  );
}

/**
 * Generates formatted TypeScript code representing src/config.ts.
 */
export function generateConfigTsCode(config: SiteConfigState): string {
  return `export const siteConfig = {
  title: ${JSON.stringify(config.title)},
  ownerName: ${JSON.stringify(config.ownerName)},
  accentColor: ${JSON.stringify(normalizeHex(config.accentColor))},
  siteUrl: ${JSON.stringify(config.siteUrl)},
  githubUrl: ${JSON.stringify(config.githubUrl)},
  timezone: ${JSON.stringify(config.timezone)},
  spotifyClientId: ${JSON.stringify(config.spotifyClientId)},
  livePlayerLayout: ${JSON.stringify(config.livePlayerLayout)},
};
`;
}
