"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { ListeningHeader } from "@/components/ListeningHeader";
import { ModeTabs } from "@/components/ModeTabs";
import { ControlRow } from "@/components/ControlRow";
import { MetricRibbon } from "@/components/MetricRibbon";
import { Spectrum } from "@/components/Spectrum";
import { OverviewView } from "@/components/OverviewView";
import { StreamLogView } from "@/components/StreamLogView";
import { SessionView } from "@/components/SessionView";
import { ListeningFooter } from "@/components/ListeningFooter";
import { CustomizationModal } from "@/components/CustomizationModal";
import { ConfigProvider, useConfig, SiteConfigState } from "@/context/ConfigContext";
import {
  Mode,
  RangeKey,
  SittingSession,
} from "@/lib/mock-listening-data";
import { OverviewData, StreamLogData, SessionData } from "@/lib/db/queries";
import { isScreenSmall } from "@/lib/resize-utils";

const RANGE_KEYS: RangeKey[] = ["1d", "1w", "1m", "6m", "1y", "all"];

const STREAM_LOG_DEPTH_KEY = "stream_log_depth";
const STREAM_LOG_DEPTH_TTL_MS = 20 * 60 * 1000; // 20 minutes

function getCachedStreamLogDepth(): number {
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
  } catch {}
  return 50;
}

function setCachedStreamLogDepth(count: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STREAM_LOG_DEPTH_KEY,
      JSON.stringify({ count, timestamp: Date.now() })
    );
  } catch {}
}

interface ListeningViewProps {
  initialOverview?: OverviewData | Record<RangeKey, OverviewData> | null;
  initialStreamLog?: StreamLogData | null;
  initialSession?: SessionData | null;
  initialConfig?: SiteConfigState | null;
  isDbConfigured?: boolean;
}

const ListeningViewInner: React.FC<ListeningViewProps> = ({
  initialOverview,
  initialStreamLog,
  initialSession,
}) => {

  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(isScreenSmall(window));
    };

    handleResize(); // Initial check

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const { config, openModal, closeModal, isModalOpen } = useConfig();
  const tzRef = useRef<string>(config.timezone);
  // Mode state: 0 = Overview, 1 = Stream Log, 2 = Current Session
  const [activeMode, setActiveMode] = useState<Mode>(0);

  // Range state: "1d" | "1w" | "1m" | "6m" | "1y" | "all", default "1d"
  const [activeRange, setActiveRange] = useState<RangeKey>("1w");
  // Displayed range stays frozen until the new range dataset has been fetched and cached
  const [displayedRange, setDisplayedRange] = useState<RangeKey>("1w");

  // In-memory client cache per range key to eliminate flash and jitter on range toggling
  const [overviewCache, setOverviewCache] = useState<Partial<Record<RangeKey, OverviewData>>>(() => {
    const initial: Partial<Record<RangeKey, OverviewData>> = {};
    if (initialOverview) {
      if ("1d" in initialOverview || "1w" in initialOverview) {
        return { ...(initialOverview as Record<RangeKey, OverviewData>) };
      }
      initial["1w"] = initialOverview as OverviewData;
    }
    return initial;
  });

  // Active range ref to guard against race conditions on fast switching
  const activeRangeRef = React.useRef<RangeKey>(activeRange);
  useEffect(() => {
    activeRangeRef.current = activeRange;
  }, [activeRange]);

  // Manual sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Dynamic API state (seeded from server props)
  const [streamLogState, setStreamLogState] = useState<StreamLogData | null>(() => {
    return initialStreamLog || null;
  });
  const [loadedPlaysCount, setLoadedPlaysCount] = useState<number>(() => {
    return initialStreamLog?.entries?.length || 50;
  });
  const loadedPlaysCountRef = useRef<number>(loadedPlaysCount);
  useEffect(() => {
    loadedPlaysCountRef.current = loadedPlaysCount;
  }, [loadedPlaysCount]);

  const [isLoadingMorePlays, setIsLoadingMorePlays] = useState<boolean>(false);

  const [sessionState, setSessionState] = useState<SessionData | null>(() => {
    return initialSession || null;
  });

  const [isRangeLoading, setIsRangeLoading] = useState<boolean>(false);

  // Dynamic sync telemetry tracking
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => {
    const syncTime =
      initialSession?.lastSyncedAt ||
      initialStreamLog?.lastSyncedAt ||
      (initialOverview && "lastSyncedAt" in initialOverview ? (initialOverview as OverviewData).lastSyncedAt : undefined);
    return syncTime ? new Date(syncTime) : null;
  });
  const [syncedAgoStr, setSyncedAgoStr] = useState<string>("JUST NOW");

  // Track whether real overview data is ready
  const isDataReady = Boolean(
    overviewCache[displayedRange] || initialOverview
  );

  // Helper to compute human-readable elapsed time
  const computeSyncedAgo = useCallback((date: Date | null): string => {
    if (!date) return "JUST NOW";
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 0) return "JUST NOW";
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 45) return "JUST NOW";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin === 1) return "1M AGO";
    if (diffMin < 60) return `${diffMin}M AGO`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours === 1) return "1H AGO";
    if (diffHours < 24) return `${diffHours}H AGO`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}D AGO`;
  }, []);

  // Recalculate human-readable elapsed time every 10 seconds
  useEffect(() => {
    setSyncedAgoStr(computeSyncedAgo(lastSyncedAt));
    const interval = setInterval(() => {
      setSyncedAgoStr(computeSyncedAgo(lastSyncedAt));
    }, 10000);
    return () => clearInterval(interval);
  }, [lastSyncedAt, computeSyncedAgo]);

  // Active session sitting state for Mode 3
  const [selectedSittingId, setSelectedSittingId] = useState<string | undefined>(undefined);

  // Support query params for direct URL inspection of all modes and states
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const m = params.get("mode");
      if (m === "0" || m === "1" || m === "2") {
        setActiveMode(parseInt(m, 10) as Mode);
      }
      const r = params.get("range");
      if (r && RANGE_KEYS.includes(r as RangeKey)) {
        setActiveRange(r as RangeKey);
        setDisplayedRange(r as RangeKey);
        activeRangeRef.current = r as RangeKey;
      }
      const sit = params.get("sitting");
      if (sit) {
        setSelectedSittingId(sit);
      }
      const configParam = params.get("config");
      if (configParam === "true" || configParam === "1") {
        openModal();
      }
    }
  }, [openModal]);

  // Fetch Overview data from server (cached on server, reset on sync)
  const fetchOverview = useCallback(async (rangeToFetch: RangeKey) => {
    try {
      const tzQuery = tzRef.current ? `&tz=${encodeURIComponent(tzRef.current)}` : "";
      const url = `/api/listening/overview?range=${rangeToFetch}${tzQuery}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = (await res.json()) as OverviewData;
        if (data && data.metrics) {
          setOverviewCache((prev) => ({ ...prev, [rangeToFetch]: data }));
          if (activeRangeRef.current === rangeToFetch) {
            setDisplayedRange(rangeToFetch);
          }
          if (data.lastSyncedAt) {
            const syncDate = new Date(data.lastSyncedAt);
            setLastSyncedAt((prev) => (!prev || syncDate > prev ? syncDate : prev));
          }
          return data;
        }
      }
    } catch (err) {
      console.error("[API FETCH] Overview query error:", err);
    }
    // Fallback if fetch returned error: unfreeze to requested range
    if (activeRangeRef.current === rangeToFetch) {
      setDisplayedRange(rangeToFetch);
    }
    return null;
  }, []);

  // Fetch Stream Log from server (cached on server, reset on sync)
  const fetchStreamLog = useCallback(async (countToFetch?: number) => {
    try {
      const depth = countToFetch || loadedPlaysCountRef.current || 50;
      const tzQuery = tzRef.current ? `&tz=${encodeURIComponent(tzRef.current)}` : "";
      const url = `/api/listening/stream-log?limit=${depth}${tzQuery}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = (await res.json()) as StreamLogData;
        if (data && data.entries) {
          setStreamLogState(data);
          setLoadedPlaysCount(data.entries.length);
          setCachedStreamLogDepth(data.entries.length);
          if (data.lastSyncedAt) {
            const syncDate = new Date(data.lastSyncedAt);
            setLastSyncedAt((prev) => (!prev || syncDate > prev ? syncDate : prev));
          }
        }
      }
    } catch (err) {
      console.error("[API FETCH] Stream log query error:", err);
    }
  }, []);

  // Restore cached stream log depth on initial client mount if > 50 and within TTL
  useEffect(() => {
    const cachedDepth = getCachedStreamLogDepth();
    if (cachedDepth > 50) {
      fetchStreamLog(cachedDepth);
    }
  }, [fetchStreamLog]);

  // Load next 50 plays incrementally using keyset cursor pagination
  const handleLoadMoreStreamLog = useCallback(async () => {
    if (
      isLoadingMorePlays ||
      !streamLogState ||
      streamLogState.hasMore === false ||
      !streamLogState.nextCursor
    ) {
      return;
    }
    setIsLoadingMorePlays(true);
    try {
      const cursor = streamLogState.nextCursor;
      const cursorId = streamLogState.nextCursorId || "";
      const lastEntry = streamLogState.entries[streamLogState.entries.length - 1];
      const prevPlayedAt = lastEntry?.playedAt || "";

      // Find the dayGroup of the last entry by scanning backward
      let prevDayGroup = "";
      for (let i = streamLogState.entries.length - 1; i >= 0; i--) {
        if (streamLogState.entries[i].dayGroup) {
          prevDayGroup = streamLogState.entries[i].dayGroup!;
          break;
        }
      }

      const tzQuery = tzRef.current ? `&tz=${encodeURIComponent(tzRef.current)}` : "";
      const params = new URLSearchParams({
        limit: "50",
        cursor,
        cursorId,
        prevPlayedAt,
        prevDayGroup,
      });

      const url = `/api/listening/stream-log?${params.toString()}${tzQuery}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (res.ok) {
        const data = (await res.json()) as StreamLogData;
        if (data && data.entries) {
          setStreamLogState((prev) => {
            if (!prev) return data;
            return {
              ...prev,
              entries: [...prev.entries, ...data.entries],
              nextCursor: data.nextCursor,
              nextCursorId: data.nextCursorId,
              hasMore: data.hasMore,
              lastSyncedAt: data.lastSyncedAt || prev.lastSyncedAt,
            };
          });

          setLoadedPlaysCount((prev) => {
            const nextCount = prev + data.entries.length;
            setCachedStreamLogDepth(nextCount);
            return nextCount;
          });
        }
      }
    } catch (err) {
      console.error("[API FETCH] Stream log load more error:", err);
    } finally {
      setIsLoadingMorePlays(false);
    }
  }, [isLoadingMorePlays, streamLogState]);

  // Fetch Current Session from server (cached on server, reset on sync)
  const fetchSession = useCallback(async () => {
    try {
      const tzQuery = tzRef.current ? `?tz=${encodeURIComponent(tzRef.current)}` : "";
      const url = `/api/listening/session${tzQuery}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = (await res.json()) as SessionData;
        if (data && (data.sittingTracks || data.previousSittings)) {
          setSessionState(data);
          if (data.lastSyncedAt) {
            const syncDate = new Date(data.lastSyncedAt);
            setLastSyncedAt((prev) => (!prev || syncDate > prev ? syncDate : prev));
          }
        }
      }
    } catch (err) {
      console.error("[API FETCH] Session query error:", err);
    }
  }, []);

  // When config.timezone is modified, invalidate cache and reload telemetry for the new timezone
  useEffect(() => {
    if (tzRef.current !== config.timezone) {
      tzRef.current = config.timezone;
      setOverviewCache({});
      fetchOverview(activeRangeRef.current);
      fetchStreamLog();
      fetchSession();
    }
  }, [config.timezone, fetchOverview, fetchStreamLog, fetchSession]);

  // Initial load: fetch all endpoints in background if not already available
  useEffect(() => {
    async function init() {
      const hasOverview = Boolean(overviewCache[activeRange]);
      const hasStreamLog = Boolean(streamLogState);
      const hasSession = Boolean(sessionState);

      if (hasOverview && hasStreamLog && hasSession) {
        return;
      }
      try {
        const promises: Promise<any>[] = [];
        if (!hasOverview) promises.push(fetchOverview(activeRange));
        if (!hasStreamLog) promises.push(fetchStreamLog());
        if (!hasSession) promises.push(fetchSession());
        await Promise.allSettled(promises);
      } catch (err) {
        console.error("[INIT FETCH] Error initializing telemetry:", err);
      }
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual sync trigger: executes ingestion, purges server cache, and refetches active views
  const handleTriggerSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const syncData = await res.json();
        const syncTimestamp = syncData.syncedAt
          ? new Date(syncData.syncedAt)
          : new Date();
        setLastSyncedAt(syncTimestamp);
        setSyncedAgoStr("JUST NOW");

        // Concurrently recall endpoints (server cache was purged by /api/sync)
        // Keep existing views frozen and visible (dimmed) during sync - DO NOT wipe cache upfront
        const [newOverview] = await Promise.all([
          fetchOverview(activeRange),
          fetchStreamLog(),
          fetchSession(),
        ]);

        // Invalidate stale non-active ranges in overviewCache so switching to them fetches fresh data
        if (newOverview) {
          setOverviewCache({ [activeRange]: newOverview });
        }
      }
    } catch (err) {
      console.error("[SYNC TRIGGER] Error triggering sync:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, activeRange, fetchOverview, fetchStreamLog, fetchSession]);

  // Background silent refetch helper (used by auto-sync schedule and focus revalidation)
  const refetchActiveData = useCallback(async () => {
    try {
      const [newOverview] = await Promise.all([
        fetchOverview(activeRangeRef.current),
        fetchStreamLog(),
        fetchSession(),
      ]);
      if (newOverview) {
        setOverviewCache((prev) => ({
          ...prev,
          [activeRangeRef.current]: newOverview,
        }));
      }
    } catch (err) {
      console.error("[AUTO REFETCH] Error updating telemetry:", err);
    }
  }, [fetchOverview, fetchStreamLog, fetchSession]);

  // Wall-clock auto-sync: triggers 30s after every top-of-hour (:00) and half-hour (:30) cron window
  useEffect(() => {
    let timerId: NodeJS.Timeout;

    const scheduleNextCheck = () => {
      const now = new Date();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const ms = now.getMilliseconds();

      // Next boundary is minute 30 (if < 30) or minute 60 (if >= 30)
      const nextTargetMinute = minutes < 30 ? 30 : 60;
      const msUntilTarget =
        ((nextTargetMinute - minutes - 1) * 60 + (59 - seconds)) * 1000 +
        (1000 - ms) +
        30000; // 30-second buffer for cron job execution and DB commit

      timerId = setTimeout(async () => {
        await refetchActiveData();
        scheduleNextCheck();
      }, msUntilTarget);
    };

    scheduleNextCheck();
    return () => clearTimeout(timerId);
  }, [refetchActiveData]);

  // Tab visibility and focus revalidation: if user returns to tab after a cron window has passed, refetch silently
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        // If lastSyncedAt is more than 30 minutes ago or missing, check and refresh
        if (!lastSyncedAt || Date.now() - lastSyncedAt.getTime() >= 30 * 60 * 1000) {
          refetchActiveData();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [lastSyncedAt, refetchActiveData]);

  const handleSelectMode = useCallback(
    (mode: Mode) => {
      if (isSyncing) return;
      setActiveMode(mode);
    },
    [isSyncing]
  );

  const handleSelectRange = useCallback(
    (range: RangeKey) => {
      if (isSyncing) return;
      setActiveRange(range);
      activeRangeRef.current = range;
      if (overviewCache[range]) {
        // Cached in-memory: instantaneous update, 0ms latency, zero flash
        setDisplayedRange(range);
        return;
      }
      // Not yet cached: keep displayed view frozen on current displayedRange while fetching
      setIsRangeLoading(true);
      fetchOverview(range).finally(() => {
        setIsRangeLoading(false);
      });
    },
    [isSyncing, overviewCache, fetchOverview]
  );

  // Keyboard navigation
  // Keys 1-3: Switch modes
  // ArrowLeft / ArrowRight: Step range in Mode 0 (clamped at 1D and ALL, no wrap)
  // Key C: Open / Toggle config panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Suppress if syncing or inside input, textarea, or contentEditable
      if (
        isSyncing ||
        (document.activeElement &&
          (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) ||
            (document.activeElement as HTMLElement).isContentEditable))
      ) {
        return;
      }

      // Keys 1-3: Modes
      if (["1", "2", "3"].includes(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        const modeIndex = (parseInt(e.key, 10) - 1) as Mode;
        handleSelectMode(modeIndex);
        return;
      }

      // ArrowLeft / ArrowRight in Overview: Step range clamped at [0, RANGE_KEYS.length - 1]
      if (activeMode === 0) {
        const currentIdx = RANGE_KEYS.indexOf(activeRange);
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          if (currentIdx > 0) {
            handleSelectRange(RANGE_KEYS[currentIdx - 1]);
          }
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          if (currentIdx < RANGE_KEYS.length - 1) {
            handleSelectRange(RANGE_KEYS[currentIdx + 1]);
          }
          return;
        }
      }

      // Key C: Open / Toggle config panel
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (isModalOpen) {
          closeModal();
        } else {
          openModal();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [activeMode, activeRange, handleSelectMode, handleSelectRange, isSyncing, isModalOpen, openModal, closeModal]);

  // Derived datasets — strictly real data, no dummy mock data fallbacks
  const currentOverview: OverviewData =
    overviewCache[displayedRange] || {
      logStartDate: "--",
      metrics: ["--", "--", "--", "--"],
      topTracks: [],
      topArtists: [],
      topAlbums: [],
      activityCadence: [],
    };

  const streamLogData: StreamLogData =
    streamLogState || {
      metrics: ["--", "--", "--", "--"],
      entries: [],
    };

  const sessionData: SessionData =
    sessionState || {
      isOpen: initialSession?.isOpen ?? false,
      tagTime: "--",
      metrics: ["--", "--", "--", "--"],
      sittingTracks: [],
      previousSittings: [],
    };

  // Selected sitting lookup for Mode 3
  const activeSitting = React.useMemo(() => {
    if (!sessionData.sittings || sessionData.sittings.length === 0) return null;
    return (
      sessionData.sittings.find((s) => s.id === selectedSittingId) ||
      sessionData.sittings[0]
    );
  }, [sessionData.sittings, selectedSittingId]);

  // Derived session metrics for Mode 3
  const currentSessionMetrics = React.useMemo((): [string, string, string, string] => {
    if (activeSitting) {
      return [
        activeSitting.runtimeStr,
        String(activeSitting.trackCount),
        String(activeSitting.uniqueArtistsCount),
        activeSitting.startTime,
      ];
    }
    return sessionData.metrics;
  }, [activeSitting, sessionData.metrics]);

  // Active metrics per mode
  const metricByMode: Record<Mode, [string, string, string, string]> = {
    0: currentOverview.metrics,
    1: streamLogData.metrics,
    2: currentSessionMetrics,
  };
  const currentMetrics = metricByMode[activeMode];

  const sessionTagTime =
    activeSitting?.tagTime || sessionData.tagTime || (sessionData.isOpen ? "LIVE" : "--");
  const isSystemLive = sessionData.isOpen;

  // Seeds the visualizer's synthetic pattern. The most recent play is the
  // closest thing to "now playing" the sync-based data model exposes.
  const latestPlay = streamLogData.entries[0];
  const spectrumTrackKey = latestPlay
    ? latestPlay.trackId || `${latestPlay.title}-${latestPlay.artist}`
    : "idle";

  return (
    <div id="music-page-root" className="min-h-[100dvh] bg-[#080808] text-[#EDEDE8] font-sans antialiased relative">
      {/* Black veil holding the screen as long as needed until real data is ready */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-[#080808] pointer-events-none select-none transition-opacity duration-300 ease-in-out ${
          isDataReady ? "opacity-0" : "opacity-100"
        }`}
      />
      <main className="max-w-[1240px] w-full mx-auto px-4 py-3 sm:px-8 sm:py-4 md:px-10 md:py-5 min-h-[100dvh] flex flex-col justify-between ">
        <div className="flex-1">
          {/* 1. Header Row */}
          <ListeningHeader />

          {/* 2. Mode Tabs (Underline active styling) */}
          <ModeTabs
            activeMode={activeMode}
            onSelectMode={handleSelectMode}
            isSyncing={isSyncing}
            isSmallScreen={isSmallScreen}
          />

          {/* 3. Fixed-Height Control Row (h-[26px], never shifts) */}
          <ControlRow
            mode={activeMode}
            range={activeRange}
            onSelectRange={handleSelectRange}
            logStartDate={currentOverview.logStartDate}
            isSessionOpen={sessionData.isOpen}
            sessionTagTime={sessionTagTime}
            isSyncing={isSyncing}
            isSmallScreen={isSmallScreen}
            onTriggerSync={handleTriggerSync}
            streamLogCount={streamLogData.entries.length || loadedPlaysCount}
            totalPlays={streamLogData.metrics[0]}
          />

          {/* 4. Metric Ribbon (4 cells, grid dividers show through) */}
          <MetricRibbon mode={activeMode} metrics={currentMetrics} />

          {/* 4b. Spectrum visualizer (synthetic by default, live audio on request) */}
          <Spectrum
            trackKey={spectrumTrackKey}
            isLive={isSystemLive}
            accentColor={config.accentColor}
          />

          {/* 5. Mode Views (h-auto on mobile so stacked columns expand, locked h-[584px] on desktop) */}
          <div
            className={`h-auto md:h-[584px] transition-opacity duration-150 ${
              isSyncing || (activeMode === 0 && isRangeLoading)
                ? "opacity-40 pointer-events-none"
                : "opacity-100"
            }`}
          >
            {activeMode === 0 && (
              <OverviewView
                range={displayedRange}
                topTracks={currentOverview.topTracks}
                topArtists={currentOverview.topArtists}
                topAlbums={currentOverview.topAlbums}
                activityCadence={currentOverview.activityCadence}
              />
            )}

            {activeMode === 1 && (
              <StreamLogView
                entries={streamLogData.entries}
                onLoadMore={handleLoadMoreStreamLog}
                isLoadingMore={isLoadingMorePlays}
                hasMore={streamLogState?.hasMore ?? (streamLogData.entries.length >= 50)}
                totalPlays={streamLogData.metrics[0]}
              />
            )}

            {activeMode === 2 && (
              <SessionView
                isOpen={sessionData.isOpen}
                sittingTracks={sessionData.sittingTracks}
                previousSittings={sessionData.previousSittings}
                sittings={sessionData.sittings}
                histogram={sessionData.histogram}
                selectedSittingId={selectedSittingId}
                onSelectSitting={(id) => setSelectedSittingId(id)}
              />
            )}
          </div>
        </div>

        {/* 6. Footer (System status only, fixed to bottom) */}
        <ListeningFooter
          mode={activeMode}
          isLive={isSystemLive}
          syncedAgo={syncedAgoStr}
          isSyncing={isSyncing}
          isSmallScreen={isSmallScreen}
          onTriggerSync={handleTriggerSync}
        />
      </main>

      {/* 7. In-App Customization Settings Modal */}
      <CustomizationModal />
    </div>
  );
};

export const ListeningView: React.FC<ListeningViewProps> = ({
  initialConfig,
  isDbConfigured = true,
  ...props
}) => {
  return (
    <ConfigProvider initialConfig={initialConfig || undefined} isDbConfigured={isDbConfigured}>
      <ListeningViewInner {...props} />
    </ConfigProvider>
  );
};

