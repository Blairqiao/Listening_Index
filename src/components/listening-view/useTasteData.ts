"use client";

import type { TastePhasesData } from "@/lib/taste/types";
import { useEpochJson, type CalendarStatus } from "./useEpochJson";

export function useTasteData(opts: {
  enabled: boolean;
  timezone: string;
  refreshKey: number;
}): { data: TastePhasesData | null; status: CalendarStatus } {
  return useEpochJson<TastePhasesData>(
    "/api/listening/taste",
    opts,
    "[TASTE DATA FETCH]",
  );
}
