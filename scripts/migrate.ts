import dotenv from "dotenv";
dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", quiet: true });

import { isDbConfigured } from "../src/lib/db";
import { migrateSchema, shouldRunMigrations } from "../src/lib/db/queries/schema";

/**
 * Runs before `next build` and `next dev`. A failure exits non-zero, which fails the
 * build, so a deployment never goes live against a schema it cannot use.
 */
async function main() {
  if (!shouldRunMigrations(process.env)) {
    console.log(`[migrate] Skipped for VERCEL_ENV=${process.env.VERCEL_ENV}.`);
    return;
  }
  if (!isDbConfigured()) {
    console.log("[migrate] Skipped: DATABASE_URL is not configured.");
    return;
  }
  await migrateSchema();
  console.log("[migrate] Schema is up to date.");
}

main().catch((error) => {
  console.error("[migrate] Failed:", error);
  process.exit(1);
});
