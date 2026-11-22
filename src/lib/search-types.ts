import type { ActivityBucket, RangeKey } from "@/lib/types";

export const SEARCH_RESULT_LIMIT = 8;
export const SEARCH_TRACK_ROWS = SEARCH_RESULT_LIMIT;
export const SEARCH_SIDE_ROWS = SEARCH_TRACK_ROWS - 1; // The Albums heading takes one row.
export const SEARCH_SINGLE_TYPE_ROWS = 16;

export const SEARCH_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "tracks", label: "Tracks" },
  { value: "artists", label: "Artists" },
  { value: "albums", label: "Albums" },
] as const;
export type SearchFilter = (typeof SEARCH_FILTER_OPTIONS)[number]["value"];
export const DEFAULT_SEARCH_FILTER: SearchFilter = "all";

export const SEARCH_SORT_OPTIONS = [
  { value: "most-plays", label: "Most plays" },
  { value: "least-plays", label: "Least plays" },
  { value: "recent", label: "Most recent" },
  { value: "oldest", label: "Least recent" },
] as const;
export type SearchSort = (typeof SEARCH_SORT_OPTIONS)[number]["value"];
export const DEFAULT_SEARCH_SORT: SearchSort = "most-plays";

export const SEARCH_MAX_CHARS = 100;
export const DEFAULT_PROFILE_RANGE: RangeKey = "all";
export const PROFILE_ALBUM_TRACKS_LIMIT = 10;
export const PROFILE_ALBUM_PROFILE_TRACKS_LIMIT = 50;
export const PROFILE_TOP_TRACKS_LIMIT = 10;
export const PROFILE_TOP_ALBUMS_LIMIT = 5;
export const PROFILE_RELATED_TRACKS_LIMIT = 4;
export const PROFILE_MORE_ALBUMS_LIMIT = 4;

export interface SearchTotals {
  tracks: number;
  artists: number;
  albums: number;
}

export interface SearchArtistResult {
  key: string;             // artist_id when the catalog is fully enriched, else artist_group_key
  name: string;
  plays: number;           // lifetime plays
  imageUrl: string | null; // image of the artist's most-played album, if any
  lastPlayedAt?: string | null;
}

export interface SearchAlbumResult {
  key: string;             // album_id when the catalog is fully enriched, otherwise album_group_key
  name: string;
  artist: string;
  plays: number;           // lifetime Plays
  imageUrl: string | null;
  lastPlayedAt?: string | null;
}

export interface SearchTrackResult {
  id: string;
  name: string;
  artist: string;
  album: string;
  plays: number;           // lifetime plays
  albumImageUrl: string | null;
  lastPlayedAt?: string | null;
}

export interface SearchResponse {
  query: string;           // the trimmed query that was searched
  artists: SearchArtistResult[];
  albums: SearchAlbumResult[];
  tracks: SearchTrackResult[];
  hasMore: boolean;
  totals?: SearchTotals;
  totalPages?: number;
}

export type ProfileKind = "track" | "artist" | "album";
export interface ProfileTarget { kind: ProfileKind; key: string; }

export interface ProfilePeakDay {
  date: string;  // Local YYYY-MM-DD
  plays: number;
}

export interface ProfileRelatedTrack {
  id: string;
  name: string;
  artist: string;
  albumImageUrl: string | null;
  coPlays: number;
}

export interface ProfileSummaryStats {
  totalMs: number;
  activeDays: number;
  longestStreakDays: number;
  longestStreakStart: string | null; // local YYYY-MM-DD of the streak's first day; null when longestStreakDays = 0
  longestStreakEnd: string | null;   // local YYYY-MM-DD of the streak's last day; null when longestStreakDays = 0
  peakDay: ProfilePeakDay | null;
  completionRate?: number | null;
  artistPlays?: number;
  artistShare?: number | null;
  albumPlays?: number;
  albumShare?: number | null;
  playShare?: number | null;         // Artist profiles: the Artist's Plays / all Plays in range
  tracksHeardInRange?: number;
  tracksHeardLifetime?: number;
  fullAlbumSessions?: number;
}

export interface ProfileHistoryEntry {
  target: ProfileTarget;
  range: RangeKey;
  name?: string;
}

export interface ProfileTopTrack { id: string; name: string; plays: number; albumImageUrl: string | null; }
export interface ProfileTopAlbum {
  id?: string;
  key?: string; // The Album ID when fully enriched, otherwise its Group Key. Omitted when unavailable.
  name: string;
  plays: number;
  imageUrl: string | null;
}
export interface ProfilePlay {
  id: string; trackId: string; playedAt: string; // ISO
  title: string; artist: string; album: string; durationMs: number; albumImageUrl: string | null;
  msPlayed?: number;
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
  key: string;                 // Track ID, or Artist or Album key in the active identity form
  name: string;                // Track title, Artist name, or Album name
  artistName: string | null;   // The Artist on a Track or Album profile. Null for Artist profiles.
  albumName: string | null;    // Track profiles only
  imageUrl: string | null;
  range: RangeKey;
  firstPlayedAt: string | null; // lifetime, ISO
  lastPlayedAt: string | null;  // lifetime, ISO
  plays: number;               // in range
  rank: number | null;         // in range. null when plays = 0
  rankedTotal: number;         // Tracks, Artists, or Albums with at least one Play in range
  activityCadence: ActivityBucket[];
  monthlyCadence?: ActivityBucket[];
  artistKey?: string;
  albumKey?: string;           // The Track's Album key in the active identity form
  trackStats?: ProfileTrackStats; // track profiles only
  hourOfDay?: number[]; // 24 counts indexed by local hour
  dayOfWeek?: number[];
  stats?: ProfileSummaryStats;
  relatedTracks?: ProfileRelatedTrack[];
  moreAlbums?: ProfileTopAlbum[];
  albumTracks?: ProfileAlbumTrack[]; // track profiles only, ranked in range
  topTracks: ProfileTopTrack[]; // Ranked in range. Up to 10 for Artist profiles and 50 for Album profiles.
  topAlbums: ProfileTopAlbum[]; // Artist profiles only, up to 5 in range.
  recentPlays: ProfilePlay[];   // every Play in range, newest first
}
