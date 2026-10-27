import type { OverviewMetricsRaw, StreamLogMetricsRaw } from "./format-utils";

export type Mode = 0 | 1 | 2 | 3; // 0 = Overview, 1 = Stream Log, 2 = Session, 3 = Live Player
export type RangeKey = "1d" | "1w" | "1m" | "6m" | "1y" | "all";

export interface TrackSummary {
  id: string;
  rank: string; // '01'
  drift: "·" | "+1" | "-1" | "+2" | "-2" | "NEW";
  name: string;
  artist: string;
  artistId?: string;
  album: string;
  albumId?: string;
  duration: string; // '5:18'
  plays: number;
  swatchColor: string;
  albumImageUrl?: string | null;
}

export interface StreamLogItem {
  id: string;
  trackId?: string;
  artistId?: string;
  albumId?: string;
  playedAt: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  albumImageUrl?: string | null;
  swatchColor?: string;
  status?: string;
  sessionGap?: {
    durationMs: number;
    sessionId: string;
    trackCount: number;
    runtimeMs: number;
  };
}

export interface SessionItem {
  id: string;
  playId: string;
  playedAt: string;
  durationMs: number;
  artistId?: string;
  albumId?: string;
  title: string;
  artist: string;
  album: string;
  swatchColor: string;
  albumImageUrl?: string | null;
  status?: string;
  isActive?: boolean;
  isFirstPlay?: boolean;
}


export interface PreviousSession {
  id?: string;
  dateStr: string; // '09 SEP'
  durationStr: string; // '1h 14m'
  tracksCountStr: string; // '18 tracks'
  runtimeMinutes?: number;
  trackCount?: number;
}


export interface SessionAnalysis {
  firstPlaysCount: number;
  totalTracks: number;
  topTrack: { title: string; count: number; id?: string; artist?: string } | null;
  topAlbum: { title: string; count: number; id?: string; artist?: string };
  topArtist: { name: string; count: number; id?: string };
}


export interface SessionRecord {
  id: string;
  startedAt: string;
  endedAt: string;
  runtimeMs: number;
  trackCount: number;
  uniqueArtistsCount: number;
  isOpen: boolean;
  tracks: SessionItem[];
  analysis: SessionAnalysis;
}


export interface SessionHistogramBar {
  id: string;
  runtimeMinutes: number;
  dateStr: string;
  title: string;
}

export interface SessionHistogramData {
  avgRuntimeMinutes: number;
  oldestDate: string;
  newestDate: string;
  bars: SessionHistogramBar[];
}

export interface SessionData {
  sessions: SessionRecord[];
  lastSyncedAt?: string;
}

export interface AlbumSummary {
  id?: string;
  rank: string; // '01', '02', etc.
  name: string; // e.g., 'Blonde'
  artist: string; // e.g., 'Frank Ocean'
  artistId?: string;
  count: number; // e.g., 241
}

export interface ActivityBucket {
  startTime: string; // ISO 8601 string
  endTime: string; // ISO 8601 string
  count: number;
  isMarker?: boolean;
  markerLabel?: string;
  date: string;
}

export type ActivityDay = ActivityBucket;

export interface OverviewData {
  logStartDate: string;
  rawMetrics: OverviewMetricsRaw;
  metrics: [string, string, string, string]; // Minutes, Tracks, Artists, Daily Avg
  topTracks: TrackSummary[];
  topArtists: Array<{ rank: string; name: string; count: number; id?: string }>;
  topAlbums: AlbumSummary[];
  clockBuckets?: number[]; // 24 values
  activityCadence: ActivityBucket[]; // Multi-scale activity distribution
  lastSyncedAt?: string;
}

export interface StreamLogData {
    rawMetrics: StreamLogMetricsRaw;
    metrics: [string, string, string, string]; // Plays, Unique Tracks, Artists, Streak
    entries: StreamLogItem[];
    nextCursor?: string | null;
    nextCursorId?: string | null;
    hasMore?: boolean;
    lastSyncedAt?: string;
  }

export interface MockListeningData {
  overview: Record<RangeKey, OverviewData>;
  streamLog: StreamLogData;
  session: SessionData;
}

export type {
  OverviewMetricsRaw,
  StreamLogMetricsRaw,
} from "./format-utils";
