import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });
dotenv.config({ path: "spotify.env" });

import { isConfigured, isDbConfigured } from "../src/lib/db";
import { ensureTablesExist, getEnrichmentProgress } from "../src/lib/db/queries";
import { runEnrichmentBatch } from "../src/lib/enrichment";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function enrichMetadata() {
  const startTime = performance.now();
  console.log("------------------------------------------------------------");
  console.log("[STAGE 2 · SPOTIFY ENRICHMENT] Resumable metadata resolution");
  console.log(`[TIMESTAMP] ${new Date().toISOString()}`);
  console.log("------------------------------------------------------------");

  if (!isDbConfigured()) {
    throw new Error("DATABASE_URL is not configured. Connect your database first.");
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!isConfigured(clientId) || !isConfigured(clientSecret) || !isConfigured(refreshToken)) {
    throw new Error(
      "Spotify API credentials not configured. Configure SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REFRESH_TOKEN."
    );
  }

  await ensureTablesExist();

  const initialProgress = await getEnrichmentProgress();
  const totalToEnrich = initialProgress.pending;

  if (totalToEnrich === 0) {
    console.log("[INFO] No pending tracks to enrich. All tracks are up to date.");
    return {
      enriched: 0,
      delisted: 0,
      durationMs: Number((performance.now() - startTime).toFixed(1)),
    };
  }

  console.log(`[1/3] Found ${totalToEnrich} tracks needing Spotify metadata enrichment.`);
  console.log("[2/3] Initiating density-gated fan-out metadata resolution...\n");

  let isInterrupted = false;

  const onSigInt = () => {
    if (isInterrupted) {
      console.log("\n[ABORT] Force terminating...");
      process.exit(1);
    }
    isInterrupted = true;
    console.log(
      "\n[INTERRUPT] Received SIGINT. Finishing current batch and shutting down gracefully..."
    );
  };

  process.on("SIGINT", onSigInt);

  let totalEnriched = 0;
  let totalDelisted = 0;

  try {
    while (!isInterrupted) {
      const result = await runEnrichmentBatch();

      if (result.quotaReached) {
        console.log(
          `\n      🛑 Daily Spotify API quota limit reached (${result.reason || "900 calls/day"}).`
        );
        console.log("         Enrichment paused until the quota resets at 00:00:00 UTC.");
        break;
      }

      if (result.rateLimited) {
        const waitSec = result.retryAfterSeconds || 15;
        console.warn(
          `\n      ⚠️ Rate limit active (${result.reason || "cooldown"}). Waiting ${waitSec}s before retrying...`
        );
        for (let s = waitSec; s > 0; s--) {
          if (isInterrupted) break;
          await sleep(1000);
        }
        continue;
      }

      totalEnriched += result.enrichedCount;
      totalDelisted += result.delistedCount;

      const progress = result.progress;
      const completedCount = progress.enriched + progress.delisted;
      const total = progress.total;
      const pct = total > 0 ? Math.min(100, Math.round((completedCount / total) * 100)) : 100;

      process.stdout.write(
        `\r      Progress: [${pct}%] ${completedCount}/${total} (${totalEnriched} enriched, ${totalDelisted} delisted, ${progress.pending} pending)`
      );

      if (result.isComplete || progress.pending === 0) {
        break;
      }

      // Polite 100ms pacing between batches
      await sleep(100);
    }
  } finally {
    process.removeListener("SIGINT", onSigInt);
  }

  process.stdout.write("\n\n");
  console.log("[3/3] Finalizing enrichment state...");
  const durationMs = (performance.now() - startTime).toFixed(1);

  console.log("------------------------------------------------------------");
  if (isInterrupted) {
    console.log(
      `[PAUSED] Enrichment safely paused. Enriched ${totalEnriched} tracks, marked ${totalDelisted} delisted.`
    );
    console.log("         Run 'npm run enrich:metadata' to resume remaining tracks.");
  } else {
    console.log(
      `[SUMMARY] Enriched ${totalEnriched} tracks, resolved ${totalDelisted} delisted tracks in ${durationMs}ms`
    );
  }
  console.log("------------------------------------------------------------");

  return {
    enriched: totalEnriched,
    delisted: totalDelisted,
    durationMs: Number(durationMs),
  };
}

if (require.main === module) {
  enrichMetadata().catch((err) => {
    console.error("\n[ERROR]", err);
    process.exit(1);
  });
}

