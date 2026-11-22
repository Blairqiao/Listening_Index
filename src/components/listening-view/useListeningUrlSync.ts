import { useCallback, useEffect, useRef, useState } from "react";
import type { Mode } from "@/lib/types";
import { formatRangeParam, isSameRange, parseRangeParam, type RangeSelection } from "@/lib/range";

export interface UseListeningUrlSyncParams {
  isAuthenticated: boolean;
  activeMode?: Mode;
  openModal: () => void;
  setActiveMode: (mode: Mode) => void;
  setActiveRange: (range: RangeSelection) => void;
  activeRangeRef: React.MutableRefObject<RangeSelection>;
  overviewCacheRef: React.MutableRefObject<Record<string, unknown>>;
  setDisplayedRange: (range: RangeSelection) => void;
  fetchOverview: (range: RangeSelection) => Promise<unknown>;
  setSelectedSessionId?: (id: string) => void;
  sanitizeActiveMode: (mode: Mode, isAuthenticated: boolean) => Mode;
}

export function useListeningUrlSync({
  isAuthenticated,
  activeMode,
  openModal,
  setActiveMode,
  setActiveRange,
  activeRangeRef,
  overviewCacheRef,
  setDisplayedRange,
  fetchOverview,
  setSelectedSessionId,
  sanitizeActiveMode,
}: UseListeningUrlSyncParams) {
  const appliedRef = useRef(false);
  // ?mode=3 (admin-only Live Player) requested before the visitor was authenticated
  const pendingLivePlayerRef = useRef(false);
  const [isPendingLivePlayer, setIsPendingLivePlayer] = useState(false);
  // Set when an URL-driven state update is queued so the URL-writing effect waits for the next render
  const skipNextUrlSyncRef = useRef(false);

  const clearPendingLivePlayer = useCallback(() => {
    if (pendingLivePlayerRef.current) {
      pendingLivePlayerRef.current = false;
      setIsPendingLivePlayer(false);
    }
  }, []);

  // Apply the URL once. Login and lock must not replay it over what the visitor chose since.
  useEffect(() => {
    if (appliedRef.current || typeof window === "undefined") return;
    appliedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    let willUpdateState = false;
    const m = params.get("mode");
    if (m === "0" || m === "1" || m === "2" || m === "3" || m === "4") {
      const requested = parseInt(m, 10) as Mode;
      const pending = requested === 3 && !isAuthenticated;
      pendingLivePlayerRef.current = pending;
      if (pending) setIsPendingLivePlayer(true);
      const nextMode = sanitizeActiveMode(requested, isAuthenticated);
      if (activeMode !== undefined && nextMode !== activeMode) {
        willUpdateState = true;
      }
      setActiveMode(nextMode);
    }
    const parsedRange = parseRangeParam(params.get("range"));
    if (parsedRange) {
      if (!isSameRange(parsedRange, activeRangeRef.current)) {
        willUpdateState = true;
      }
      setActiveRange(parsedRange);
      activeRangeRef.current = parsedRange;
      if (overviewCacheRef.current[formatRangeParam(parsedRange)]) {
        setDisplayedRange(parsedRange);
      } else {
        fetchOverview(parsedRange);
      }
    }
    if (willUpdateState) {
      skipNextUrlSyncRef.current = true;
    }
    const sess = params.get("session");
    if (sess) {
      if (setSelectedSessionId) setSelectedSessionId(sess);
    }
    const configParam = params.get("config");
    if (configParam === "true" || configParam === "1") {
      openModal();
    }
  }, [
    openModal,
    isAuthenticated,
    activeMode,
    fetchOverview,
    setActiveMode,
    setActiveRange,
    activeRangeRef,
    overviewCacheRef,
    setDisplayedRange,
    setSelectedSessionId,
    sanitizeActiveMode,
  ]);

  useEffect(() => {
    if (isAuthenticated && pendingLivePlayerRef.current) {
      pendingLivePlayerRef.current = false;
      setIsPendingLivePlayer(false);
      skipNextUrlSyncRef.current = true;
      setActiveMode(3);
    }
  }, [isAuthenticated, setActiveMode]);

  return {
    isPendingLivePlayer,
    pendingLivePlayerRef,
    clearPendingLivePlayer,
    skipNextUrlSyncRef,
  };
}
