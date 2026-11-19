import type { ActivityBucket, RangeKey } from "@/lib/types";

export const SEARCH_RESULT_LIMIT = 8;
export const SEARCH_SORT_OPTIONS = [
  { value: "most-plays", label: "Most plays" },
  { value: "least-plays", label: "Least plays" },
  { value: "recent", label: "Most recent" },
  { value: "oldest", label: "Least recent" },
] as const;
export type SearchSort = (typeof SEARCH_SORT_OPTIONS)[number]["value"];
export const DEFAULT_SEARCH_SORT: SearchSort = "most-plays";

export const SEARCH_MAX_CHARS = 100;
export const DEFAULT_PROFILE_RANGE: RangeKey = "1y";
export const PROFILE_RECENT_PLAYS_LIMIT = 20;
export const PROFILE_ALBUM_TRACKS_LIMIT = 10;
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
  artists: SearchArtistResult[];
  tracks: SearchTrackResult[];
  hasMore: boolean;
}

export type ProfileKind = "track" | "artist";
export interface ProfileTarget { kind: ProfileKind; key: string; }

export interface ProfileTopTrack { id: string; name: string; plays: number; albumImageUrl: string | null; }
export interface ProfileTopAlbum { id?: string; name: string; plays: number; imageUrl: string | null; }
export interface ProfilePlay {
  id: string; trackId: string; playedAt: string; // ISO
  title: string; artist: string; album: string; durationMs: number; albumImageUrl: string | null;
}

export interface ProfileAlbumTrack {
  id: string;
  name: string;
  plays: number;
  isCurrent: boolean;
}

export interface ProfileTrackStats {
  artistShare: number | null;
  artistPlays: number;
  longestStreakDays: number;
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
  monthlyCadence?: ActivityBucket[];
  artistKey?: string;
  trackStats?: ProfileTrackStats; // track profiles only
  hourOfDay?: number[]; // 24 counts indexed by local hour
  albumTracks?: ProfileAlbumTrack[]; // track profiles only, ranked in range
  topTracks: ProfileTopTrack[]; // artist profiles only (≤ 10, in range). [] for tracks
  topAlbums: ProfileTopAlbum[]; // artist profiles only (≤ 5, in range). [] for tracks
  recentPlays: ProfilePlay[];   // in range, newest first, ≤ 20
}
