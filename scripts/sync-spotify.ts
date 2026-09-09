import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });
dotenv.config({ path: "spotify.env" });

import { fetchRecentlyPlayed } from "../src/lib/spotify";
import {
  ensureTablesExist,
  upsertArtist,
  upsertAlbum,
  upsertTrack,
  insertPlay,
  getExistingEntityIds,
  recordLastSync,
} from "../src/lib/db/queries";

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
    // Plays are NOT pre-filtered; every play event is delivered to the database ledger.
    // Idempotency is enforced strictly at the database layer via ON CONFLICT (played_at, track_id) DO NOTHING.
    const newStreamItems = [...streamItems].reverse();

    // 2c. Pre-filter existing artists, albums, and tracks in batch to avoid redundant upserts
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

    // 3. Foreign Key Cascade Ingestion
    console.log("[2/3] Ingesting entities in strict foreign-key order...");

    let artistsUpserted = 0;
    let albumsUpserted = 0;
    let tracksUpserted = 0;
    let playsIngested = 0;

    for (const item of newStreamItems) {
      const { track, played_at } = item;
      const primaryArtist = track.artists[0];
      const album = track.album;
      const albumArtist = album.artists?.[0] || primaryArtist;

      // Step 3a: Upsert primary artist if not already in DB
      if (!existingArtistIds.has(primaryArtist.id)) {
        await upsertArtist(primaryArtist.id, primaryArtist.name);
        existingArtistIds.add(primaryArtist.id);
        artistsUpserted++;
      }

      // If album has a distinct primary artist, ensure they exist as well
      if (albumArtist.id && !existingArtistIds.has(albumArtist.id)) {
        await upsertArtist(albumArtist.id, albumArtist.name);
        existingArtistIds.add(albumArtist.id);
        artistsUpserted++;
      }

      // Step 3b: Upsert album if not already in DB
      if (!existingAlbumIds.has(album.id)) {
        const imageUrl = album.images?.[0]?.url || null;
        await upsertAlbum(album.id, album.name, imageUrl, albumArtist.id);
        existingAlbumIds.add(album.id);
        albumsUpserted++;
      }

      // Step 3c: Upsert track if not already in DB
      if (!existingTrackIds.has(track.id)) {
        await upsertTrack(
          track.id,
          track.name,
          primaryArtist.id,
          album.id,
          track.duration_ms
        );
        existingTrackIds.add(track.id);
        tracksUpserted++;
      }

      // Step 3d: Insert play event
      const inserted = await insertPlay(played_at, track.id, track.duration_ms);
      if (inserted) {
        playsIngested++;
      }
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
