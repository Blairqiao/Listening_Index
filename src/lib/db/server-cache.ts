import { revalidateTag } from "next/cache";
import type { OverviewData, StreamLogData, SessionData } from "./queries/types";
import { RangeKey } from "@/lib/mock-listening-data";
import { KeyedAsyncCache } from "@/lib/async-utils";

const CACHE_TTL_MS = 60 * 1000; // 60 seconds

interface ServerListeningCache {
  overview: KeyedAsyncCache<OverviewData>;
  streamLog: KeyedAsyncCache<StreamLogData>;
  session: KeyedAsyncCache<SessionData>;
}

const globalForCache = globalThis as unknown as {
  __serverListeningCache?: ServerListeningCache;
};

if (!globalForCache.__serverListeningCache) {
  globalForCache.__serverListeningCache = {
    overview: new KeyedAsyncCache<OverviewData>(CACHE_TTL_MS),
    streamLog: new KeyedAsyncCache<StreamLogData>(CACHE_TTL_MS),
    session: new KeyedAsyncCache<SessionData>(CACHE_TTL_MS),
  };
}

const cacheStore: ServerListeningCache = globalForCache.__serverListeningCache;

let cacheEpoch = 0;
const cacheClearListeners: Array<() => void> = [];

export function registerCacheClearListener(listener: () => void): void {
  cacheClearListeners.push(listener);
}

export function clearServerCache(): void {
  cacheEpoch++;
  cacheStore.overview.clear();
  cacheStore.streamLog.clear();
  cacheStore.session.clear();
  for (const listener of cacheClearListeners) {
    try {
      listener();
    } catch (_error) {
      return;
    }
  }
  console.log("[SERVER CACHE] All server listening caches purged.");

  try {
    revalidateTag("listening-data", "max");
  } catch {
    // Graceful fallback if called outside Next.js request context
  }
}

export function getCachedOverview(range: RangeKey): OverviewData | undefined {
  return cacheStore.overview.get(range);
}

export function setCachedOverview(range: RangeKey, data: OverviewData): void {
  cacheStore.overview.set(range, data);
}

export function getCachedStreamLog(limit: number): StreamLogData | undefined {
  return cacheStore.streamLog.get(String(limit));
}

export function setCachedStreamLog(limit: number, data: StreamLogData): void {
  cacheStore.streamLog.set(String(limit), data);
}

export function getCachedSession(): SessionData | null {
  return cacheStore.session.get("session") ?? null;
}

export function setCachedSession(data: SessionData): void {
  cacheStore.session.set("session", data);
}

/**
 * Retrieves cached Overview data, or invokes fetcher with concurrent in-flight deduplication.
 */
export async function getOrFetchOverview<T extends OverviewData = OverviewData>(
  range: RangeKey,
  tzOrFetcher: string | (() => Promise<T>),
  maybeFetcher?: () => Promise<T>
): Promise<T> {
  const fetcher = (typeof tzOrFetcher === "function" ? tzOrFetcher : maybeFetcher) as () => Promise<T>;
  if (!fetcher) {
    throw new Error("[SERVER CACHE] No fetcher provided for getOrFetchOverview");
  }
  return cacheStore.overview.getOrFetch(
    range,
    fetcher as () => Promise<OverviewData>,
    () => cacheEpoch
  ) as Promise<T>;
}

/**
 * Retrieves cached Stream Log data, or invokes fetcher with concurrent in-flight deduplication.
 */
export async function getOrFetchStreamLog<T extends StreamLogData = StreamLogData>(
  limit: number,
  tzOrFetcher: string | (() => Promise<T>),
  maybeFetcher?: () => Promise<T>
): Promise<T> {
  const fetcher = (typeof tzOrFetcher === "function" ? tzOrFetcher : maybeFetcher) as () => Promise<T>;
  if (!fetcher) {
    throw new Error("[SERVER CACHE] No fetcher provided for getOrFetchStreamLog");
  }
  return cacheStore.streamLog.getOrFetch(
    String(limit),
    fetcher as () => Promise<StreamLogData>,
    () => cacheEpoch
  ) as Promise<T>;
}

/**
 * Retrieves cached Session data, or invokes fetcher with concurrent in-flight deduplication.
 */
export async function getOrFetchSession<T extends SessionData = SessionData>(
  tzOrFetcher?: string | (() => Promise<T>),
  maybeFetcher?: () => Promise<T>
): Promise<T> {
  const fetcher = (typeof tzOrFetcher === "function" ? tzOrFetcher : maybeFetcher) as () => Promise<T>;
  if (!fetcher) {
    throw new Error("[SERVER CACHE] No fetcher provided for getOrFetchSession");
  }
  return cacheStore.session.getOrFetch(
    "session",
    fetcher as () => Promise<SessionData>,
    () => cacheEpoch
  ) as Promise<T>;
}
