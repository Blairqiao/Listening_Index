"use client";

import type { CalendarData } from "@/lib/calendar";
import {
  useEpochJson,
  shouldRefetchCalendar,
  type CalendarStatus,
} from "./useEpochJson";

export { shouldRefetchCalendar, type CalendarStatus };

export function useCalendarData(opts: {
  enabled: boolean;
  timezone: string;
  refreshKey: number;
}): { data: CalendarData | null; status: CalendarStatus } {
  return useEpochJson<CalendarData>(
    "/api/listening/calendar",
    opts,
    "[CALENDAR DATA FETCH]",
  );
}
