/**
 * Backend selection, resolved at call time.
 *
 * Deliberately not resolved once at module load: reading DB_BACKEND on each
 * call keeps tests and local experiments able to flip backends without a
 * restart, and costs nothing measurable next to a database round trip.
 *
 * The Postgres implementations are the existing query functions, adopted
 * unchanged. Nothing about the Postgres path is rewritten to add MongoDB —
 * it simply gains a sibling.
 */

import { getDbBackend, type ConfigRepository } from "./adapter";
import {
  getActiveSiteConfig as pgGetActiveSiteConfig,
  saveActiveSiteConfig as pgSaveActiveSiteConfig,
  resetActiveSiteConfig as pgResetActiveSiteConfig,
} from "./queries/config";
import { mongoConfigRepository } from "./mongo/config";

const postgresConfigRepository: ConfigRepository = {
  getActiveSiteConfig: pgGetActiveSiteConfig,
  saveActiveSiteConfig: pgSaveActiveSiteConfig,
  resetActiveSiteConfig: pgResetActiveSiteConfig,
};

export function configRepository(): ConfigRepository {
  return getDbBackend() === "mongodb" ? mongoConfigRepository : postgresConfigRepository;
}
