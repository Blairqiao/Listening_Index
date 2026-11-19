import { RANGE_KEYS, type Mode, type RangeKey } from "@/lib/types";
import type { OverviewData, StreamLogData, TrackTelemetryStats } from "@/lib/db/queries";
import type { ProfileData, ProfileTarget } from "@/lib/search-types";
import { formatLogStartDate } from "@/lib/db/queries/helpers";
import { formatRankDisplay, formatPlaysDisplay } from "@/lib/format-utils";

/** Every Overview range, active first so the visible view refreshes before the rest. */
export function overviewRefreshOrder(activeRange: RangeKey): RangeKey[] {
  return [activeRange, ...RANGE_KEYS.filter((range) => range !== activeRange)];
}

export function sanitizeActiveMode(mode: Mode, isAuthenticated: boolean): Mode {
  return mode === 3 && !isAuthenticated ? 0 : mode;
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
    status !== "ready" ||
    !data ||
    !target ||
    data.kind !== target.kind ||
    data.key !== target.key ||
    data.range !== range
  ) {
    return ["--", "--", "--", "--"];
  }

  const plays = String(data.plays);
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
    profileTarget: ProfileTarget | null;
    profileRange: RangeKey;
  }
): string {
  const raw = currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch;
  const params = new URLSearchParams(raw);
  const target = state.activeMode === 4 ? state.profileTarget : null;

  for (const kind of ["track", "artist", "album"]) {
    if (kind !== target?.kind) params.delete(kind);
  }

  if (state.activeMode === 4) {
    params.set("mode", "4");
  } else if (params.get("mode") === "4") {
    params.delete("mode");
  }

  if (target) {
    params.set(target.kind, target.key);
    params.set("prange", state.profileRange);
  } else {
    params.delete("prange");
  }

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
