import React, { useCallback, useEffect, useRef, useState } from "react";
import type { RangeSelection } from "@/lib/range";
import type { OverviewData } from "@/lib/db/queries";
import {
  computeSyncedAgo,
  overviewRefreshOrder,
  pruneOverviewCacheWindows,
  STREAM_LOG_PAGE_SIZE,
} from "./listening-helpers";

export interface UseListeningSyncParams {
  isAuthenticated: boolean;
  activeRangeRef: React.MutableRefObject<RangeSelection>;
  requestGenerationRef: React.MutableRefObject<number>;
  setOverviewCache: React.Dispatch<React.SetStateAction<Record<string, OverviewData>>>;
  fetchOverview: (range: RangeSelection) => Promise<unknown>;
  fetchStreamLog: (countToFetch?: number) => Promise<void>;
  fetchSession: () => Promise<void>;
  lastSyncedAt: Date | null;
  setLastSyncedAt: (date: Date) => void;
}

/**
 * Manual sync, background refresh after each :00/:30 cron window, refresh on tab focus,
 * and refresh after an upload. Every refresh refetches all Overview ranges.
 */
export function useListeningSync({
  isAuthenticated,
  activeRangeRef,
  requestGenerationRef,
  setOverviewCache,
  fetchOverview,
  fetchStreamLog,
  fetchSession,
  lastSyncedAt,
  setLastSyncedAt,
}: UseListeningSyncParams) {
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncedAgoStr, setSyncedAgoStr] = useState<string>("Just now");

  // Recalculate the elapsed-time label every 10 seconds
  useEffect(() => {
    setSyncedAgoStr(computeSyncedAgo(lastSyncedAt));
    const interval = setInterval(() => {
      setSyncedAgoStr(computeSyncedAgo(lastSyncedAt));
    }, 10000);
    return () => clearInterval(interval);
  }, [lastSyncedAt]);

  // Manual sync trigger: runs ingestion, which purges the server cache, then refetches every view
  const handleTriggerSync = useCallback(async () => {
    if (!isAuthenticated || isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Cache-Control": "no-cache" },
      });
      const syncData = await res.json().catch(() => ({}));
      if (res.ok && syncData?.success === true) {
        requestGenerationRef.current++;
        setSyncError(null);
        setLastSyncedAt(syncData.syncedAt ? new Date(syncData.syncedAt) : new Date());
        setSyncedAgoStr("Just now");

        // Existing views stay visible (dimmed) until each range's fresh,
        // enrichment-patched response replaces it. Non-active cached windows are dropped.
        const active = activeRangeRef.current;
        setOverviewCache((prev) => pruneOverviewCacheWindows(prev, active));
        await Promise.all([
          ...overviewRefreshOrder(active).map((range) => fetchOverview(range)),
          fetchStreamLog(),
          fetchSession(),
        ]);
      } else {
        const errorMsg =
          syncData?.error ||
          (res.status === 409
            ? "Sync conflict: not connected"
            : `Sync failed (${res.status || "error"})`);
        setSyncError(errorMsg);
      }
    } catch (err) {
      console.error("[SYNC TRIGGER] Error triggering sync:", err);
      setSyncError("Network error triggering sync");
    } finally {
      setIsSyncing(false);
    }
  }, [
    isSyncing,
    isAuthenticated,
    activeRangeRef,
    requestGenerationRef,
    setOverviewCache,
    setLastSyncedAt,
    fetchOverview,
    fetchStreamLog,
    fetchSession,
  ]);

  // Background silent refetch (auto-sync schedule and focus revalidation) of every range
  const refetchActiveData = useCallback(async () => {
    requestGenerationRef.current++;
    const active = activeRangeRef.current;
    setOverviewCache((prev) => pruneOverviewCacheWindows(prev, active));
    try {
      await Promise.all([
        ...overviewRefreshOrder(active).map((range) => fetchOverview(range)),
        fetchStreamLog(),
        fetchSession(),
      ]);
    } catch (err) {
      console.error("[AUTO REFETCH] Error updating telemetry:", err);
    }
  }, [activeRangeRef, requestGenerationRef, setOverviewCache, fetchOverview, fetchStreamLog, fetchSession]);

  // When an upload batch completes, refetch every range so all of them include the imported Plays.
  // An import can add older Plays inside the loaded Stream Log window, so that list is replaced, not merged.
  const handleUploadComplete = useCallback(async () => {
    requestGenerationRef.current++;
    const active = activeRangeRef.current;
    setOverviewCache((prev) => pruneOverviewCacheWindows(prev, active));
    try {
      await Promise.all([
        ...overviewRefreshOrder(active).map((range) => fetchOverview(range)),
        fetchStreamLog(STREAM_LOG_PAGE_SIZE),
        fetchSession(),
      ]);
    } catch (err) {
      console.error("[UPLOAD COMPLETE] Error refreshing listening data:", err);
    }
  }, [activeRangeRef, requestGenerationRef, setOverviewCache, fetchOverview, fetchStreamLog, fetchSession]);

  // Wall-clock auto-refresh: 30s after every :00 and :30 cron window
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

  // Returning to the tab after a cron window refetches silently, at most once a minute
  const lastFocusRefetchRef = useRef<number>(0);
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      const now = Date.now();
      if (document.visibilityState === "visible") {
        if (now - lastFocusRefetchRef.current < 60_000) return;
        if (!lastSyncedAt || now - lastSyncedAt.getTime() >= 30 * 60 * 1000) {
          lastFocusRefetchRef.current = now;
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

  return {
    isSyncing,
    syncError,
    syncedAgoStr,
    handleTriggerSync,
    handleUploadComplete,
  };
}
