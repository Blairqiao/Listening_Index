"use client";

import type { CalendarData } from "@/lib/calendar";
import {
  useEpochJson,
  prefetchEpochJson,
  shouldRefetchCalendar,
  type CalendarStatus,
} from "./useEpochJson";

export { shouldRefetchCalendar, type CalendarStatus };

const CALENDAR_PATH = "/api/listening/calendar";

export function prefetchCalendar(timezone: string, refreshKey: number): void {
  prefetchEpochJson(CALENDAR_PATH, timezone, refreshKey);
}

export function useCalendarData(opts: {
  enabled: boolean;
  timezone: string;
  refreshKey: number;
}): { data: CalendarData | null; status: CalendarStatus } {
  return useEpochJson<CalendarData>(
    CALENDAR_PATH,
    opts,
    "[CALENDAR DATA FETCH]",
  );
}
