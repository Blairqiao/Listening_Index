"use client";

import type { TastePhasesData } from "@/lib/taste/types";
import { useEpochJson, prefetchEpochJson, type CalendarStatus } from "./useEpochJson";

const TASTE_PATH = "/api/listening/taste";

export function prefetchTaste(timezone: string, refreshKey: number): void {
  prefetchEpochJson(TASTE_PATH, timezone, refreshKey);
}

export function useTasteData(opts: {
  enabled: boolean;
  timezone: string;
  refreshKey: number;
}): { data: TastePhasesData | null; status: CalendarStatus } {
  return useEpochJson<TastePhasesData>(
    TASTE_PATH,
    opts,
    "[TASTE DATA FETCH]",
  );
}
