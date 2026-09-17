import { getDb } from "../index";
import { getLastSync } from "./ingestion";
import {
  getTimezone,
  sanitizeTimezone,
  formatDayGroupTz,
  formatHHmmTz,
  formatTimeTz,
  formatSittingAge,
  formatDurationMs,
  formatDurationHoursMinutes,
} from "./helpers";
import { getSwatchColor } from "@/lib/color-utils";
import type { SessionData } from "./types";
import type {
  SittingItem,
  PreviousSitting,
  SittingSession,
  SessionHistogramData,
  SessionHistogramBar,
} from "@/lib/mock-listening-data";

/**
 * Mode 3: Retrieves current listening session data and historical sittings bounded by 30-minute gap.
 */
export async function getCurrentSession(tzOverride?: string): Promise<SessionData> {
  const sql = getDb();
  const tz = sanitizeTimezone(tzOverride);

  interface SessionPlayRow {
    id: string;
    track_id: string;
    artist_id: string | null;
    album_id: string | null;
    played_at: string;
    title: string;
    artist: string;
    album: string;
    album_image_url: string | null;
    duration_ms: number;
    is_first_play: boolean;
  }

  const rawPlaysPromise = sql`
    WITH recent_plays AS (
      SELECT 
          p.id::text,
          p.played_at,
          p.track_id,
          t.artist_id,
          t.album_id,
          t.name AS title,
          COALESCE(ar.name, t.artist_name) AS artist,
          COALESCE(al.name, t.album_name) AS album,
          al.image_url AS album_image_url,
          t.duration_ms
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      LEFT JOIN albums al ON t.album_id = al.id
      LEFT JOIN artists ar ON t.artist_id = ar.id
      ORDER BY p.played_at DESC
      LIMIT 600
    ),
    first_plays AS (
      SELECT track_id, MIN(played_at) as min_played_at
      FROM plays
      WHERE track_id IN (SELECT DISTINCT track_id FROM recent_plays)
      GROUP BY track_id
    )
    SELECT rp.*, (rp.played_at = fp.min_played_at) AS is_first_play
    FROM recent_plays rp
    JOIN first_plays fp ON rp.track_id = fp.track_id
    ORDER BY rp.played_at DESC;
  `;
  const lastSyncPromise = getLastSync("spotify");

  const [rawPlaysResult, lastSync] = await Promise.all([
    rawPlaysPromise,
    lastSyncPromise,
  ]);
  const rawPlays: SessionPlayRow[] = rawPlaysResult as any;

  if (rawPlays.length === 0) {
    return {
      isOpen: false,
      tagTime: "--",
      metrics: ["0m", "0", "0", "--"],
      sittingTracks: [],
      previousSittings: [],
      sittings: [],
      sessions: [],
      histogram: {
        avgRuntimeMinutes: 0,
        oldestDate: "--",
        newestDate: "--",
        bars: [],
      },
    };
  }

  // Segment plays into sittings bounded by 30-minute gap
  const sittingsPlays: SessionPlayRow[][] = [];
  let currentSitting: SessionPlayRow[] = [];

  for (let i = 0; i < rawPlays.length; i++) {
    const play = rawPlays[i];
    currentSitting.push(play);

    const nextPlay = rawPlays[i + 1];
    if (nextPlay) {
      const currentMs = new Date(play.played_at).getTime();
      const nextMs = new Date(nextPlay.played_at).getTime();
      const gapMs = currentMs - nextMs;

      if (gapMs > 30 * 60 * 1000) {
        sittingsPlays.push(currentSitting);
        currentSitting = [];
      }
    } else {
      sittingsPlays.push(currentSitting);
      currentSitting = [];
    }
  }

  // Construct complete SittingSession[] objects
  const sittings: SittingSession[] = sittingsPlays.slice(0, 20).map((sittingPlays, k) => {
    const sittingLatest = sittingPlays[0];
    const sittingOldest = sittingPlays[sittingPlays.length - 1];
    const dateStr = formatDayGroupTz(new Date(sittingLatest.played_at), tz);

    let sRuntimeMs =
      new Date(sittingLatest.played_at).getTime() -
      new Date(sittingOldest.played_at).getTime();
    if (sRuntimeMs === 0 && sittingLatest.duration_ms) {
      sRuntimeMs = sittingLatest.duration_ms;
    }
    const runtimeStr = formatDurationHoursMinutes(sRuntimeMs);
    const runtimeMinutes = Math.max(1, Math.round(sRuntimeMs / 60000));
    const trackCount = sittingPlays.length;
    const uniqueArtistsCount = new Set(sittingPlays.map((p) => p.artist)).size;
    const startTime = formatHHmmTz(new Date(sittingOldest.played_at), tz);

    const isThisOpen =
      k === 0 &&
      Date.now() - new Date(sittingLatest.played_at).getTime() <= 30 * 60 * 1000;

    let tagTime = "--";
    if (k === 0 && isThisOpen) {
      tagTime = formatTimeTz(new Date(sittingLatest.played_at), tz);
    } else {
      const ageMs = Math.max(0, Date.now() - new Date(sittingLatest.played_at).getTime());
      tagTime = formatSittingAge(ageMs);
    }

    const tracks: SittingItem[] = sittingPlays.map((p, pIdx) => ({
      id: p.track_id,
      artistId: p.artist_id || undefined,
      albumId: p.album_id || undefined,
      albumImageUrl: p.album_image_url || null,
      timestamp: formatHHmmTz(new Date(p.played_at), tz),
      title: p.title,
      artist: p.artist,
      album: p.album,
      swatchColor: getSwatchColor(p.track_id + p.title),
      isActive: isThisOpen && pIdx === 0,
      isFirstPlay: Boolean(p.is_first_play),
      duration: formatDurationMs(p.duration_ms || 0),
    }));

    // Analysis
    const firstPlaysCount = sittingPlays.filter((p) => p.is_first_play).length;
    const songCounts = new Map<string, number>();
    for (const p of sittingPlays) {
      songCounts.set(p.title, (songCounts.get(p.title) || 0) + 1);
    }
    let maxSongCount = 0;
    for (const count of songCounts.values()) {
      if (count > maxSongCount) maxSongCount = count;
    }
    let topSong: { title: string; count: number } | null = null;
    if (sittingPlays.length > 0 && maxSongCount > 0) {
      const latestPlay = sittingPlays.find((p) => songCounts.get(p.title) === maxSongCount);
      if (latestPlay) {
        topSong = { title: latestPlay.title, count: maxSongCount };
      }
    }

    const albumCounts = new Map<string, number>();
    for (const p of sittingPlays) {
      if (p.album) {
        albumCounts.set(p.album, (albumCounts.get(p.album) || 0) + 1);
      }
    }
    let topAlbumEntry: [string, number] | null = null;
    for (const [album, count] of albumCounts.entries()) {
      if (!topAlbumEntry || count > topAlbumEntry[1]) {
        topAlbumEntry = [album, count];
      }
    }
    const topAlbum = topAlbumEntry
      ? { title: topAlbumEntry[0], count: topAlbumEntry[1] }
      : { title: "None", count: 0 };

    const artistCounts = new Map<string, number>();
    for (const p of sittingPlays) {
      if (p.artist) {
        artistCounts.set(p.artist, (artistCounts.get(p.artist) || 0) + 1);
      }
    }
    let topArtistEntry: [string, number] | null = null;
    for (const [artist, count] of artistCounts.entries()) {
      if (!topArtistEntry || count > topArtistEntry[1]) {
        topArtistEntry = [artist, count];
      }
    }
    const topArtist = topArtistEntry
      ? { name: topArtistEntry[0], count: topArtistEntry[1] }
      : { name: "None", count: 0 };

    return {
      id: `s${k + 1}`,
      dateStr,
      runtimeMinutes,
      runtimeStr,
      trackCount,
      uniqueArtistsCount,
      startTime,
      tagTime,
      isOpen: isThisOpen,
      tracks,
      analysis: {
        firstPlaysCount,
        totalTracks: trackCount,
        topSong,
        topAlbum,
        topArtist,
      },
    };
  });

  // Previous sittings matching s1..sN
  const previousSittings: PreviousSitting[] = sittings.map((s) => ({
    id: s.id,
    dateStr: s.dateStr,
    durationStr: s.runtimeStr,
    tracksCountStr: `${s.trackCount} ${s.trackCount === 1 ? "track" : "tracks"}`,
    runtimeMinutes: s.runtimeMinutes,
    trackCount: s.trackCount,
  }));

  // Histogram: last 20 sittings ordered chronologically (oldest to newest)
  const recentForHist = sittings.slice(0, 20);
  const chrono = [...recentForHist].reverse();
  const bars: SessionHistogramBar[] = chrono.map((s) => ({
    id: s.id,
    runtimeMinutes: s.runtimeMinutes,
    dateStr: s.dateStr,
    title: `${s.runtimeMinutes}m`,
  }));

  const runtimes = chrono.map((c) => c.runtimeMinutes);
  const avg =
    runtimes.length === 0
      ? 0
      : runtimes.reduce((a, b) => a + b, 0) / runtimes.length;
  const avgRuntimeMinutes = Math.round(avg);

  const oldestDate = chrono[0]?.dateStr || "--";
  const newestDate = chrono[chrono.length - 1]?.dateStr || "--";

  const histogram: SessionHistogramData = {
    avgRuntimeMinutes,
    oldestDate,
    newestDate,
    bars,
  };

  const activeSitting = sittings[0];
  const isOpen = activeSitting ? activeSitting.isOpen : false;
  const tagTime = activeSitting ? activeSitting.tagTime || "--" : "--";
  const metrics: [string, string, string, string] = activeSitting
    ? [
        activeSitting.runtimeStr,
        String(activeSitting.trackCount),
        String(activeSitting.uniqueArtistsCount),
        activeSitting.startTime,
      ]
    : ["0m", "0", "0", "--"];
  const sittingTracks: SittingItem[] = activeSitting ? activeSitting.tracks : [];

  return {
    isOpen,
    tagTime,
    metrics,
    sittingTracks,
    previousSittings,
    sittings,
    sessions: sittings,
    histogram,
    lastSyncedAt: lastSync ?? (rawPlays[0]
      ? new Date(rawPlays[0].played_at).toISOString()
      : undefined),
  };
}
