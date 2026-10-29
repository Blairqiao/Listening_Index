import { revalidateTag } from "next/cache";
import type { OverviewData, StreamLogData, SessionData } from "./queries/types";
import type { RangeKey } from "@/lib/types";
import { KeyedAsyncCache } from "@/lib/async-utils";
import { sanitizeTimezone } from "./queries/helpers";

type ListeningData = OverviewData | StreamLogData | SessionData;
const globalForCache = globalThis as unknown as {
  __boundedListeningCache?: KeyedAsyncCache<ListeningData>;
};
const cacheStore = globalForCache.__boundedListeningCache ??= new KeyedAsyncCache<ListeningData>(60_000);
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
  range: RangeKey,
  timezone: string,
  fetcher: () => Promise<T>
): Promise<T> {
  return cacheStore.getOrFetch(JSON.stringify([cacheEpoch, "overview", range, timezoneIdentity(timezone)]), fetcher, () => cacheEpoch) as Promise<T>;
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
  timezone: string,
  fetcher: () => Promise<T>
): Promise<T> {
  return cacheStore.getOrFetch(JSON.stringify([cacheEpoch, "session", timezoneIdentity(timezone)]), fetcher, () => cacheEpoch) as Promise<T>;
}
