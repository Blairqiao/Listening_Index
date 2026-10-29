import { useEffect } from "react";
import type { Mode, RangeKey } from "@/lib/types";

export interface UseListeningUrlSyncParams {
  isAuthenticated: boolean;
  rangeKeys: RangeKey[];
  openModal: () => void;
  setActiveMode: (mode: Mode) => void;
  setActiveRange: (range: RangeKey) => void;
  activeRangeRef: React.MutableRefObject<RangeKey>;
  overviewCacheRef: React.MutableRefObject<Record<string, unknown>>;
  setDisplayedRange: (range: RangeKey) => void;
  fetchOverview: (range: RangeKey) => Promise<unknown>;
  setSelectedSessionId?: (id: string) => void;
  sanitizeActiveMode: (mode: Mode, isAuthenticated: boolean) => Mode;
}

export function useListeningUrlSync({
  isAuthenticated,
  rangeKeys,
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
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const m = params.get("mode");
      if (m === "0" || m === "1" || m === "2" || m === "3") {
        setActiveMode(sanitizeActiveMode(parseInt(m, 10) as Mode, isAuthenticated));
      }
      const r = params.get("range");
      if (r && rangeKeys.includes(r as RangeKey)) {
        const rangeKey = r as RangeKey;
        setActiveRange(rangeKey);
        activeRangeRef.current = rangeKey;
        if (overviewCacheRef.current[rangeKey]) {
          setDisplayedRange(rangeKey);
        } else {
          fetchOverview(rangeKey);
        }
      }
      const sess = params.get("session");
      if (sess) {
        if (setSelectedSessionId) setSelectedSessionId(sess);
      }
      const configParam = params.get("config");
      if (configParam === "true" || configParam === "1") {
        openModal();
      }
    }
  }, [
    openModal,
    isAuthenticated,
    fetchOverview,
    rangeKeys,
    setActiveMode,
    setActiveRange,
    activeRangeRef,
    overviewCacheRef,
    setDisplayedRange,
    setSelectedSessionId,
      sanitizeActiveMode,
  ]);
}
