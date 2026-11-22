import React, { useCallback, useEffect, useRef, useState } from "react";
import type { RangeKey } from "@/lib/types";
import { formatRangeParam, type RangeSelection } from "@/lib/range";
import type {
  OverviewData,
  StreamLogData,
  SessionData,
  EnrichedTrackItem,
} from "@/lib/db/queries";
import {
  patchOverviewCacheWithEnrichment,
  patchStreamLogWithEnrichment,
  patchSessionWithEnrichment,
  type EnrichmentPatchData,
} from "@/lib/enrichment-patch";
import {
  appendStreamLogPage,
  getCachedStreamLogDepth,
  isStreamLogCursorCurrent,
  mergeStreamLogHead,
  setCachedStreamLogDepth,
  streamLogHeadOverlaps,
} from "./listening-helpers";

export interface UseListeningDataParams {
  initialOverview?: OverviewData | Record<RangeKey, OverviewData> | Record<string, OverviewData> | null;
  initialStreamLog?: StreamLogData | null;
  initialSession?: SessionData | null;
  initialRange: RangeSelection;
  visitorTimezone: string;
}

/**
 * Client-side data layer for the listening page: per-range Overview cache, Stream Log
 * pages, Sessions, and the enrichment overlay applied to all three.
 *
 * Every fetch captures the request generation, per-range sequence, and timezone before it starts
 * and drops its response if any changed, so a stale response never lands in the current view.
 */
export function useListeningData({
  initialOverview,
  initialStreamLog,
  initialSession,
  initialRange,
  visitorTimezone,
}: UseListeningDataParams) {
  const tzRef = useRef<string>(visitorTimezone);
  const requestGenerationRef = useRef(0);
  const overviewFetchSeqRef = useRef<Map<string, number>>(new Map());

  // Range state. The displayed range stays frozen until the new range's data has arrived.
  const [activeRange, setActiveRange] = useState<RangeSelection>(initialRange);
  const [displayedRange, setDisplayedRange] = useState<RangeSelection>(initialRange);
  const [isRangeLoading, setIsRangeLoading] = useState<boolean>(false);

  // In-memory cache keyed by formatRangeParam so switching ranges has no flash
  const [overviewCache, setOverviewCacheState] = useState<Record<string, OverviewData>>(() => {
    const initial: Record<string, OverviewData> = {};
    if (initialOverview) {
      if ("1d" in initialOverview || "1w" in initialOverview) {
        return { ...(initialOverview as Record<string, OverviewData>) };
      }
      initial[formatRangeParam(initialRange)] = initialOverview as OverviewData;
    }
    return initial;
  });

  // Retains the last rendered Overview payload for displayedRange even if a sync prunes it from cache
  const [retainedOverview, setRetainedOverview] = useState<{
    rangeKey: string;
    data: OverviewData;
  } | null>(() => {
    const initialKey = formatRangeParam(initialRange);
    const initialData = overviewCache[initialKey];
    return initialData ? { rangeKey: initialKey, data: initialData } : null;
  });

  // Active range ref guards against races when switching ranges quickly
  const activeRangeRef = React.useRef<RangeSelection>(activeRange);
  useEffect(() => {
    activeRangeRef.current = activeRange;
  }, [activeRange]);

  const overviewCacheRef = React.useRef<Record<string, OverviewData>>(overviewCache);
  useEffect(() => {
    overviewCacheRef.current = overviewCache;
  }, [overviewCache]);

  const setOverviewCache = useCallback(
    (updater: React.SetStateAction<Record<string, OverviewData>>) => {
      overviewCacheRef.current =
        typeof updater === "function" ? updater(overviewCacheRef.current) : updater;
      setOverviewCacheState(updater);
    },
    []
  );

  const displayedRangeKey = formatRangeParam(displayedRange);
  const cachedDisplayedOverview = overviewCache[displayedRangeKey];
  const displayedOverview: OverviewData | null =
    cachedDisplayedOverview ??
    (retainedOverview?.rangeKey === displayedRangeKey ? retainedOverview.data : null);

  useEffect(() => {
    if (cachedDisplayedOverview) {
      setRetainedOverview((prev) =>
        prev && prev.rangeKey === displayedRangeKey && prev.data === cachedDisplayedOverview
          ? prev
          : { rangeKey: displayedRangeKey, data: cachedDisplayedOverview }
      );
    }
  }, [displayedRangeKey, cachedDisplayedOverview]);

  const [streamLogState, setStreamLogState] = useState<StreamLogData | null>(() => {
    return initialStreamLog || null;
  });
  const [loadedPlaysCount, setLoadedPlaysCount] = useState<number>(() => {
    return initialStreamLog?.entries?.length || 50;
  });
  const [isLoadingMorePlays, setIsLoadingMorePlays] = useState<boolean>(false);

  const [sessionState, setSessionState] = useState<SessionData | null>(() => {
    return initialSession || null;
  });

  // Latest committed state, readable from fetch callbacks without re-creating them
  const streamLogStateRef = useRef(streamLogState);
  useEffect(() => {
    streamLogStateRef.current = streamLogState;
  }, [streamLogState]);
  const sessionStateRef = useRef(sessionState);
  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => {
    const syncTime =
      initialSession?.lastSyncedAt ||
      initialStreamLog?.lastSyncedAt ||
      (initialOverview && "lastSyncedAt" in initialOverview ? (initialOverview as OverviewData).lastSyncedAt : undefined);
    return syncTime ? new Date(syncTime) : null;
  });

  // Session-accumulated enrichment overlays and delisted IDs keep artwork across mode and range switches
  const enrichmentOverlayRef = useRef<Map<string, EnrichmentPatchData>>(new Map());
  const delistedSetRef = useRef<Set<string>>(new Set());

  const handleCentralEnriched = useCallback(
    (enriched: EnrichedTrackItem[], delistedIds: string[]) => {
      if (enriched.length === 0 && delistedIds.length === 0) return;

      for (const item of enriched) {
        enrichmentOverlayRef.current.set(item.requestedId, {
          albumImageUrl: item.albumImageUrl,
          artistId: item.artistId,
          albumId: item.albumId,
        });
      }
      for (const id of delistedIds) {
        delistedSetRef.current.add(id);
      }

      setOverviewCache((prev) => {
        const { updatedCache, changed } = patchOverviewCacheWithEnrichment(
          prev,
          enrichmentOverlayRef.current,
          delistedSetRef.current
        );
        return changed ? updatedCache : prev;
      });

      setStreamLogState((prev) =>
        patchStreamLogWithEnrichment(prev, enrichmentOverlayRef.current, delistedSetRef.current)
      );

      setSessionState((prev) =>
        patchSessionWithEnrichment(prev, enrichmentOverlayRef.current, delistedSetRef.current)
      );
    },
    [setOverviewCache]
  );

  // Fetch Overview data from server (cached on server, reset on sync)
  const fetchOverview = useCallback(async (rangeToFetch: RangeSelection) => {
    const rangeParam = formatRangeParam(rangeToFetch);
    const timezone = tzRef.current;
    const generation = requestGenerationRef.current;
    const seq = (overviewFetchSeqRef.current.get(rangeParam) ?? 0) + 1;
    overviewFetchSeqRef.current.set(rangeParam, seq);
    try {
      const tzQuery = timezone ? `&tz=${encodeURIComponent(timezone)}` : "";
      const url = `/api/listening/overview?range=${encodeURIComponent(rangeParam)}${tzQuery}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = (await res.json()) as OverviewData;
        if (
          generation !== requestGenerationRef.current ||
          timezone !== tzRef.current ||
          overviewFetchSeqRef.current.get(rangeParam) !== seq
        ) {
          return null;
        }
        if (data && data.metrics) {
          setOverviewCache((prev) => {
            const next = { ...prev, [rangeParam]: data };
            if (enrichmentOverlayRef.current.size > 0 || delistedSetRef.current.size > 0) {
              return patchOverviewCacheWithEnrichment(
                next,
                enrichmentOverlayRef.current,
                delistedSetRef.current
              ).updatedCache;
            }
            return next;
          });
          if (formatRangeParam(activeRangeRef.current) === rangeParam) {
            setDisplayedRange(rangeToFetch);
            setIsRangeLoading(false);
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
    if (
      generation === requestGenerationRef.current &&
      timezone === tzRef.current &&
      overviewFetchSeqRef.current.get(rangeParam) === seq &&
      formatRangeParam(activeRangeRef.current) === rangeParam
    ) {
      setDisplayedRange(rangeToFetch);
      setIsRangeLoading(false);
    }
    return null;
  }, [setOverviewCache]);

  // Fetch Stream Log from server (cached on server, reset on sync)
  const fetchStreamLog = useCallback(async (countToFetch?: number, aggregatesOnly = false) => {
    const timezone = tzRef.current;
    const generation = requestGenerationRef.current;
    try {
      // Background / revalidation fetches only the head slice (50) instead of hundreds of older rows
      const depth = aggregatesOnly ? 1 : countToFetch || 50;
      const tzQuery = timezone ? `&tz=${encodeURIComponent(timezone)}` : "";
      const url = `/api/listening/stream-log?limit=${depth}${tzQuery}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = (await res.json()) as StreamLogData;
        if (generation !== requestGenerationRef.current || timezone !== tzRef.current) return;
        if (data && data.entries) {
          // A head refresh that does not reach the loaded rows replaces them, like an explicit depth
          const replaces = Boolean(countToFetch) || !streamLogHeadOverlaps(streamLogStateRef.current, data);
          setStreamLogState((prev) => {
            if (aggregatesOnly && prev) return { ...prev, rawMetrics: data.rawMetrics, metrics: data.metrics };
            const next = countToFetch ? data : mergeStreamLogHead(prev, data);
            if (enrichmentOverlayRef.current.size > 0 || delistedSetRef.current.size > 0) {
              return patchStreamLogWithEnrichment(next, enrichmentOverlayRef.current, delistedSetRef.current);
            }
            return next;
          });
          if (!aggregatesOnly) setLoadedPlaysCount((prev) => (replaces ? data.entries.length : Math.max(prev, data.entries.length)));
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

  // Load the next page of Plays using keyset cursor pagination
  const handleLoadMoreStreamLog = useCallback(async () => {
    if (
      isLoadingMorePlays ||
      !streamLogState ||
      streamLogState.hasMore === false ||
      !streamLogState.nextCursor
    ) {
      return;
    }
    const timezone = tzRef.current;
    const generation = requestGenerationRef.current;
    setIsLoadingMorePlays(true);
    try {
      const cursor = streamLogState.nextCursor;
      const cursorId = streamLogState.nextCursorId || "";
      const lastEntry = streamLogState.entries[streamLogState.entries.length - 1];
      const prevPlayedAt = lastEntry?.playedAt || "";

      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      const limit = isMobile ? "25" : "50";

      const tzQuery = timezone ? `&tz=${encodeURIComponent(timezone)}` : "";
      const params = new URLSearchParams({
        limit,
        cursor,
        cursorId,
        prevPlayedAt,
      });

      const url = `/api/listening/stream-log?${params.toString()}${tzQuery}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (res.ok) {
        const data = (await res.json()) as StreamLogData;
        if (generation !== requestGenerationRef.current || timezone !== tzRef.current) return;
        if (data && data.entries) {
          // The list may have been replaced (depth restore, refresh) while this page was in flight
          if (!isStreamLogCursorCurrent(streamLogStateRef.current, cursor, cursorId)) return;
          setStreamLogState((prev) => {
            const next = appendStreamLogPage(prev, data, cursor, cursorId);
            if (!next || next === prev) return prev;
            if (enrichmentOverlayRef.current.size > 0 || delistedSetRef.current.size > 0) {
              return patchStreamLogWithEnrichment(next, enrichmentOverlayRef.current, delistedSetRef.current);
            }
            return next;
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
    const timezone = tzRef.current;
    const generation = requestGenerationRef.current;
    try {
      const tzQuery = timezone ? `?tz=${encodeURIComponent(timezone)}` : "";
      const url = `/api/listening/session${tzQuery}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = (await res.json()) as SessionData;
        if (generation !== requestGenerationRef.current || timezone !== tzRef.current) return;
        if (data && data.sessions) {
          setSessionState(() => {
            if (enrichmentOverlayRef.current.size > 0 || delistedSetRef.current.size > 0) {
              return patchSessionWithEnrichment(data, enrichmentOverlayRef.current, delistedSetRef.current);
            }
            return data;
          });
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

  // A timezone change invalidates every cached range and drops every request in flight,
  // including the initial ones, so anything not loaded yet is fetched in full here.
  const refetchAfterTimezoneChange = useCallback(() => {
    requestGenerationRef.current++;
    overviewCacheRef.current = {};
    setOverviewCache({});
    void fetchOverview(activeRangeRef.current);
    if (streamLogStateRef.current) {
      void fetchStreamLog(undefined, true);
    } else {
      void fetchStreamLog();
    }
    if (!sessionStateRef.current) void fetchSession();
  }, [fetchOverview, fetchStreamLog, fetchSession, setOverviewCache]);

  useEffect(() => {
    if (tzRef.current !== visitorTimezone) {
      tzRef.current = visitorTimezone;
      refetchAfterTimezoneChange();
    }
  }, [visitorTimezone, refetchAfterTimezoneChange]);

  // Initial load: fetch whatever the server did not provide
  useEffect(() => {
    async function init() {
      const hasOverview = Boolean(overviewCache[formatRangeParam(activeRange)]);
      const hasStreamLog = Boolean(streamLogState);
      const hasSession = Boolean(sessionState);

      if (hasOverview && hasStreamLog && hasSession) {
        return;
      }
      try {
        const promises: Promise<unknown>[] = [];
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

  // Switch the Overview range. A cached range shows immediately; otherwise the current view stays until the fetch lands.
  const selectRange = useCallback(
    (range: RangeSelection) => {
      const rangeParam = formatRangeParam(range);
      setActiveRange(range);
      activeRangeRef.current = range;
      if (overviewCacheRef.current[rangeParam]) {
        setDisplayedRange(range);
        setIsRangeLoading(false);
        return;
      }
      setIsRangeLoading(true);
      void fetchOverview(range);
    },
    [fetchOverview]
  );

  return {
    activeRange,
    setActiveRange,
    displayedRange,
    setDisplayedRange,
    displayedOverview,
    isRangeLoading,
    selectRange,
    activeRangeRef,
    requestGenerationRef,
    overviewCache,
    setOverviewCache,
    overviewCacheRef,
    streamLogState,
    loadedPlaysCount,
    isLoadingMorePlays,
    sessionState,
    lastSyncedAt,
    setLastSyncedAt,
    handleCentralEnriched,
    fetchOverview,
    fetchStreamLog,
    fetchSession,
    handleLoadMoreStreamLog,
  };
}
