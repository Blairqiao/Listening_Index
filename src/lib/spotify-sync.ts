import { fetchRecentlyPlayed } from "@/lib/spotify";
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
} from "@/lib/db/queries";
import { debouncePlays } from "@/lib/history-parser";
import { runEnrichmentBatch } from "@/lib/enrichment";

export interface SyncResult {
  processed: number;
  durationMs: number;
}

/**
 * Spotify Synchronization & Ingestion Pipeline (ETL)
 *
 * Execution Flow:
 * 1. Authenticate via OAuth token refresh flow.
 * 2. Fetch recent 50 stream entries via Spotify Web API.
 * 3. Filter out local audio files and malformed payloads.
 * 4. Ingest entities in strict foreign-key order:
 *    - Primary artists -> bulkUpsertArtists
 *    - Albums -> bulkUpsertAlbums
 *    - Tracks -> bulkUpsertTracks
 *    - Plays -> bulkInsertPlays
 * 5. Run quota-budgeted cron micro-enrichment.
 */
export async function syncSpotify(): Promise<SyncResult> {
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

    // 2c. Debounce rapid duplicate stream events (< 30s gap or < track duration per track)
    const { debounced: newStreamItems, droppedCount: debouncedDuplicatesCount } = debouncePlays(
      reversedItems.map((item) => ({
        ...item,
        playedAt: item.played_at,
        trackId: item.track.id,
        durationMs: item.track.duration_ms,
      })),
      30_000
    );

    if (debouncedDuplicatesCount > 0) {
      console.log(`      Debounced ${debouncedDuplicatesCount} rapid duplicate/resumption stream events`);
    }

    // 2d. Pre-filter existing artists, albums, and tracks in batch to avoid redundant upserts
    const candidateArtistIds = new Set<string>();
    const candidateAlbumIds = new Set<string>();
    const candidateTrackIds = new Set<string>();

    for (const item of newStreamItems) {
      const artist = item.track.artists[0];
      const album = item.track.album;
      const track = item.track;
      if (artist?.id) candidateArtistIds.add(artist.id);
      if (album?.id) candidateAlbumIds.add(album.id);
      if (track?.id) candidateTrackIds.add(track.id);
    }

    const { existingArtistIds, existingAlbumIds, existingTrackIds } = await getExistingEntityIds({
      artistIds: Array.from(candidateArtistIds),
      albumIds: Array.from(candidateAlbumIds),
      trackIds: Array.from(candidateTrackIds),
    });

    console.log(
      `      Entities in batch: ${candidateArtistIds.size} artists (${existingArtistIds.size} existing), ` +
        `${candidateAlbumIds.size} albums (${existingAlbumIds.size} existing), ` +
        `${candidateTrackIds.size} tracks (${existingTrackIds.size} existing)`
    );

    // 3. Foreign-Key Cascade Ingestion
    console.log("[2/3] Ingesting entities in strict foreign-key order...");

    // 3a. Bulk Upsert Artists
    const artistsToUpsert = Array.from(candidateArtistIds)
      .filter((id) => !existingArtistIds.has(id))
      .map((id) => {
        const item = newStreamItems.find((i) => i.track.artists[0].id === id)!;
        return { id, name: item.track.artists[0].name };
      });
    const artistsUpserted = artistsToUpsert.length;
    await bulkUpsertArtists(artistsToUpsert);

    // 3b. Bulk Upsert Albums
    const albumsToUpsert = Array.from(candidateAlbumIds)
      .filter((id) => !existingAlbumIds.has(id))
      .map((id) => {
        const item = newStreamItems.find((i) => i.track.album.id === id)!;
        const album = item.track.album;
        const imageUrl = album.images && album.images.length > 0 ? album.images[0].url : null;
        return {
          id,
          name: album.name,
          imageUrl,
          artistId: item.track.artists[0].id,
        };
      });
    const albumsUpserted = albumsToUpsert.length;
    await bulkUpsertAlbums(albumsToUpsert);

    // 3c. Bulk Upsert Tracks
    const tracksToUpsert: TrackUpsertItem[] = Array.from(candidateTrackIds)
      .map((id) => {
        const item = newStreamItems.find((i) => i.track.id === id)!;
        const track = item.track;
        return {
          id: track.id,
          name: track.name,
          artistName: track.artists[0]?.name || "Unknown Artist",
          albumName: track.album?.name || "Unknown Album",
          artistId: track.artists[0]?.id || null,
          albumId: track.album?.id || null,
          durationMs: track.duration_ms,
          enrichmentStatus: "enriched",
        };
      });
    const tracksUpserted = tracksToUpsert.length;
    await bulkUpsertTracks(tracksToUpsert);

    // 3d. Bulk Insert Plays
    const playsToInsert: PlayInsertItem[] = newStreamItems.map((item) => ({
      playedAt: item.played_at,
      trackId: item.track.id,
      msPlayed: item.track.duration_ms,
    }));
    const { insertedCount: playsIngested } = await bulkInsertPlays(playsToInsert);

    // Run quota-budgeted cron micro-enrichment
    try {
      console.log("[2b/3] Running quota-budgeted cron micro-enrichment (up to 14 calls)...");
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
    const durationMs = Number((performance.now() - startTime).toFixed(1));
    console.log("[3/3] Ingestion cycle successfully completed.");
    console.log("------------------------------------------------------------");
    console.log(
      `[SUMMARY] Processed ${playsIngested} plays (${candidateArtistIds.size} artists [${artistsUpserted} new], ${candidateAlbumIds.size} albums [${albumsUpserted} new], ${candidateTrackIds.size} tracks [${tracksUpserted} new]) in ${durationMs}ms`
    );
    console.log("------------------------------------------------------------");

    await recordLastSync("spotify");
    return { processed: playsIngested, durationMs };
  } catch (error: unknown) {
    const durationMs = Number((performance.now() - startTime).toFixed(1));
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
    throw error;
  }
}
