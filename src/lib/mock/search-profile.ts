import type { RangeKey } from "@/lib/types";
import {
  DEFAULT_SEARCH_SORT,
  SEARCH_SIDE_ROWS,
  SEARCH_TRACK_ROWS,
  type SearchSort,
  PROFILE_ALBUM_TRACKS_LIMIT,
  PROFILE_ALBUM_PROFILE_TRACKS_LIMIT,
  PROFILE_RECENT_PLAYS_LIMIT,
  PROFILE_TOP_TRACKS_LIMIT,
  PROFILE_TOP_ALBUMS_LIMIT,
  type ProfileAlbumTrack,
  type ProfileData,
  type ProfilePlay,
  type ProfileTarget,
  type ProfileTopAlbum,
  type ProfileTopTrack,
  type SearchAlbumResult,
  type SearchArtistResult,
  type SearchResponse,
  type SearchTrackResult,
} from "@/lib/search-types";
import { artistShare, hourHistogram, longestStreak } from "@/lib/profile-stats";
import { normalizeForSearch } from "@/lib/search-utils";
import { planSideColumn } from "@/lib/search-layout";
import { CATALOG } from "./catalog";
import { ALL_MOCK_STREAM_LOG_ENTRIES } from "./stream-log";
import { buildProfileCadence } from "@/lib/db/queries/cadence";
import { OVERVIEW_INTERVAL_CONFIG } from "@/lib/db/queries/overview";
import { sanitizeTimezone } from "@/lib/db/queries/helpers";

interface NormalizedMockPlay {
  id: string;
  trackId: string;
  playedAt: string;
  title: string;
  artist: string;
  artistId: string;
  album: string;
  albumId?: string;
  durationMs: number;
  albumImageUrl: string | null;
}

interface DerivedMockTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumImageUrl: string | null;
  lifetimePlays: number;
  firstPlayedAt: string;
  lastPlayedAt: string;
}

interface DerivedMockArtist {
  key: string;
  name: string;
  lifetimePlays: number;
  imageUrl: string | null;
  firstPlayedAt: string;
  lastPlayedAt: string;
}

interface DerivedMockAlbum {
  key: string;
  name: string;
  artist: string;
  artistId: string;
  lifetimePlays: number;
  imageUrl: string | null;
  firstPlayedAt: string;
  lastPlayedAt: string;
}

function getMockAlbumKey(play: { artist: string; album: string; albumId?: string }): string {
  return play.albumId || `${play.artist.toLowerCase().trim()}::${play.album.toLowerCase().trim()}`;
}

const CATALOG_ENTRIES = Object.values(CATALOG);

function normalizeMockPlays(): NormalizedMockPlay[] {
  return ALL_MOCK_STREAM_LOG_ENTRIES.map((entry) => {
    const catalogItem = CATALOG_ENTRIES.find(
      (c) => c.id === entry.trackId || (c.name === entry.title && c.artist === entry.artist)
    );
    const trackId = entry.trackId ?? catalogItem?.id ?? entry.id;
    const artistId = entry.artistId ?? catalogItem?.artistId ?? "";
    const albumId = entry.albumId ?? catalogItem?.albumId;
    const albumImageUrl = entry.albumImageUrl ?? catalogItem?.albumImageUrl ?? null;

    return {
      id: entry.id,
      trackId,
      playedAt: entry.playedAt,
      title: entry.title,
      artist: entry.artist,
      artistId,
      album: entry.album,
      albumId,
      durationMs: entry.durationMs,
      albumImageUrl,
    };
  });
}

const NORMALIZED_PLAYS: NormalizedMockPlay[] = normalizeMockPlays();

const GLOBAL_TIMESTAMPS = NORMALIZED_PLAYS.map((p) => new Date(p.playedAt).getTime());
const GLOBAL_MAX_MS = Math.max(...GLOBAL_TIMESTAMPS);

// Anchor now at the newest mock playedAt + 1 minute.
const ANCHOR_NOW = new Date(GLOBAL_MAX_MS + 60 * 1000);

function deriveUniqueTracks(plays: NormalizedMockPlay[]): Map<string, DerivedMockTrack> {
  const tracks = new Map<string, DerivedMockTrack>();

  for (const play of plays) {
    const existing = tracks.get(play.trackId);
    if (!existing) {
      tracks.set(play.trackId, {
        id: play.trackId,
        name: play.title,
        artist: play.artist,
        album: play.album,
        albumImageUrl: play.albumImageUrl,
        lifetimePlays: 1,
        firstPlayedAt: play.playedAt,
        lastPlayedAt: play.playedAt,
      });
      continue;
    }

    existing.lifetimePlays += 1;
    if (new Date(play.playedAt).getTime() < new Date(existing.firstPlayedAt).getTime()) {
      existing.firstPlayedAt = play.playedAt;
    }
    if (new Date(play.playedAt).getTime() > new Date(existing.lastPlayedAt).getTime()) {
      existing.lastPlayedAt = play.playedAt;
    }
    if (!existing.albumImageUrl && play.albumImageUrl) {
      existing.albumImageUrl = play.albumImageUrl;
    }
  }

  return tracks;
}

function deriveUniqueArtists(plays: NormalizedMockPlay[]): Map<string, DerivedMockArtist> {
  const artists = new Map<
    string,
    {
      key: string;
      name: string;
      lifetimePlays: number;
      firstPlayedAt: string;
      lastPlayedAt: string;
      albumCounts: Map<string, { name: string; count: number; imageUrl: string | null }>;
    }
  >();

  for (const play of plays) {
    let artistEntry = artists.get(play.artistId);
    if (!artistEntry) {
      artistEntry = {
        key: play.artistId,
        name: play.artist,
        lifetimePlays: 0,
        firstPlayedAt: play.playedAt,
        lastPlayedAt: play.playedAt,
        albumCounts: new Map(),
      };
      artists.set(play.artistId, artistEntry);
    }

    artistEntry.lifetimePlays += 1;
    if (new Date(play.playedAt).getTime() < new Date(artistEntry.firstPlayedAt).getTime()) {
      artistEntry.firstPlayedAt = play.playedAt;
    }
    if (new Date(play.playedAt).getTime() > new Date(artistEntry.lastPlayedAt).getTime()) {
      artistEntry.lastPlayedAt = play.playedAt;
    }

    const albumKey = getMockAlbumKey(play);
    const albumRecord = artistEntry.albumCounts.get(albumKey) ?? {
      name: play.album,
      count: 0,
      imageUrl: play.albumImageUrl,
    };
    albumRecord.count += 1;
    if (!albumRecord.imageUrl && play.albumImageUrl) {
      albumRecord.imageUrl = play.albumImageUrl;
    }
    artistEntry.albumCounts.set(albumKey, albumRecord);
  }

  const result = new Map<string, DerivedMockArtist>();
  for (const [artistId, entry] of artists.entries()) {
    const sortedAlbums = [...entry.albumCounts.values()].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
    const mostPlayedAlbum = sortedAlbums[0];

    result.set(artistId, {
      key: entry.key,
      name: entry.name,
      lifetimePlays: entry.lifetimePlays,
      imageUrl: mostPlayedAlbum?.imageUrl ?? null,
      firstPlayedAt: entry.firstPlayedAt,
      lastPlayedAt: entry.lastPlayedAt,
    });
  }

  return result;
}

function deriveUniqueAlbums(plays: NormalizedMockPlay[]): Map<string, DerivedMockAlbum> {
  const albums = new Map<string, DerivedMockAlbum>();

  for (const play of plays) {
    const key = getMockAlbumKey(play);
    let albumEntry = albums.get(key);
    if (!albumEntry) {
      albumEntry = {
        key,
        name: play.album,
        artist: play.artist,
        artistId: play.artistId,
        lifetimePlays: 0,
        imageUrl: play.albumImageUrl ?? null,
        firstPlayedAt: play.playedAt,
        lastPlayedAt: play.playedAt,
      };
      albums.set(key, albumEntry);
    }

    albumEntry.lifetimePlays += 1;
    if (new Date(play.playedAt).getTime() < new Date(albumEntry.firstPlayedAt).getTime()) {
      albumEntry.firstPlayedAt = play.playedAt;
    }
    if (new Date(play.playedAt).getTime() > new Date(albumEntry.lastPlayedAt).getTime()) {
      albumEntry.lastPlayedAt = play.playedAt;
    }
    if (!albumEntry.imageUrl && play.albumImageUrl) {
      albumEntry.imageUrl = play.albumImageUrl;
    }
  }

  return albums;
}

const UNIQUE_TRACKS: Map<string, DerivedMockTrack> = deriveUniqueTracks(NORMALIZED_PLAYS);
const UNIQUE_ARTISTS: Map<string, DerivedMockArtist> = deriveUniqueArtists(NORMALIZED_PLAYS);
const UNIQUE_ALBUMS: Map<string, DerivedMockAlbum> = deriveUniqueAlbums(NORMALIZED_PLAYS);

export function getMockSearch(
  query: string,
  sort: SearchSort = DEFAULT_SEARCH_SORT,
  page = 1,
): SearchResponse {
  const trimmed = query.trim();
  const normalizedQuery = normalizeForSearch(trimmed);
  const trackOffset = (page - 1) * SEARCH_TRACK_ROWS;
  const matches = (value: string) => normalizeForSearch(value).includes(normalizedQuery);

  function compare(
    a: DerivedMockTrack | DerivedMockArtist | DerivedMockAlbum,
    b: DerivedMockTrack | DerivedMockArtist | DerivedMockAlbum,
  ) {
    const recency = Date.parse(b.lastPlayedAt) - Date.parse(a.lastPlayedAt);
    const order = {
      "most-plays": b.lifetimePlays - a.lifetimePlays,
      "least-plays": a.lifetimePlays - b.lifetimePlays,
      recent: recency,
      oldest: -recency,
    }[sort];
    const aKey = "id" in a ? a.id : a.key;
    const bKey = "id" in b ? b.id : b.key;
    return order || a.name.localeCompare(b.name) || aKey.localeCompare(bKey);
  }

  const matchedArtists = [...UNIQUE_ARTISTS.values()]
    .filter((artist) => matches(artist.name))
    .sort(compare);
  const matchedAlbums = [...UNIQUE_ALBUMS.values()]
    .filter((album) => matches(album.name))
    .sort(compare);
  const matchedTracks = [...UNIQUE_TRACKS.values()]
    .filter((track) => matches(track.name) || matches(track.artist))
    .sort(compare);

  const artistTotal = matchedArtists.length;
  const albumTotal = matchedAlbums.length;

  const { artistOffset, artistLimit, albumOffset, albumLimit } = planSideColumn({
    artistTotal,
    albumTotal,
    sideRows: SEARCH_SIDE_ROWS,
    page,
  });

  const artists: SearchArtistResult[] = matchedArtists
    .slice(artistOffset, artistOffset + artistLimit)
    .map((artist) => ({
      key: artist.key,
      name: artist.name,
      plays: artist.lifetimePlays,
      imageUrl: artist.imageUrl,
    }));
  const albums: SearchAlbumResult[] = matchedAlbums
    .slice(albumOffset, albumOffset + albumLimit)
    .map((album) => ({
      key: album.key,
      name: album.name,
      artist: album.artist,
      plays: album.lifetimePlays,
      imageUrl: album.imageUrl,
    }));
  const tracks: SearchTrackResult[] = matchedTracks
    .slice(trackOffset, trackOffset + SEARCH_TRACK_ROWS)
    .map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artist,
      album: track.album,
      plays: track.lifetimePlays,
      albumImageUrl: track.albumImageUrl,
    }));

  return {
    query: trimmed,
    artists,
    albums,
    tracks,
    hasMore:
      trackOffset + SEARCH_TRACK_ROWS < matchedTracks.length ||
      artistOffset + artistLimit < artistTotal ||
      albumOffset + albumLimit < albumTotal,
  };
}

function getWindowCutoff(range: RangeKey, now: Date): number | null {
  if (range === "all") return null;
  const days = OVERVIEW_INTERVAL_CONFIG[range].elapsedDays;
  return now.getTime() - days * 86400000;
}

function filterPlaysInRange(plays: NormalizedMockPlay[], cutoffMs: number | null): NormalizedMockPlay[] {
  if (cutoffMs === null) return plays;
  return plays.filter((p) => new Date(p.playedAt).getTime() >= cutoffMs);
}

function computeCadenceRows(
  targetPlays: NormalizedMockPlay[],
  range: RangeKey,
  tz: string,
  now: Date
): Record<string, unknown>[] {
  const nowMs = now.getTime();
  let filtered = targetPlays;

  if (range === "1d") {
    filtered = targetPlays.filter((p) => new Date(p.playedAt).getTime() >= nowMs - 24 * 3600000);
  } else if (range === "1w") {
    filtered = targetPlays.filter((p) => new Date(p.playedAt).getTime() >= nowMs - 7 * 86400000);
  } else if (range === "1m") {
    filtered = targetPlays.filter((p) => new Date(p.playedAt).getTime() >= nowMs - 30 * 86400000);
  } else if (range === "6m") {
    filtered = targetPlays.filter((p) => new Date(p.playedAt).getTime() >= nowMs - 180 * 86400000);
  } else if (range === "1y") {
    filtered = targetPlays.filter((p) => new Date(p.playedAt).getTime() >= nowMs - 365 * 86400000);
  }

  const counts = new Map<string, number>();
  const blockEntries = new Map<string, { day: string; block: number; count: number }>();

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });

  for (const p of filtered) {
    const parts = formatter.formatToParts(new Date(p.playedAt));
    const m = Object.fromEntries(parts.map((pt) => [pt.type, pt.value]));

    if (range === "1d") {
      // Same UTC hour key as the SQL: 'YYYY-MM-DD"T"HH24:00:00"Z"'.
      const key = new Date(p.playedAt).toISOString().slice(0, 13) + ":00:00Z";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    } else if (range === "1w") {
      const day = `${m.year}-${m.month}-${m.day}`;
      const block = Math.floor(Number(m.hour) / 6);
      const key = `${day}_${block}`;
      const existing = blockEntries.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        blockEntries.set(key, { day, block, count: 1 });
      }
    } else if (range === "1m" || range === "6m") {
      const day = `${m.year}-${m.month}-${m.day}`;
      counts.set(day, (counts.get(day) ?? 0) + 1);
    } else {
      const ym = `${m.year}-${m.month}`;
      counts.set(ym, (counts.get(ym) ?? 0) + 1);
    }
  }

  if (range === "1d") {
    return [...counts.entries()].map(([hour_key, count]) => ({ hour_key, count }));
  }
  if (range === "1w") {
    return [...blockEntries.values()];
  }
  if (range === "1m" || range === "6m") {
    return [...counts.entries()].map(([day, count]) => ({ day, count }));
  }
  return [...counts.entries()].map(([ym, count]) => ({ ym, count }));
}

function getLocalPlayTimes(plays: NormalizedMockPlay[], timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  return plays.map(({ playedAt }) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(playedAt))
      .map(({ type, value }) => [type, value]));
    return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
  });
}

export function getMockProfile(target: ProfileTarget, range: RangeKey, tz: string): ProfileData | null {
  if (!target || (target.kind !== "track" && target.kind !== "artist" && target.kind !== "album")) {
    return null;
  }

  const effectiveTz = sanitizeTimezone(tz);
  const now = ANCHOR_NOW;
  const cutoffMs = getWindowCutoff(range, now);
  const allInRangePlays = filterPlaysInRange(NORMALIZED_PLAYS, cutoffMs);

  if (target.kind === "track") {
    const track = UNIQUE_TRACKS.get(target.key);
    if (!track) return null;

    const targetLifetimePlays = NORMALIZED_PLAYS.filter((p) => p.trackId === target.key);
    const targetInRangePlays = filterPlaysInRange(targetLifetimePlays, cutoffMs);
    const inRangePlayCount = targetInRangePlays.length;

    // Track ranking uses DENSE_RANK over in-range plays
    const trackCounts = new Map<string, number>();
    for (const p of allInRangePlays) {
      trackCounts.set(p.trackId, (trackCounts.get(p.trackId) ?? 0) + 1);
    }
    const rankedTotal = trackCounts.size;

    let rank: number | null = null;
    if (inRangePlayCount > 0) {
      const distinctCountsDesc = [...new Set(trackCounts.values())].sort((a, b) => b - a);
      const denseRankIndex = distinctCountsDesc.indexOf(inRangePlayCount);
      rank = denseRankIndex >= 0 ? denseRankIndex + 1 : null;
    }

    const cadenceRows = computeCadenceRows(targetLifetimePlays, range, effectiveTz, now);
    const cadence = buildProfileCadence({
      range,
      tz: effectiveTz,
      now,
      cadenceRows,
      minDateRow: { log_start_date: track.firstPlayedAt },
    });

    const recentPlays: ProfilePlay[] = targetInRangePlays
      .slice()
      .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
      .slice(0, PROFILE_RECENT_PLAYS_LIMIT)
      .map((p) => ({
        id: p.id,
        trackId: p.trackId,
        playedAt: p.playedAt,
        title: p.title,
        artist: p.artist,
        album: p.album,
        durationMs: p.durationMs,
        albumImageUrl: p.albumImageUrl,
      }));

    const { artistId, albumId, album } = targetLifetimePlays[0];
    const localTimes = getLocalPlayTimes(targetInRangePlays, effectiveTz);

    let artistPlays = 0;
    const albumCounts = new Map<string, ProfileAlbumTrack>();
    for (const play of allInRangePlays) {
      const sameArtist = Boolean(artistId) && play.artistId === artistId;
      if (sameArtist) artistPlays += 1;
      const sameAlbum = albumId ? play.albumId === albumId : sameArtist && play.album === album;
      if (!sameAlbum) continue;

      const row = albumCounts.get(play.trackId);
      if (row) {
        row.plays += 1;
      } else {
        albumCounts.set(play.trackId, {
          id: play.trackId,
          name: play.title,
          plays: 1,
          isCurrent: play.trackId === track.id,
        });
      }
    }
    const albumTracks = [...albumCounts.values()]
      .sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .slice(0, PROFILE_ALBUM_TRACKS_LIMIT);

    return {
      kind: "track",
      key: track.id,
      name: track.name,
      artistName: track.artist,
      albumName: track.album,
      imageUrl: track.albumImageUrl,
      range,
      firstPlayedAt: track.firstPlayedAt,
      lastPlayedAt: track.lastPlayedAt,
      plays: inRangePlayCount,
      rank,
      rankedTotal,
      ...cadence,
      artistKey: artistId || undefined,
      albumKey: getMockAlbumKey(targetLifetimePlays[0]),
      trackStats: {
        artistShare: artistShare(inRangePlayCount, artistPlays),
        artistPlays,
        longestStreakDays: longestStreak(localTimes.map(({ day }) => day)),
      },
      hourOfDay: hourHistogram(localTimes.map(({ hour }) => hour)),
      albumTracks,
      topTracks: [],
      topAlbums: [],
      recentPlays,
    };
  }

  if (target.kind === "album") {
    const album = UNIQUE_ALBUMS.get(target.key);
    if (!album) return null;

    const albumLifetimePlays = NORMALIZED_PLAYS.filter((p) => getMockAlbumKey(p) === target.key);

    const albumInRangePlays = filterPlaysInRange(albumLifetimePlays, cutoffMs);
    const albumInRangePlayCount = albumInRangePlays.length;

    // Album ranking uses row order (plays DESC, name ASC, key ASC) over in-range plays
    const albumCounts = new Map<string, { key: string; name: string; count: number }>();
    for (const p of allInRangePlays) {
      const key = getMockAlbumKey(p);
      const existing = albumCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        albumCounts.set(key, { key, name: p.album, count: 1 });
      }
    }
    const albumRankedTotal = albumCounts.size;

    let albumRank: number | null = null;
    if (albumInRangePlayCount > 0) {
      const sortedAlbums = [...albumCounts.values()].sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name) || a.key.localeCompare(b.key);
      });
      const albumIndex = sortedAlbums.findIndex((a) => a.key === target.key);
      albumRank = albumIndex >= 0 ? albumIndex + 1 : null;
    }

    const albumCadenceRows = computeCadenceRows(albumLifetimePlays, range, effectiveTz, now);
    const albumCadence = buildProfileCadence({
      range,
      tz: effectiveTz,
      now,
      cadenceRows: albumCadenceRows,
      minDateRow: { log_start_date: album.firstPlayedAt },
    });

    const albumRecentPlays: ProfilePlay[] = albumInRangePlays
      .slice()
      .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
      .slice(0, PROFILE_RECENT_PLAYS_LIMIT)
      .map((p) => ({
        id: p.id,
        trackId: p.trackId,
        playedAt: p.playedAt,
        title: p.title,
        artist: p.artist,
        album: p.album,
        durationMs: p.durationMs,
        albumImageUrl: p.albumImageUrl,
      }));

    const albumTrackAggregates = new Map<
      string,
      { id: string; name: string; plays: number; albumImageUrl: string | null }
    >();
    for (const p of albumInRangePlays) {
      const existing = albumTrackAggregates.get(p.trackId);
      if (existing) {
        existing.plays += 1;
        if (!existing.albumImageUrl && p.albumImageUrl) {
          existing.albumImageUrl = p.albumImageUrl;
        }
      } else {
        albumTrackAggregates.set(p.trackId, {
          id: p.trackId,
          name: p.title,
          plays: 1,
          albumImageUrl: p.albumImageUrl,
        });
      }
    }

    const albumTopTracks: ProfileTopTrack[] = [...albumTrackAggregates.values()]
      .sort((a, b) => {
        if (b.plays !== a.plays) return b.plays - a.plays;
        return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
      })
      .slice(0, PROFILE_ALBUM_PROFILE_TRACKS_LIMIT);

    const albumLocalTimes = getLocalPlayTimes(albumInRangePlays, effectiveTz);

    return {
      kind: "album",
      key: album.key,
      name: album.name,
      artistName: album.artist,
      albumName: null,
      imageUrl: album.imageUrl,
      range,
      firstPlayedAt: album.firstPlayedAt,
      lastPlayedAt: album.lastPlayedAt,
      plays: albumInRangePlayCount,
      rank: albumRank,
      rankedTotal: albumRankedTotal,
      ...albumCadence,
      artistKey: album.artistId || undefined,
      hourOfDay: hourHistogram(albumLocalTimes.map(({ hour }) => hour)),
      topTracks: albumTopTracks,
      topAlbums: [],
      recentPlays: albumRecentPlays,
    };
  }

  const artist = UNIQUE_ARTISTS.get(target.key);
  if (!artist) return null;

  const targetLifetimePlays = NORMALIZED_PLAYS.filter((p) => p.artistId === target.key);
  const targetInRangePlays = filterPlaysInRange(targetLifetimePlays, cutoffMs);
  const inRangePlayCount = targetInRangePlays.length;

  // Artist ranking uses row order (plays DESC, name ASC) over in-range plays
  const artistCounts = new Map<string, { id: string; name: string; count: number }>();
  for (const p of allInRangePlays) {
    const existing = artistCounts.get(p.artistId);
    if (existing) {
      existing.count += 1;
    } else {
      artistCounts.set(p.artistId, { id: p.artistId, name: p.artist, count: 1 });
    }
  }
  const rankedTotal = artistCounts.size;

  let rank: number | null = null;
  if (inRangePlayCount > 0) {
    const sortedArtists = [...artistCounts.values()].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
    const artistIndex = sortedArtists.findIndex((a) => a.id === target.key);
    rank = artistIndex >= 0 ? artistIndex + 1 : null;
  }

  const cadenceRows = computeCadenceRows(targetLifetimePlays, range, effectiveTz, now);
  const cadence = buildProfileCadence({
    range,
    tz: effectiveTz,
    now,
    cadenceRows,
    minDateRow: { log_start_date: artist.firstPlayedAt },
  });

  const recentPlays: ProfilePlay[] = targetInRangePlays
    .slice()
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
    .slice(0, PROFILE_RECENT_PLAYS_LIMIT)
    .map((p) => ({
      id: p.id,
      trackId: p.trackId,
      playedAt: p.playedAt,
      title: p.title,
      artist: p.artist,
      album: p.album,
      durationMs: p.durationMs,
      albumImageUrl: p.albumImageUrl,
    }));

  const trackAggregates = new Map<string, { id: string; name: string; plays: number; albumImageUrl: string | null }>();
  for (const p of targetInRangePlays) {
    const existing = trackAggregates.get(p.trackId);
    if (existing) {
      existing.plays += 1;
      if (!existing.albumImageUrl && p.albumImageUrl) {
        existing.albumImageUrl = p.albumImageUrl;
      }
    } else {
      trackAggregates.set(p.trackId, {
        id: p.trackId,
        name: p.title,
        plays: 1,
        albumImageUrl: p.albumImageUrl,
      });
    }
  }

  const topTracks: ProfileTopTrack[] = [...trackAggregates.values()]
    .sort((a, b) => {
      if (b.plays !== a.plays) return b.plays - a.plays;
      return a.name.localeCompare(b.name);
    })
    .slice(0, PROFILE_TOP_TRACKS_LIMIT);

  const albumAggregates = new Map<
    string,
    { id?: string; key: string; name: string; plays: number; imageUrl: string | null }
  >();
  for (const p of targetInRangePlays) {
    const albumKey = getMockAlbumKey(p);
    const existing = albumAggregates.get(albumKey);
    if (existing) {
      existing.plays += 1;
      if (!existing.imageUrl && p.albumImageUrl) {
        existing.imageUrl = p.albumImageUrl;
      }
    } else {
      albumAggregates.set(albumKey, {
        id: p.albumId,
        key: albumKey,
        name: p.album,
        plays: 1,
        imageUrl: p.albumImageUrl,
      });
    }
  }

  const topAlbums: ProfileTopAlbum[] = [...albumAggregates.values()]
    .sort((a, b) => {
      if (b.plays !== a.plays) return b.plays - a.plays;
      return a.name.localeCompare(b.name) || a.key.localeCompare(b.key);
    })
    .slice(0, PROFILE_TOP_ALBUMS_LIMIT)
    .map((a) => ({
      id: a.id,
      key: a.key,
      name: a.name,
      plays: a.plays,
      imageUrl: a.imageUrl,
    }));

  return {
    kind: "artist",
    key: artist.key,
    name: artist.name,
    artistName: null,
    albumName: null,
    imageUrl: artist.imageUrl,
    range,
    firstPlayedAt: artist.firstPlayedAt,
    lastPlayedAt: artist.lastPlayedAt,
    plays: inRangePlayCount,
    rank,
    rankedTotal,
    ...cadence,
    hourOfDay: hourHistogram(getLocalPlayTimes(targetInRangePlays, effectiveTz).map(({ hour }) => hour)),
    topTracks,
    topAlbums,
    recentPlays,
  };
}
