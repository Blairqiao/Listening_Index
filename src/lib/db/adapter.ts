/**
 * Storage backend selection.
 *
 * The app was written directly against Postgres: every query file imports
 * `sql` and writes SQL inline. To let a second backend exist alongside it,
 * each area of the data layer gets an interface here, and each backend
 * provides an implementation.
 *
 * Callers ask this module for a repository and never learn which backend
 * answered. That is the whole point of the indirection: `src/app/api/...`
 * should not care whether a row came from Postgres or a document came from
 * MongoDB.
 *
 * Selection is by `DB_BACKEND`. Postgres stays the default, so an existing
 * deployment behaves exactly as before.
 */

import type { SiteConfigState } from "@/lib/config-utils";
import { isDbConfigured } from "./index";

export type DbBackend = "postgres" | "mongodb";

/**
 * Site settings: one record, read on nearly every request, written only from
 * the customization menu.
 *
 * In Postgres this is a single row in `site_settings` with id 'active'.
 * In MongoDB it is a single document in the `site_settings` collection with
 * _id 'active'. The shapes line up almost exactly, which is why this is the
 * right slice to port first.
 */
export interface ConfigRepository {
  getActiveSiteConfig(): Promise<SiteConfigState>;
  saveActiveSiteConfig(config: SiteConfigState): Promise<boolean>;
  resetActiveSiteConfig(): Promise<SiteConfigState>;
}

export function getDbBackend(): DbBackend {
  return process.env.DB_BACKEND === "mongodb" ? "mongodb" : "postgres";
}

/**
 * True when the selected backend has a connection string to work with.
 * Mirrors the existing isDbConfigured(), but answers for whichever backend
 * is actually in use, so the mock-data fallback still works either way.
 */
export function isBackendConfigured(): boolean {
  if (getDbBackend() === "mongodb") {
    const uri = process.env.MONGODB_URI;
    return Boolean(uri && uri.trim() && !uri.trim().toLowerCase().startsWith("todo"));
  }
  // Delegating rather than duplicating the placeholder checks.
  return isDbConfigured();
}
