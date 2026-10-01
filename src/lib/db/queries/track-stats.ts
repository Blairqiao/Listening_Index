import { getDb, isDbConfigured } from "../index";
import { catalogTotalsCache } from "./cache";

export interface TrackTelemetryStats {
  track: {
    id?: string;
    name?: string;
    plays: number;
    rank: number | null; // null if 0 plays
    totalTracks: number;
  };
  artist: {
    name: string;
    plays: number;
    rank: number | null; // null if 0 plays
    totalArtists: number;
  };
}

/**
 * Computes telemetry stats for a track and artist from the personal archive plays ledger.
 * Returns play counts, leader rankings (1-based, null if 0 plays), and total unique counts.
 */
export async function getTrackTelemetryStats(params: {
  trackId?: string;
  title?: string;
  artist?: string;
}): Promise<TrackTelemetryStats> {
  const cleanTrackId = params.trackId?.trim() || undefined;
  const cleanTitle = params.title?.trim() || undefined;
  const cleanArtist = params.artist?.trim() || undefined;

  const defaultEmptyStats: TrackTelemetryStats = {
    track: {
      id: cleanTrackId,
      name: cleanTitle,
      plays: 0,
      rank: null,
      totalTracks: 0,
    },
    artist: {
      name: cleanArtist || "",
      plays: 0,
      rank: null,
      totalArtists: 0,
    },
  };

  if (process.env.FORCE_MOCK_DATA === "true") {
    return {
      track: {
        id: cleanTrackId,
        name: cleanTitle || "Weird Fishes / Arpeggi",
        plays: 42,
        rank: 14,
        totalTracks: 1400,
      },
      artist: {
        name: cleanArtist || "Radiohead",
        plays: 280,
        rank: 3,
        totalArtists: 600,
      },
    };
  }

  if (!isDbConfigured()) {
    return defaultEmptyStats;
  }

  try {
    const sql = getDb();

    // Query total distinct tracks and artists with 5-minute in-memory latch cache
    const totalsPromise = catalogTotalsCache.get(async () => {
      const rows = await sql`
        SELECT 
          COUNT(DISTINCT p.track_id)::int AS total_tracks,
          COUNT(DISTINCT t.artist_group_key)::int AS total_artists
        FROM plays p
        JOIN tracks t ON p.track_id = t.id
      `;
      return {
        totalTracks: Number(rows[0]?.total_tracks) || 0,
        totalArtists: Number(rows[0]?.total_artists) || 0,
      };
    });

    let resolvedTrackId: string | undefined = cleanTrackId;
    let resolvedTrackName: string | undefined = cleanTitle;
    let resolvedArtistName: string = cleanArtist || "";
    let resolvedArtistGroupKey: string | undefined = cleanArtist ? cleanArtist.trim().toLowerCase() : undefined;
    let trackPlays = 0;

    // 1. Look up track by trackId if provided
    if (cleanTrackId) {
      const trackRows = await sql`
        SELECT t.id, t.name, t.artist_name, t.artist_group_key, COUNT(p.id)::int AS plays
        FROM tracks t
        LEFT JOIN plays p ON p.track_id = t.id
        WHERE t.id = ${cleanTrackId}
        GROUP BY t.id, t.name, t.artist_name, t.artist_group_key
      `;
      if (trackRows.length > 0) {
        resolvedTrackId = trackRows[0].id;
        resolvedTrackName = trackRows[0].name ?? cleanTitle;
        trackPlays = Number(trackRows[0].plays) || 0;
        if (trackRows[0].artist_group_key) {
          resolvedArtistGroupKey = trackRows[0].artist_group_key;
          resolvedArtistName = trackRows[0].artist_name || resolvedArtistName;
        }
      }
    }

    // 2. Fallback to title and artist matching if trackId yielded 0 plays or was not found
    if (trackPlays === 0 && cleanTitle) {
      const fallbackRows = cleanArtist
        ? await sql`
            SELECT t.id, t.name, t.artist_name, t.artist_group_key, COUNT(p.id)::int AS plays
            FROM tracks t
            JOIN plays p ON p.track_id = t.id
            WHERE lower(trim(t.name)) = lower(trim(${cleanTitle}))
              AND t.artist_group_key = lower(trim(${cleanArtist}))
            GROUP BY t.id, t.name, t.artist_name, t.artist_group_key
            ORDER BY plays DESC
            LIMIT 1
          `
        : await sql`
            SELECT t.id, t.name, t.artist_name, t.artist_group_key, COUNT(p.id)::int AS plays
            FROM tracks t
            JOIN plays p ON p.track_id = t.id
            WHERE lower(trim(t.name)) = lower(trim(${cleanTitle}))
            GROUP BY t.id, t.name, t.artist_name, t.artist_group_key
            ORDER BY plays DESC
            LIMIT 1
          `;

      if (fallbackRows.length > 0 && Number(fallbackRows[0].plays) > 0) {
        resolvedTrackId = fallbackRows[0].id;
        resolvedTrackName = fallbackRows[0].name ?? cleanTitle;
        trackPlays = Number(fallbackRows[0].plays) || 0;
        if (fallbackRows[0].artist_group_key) {
          resolvedArtistGroupKey = fallbackRows[0].artist_group_key;
          resolvedArtistName = fallbackRows[0].artist_name || resolvedArtistName;
        }
      }
    }

    // 3. Look up artist plays by artist_group_key
    let artistPlays = 0;
    if (resolvedArtistGroupKey) {
      const artistRows = await sql`
        SELECT COUNT(p.id)::int AS plays
        FROM plays p
        JOIN tracks t ON p.track_id = t.id
        WHERE t.artist_group_key = ${resolvedArtistGroupKey}
      `;
      artistPlays = Number(artistRows[0]?.plays) || 0;
    }

    // 4. Compute rankings and resolve cached catalog totals concurrently
    const [trackRankRows, artistRankRows, totals] = await Promise.all([
      trackPlays > 0
        ? sql`
            SELECT COUNT(*)::int + 1 AS rank FROM (
              SELECT 1 FROM plays GROUP BY track_id HAVING COUNT(*) > ${trackPlays}
            ) sub
          `
        : Promise.resolve(null),
      artistPlays > 0 && resolvedArtistGroupKey
        ? sql`
            SELECT COUNT(*)::int + 1 AS rank FROM (
              SELECT 1 FROM plays p JOIN tracks t ON p.track_id = t.id 
              GROUP BY t.artist_group_key HAVING COUNT(*) > ${artistPlays}
            ) sub
          `
        : Promise.resolve(null),
      totalsPromise,
    ]);

    const trackRank =
      trackRankRows && trackRankRows.length > 0 ? Number(trackRankRows[0].rank) || null : null;
    const artistRank =
      artistRankRows && artistRankRows.length > 0 ? Number(artistRankRows[0].rank) || null : null;

    return {
      track: {
        id: resolvedTrackId,
        name: resolvedTrackName,
        plays: trackPlays,
        rank: trackRank,
        totalTracks: totals.totalTracks,
      },
      artist: {
        name: resolvedArtistName,
        plays: artistPlays,
        rank: artistRank,
        totalArtists: totals.totalArtists,
      },
    };
  } catch (error) {
    console.error("[getTrackTelemetryStats] DB query failed, falling back to empty stats:", error);
    return defaultEmptyStats;
  }
}
