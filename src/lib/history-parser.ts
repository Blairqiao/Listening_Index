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

  // 2. Must have a non-empty track title
  if (!item.master_metadata_track_name || item.master_metadata_track_name.trim().length === 0) {
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
      const artistName = (item.master_metadata_album_artist_name || "Unknown Artist").trim();
      const albumName = (item.master_metadata_album_album_name || "Unknown Album").trim();
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
