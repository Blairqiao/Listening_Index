import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });
dotenv.config({ path: "spotify.env" });

import { fetchRecentlyPlayed } from "../src/lib/spotify";
import {
  ensureTablesExist,
  bulkUpsertArtists,
  bulkUpsertAlbums,
  bulkUpsertTracks,
  bulkInsertPlays,
  getExistingEntityIds,
  recordLastSync,
  TrackUpsertItem,
  PlayInsertItem,
} from "../src/lib/db/queries";
import { debouncePlays } from "../src/lib/history-parser";

/**
 * Spotify Synchronization & Ingestion Pipeline (ETL)
 *
 * Execution Flow:
 * 1. Authenticate via OAuth token refresh flow.
 * 2. Fetch recent 50 stream entries via Spotify Web API.
 * 3. Filter out local audio files and malformed payloads.
 * 4. Sequentially execute in strict foreign-key cascade order:
 *    - Extract primary artist -> upsertArtist
 *    - Extract album metadata -> upsertAlbum
 *    - Extract track metadata -> upsertTrack
 *    - Extract play ledger event -> insertPlay
 * 5. Log execution telemetry and timing.
 */

async function main() {
  const startTime = performance.now();
  console.log("------------------------------------------------------------");
  console.log("[ETL · SPOTIFY SYNC] Ingestion run initiated");
  console.log(`[TIMESTAMP] ${new Date().toISOString()}`);
  console.log("------------------------------------------------------------");

  try {
    // 0. Ensure database tables exist (self-healing for fresh deployments)
    console.log("[0/3] Verifying database schema...");
    await ensureTablesExist();

    // 1. Fetch Recently Played Tracks
    console.log("[1/3] Fetching recently played tracks from Spotify Web API...");
    const recentlyPlayed = await fetchRecentlyPlayed(50);
    const rawCount = recentlyPlayed.items.length;
    console.log(`      Received ${rawCount} items from Spotify cursor`);

    // 2. Filter out local audio files and malformed payloads
    const streamItems = recentlyPlayed.items.filter((item) => {
      const isLocal = item.track?.is_local === true;
      const hasArtist = Boolean(
        item.track?.artists && item.track.artists.length > 0 && item.track.artists[0]?.id
      );
      const hasAlbum = Boolean(item.track?.album?.id);
      const hasId = Boolean(item.track?.id);
      return !isLocal && hasArtist && hasAlbum && hasId;
    });

    const skippedLocalCount = rawCount - streamItems.length;
    if (skippedLocalCount > 0) {
      console.log(`      Filtered out ${skippedLocalCount} local/malformed items`);
    }
    console.log(`      Valid stream events to process: ${streamItems.length}`);

    if (streamItems.length === 0) {
      console.log("[INFO] No external streaming events found in batch. Exiting.");
      await recordLastSync("spotify");
      return {
        processed: 0,
        durationMs: Number((performance.now() - startTime).toFixed(1)),
      };
    }

    // 2b. Reverse stream items to ingest chronologically (oldest -> newest)
    const reversedItems = [...streamItems].reverse();

    // 2c. Debounce rapid duplicate stream events (< 30s gap per track)
    // Spotify live API emits multiple events for rapid skips, stutters, and reconnect loops
    const { debounced: newStreamItems, droppedCount: debouncedDuplicatesCount } = debouncePlays(
      reversedItems.map((item) => ({
        ...item,
        playedAt: item.played_at,
        trackId: item.track.id,
      })),
      30_000
    );

    if (debouncedDuplicatesCount > 0) {
      console.log(`      Debounced ${debouncedDuplicatesCount} rapid duplicate stream events (< 30s gap)`);
    }

    // 2d. Pre-filter existing artists, albums, and tracks in batch to avoid redundant upserts
    const candidateArtistIds = new Set<string>();
    const candidateAlbumIds = new Set<string>();
    const candidateTrackIds = new Set<string>();

    for (const item of newStreamItems) {
      const primaryArtist = item.track.artists[0];
      const album = item.track.album;
      const albumArtist = album.artists?.[0] || primaryArtist;
      if (primaryArtist?.id) candidateArtistIds.add(primaryArtist.id);
      if (albumArtist?.id) candidateArtistIds.add(albumArtist.id);
      if (album?.id) candidateAlbumIds.add(album.id);
      if (item.track?.id) candidateTrackIds.add(item.track.id);
    }

    const { existingArtistIds, existingAlbumIds, existingTrackIds } =
      await getExistingEntityIds({
        artistIds: Array.from(candidateArtistIds),
        albumIds: Array.from(candidateAlbumIds),
        trackIds: Array.from(candidateTrackIds),
      });

    console.log(
      `      Entities in batch: ${candidateArtistIds.size} artists (${existingArtistIds.size} existing), ${candidateAlbumIds.size} albums (${existingAlbumIds.size} existing), ${candidateTrackIds.size} tracks (${existingTrackIds.size} existing)`
    );

    // 3. Foreign Key Cascade Ingestion (High-Throughput Batch UNNEST Queries)
    console.log("[2/3] Ingesting entities in strict foreign-key order...");

    const newArtistsMap = new Map<string, { id: string; name: string }>();
    const newAlbumsMap = new Map<string, { id: string; name: string; imageUrl?: string | null; artistId: string }>();
    const tracksMap = new Map<string, TrackUpsertItem>();
    const playsList: PlayInsertItem[] = [];

    for (const item of newStreamItems) {
      const { track, played_at } = item;
      const primaryArtist = track.artists[0];
      const album = track.album;
      const albumArtist = album.artists?.[0] || primaryArtist;

      if (!existingArtistIds.has(primaryArtist.id)) {
        newArtistsMap.set(primaryArtist.id, { id: primaryArtist.id, name: primaryArtist.name });
      }
      if (albumArtist.id && !existingArtistIds.has(albumArtist.id)) {
        newArtistsMap.set(albumArtist.id, { id: albumArtist.id, name: albumArtist.name });
      }

      if (!existingAlbumIds.has(album.id)) {
        const imageUrl = album.images?.[0]?.url || null;
        newAlbumsMap.set(album.id, { id: album.id, name: album.name, imageUrl, artistId: albumArtist.id });
      }

      const existingTrack = tracksMap.get(track.id);
      if (!existingTrack) {
        tracksMap.set(track.id, {
          id: track.id,
          name: track.name,
          artistId: primaryArtist.id,
          albumId: album.id,
          durationMs: track.duration_ms,
          artistName: primaryArtist.name,
          albumName: album.name,
          enrichmentStatus: "enriched",
        });
      } else {
        existingTrack.durationMs = Math.max(existingTrack.durationMs, track.duration_ms);
      }

      playsList.push({
        playedAt: played_at,
        trackId: track.id,
        msPlayed: track.duration_ms,
      });
    }

    let artistsUpserted = 0;
    let albumsUpserted = 0;
    let tracksUpserted = 0;
    let playsIngested = 0;

    if (newArtistsMap.size > 0) {
      await bulkUpsertArtists(Array.from(newArtistsMap.values()));
      artistsUpserted = newArtistsMap.size;
    }
    if (newAlbumsMap.size > 0) {
      await bulkUpsertAlbums(Array.from(newAlbumsMap.values()));
      albumsUpserted = newAlbumsMap.size;
    }
    if (tracksMap.size > 0) {
      await bulkUpsertTracks(Array.from(tracksMap.values()));
      let newTrackCount = 0;
      for (const trackId of tracksMap.keys()) {
        if (!existingTrackIds.has(trackId)) newTrackCount++;
      }
      tracksUpserted = newTrackCount;
    }
    if (playsList.length > 0) {
      const { insertedCount } = await bulkInsertPlays(playsList);
      playsIngested = insertedCount;
    }

    // Step 3e: Run quota-budgeted cron micro-enrichment for historical pending backlog
    try {
      console.log("[2b/3] Running quota-budgeted cron micro-enrichment (up to 14 calls)...");
      const { runEnrichmentBatch } = await import("../src/lib/enrichment");
      const cronEnrichmentResult = await runEnrichmentBatch({ bucket: "cron" });
      if (cronEnrichmentResult.enrichedCount > 0 || cronEnrichmentResult.delistedCount > 0) {
        console.log(
          `      ✓ Cron micro-enrichment: ${cronEnrichmentResult.enrichedCount} tracks enriched, ${cronEnrichmentResult.delistedCount} delisted (${cronEnrichmentResult.progress.pending} pending remaining)`
        );
      } else if (cronEnrichmentResult.quotaReached) {
        console.log("      ℹ Cron micro-enrichment paused: daily quota limit reached");
      } else {
        console.log("      ℹ Cron micro-enrichment idle: no pending tracks to enrich");
      }
    } catch (enrichErr: unknown) {
      const msg = enrichErr instanceof Error ? enrichErr.message : String(enrichErr);
      console.warn(`      [WARN] Cron micro-enrichment skipped: ${msg}`);
    }

    console.log(`      ✓ Upserted ${artistsUpserted} new artist entities`);
    console.log(`      ✓ Upserted ${albumsUpserted} new album entities`);
    console.log(`      ✓ Upserted ${tracksUpserted} new track entities`);
    console.log(`      ✓ Ingested ${playsIngested} play events`);

    // 4. Summary Telemetry
    const durationMs = (performance.now() - startTime).toFixed(1);
    console.log("[3/3] Ingestion cycle successfully completed.");
    console.log("------------------------------------------------------------");
    console.log(
      `[SUMMARY] Processed ${playsIngested} plays (${candidateArtistIds.size} artists [${artistsUpserted} new], ${candidateAlbumIds.size} albums [${albumsUpserted} new], ${candidateTrackIds.size} tracks [${tracksUpserted} new]) in ${durationMs}ms`
    );
    console.log("------------------------------------------------------------");

    await recordLastSync("spotify");
    return { processed: playsIngested, durationMs: Number(durationMs) };
  } catch (error: unknown) {
    const durationMs = (performance.now() - startTime).toFixed(1);
    console.error("------------------------------------------------------------");
    console.error(`[ERROR · ETL FAILED] Execution halted after ${durationMs}ms`);
    if (error instanceof Error) {
      console.error(`[MESSAGE] ${error.message}`);
      if (error.stack) {
        console.error(`[STACK]\n${error.stack}`);
      }
    } else {
      console.error("[UNKNOWN ERROR]", error);
    }
    console.error("------------------------------------------------------------");

    if (require.main === module) {
      process.exit(1);
    }
    throw error;
  }
}

// Run script if executed directly
if (require.main === module) {
  main().catch(() => process.exit(1));
}

export { main as syncSpotify };
