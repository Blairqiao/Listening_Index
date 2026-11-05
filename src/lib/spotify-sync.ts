import { fetchRecentlyPlayed } from "@/lib/spotify";
import {
  ensureTablesExist,
  bulkUpsertArtists,
  bulkUpsertAlbums,
  bulkUpsertTracks,
  bulkInsertPlays,
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

  try {
    // 0. Ensure database tables exist (self-healing for fresh deployments)
    await ensureTablesExist();

    // 1. Fetch Recently Played Tracks
    // No after cursor: the endpoint only returns the latest 50, and bulkInsertPlays dedupes overlap.
    const recentlyPlayed = await fetchRecentlyPlayed(50);

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

    if (streamItems.length === 0) {
      await recordLastSync();
      return {
        processed: 0,
        durationMs: Number((performance.now() - startTime).toFixed(1)),
      };
    }

    // 2b. Reverse stream items to ingest chronologically (oldest -> newest)
    const reversedItems = [...streamItems].reverse();

    // 2c. Debounce rapid duplicate stream events (< 30s gap or < track duration per track)
    const { debounced: newStreamItems } = debouncePlays(
      reversedItems.map((item) => ({
        ...item,
        playedAt: item.played_at,
        trackId: item.track.id,
        durationMs: item.track.duration_ms,
      })),
      30_000
    );

    // 2d. Gather candidate artists, albums, and tracks from the batch
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

    // 3. Foreign-Key Cascade Ingestion

    // 3a. Bulk Upsert Artists
    const artistsToUpsert = Array.from(candidateArtistIds).map((id) => {
      const item = newStreamItems.find((i) => i.track.artists[0].id === id)!;
      return { id, name: item.track.artists[0].name };
    });
    await bulkUpsertArtists(artistsToUpsert);

    // 3b. Bulk Upsert Albums
    const albumsToUpsert = Array.from(candidateAlbumIds).map((id) => {
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
    await bulkUpsertAlbums(albumsToUpsert);

    // 3c. Bulk Upsert Tracks
    const tracksToUpsert: TrackUpsertItem[] = Array.from(candidateTrackIds).map((id) => {
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
    await bulkUpsertTracks(tracksToUpsert);

    // 3d. Bulk Insert Plays
    // Spotify recently-played omits ms_played, so duration_ms is stored as an approximation.
    const playsToInsert: PlayInsertItem[] = newStreamItems.map((item) => ({
      playedAt: item.played_at,
      trackId: item.track.id,
      msPlayed: item.track.duration_ms,
    }));
    const { insertedCount: playsIngested } = await bulkInsertPlays(playsToInsert);

    // Run quota-budgeted cron micro-enrichment
    try {
      await runEnrichmentBatch({ bucket: "cron" });
    } catch (enrichErr: unknown) {
      const msg = enrichErr instanceof Error ? enrichErr.message : String(enrichErr);
      console.warn(`[spotify-sync] Cron enrichment skipped: ${msg}`);
    }

    const durationMs = Number((performance.now() - startTime).toFixed(1));

    await recordLastSync();
    return { processed: playsIngested, durationMs };
  } catch (error: unknown) {
    const durationMs = Number((performance.now() - startTime).toFixed(1));
    console.error(`[spotify-sync] Failed after ${durationMs}ms:`, error);
    throw error;
  }
}
