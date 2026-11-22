import { RANGE_KEYS, type Mode, type RangeKey } from "@/lib/types";
import type { OverviewData, StreamLogData, TrackTelemetryStats } from "@/lib/db/queries";
import {
  DEFAULT_OVERVIEW_RANGE,
  formatRangeParam,
  isSameRange,
  presetRange,
  type RangeSelection,
} from "@/lib/range";
import {
  DEFAULT_SEARCH_FILTER,
  DEFAULT_SEARCH_SORT,
  type ProfileData,
  type ProfileTarget,
  type SearchFilter,
  type SearchSort,
} from "@/lib/search-types";
import { formatLogStartDate } from "@/lib/db/queries/helpers";
import { formatRankDisplay, formatPlaysDisplay } from "@/lib/format-utils";

const PRESET_KEY_SET = new Set<string>(RANGE_KEYS);

/** Active selection first, then every preset with no duplicates. */
export function overviewRefreshOrder(active: RangeSelection): RangeSelection[] {
  const presets = RANGE_KEYS.map(presetRange).filter((preset) => !isSameRange(preset, active));
  return [active, ...presets];
}

/** Drop cached window entries other than the active selection so stale windows cannot show after a refresh. */
export function pruneOverviewCacheWindows(
  cache: Record<string, OverviewData>,
  active: RangeSelection
): Record<string, OverviewData> {
  const activeKey = formatRangeParam(active);
  let dropped = false;
  const next: Record<string, OverviewData> = {};
  for (const [key, value] of Object.entries(cache)) {
    if (PRESET_KEY_SET.has(key) || key === activeKey) {
      next[key] = value;
    } else {
      dropped = true;
    }
  }
  return dropped ? next : cache;
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
  if (!date) return "Just now";
  const diffMs = now - date.getTime();
  if (diffMs < 0) return "Just now";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin === 1) return "1m ago";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours === 1) return "1h ago";
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
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
  range: "1w",
  granularity: "block6h",
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

export type ProfileStatus = "loading" | "ready" | "not_found" | "error";

export function getProfileCacheKey(
  target: ProfileTarget,
  range: RangeKey,
  visitorTimezone: string
): string {
  return `${target.kind}:${range}:${visitorTimezone}:${target.key}`;
}

export function resolveDisplayedProfileData(
  data: ProfileData | null,
  target: ProfileTarget | null
): ProfileData | null {
  if (!data || !target) return null;
  if (data.kind !== target.kind || data.key !== target.key) return null;
  return data;
}

export function formatProfileRibbonMetrics(
  data: ProfileData | null,
  status: ProfileStatus,
  target: ProfileTarget | null,
  range: RangeKey,
  visitorTimezone: string,
  rankFormat: "rank" | "percentile" = "rank",
): [string, string, string, string] {
  if (
    (status !== "ready" && status !== "loading") ||
    !data ||
    !target ||
    data.kind !== target.kind ||
    data.key !== target.key ||
    (status === "ready" && data.range !== range)
  ) {
    return ["--", "--", "--", "--"];
  }

  const plays = data.plays.toLocaleString();
  const rank =
    data.rank !== null && data.rank > 0
      ? formatRankDisplay(data.rank, data.rankedTotal, rankFormat)
      : "--";

  const formatDate = (iso: string | null): string => {
    if (!iso) return "--";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "--";
    return formatLogStartDate(d, visitorTimezone);
  };

  return [plays, rank, formatDate(data.firstPlayedAt), formatDate(data.lastPlayedAt)];
}

export function buildListeningUrlSearch(
  currentSearch: string,
  state: {
    activeMode: Mode;
    overviewRange: RangeSelection;
    profileTarget: ProfileTarget | null;
    profileRange: RangeKey;
    preservePendingMode3?: boolean;
    search?: {
      query: string;
      filter: SearchFilter;
      sort: SearchSort;
      page: number;
    };
  }
): string {
  const raw = currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch;
  const params = new URLSearchParams(raw);
  const target = state.activeMode === 4 ? state.profileTarget : null;

  for (const kind of ["track", "artist", "album"]) {
    if (kind !== target?.kind) params.delete(kind);
  }

  if (state.activeMode === 0) {
    if (isSameRange(state.overviewRange, DEFAULT_OVERVIEW_RANGE)) {
      params.delete("range");
    } else {
      params.set("range", formatRangeParam(state.overviewRange));
    }
  }

  if (state.activeMode === 4) {
    params.set("mode", "4");
  } else if (state.activeMode === 0) {
    if (state.preservePendingMode3 && params.get("mode") === "3") {
      params.set("mode", "3");
    } else {
      params.delete("mode");
    }
  } else if (params.has("mode")) {
    params.set("mode", String(state.activeMode));
  }

  if (target) {
    params.set(target.kind, target.key);
    params.set("prange", state.profileRange);
  } else {
    params.delete("prange");
  }

  if (state.activeMode === 4 && !target && state.search) {
    const trimmedQuery = state.search.query.trim();
    if (trimmedQuery) {
      params.set("q", trimmedQuery);
    } else {
      params.delete("q");
    }
    if (state.search.filter !== DEFAULT_SEARCH_FILTER) {
      params.set("type", state.search.filter);
    } else {
      params.delete("type");
    }
    if (state.search.sort !== DEFAULT_SEARCH_SORT) {
      params.set("sort", state.search.sort);
    } else {
      params.delete("sort");
    }
    if (state.search.page > 1) {
      params.set("page", String(state.search.page));
    } else {
      params.delete("page");
    }
  } else {
    params.delete("q");
    params.delete("type");
    params.delete("sort");
    params.delete("page");
  }

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
