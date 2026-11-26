import { revalidateTag } from "next/cache";
import type { OverviewData, StreamLogData, SessionData } from "./queries/types";
import type { CalendarData } from "@/lib/calendar";
import type { TastePhasesData } from "@/lib/taste/types";
import type { SearchFilter, SearchResponse, SearchSort } from "@/lib/search-types";
import { formatRangeParam, type RangeSelection } from "@/lib/range";
import { KeyedAsyncCache } from "@/lib/async-utils";
import { sanitizeTimezone } from "./queries/helpers";

type ListeningData =
  | OverviewData
  | StreamLogData
  | SessionData
  | CalendarData
  | TastePhasesData
  | SearchResponse;
const globalForCache = globalThis as unknown as {
  __boundedListeningCache?: KeyedAsyncCache<ListeningData>;
};
// One refresh asks for six Overview ranges, the Stream Log and Sessions, keyed by timezone,
// so the default of 16 in-flight keys turns a few concurrent visitors into 429s.
const MAX_CACHE_ENTRIES = 128;
const MAX_IN_FLIGHT_KEYS = 64;
const cacheStore = globalForCache.__boundedListeningCache ??=
  new KeyedAsyncCache<ListeningData>(60_000, MAX_CACHE_ENTRIES, MAX_IN_FLIGHT_KEYS);
let cacheEpoch = 0;
const cacheClearListeners: Array<() => void> = [];

function timezoneIdentity(timezone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: sanitizeTimezone(timezone),
  }).resolvedOptions().timeZone;
}

export function registerCacheClearListener(listener: () => void): void {
  cacheClearListeners.push(listener);
}

export function clearServerCache(): void {
  cacheEpoch++;
  cacheStore.clear();
  for (const listener of cacheClearListeners) listener();
  try {
    revalidateTag("listening-data", "max");
  } catch {
    // Cache invalidation also runs outside a Next.js request.
  }
}

export function getOrFetchOverview<T extends OverviewData = OverviewData>(
  sel: RangeSelection,
  timezone: string,
  fetcher: () => Promise<T>
): Promise<T> {
  return cacheStore.getOrFetch(
    JSON.stringify([cacheEpoch, "overview", formatRangeParam(sel), timezoneIdentity(timezone)]),
    fetcher,
    () => cacheEpoch
  ) as Promise<T>;
}

export interface StreamLogPageIdentity {
  cursor?: string;
  cursorId?: string;
  prevPlayedAt?: string;
}

export function getOrFetchStreamLog<T extends StreamLogData = StreamLogData>(
  limit: number,
  timezone: string,
  fetcher: () => Promise<T>,
  page: StreamLogPageIdentity = {}
): Promise<T> {
  if (limit > 250) return fetcher();
  const key = JSON.stringify([cacheEpoch, "stream-log", limit, timezoneIdentity(timezone), page.cursor ?? null,
    page.cursorId ?? null, page.prevPlayedAt ?? null]);
  return cacheStore.getOrFetch(key, fetcher, () => cacheEpoch) as Promise<T>;
}

export function getOrFetchSession<T extends SessionData = SessionData>(
  fetcher: () => Promise<T>
): Promise<T> {
  return cacheStore.getOrFetch(JSON.stringify([cacheEpoch, "session"]), fetcher, () => cacheEpoch) as Promise<T>;
}

export function getOrFetchCalendar<T extends CalendarData = CalendarData>(
  timezone: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const key = JSON.stringify([cacheEpoch, "calendar", timezoneIdentity(timezone)]);
  return cacheStore.getOrFetch(key, fetcher, () => cacheEpoch) as Promise<T>;
}

export function getOrFetchTaste<T extends TastePhasesData = TastePhasesData>(
  timezone: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const key = JSON.stringify([cacheEpoch, "taste", timezoneIdentity(timezone)]);
  return cacheStore.getOrFetch(key, fetcher, () => cacheEpoch) as Promise<T>;
}

/** Caches the empty-query Search browse, which every visit to Search opens on. Typed queries are not cached. */
export function getOrFetchSearchBrowse<T extends SearchResponse = SearchResponse>(
  sort: SearchSort,
  page: number,
  filter: SearchFilter,
  fetcher: () => Promise<T>
): Promise<T> {
  const key = JSON.stringify([cacheEpoch, "search-browse", sort, page, filter]);
  return cacheStore.getOrFetch(key, fetcher, () => cacheEpoch) as Promise<T>;
}
