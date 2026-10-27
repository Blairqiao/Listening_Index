import {
  AlbumSummary,
  RangeKey,
  ActivityDay,
  ActivityBucket,
} from "@/lib/mock-listening-data";
import type { OverviewMetricsRaw, StreamLogMetricsRaw } from "@/lib/format-utils";

export type { StreamLogItem } from "@/lib/types";
export type { RangeKey, AlbumSummary, ActivityDay, ActivityBucket };
export type { OverviewMetricsRaw, StreamLogMetricsRaw };

export type { OverviewData, StreamLogData } from "@/lib/types";

export type { SessionData } from "@/lib/types";

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
