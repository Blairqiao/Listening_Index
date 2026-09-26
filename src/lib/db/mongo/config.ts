/**
 * Site settings, MongoDB implementation.
 *
 * Side by side with the Postgres version in queries/config.ts:
 *
 *   SELECT ... FROM site_settings WHERE id = 'active' LIMIT 1
 *     ->  collection.findOne({ _id: "active" })
 *
 *   INSERT ... ON CONFLICT (id) DO UPDATE SET ...
 *     ->  collection.updateOne({ _id }, { $set: ... }, { upsert: true })
 *
 * Two differences worth noticing.
 *
 * There is no column list. Postgres needed an ALTER TABLE to add
 * spotify_client_id; here a new field simply appears in new documents, and
 * older ones without it read back as undefined. That flexibility is the
 * headline MongoDB feature — and the catch, since nothing stops a typo from
 * becoming a new field. Hence normalizeSiteConfig on the way out: documents
 * are trusted for shape no more than an untrusted request body is.
 *
 * And _id is the primary key, always. Postgres let us name it `id`; Mongo
 * fixes the name, so 'active' goes there rather than in a column of our own.
 */

import { getMongoDb } from "./index";
import { siteConfig } from "@/config";
import {
  DEFAULT_SITE_CONFIG,
  normalizeSiteConfig,
  type SiteConfigState,
} from "@/lib/config-utils";
import type { ConfigRepository } from "../adapter";

const COLLECTION = "site_settings";
const DOC_ID = "active";

function defaults(): SiteConfigState {
  return normalizeSiteConfig(siteConfig as Partial<SiteConfigState>, DEFAULT_SITE_CONFIG);
}

export const mongoConfigRepository: ConfigRepository = {
  async getActiveSiteConfig(): Promise<SiteConfigState> {
    const fallback = defaults();
    try {
      const db = await getMongoDb();
      const doc = await db.collection(COLLECTION).findOne({ _id: DOC_ID as never });
      if (!doc) {
        // Seed on first read, the same way the Postgres path does.
        await db
          .collection(COLLECTION)
          .updateOne(
            { _id: DOC_ID as never },
            { $set: { ...fallback, updatedAt: new Date() } },
            { upsert: true }
          );
        return fallback;
      }
      // A document is untrusted input: it may predate a field, or carry one
      // we no longer use. Normalizing gives the caller a complete object.
      return normalizeSiteConfig(doc as Partial<SiteConfigState>, fallback);
    } catch (error) {
      console.warn(
        "[SITE CONFIG] Could not load active config from MongoDB, falling back to src/config.ts:",
        error
      );
      return fallback;
    }
  },

  async saveActiveSiteConfig(config: SiteConfigState): Promise<boolean> {
    try {
      const db = await getMongoDb();
      await db
        .collection(COLLECTION)
        .updateOne(
          { _id: DOC_ID as never },
          { $set: { ...config, updatedAt: new Date() } },
          { upsert: true }
        );
      return true;
    } catch (error) {
      console.error("[SITE CONFIG] Failed to save active config to MongoDB:", error);
      throw error;
    }
  },

  async resetActiveSiteConfig(): Promise<SiteConfigState> {
    const reset = defaults();
    try {
      const db = await getMongoDb();
      // Replace rather than $set: reset should drop stale fields too, which
      // a merge would silently keep.
      await db
        .collection(COLLECTION)
        .replaceOne(
          { _id: DOC_ID as never },
          { ...reset, updatedAt: new Date() },
          { upsert: true }
        );
    } catch (error) {
      console.error("[SITE CONFIG] Failed to reset active config in MongoDB:", error);
    }
    return reset;
  },
};
