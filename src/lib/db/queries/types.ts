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

export type { StreamLogItem, RangeKey, AlbumSummary, ActivityDay };

export interface OverviewData {
  logStartDate: string;
  metrics: [string, string, string, string]; // Minutes, Tracks, Artists, Daily Avg
  topTracks: TrackSummary[];
  topArtists: Array<{ rank: string; name: string; count: number; id?: string }>;
  topAlbums: AlbumSummary[];
  clockBuckets?: number[]; // 24 values representing hourly distribution (0-23)
  activityCadence?: ActivityDay[];
  lastSyncedAt?: string;
}

export interface StreamLogData {
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
