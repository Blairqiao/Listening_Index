import {
  TrackSummary,
  AlbumSummary,
  StreamLogItem,
  SittingItem,
  PreviousSitting,
  SittingSession,
  SessionHistogramData,
  SessionHistogramBar,
  RangeKey,
  ActivityDay,
} from "@/lib/mock-listening-data";
import type { OverviewMetricsRaw, StreamLogMetricsRaw } from "@/lib/format-utils";

export type { StreamLogItem, RangeKey, AlbumSummary, ActivityDay };
export type { OverviewMetricsRaw, StreamLogMetricsRaw };

export interface ActivityBucket {
  startTime: string; // ISO 8601 string
  endTime: string; // ISO 8601 string
  count: number; // Qualified plays count
  isMarker?: boolean;
  markerLabel?: string;
}

export interface OverviewData {
  logStartDate: string;
  rawMetrics?: OverviewMetricsRaw;
  metrics: [string, string, string, string]; // Minutes, Tracks, Artists, Daily Avg
  topTracks: TrackSummary[];
  topArtists: Array<{ rank: string; name: string; count: number; id?: string }>;
  topAlbums: AlbumSummary[];
  clockBuckets?: number[]; // 24 values representing hourly distribution (0-23)
  activityCadence?: ActivityBucket[] | any;
  lastSyncedAt?: string;
}


export interface StreamLogData {
  rawMetrics?: StreamLogMetricsRaw;
  metrics: [string, string, string, string]; // Total Plays, Logged Time, Unique Artists, Current Streak
  entries: StreamLogItem[];
  nextCursor?: string | null;
  nextCursorId?: string | null;
  hasMore?: boolean;
  lastSyncedAt?: string;
}


export interface SessionData {
  isOpen: boolean;
  tagTime: string; // e.g. '22:15 CDT' or '42M'
  metrics: [string, string, string, string]; // Runtime, Tracks, Unique Artists, Start Time
  sittingTracks: SittingItem[];
  previousSittings: PreviousSitting[];
  lastSyncedAt?: string;
  sittings?: SittingSession[];
  sessions?: SittingSession[];
  histogram?: SessionHistogramData;
}

export interface TrackUpsertItem {
  id: string;
  name: string;
  artistName: string;
  albumName: string;
  artistGroupKey?: string;
  albumGroupKey?: string;
  artistId?: string | null;
  albumId?: string | null;
  durationMs: number;
  enrichmentStatus?: "pending" | "enriched" | "delisted";
}

export interface PlayInsertItem {
  playedAt: string;
  trackId: string;
  msPlayed: number;
}

export interface EnrichedTrackItem {
  requestedId: string;
  name: string;
  durationMs: number;
  artistId: string;
  artistName: string;
  albumId: string;
  albumName: string;
  albumImageUrl: string | null;
}

export type { SiteConfigState } from "@/lib/config-utils";
