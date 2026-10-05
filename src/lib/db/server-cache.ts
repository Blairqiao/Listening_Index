import { revalidateTag } from "next/cache";
import type { OverviewData, StreamLogData, SessionData } from "./queries/types";
import { RangeKey } from "@/lib/mock-listening-data";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface ServerListeningCache {
  overview: Map<string, CacheEntry<OverviewData>>;
  streamLog: Map<string, CacheEntry<StreamLogData>>;
  session: Map<string, CacheEntry<SessionData>>;
  inFlightOverview: Map<string, Promise<OverviewData>>;
  inFlightStreamLog: Map<string, Promise<StreamLogData>>;
  inFlightSession: Map<string, Promise<SessionData>>;
}

const CACHE_TTL_MS = 60 * 1000; // 60 seconds

const globalForCache = globalThis as unknown as {
  __serverListeningCache?: ServerListeningCache;
};

if (!globalForCache.__serverListeningCache) {
  globalForCache.__serverListeningCache = {
    overview: new Map(),
    streamLog: new Map(),
    session: new Map(),
    inFlightOverview: new Map(),
    inFlightStreamLog: new Map(),
    inFlightSession: new Map(),
  };
} else {
  if (!globalForCache.__serverListeningCache.inFlightOverview) {
    globalForCache.__serverListeningCache.inFlightOverview = new Map();
  }
  if (!globalForCache.__serverListeningCache.inFlightStreamLog) {
    globalForCache.__serverListeningCache.inFlightStreamLog = new Map();
  }
  if (!globalForCache.__serverListeningCache.inFlightSession) {
    globalForCache.__serverListeningCache.inFlightSession = new Map();
  }
}

const cacheStore: ServerListeningCache = globalForCache.__serverListeningCache;


export function getCachedOverview(range: RangeKey): OverviewData | undefined {
  const key = range;
  const entry = cacheStore.overview.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cacheStore.overview.delete(key);
    return undefined;
  }
  return entry.data;
}

export function setCachedOverview(range: RangeKey, data: OverviewData): void {
  const key = range;
  cacheStore.overview.set(key, { data, timestamp: Date.now() });
}

export function getCachedStreamLog(limit: number): StreamLogData | undefined {
  const key = String(limit);
  const entry = cacheStore.streamLog.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cacheStore.streamLog.delete(key);
    return undefined;
  }
  return entry.data;
}

export function setCachedStreamLog(limit: number, data: StreamLogData): void {
  const key = String(limit);
  cacheStore.streamLog.set(key, { data, timestamp: Date.now() });
}

export function getCachedSession(): SessionData | null {
  const key = "session";
  const entry = cacheStore.session.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cacheStore.session.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedSession(data: SessionData): void {
  const key = "session";
  cacheStore.session.set(key, { data, timestamp: Date.now() });
}

const cacheClearListeners: Array<() => void> = [];

let cacheEpoch = 0;

export function registerCacheClearListener(listener: () => void): void {
  cacheClearListeners.push(listener);
}

export function clearServerCache(): void {
  cacheEpoch++;
  cacheStore.overview.clear();
  cacheStore.streamLog.clear();
  cacheStore.session.clear();
  cacheStore.inFlightOverview.clear();
  cacheStore.inFlightStreamLog.clear();
  cacheStore.inFlightSession.clear();
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

  const cached = getCachedOverview(range);
  if (cached) return cached as T;

  const key = range;
  let inFlight = cacheStore.inFlightOverview.get(key) as Promise<T> | undefined;
  if (!inFlight) {
    const fetchEpoch = cacheEpoch;
    inFlight = (async () => {
      try {
        const data = await fetcher();
        if (fetchEpoch === cacheEpoch) {
          setCachedOverview(range, data);
        }
        return data;
      } finally {
        cacheStore.inFlightOverview.delete(key);
      }
    })();
    cacheStore.inFlightOverview.set(key, inFlight as Promise<OverviewData>);
  }
  return inFlight;
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

  const cached = getCachedStreamLog(limit);
  if (cached) return cached as T;

  const key = String(limit);
  let inFlight = cacheStore.inFlightStreamLog.get(key) as Promise<T> | undefined;
  if (!inFlight) {
    const fetchEpoch = cacheEpoch;
    inFlight = (async () => {
      try {
        const data = await fetcher();
        if (fetchEpoch === cacheEpoch) {
          setCachedStreamLog(limit, data);
        }
        return data;
      } finally {
        cacheStore.inFlightStreamLog.delete(key);
      }
    })();
    cacheStore.inFlightStreamLog.set(key, inFlight as Promise<StreamLogData>);
  }
  return inFlight;
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

  const cached = getCachedSession();
  if (cached) return cached as T;

  const key = "session";
  let inFlight = cacheStore.inFlightSession.get(key) as Promise<T> | undefined;
  if (!inFlight) {
    const fetchEpoch = cacheEpoch;
    inFlight = (async () => {
      try {
        const data = await fetcher();
        if (fetchEpoch === cacheEpoch) {
          setCachedSession(data);
        }
        return data;
      } finally {
        cacheStore.inFlightSession.delete(key);
      }
    })();
    cacheStore.inFlightSession.set(key, inFlight as Promise<SessionData>);
  }
  return inFlight;
}


