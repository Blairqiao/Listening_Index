import { RANGE_KEYS, type Mode, type RangeKey } from "@/lib/types";
import type { OverviewData, StreamLogData, TrackTelemetryStats } from "@/lib/db/queries";
import { formatRankDisplay, formatPlaysDisplay } from "@/lib/format-utils";

/** Every Overview range, active first so the visible view refreshes before the rest. */
export function overviewRefreshOrder(activeRange: RangeKey): RangeKey[] {
  return [activeRange, ...RANGE_KEYS.filter((range) => range !== activeRange)];
}

export function sanitizeActiveMode(mode: Mode, isAuthenticated: boolean): Mode {
  return mode === 3 && !isAuthenticated ? 0 : mode;
}

/** The Session picked in the Sessions view, defaulting to the newest one. */
export function findSelectedSession<T extends { id: string }>(
  sessions: readonly T[],
  selectedSessionId?: string
): T | undefined {
  return sessions.find((session) => session.id === selectedSessionId) || sessions[0];
}

export function getTrackStatsCacheKey(params: {
  trackId?: string | null;
  title?: string | null;
  artist?: string | null;
}): string {
  return `${params.trackId || ""}:${params.title || ""}:${params.artist || ""}`;
}

export interface ActiveEntityCandidate {
  id?: string;
  title?: string;
  artist?: string;
}

/** The Track the live player is on, falling back to the latest Play in the Stream Log. */
export function resolveActiveEntity(
  currentTrack?: { id?: string | null; name?: string; artists?: Array<{ name: string }> } | null,
  streamLogLatest?: { trackId?: string | null; title?: string | null; artist?: string | null } | null
): ActiveEntityCandidate | null {
  if (currentTrack) {
    return {
      id: currentTrack.id || undefined,
      title: currentTrack.name || undefined,
      artist:
        currentTrack.artists?.map((a) => a.name).join(", ") ||
        currentTrack.artists?.[0]?.name ||
        undefined,
    };
  }
  if (streamLogLatest) {
    return {
      id: streamLogLatest.trackId || undefined,
      title: streamLogLatest.title || undefined,
      artist: streamLogLatest.artist || undefined,
    };
  }
  return null;
}

export function computeLivePlayerMetrics(
  trackStats: TrackTelemetryStats | null,
  trackRankFormat: "rank" | "percentile" = "rank",
  artistRankFormat: "rank" | "percentile" = "rank",
  fallbackPlays = "--"
): [string, string, string, string] {
  return [
    formatRankDisplay(
      trackStats?.track?.rank ?? null,
      trackStats?.track?.totalTracks ?? 0,
      trackRankFormat
    ),
    trackStats ? formatPlaysDisplay(trackStats.track.plays) : fallbackPlays,
    formatRankDisplay(
      trackStats?.artist?.rank ?? null,
      trackStats?.artist?.totalArtists ?? 0,
      artistRankFormat
    ),
    trackStats ? formatPlaysDisplay(trackStats.artist.plays) : fallbackPlays,
  ];
}

/** Human-readable time since the last sync, as shown in the footer. */
export function computeSyncedAgo(date: Date | null, now = Date.now()): string {
  if (!date) return "JUST NOW";
  const diffMs = now - date.getTime();
  if (diffMs < 0) return "JUST NOW";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return "JUST NOW";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin === 1) return "1M AGO";
  if (diffMin < 60) return `${diffMin}M AGO`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours === 1) return "1H AGO";
  if (diffHours < 24) return `${diffHours}H AGO`;
  return `${Math.floor(diffHours / 24)}D AGO`;
}

/** Rows in one Stream Log page; also the depth of a head refresh. */
export const STREAM_LOG_PAGE_SIZE = 50;

/** True when a refreshed head page shares at least one Play with the rows already loaded. */
export function streamLogHeadOverlaps(prev: StreamLogData | null, fresh: StreamLogData): boolean {
  if (!prev || prev.entries.length === 0) return false;
  const freshIds = new Set(fresh.entries.map((entry) => entry.id));
  return prev.entries.some((entry) => freshIds.has(entry.id));
}

/**
 * Apply a refreshed head page to the loaded Stream Log. With an overlap the older rows stay
 * and pagination continues from their cursor. Without one, Plays between the two sets were
 * never fetched, so the fresh page and its cursor replace everything.
 */
export function mergeStreamLogHead(prev: StreamLogData | null, fresh: StreamLogData): StreamLogData {
  if (!prev || !streamLogHeadOverlaps(prev, fresh)) return fresh;
  const freshIds = new Set(fresh.entries.map((entry) => entry.id));
  return {
    ...fresh,
    entries: [...fresh.entries, ...prev.entries.filter((entry) => !freshIds.has(entry.id))],
    hasMore: prev.hasMore,
    nextCursor: prev.nextCursor,
    nextCursorId: prev.nextCursorId,
  };
}

/** True when the loaded Stream Log still ends at the cursor a "load more" request was made from. */
export function isStreamLogCursorCurrent(
  current: StreamLogData | null,
  cursor: string,
  cursorId: string
): boolean {
  return Boolean(current) && current!.nextCursor === cursor && (current!.nextCursorId || "") === cursorId;
}

/** Append a "load more" page, or return the state unchanged if the list was replaced meanwhile. */
export function appendStreamLogPage(
  prev: StreamLogData | null,
  page: StreamLogData,
  cursor: string,
  cursorId: string
): StreamLogData | null {
  if (!prev || !isStreamLogCursorCurrent(prev, cursor, cursorId)) return prev;
  return {
    ...prev,
    entries: [...prev.entries, ...page.entries],
    nextCursor: page.nextCursor,
    nextCursorId: page.nextCursorId,
    hasMore: page.hasMore,
    lastSyncedAt: page.lastSyncedAt || prev.lastSyncedAt,
  };
}

const STREAM_LOG_DEPTH_KEY = "stream_log_depth";
const STREAM_LOG_DEPTH_TTL_MS = 20 * 60 * 1000; // 20 minutes

export function getCachedStreamLogDepth(): number {
  if (typeof window === "undefined") return 50;
  try {
    const raw = localStorage.getItem(STREAM_LOG_DEPTH_KEY);
    if (!raw) return 50;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.count === "number" && typeof parsed.timestamp === "number") {
      if (Date.now() - parsed.timestamp < STREAM_LOG_DEPTH_TTL_MS) {
        return Math.max(50, parsed.count);
      }
    }
  } catch (error) {
    console.error("[STREAM LOG DEPTH] Error reading cached depth:", error);
  }
  return 50;
}

export function setCachedStreamLogDepth(count: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STREAM_LOG_DEPTH_KEY, JSON.stringify({ count, timestamp: Date.now() }));
  } catch (error) {
    console.error("[STREAM LOG DEPTH] Error setting cached depth:", error);
  }
}

export const EMPTY_OVERVIEW: OverviewData = {
  logStartDate: "--",
  rawMetrics: {
    totalMs: 0,
    trackCount: 0,
    artistCount: 0,
    elapsedDays: 1,
  },
  metrics: ["--", "--", "--", "--"],
  topTracks: [],
  topArtists: [],
  topAlbums: [],
  activityCadence: [],
};

export const EMPTY_STREAM_LOG: StreamLogData = {
  rawMetrics: {
    totalPlays: 0,
    uniqueTracks: 0,
    uniqueArtists: 0,
    streakDays: 0,
  },
  metrics: ["--", "--", "--", "--"],
  entries: [],
};
