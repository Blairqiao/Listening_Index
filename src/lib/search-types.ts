import type { ActivityBucket, RangeKey } from "@/lib/types";

export const SEARCH_RESULT_LIMIT = 8;
export const SEARCH_MAX_CHARS = 100;
export const PROFILE_RECENT_PLAYS_LIMIT = 20;
export const PROFILE_TOP_TRACKS_LIMIT = 10;
export const PROFILE_TOP_ALBUMS_LIMIT = 5;

export interface SearchArtistResult {
  key: string;             // artist_id when the catalog is fully enriched, else artist_group_key
  name: string;
  plays: number;           // lifetime plays
  imageUrl: string | null; // image of the artist's most-played album, if any
}

export interface SearchTrackResult {
  id: string;
  name: string;
  artist: string;
  album: string;
  plays: number;           // lifetime plays
  albumImageUrl: string | null;
}

export interface SearchResponse {
  query: string;           // the trimmed query that was searched
  artists: SearchArtistResult[]; // ≤ 8, plays DESC, name ASC
  tracks: SearchTrackResult[];   // ≤ 8, plays DESC, name ASC
}

export type ProfileKind = "track" | "artist";
export interface ProfileTarget { kind: ProfileKind; key: string; }

export interface ProfileTopTrack { id: string; name: string; plays: number; albumImageUrl: string | null; }
export interface ProfileTopAlbum { id?: string; name: string; plays: number; imageUrl: string | null; }
export interface ProfilePlay {
  id: string; trackId: string; playedAt: string; // ISO
  title: string; artist: string; album: string; durationMs: number; albumImageUrl: string | null;
}

export interface ProfileData {
  kind: ProfileKind;
  key: string;                 // canonical: track id, or artist key in the active identity form
  name: string;                // track title or artist name
  artistName: string | null;   // track profiles: the track's artist. Artist profiles: null
  albumName: string | null;    // track profiles only
  imageUrl: string | null;
  range: RangeKey;
  firstPlayedAt: string | null; // lifetime, ISO
  lastPlayedAt: string | null;  // lifetime, ISO
  plays: number;               // in range
  rank: number | null;         // in range. null when plays = 0
  rankedTotal: number;         // tracks (or artists) with ≥ 1 play in range
  activityCadence: ActivityBucket[];
  topTracks: ProfileTopTrack[]; // artist profiles only (≤ 10, in range). [] for tracks
  topAlbums: ProfileTopAlbum[]; // artist profiles only (≤ 5, in range). [] for tracks
  recentPlays: ProfilePlay[];   // in range, newest first, ≤ 20
}
