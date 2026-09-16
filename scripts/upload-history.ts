import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });
dotenv.config({ path: "spotify.env" });

import { isConfigured, isDbConfigured } from "../src/lib/db";
import {
  ensureTablesExist,
  bulkUpsertTracks,
  bulkInsertPlays,
  TrackUpsertItem,
} from "../src/lib/db/queries";
import {
  parseHistoryRecords,
  CompactPlayEvent,
} from "../src/lib/history-parser";
import { extractAudioHistoryEntries, isAudioHistoryFilename } from "../src/lib/zip-utils";
import { enrichMetadata } from "./enrich-metadata";

interface FileSource {
  name: string;
  getText: () => Promise<string>;
}

async function resolveFileSources(targetPath?: string): Promise<FileSource[]> {
  const sources: FileSource[] = [];

  // Default path if none provided
  const candidatePath =
    targetPath ||
    (fs.existsSync(path.resolve(process.cwd(), "src/lib/Streaming_History_Audio_2024.json"))
      ? path.resolve(process.cwd(), "src/lib/Streaming_History_Audio_2024.json")
      : undefined);

  if (!candidatePath) {
    // Check current directory for matching files or zips
    const dirEntries = fs.readdirSync(process.cwd());
    const zip = dirEntries.find((f) => f.toLowerCase().endsWith(".zip"));
    if (zip) {
      return resolveFileSources(path.resolve(process.cwd(), zip));
    }
    const jsonFiles = dirEntries.filter(isAudioHistoryFilename);
    if (jsonFiles.length > 0) {
      return jsonFiles.map((f) => ({
        name: f,
        getText: async () => fs.readFileSync(path.resolve(process.cwd(), f), "utf-8"),
      }));
    }
    throw new Error(
      "No input file specified. Usage: npm run upload:history <path-to-zip-or-json>"
    );
  }

  const resolved = path.resolve(process.cwd(), candidatePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File or directory not found: ${resolved}`);
  }

  const stat = fs.statSync(resolved);

  if (stat.isDirectory()) {
    const files = fs.readdirSync(resolved);
    for (const file of files) {
      if (isAudioHistoryFilename(file)) {
        sources.push({
          name: file,
          getText: async () => fs.readFileSync(path.join(resolved, file), "utf-8"),
        });
      }
    }
  } else if (resolved.toLowerCase().endsWith(".zip")) {
    const zipBuffer = fs.readFileSync(resolved);
    const entries = await extractAudioHistoryEntries(zipBuffer);
    for (const entry of entries) {
      sources.push({
        name: entry.filename,
        getText: entry.readText,
      });
    }
  } else if (resolved.toLowerCase().endsWith(".json")) {
    sources.push({
      name: path.basename(resolved),
      getText: async () => fs.readFileSync(resolved, "utf-8"),
    });
  } else {
    throw new Error(`Unsupported file type: ${resolved}. Provide a .zip or .json file.`);
  }

  if (sources.length === 0) {
    throw new Error(
      `No matching Streaming_History_Audio or endsong JSON files found in: ${resolved}`
    );
  }

  return sources;
}

async function ingestPlayBatch(plays: CompactPlayEvent[]): Promise<number> {
  const trackMap = new Map<string, TrackUpsertItem>();

  for (const p of plays) {
    const existing = trackMap.get(p.trackId);
    if (!existing) {
      trackMap.set(p.trackId, {
        id: p.trackId,
        name: p.trackName,
        artistName: p.artistName,
        albumName: p.albumName,
        artistGroupKey: p.artistGroupKey,
        albumGroupKey: p.albumGroupKey,
        durationMs: p.msPlayed,
        enrichmentStatus: "pending",
      });
    } else {
      existing.durationMs = Math.max(existing.durationMs, p.msPlayed);
    }
  }

  await bulkUpsertTracks(Array.from(trackMap.values()));

  const { insertedCount } = await bulkInsertPlays(
    plays.map((p) => ({
      playedAt: p.playedAt,
      trackId: p.trackId,
      msPlayed: p.msPlayed,
    }))
  );

  return insertedCount;
}

async function main() {
  const totalStartTime = performance.now();
  console.log("============================================================");
  console.log("      Spotify Extended Music History Ingestion Service      ");
  console.log("============================================================\n");

  // 1. Enforce Preconditions (Only requires DB)
  if (!isDbConfigured()) {
    console.error("[ERROR] DATABASE_URL is not configured in .env.local or environment.");
    process.exit(1);
  }

  await ensureTablesExist();

  // 2. Discover File Sources
  const targetArg = process.argv[2];
  console.log("[STAGE 1/2] Locating streaming history files...");
  const sources = await resolveFileSources(targetArg);
  console.log(`            Found ${sources.length} audio history source file(s):`);
  for (const s of sources) {
    console.log(`            • ${s.name}`);
  }
  console.log("");

  // 3. Process Files One-by-One (Low-Memory Streaming)
  let totalQualifiedPlays = 0;
  let totalNewPlays = 0;
  const PLAY_BATCH_SIZE = 1000;

  for (let fileIdx = 0; fileIdx < sources.length; fileIdx++) {
    const source = sources[fileIdx];
    console.log(
      `[STAGE 1/2] [File ${fileIdx + 1}/${sources.length}] Reading and parsing ${source.name}...`
    );

    const jsonText = await source.getText();
    const rawRecords = JSON.parse(jsonText);

    if (!Array.isArray(rawRecords)) {
      console.warn(`            ⚠️ Skipped ${source.name}: Expected JSON array.`);
      continue;
    }

    const qualifiedPlays = parseHistoryRecords(rawRecords);
    console.log(
      `            Parsed ${rawRecords.length} stream events -> ${qualifiedPlays.length} qualified music plays (>=30s / trackdone)`
    );

    // Ingest in batches of 1,000
    for (let i = 0; i < qualifiedPlays.length; i += PLAY_BATCH_SIZE) {
      const batch = qualifiedPlays.slice(i, i + PLAY_BATCH_SIZE);
      const newInserted = await ingestPlayBatch(batch);

      totalQualifiedPlays += batch.length;
      totalNewPlays += newInserted;

      const pct = Math.round(((i + batch.length) / qualifiedPlays.length) * 100);
      process.stdout.write(
        `\r            Ingesting plays: [${pct}%] ${i + batch.length}/${qualifiedPlays.length} (${totalNewPlays} new rows)`
      );
    }
    process.stdout.write("\n\n");
  }

  console.log("------------------------------------------------------------");
  console.log(`[UPLOAD COMPLETE] Ingested ${totalQualifiedPlays} total qualified plays.`);
  console.log(`                  New plays inserted: ${totalNewPlays}`);
  console.log(`                  Duplicates skipped: ${totalQualifiedPlays - totalNewPlays}`);
  console.log("------------------------------------------------------------\n");

  const totalDurationSec = ((performance.now() - totalStartTime) / 1000).toFixed(1);
  console.log("============================================================");
  console.log(`  🎉 History upload successfully finished in ${totalDurationSec}s!`);
  console.log("  All plays and tracks are now in your database.");
  console.log("  Your dashboard and stream log are fully active.");
  console.log("");
  console.log("  To enrich album artwork and track durations later, run:");
  console.log("    npm run enrich:metadata");
  console.log("============================================================\n");
}

main().catch((err) => {
  console.error("\n[FATAL ERROR]", err);
  process.exit(1);
});
