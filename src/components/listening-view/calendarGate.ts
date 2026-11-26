import type { CalendarStatus } from "./useEpochJson";

interface Loadable<T> {
  data: T | null;
  status: CalendarStatus;
}

/**
 * Calendar and Taste phases load as two requests. On first load, keep the
 * skeleton until Taste settles so the heatmaps and phase cards appear together.
 * A Taste error releases the calendar on its own. Refreshes keep what is shown.
 */
export function gateCalendarOnTaste<C, T>(
  calendar: Loadable<C>,
  taste: Loadable<T>,
): { data: C | null; isLoading: boolean } {
  const tasteSettled = taste.data !== null || taste.status === "ready" || taste.status === "error";
  if (calendar.data !== null && tasteSettled) {
    return { data: calendar.data, isLoading: false };
  }
  const calendarFailed = calendar.data === null && calendar.status === "error";
  return { data: null, isLoading: !calendarFailed };
}
