/**
 * Spotify Extended Streaming History Parser & Filter
 *
 * Implements audio-only music filtering, play qualification threshold,
 * pre-normalized group keys, and timestamp normalization.
 */

export interface SpotifyAudioHistoryRecord {
  ts: string;
  platform?: string;
  ms_played: number;
  conn_country?: string;
  ip_addr?: string;
  master_metadata_track_name: string | null;
  master_metadata_album_artist_name: string | null;
  master_metadata_album_album_name: string | null;
  spotify_track_uri: string | null;
  episode_name?: string | null;
  episode_show_name?: string | null;
  spotify_episode_uri?: string | null;
  audiobook_title?: string | null;
  audiobook_uri?: string | null;
  audiobook_chapter_uri?: string | null;
  audiobook_chapter_title?: string | null;
  reason_start?: string | null;
  reason_end?: string | null;
  shuffle?: boolean | null;
  skipped?: boolean | null;
  offline?: boolean | null;
  offline_timestamp?: number | null;
  incognito_mode?: boolean | null;
}

export interface CompactPlayEvent {
  playedAt: string; // ISO 8601 truncated to second precision UTC
  msPlayed: number;
  trackId: string;
  trackName: string;
  artistName: string;
  albumName: string;
  artistGroupKey: string;
  albumGroupKey: string;
}

/**
 * Normalizes an entity name by trimming, lowercasing, and normalizing to Unicode NFC.
 */
export function normalizeName(str: string): string {
  return str.trim().toLowerCase().normalize("NFC");
}

export function makeArtistGroupKey(artistName: string): string {
  return normalizeName(artistName || "Unknown Artist");
}

export function makeAlbumGroupKey(artistName: string, albumName: string): string {
  return `${makeArtistGroupKey(artistName)}::${normalizeName(albumName || "Unknown Album")}`;
}

/**
 * Extracts the 22-character base62 Spotify Track ID from a URI.
 * Example: "spotify:track:6orDsQsMy7BaqGoRWw3fVN" -> "6orDsQsMy7BaqGoRWw3fVN"
 */
export function extractTrackId(uri?: string | null): string | null {
  if (!uri) return null;
  const trimmed = uri.trim();
  if (trimmed.startsWith("spotify:track:")) {
    const id = trimmed.slice("spotify:track:".length).trim();
    return id.length > 0 ? id : null;
  }
  const match = trimmed.match(/\/track\/([a-zA-Z0-9]{15,30})/);
  if (match) {
    return match[1];
  }
  return null;
}

/**
 * Truncates an ISO timestamp to whole seconds (UTC).
 * Ensures consistency between live sync millisecond timestamps and history export second timestamps.
 */
export function truncateToSeconds(ts: string | Date): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid timestamp: ${ts}`);
  }
  // Format as YYYY-MM-DDTHH:mm:ssZ
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Predicate to verify if an item is a pure music track (excluding podcasts, videos, and audiobooks).
 */
export function isAudioMusicTrack(item: SpotifyAudioHistoryRecord): boolean {
  // 1. Must have a valid Spotify track URI
  const trackId = extractTrackId(item.spotify_track_uri);
  if (!trackId) return false;

  // 2. Must have non-empty track title, artist name, and album name
  if (!item.master_metadata_track_name || item.master_metadata_track_name.trim().length === 0) {
    return false;
  }
  if (!item.master_metadata_album_artist_name || item.master_metadata_album_artist_name.trim().length === 0) {
    return false;
  }
  if (!item.master_metadata_album_album_name || item.master_metadata_album_album_name.trim().length === 0) {
    return false;
  }

  // 3. Must not be a podcast episode
  if (item.episode_name || item.episode_show_name || item.spotify_episode_uri) {
    return false;
  }

  // 4. Must not be an audiobook
  if (
    item.audiobook_title ||
    item.audiobook_uri ||
    item.audiobook_chapter_uri ||
    item.audiobook_chapter_title
  ) {
    return false;
  }

  return true;
}

/**
 * Predicate to verify if a play is qualified (play threshold).
 * Qualified if played for at least 30s, or at least 10s and played to natural completion.
 */
export function isQualifiedPlay(item: SpotifyAudioHistoryRecord): boolean {
  if (item.ms_played >= 30000) return true;
  if (item.ms_played >= 10000 && item.reason_end === "trackdone") return true;
  return false;
}

/**
 * Parses and converts raw Spotify history records into a clean array of qualified CompactPlayEvents.
 */
export function parseHistoryRecords(records: unknown[]): CompactPlayEvent[] {
  const results: CompactPlayEvent[] = [];

  for (const raw of records) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as SpotifyAudioHistoryRecord;

    if (!isAudioMusicTrack(item)) continue;
    if (!isQualifiedPlay(item)) continue;

    const trackId = extractTrackId(item.spotify_track_uri);
    if (!trackId) continue;

    try {
      const playedAt = truncateToSeconds(item.ts);
      const artistName = item.master_metadata_album_artist_name!.trim();
      const albumName = item.master_metadata_album_album_name!.trim();
      results.push({
        playedAt,
        msPlayed: Math.max(0, item.ms_played),
        trackId,
        trackName: item.master_metadata_track_name!.trim(),
        artistName,
        albumName,
        artistGroupKey: makeArtistGroupKey(artistName),
        albumGroupKey: makeAlbumGroupKey(artistName, albumName),
      });
    } catch {
      // Skip invalid timestamps
    }
  }

  return results;
}

export interface DebouncePlayItem {
  playedAt: string | Date;
  trackId: string;
  [key: string]: any;
}

/** Canonical domain alias: stream events prior to meeting the Play Threshold */
export type DebounceStreamEventItem = DebouncePlayItem;

/**
 * Filters out rapid duplicate stream events of the same track occurring within < cooldownMs (default: 30,000ms / 30s).
 *
 * Handles live Spotify Web API skips, reconnection loops, and player restart glitches
 * where Spotify emits multiple played_at events spaced seconds apart without ms_played duration.
 *
 * Algorithm:
 * 1. Sorts candidate events chronologically (oldest to newest).
 * 2. Compares each event against the preceding stream event for that track.
 * 3. Discards any stream event where elapsed time since the previous event is < cooldownMs (< 30s aborted listen).
 * 4. Accepts any stream event where delta >= cooldownMs and updates the observed timestamp.
 */
export function debouncePlays<T extends DebouncePlayItem>(
  plays: T[],
  cooldownMs: number = 30_000,
  initialLastSeen?: Map<string, number>
): { debounced: T[]; droppedCount: number } {
  if (plays.length === 0) {
    return { debounced: [], droppedCount: 0 };
  }

  // Sort chronologically ascending
  const sorted = [...plays].sort(
    (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
  );

  const lastSeen = new Map<string, number>(initialLastSeen);
  const debounced: T[] = [];
  let droppedCount = 0;

  for (const play of sorted) {
    const playTimeMs = new Date(play.playedAt).getTime();
    if (isNaN(playTimeMs)) {
      droppedCount++;
      continue;
    }

    const prevSeenMs = lastSeen.get(play.trackId);
    lastSeen.set(play.trackId, playTimeMs);

    if (prevSeenMs !== undefined && Math.abs(playTimeMs - prevSeenMs) < cooldownMs) {
      droppedCount++;
      continue;
    }

    debounced.push(play);
  }

  return { debounced, droppedCount };
}

/** Canonical domain alias for stream event debouncing */
export const debounceStreamEvents = debouncePlays;
