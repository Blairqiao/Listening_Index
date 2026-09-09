import { revalidateTag } from "next/cache";
import type { OverviewData, StreamLogData, SessionData } from "./queries";
import { RangeKey } from "@/lib/mock-listening-data";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface ServerListeningCache {
  overview: Map<RangeKey, CacheEntry<OverviewData>>;
  streamLog: Map<number, CacheEntry<StreamLogData>>;
  session: CacheEntry<SessionData> | null;
}

const CACHE_TTL_MS = 60 * 1000; // 60 seconds

const globalForCache = globalThis as unknown as {
  __serverListeningCache?: ServerListeningCache;
};

if (!globalForCache.__serverListeningCache) {
  globalForCache.__serverListeningCache = {
    overview: new Map(),
    streamLog: new Map(),
    session: null,
  };
}

const cacheStore: ServerListeningCache = globalForCache.__serverListeningCache;

export function getCachedOverview(range: RangeKey): OverviewData | undefined {
  const entry = cacheStore.overview.get(range);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cacheStore.overview.delete(range);
    return undefined;
  }
  return entry.data;
}

export function setCachedOverview(range: RangeKey, data: OverviewData): void {
  cacheStore.overview.set(range, { data, timestamp: Date.now() });
}

export function getCachedStreamLog(limit: number): StreamLogData | undefined {
  const entry = cacheStore.streamLog.get(limit);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cacheStore.streamLog.delete(limit);
    return undefined;
  }
  return entry.data;
}

export function setCachedStreamLog(limit: number, data: StreamLogData): void {
  cacheStore.streamLog.set(limit, { data, timestamp: Date.now() });
}

export function getCachedSession(): SessionData | null {
  const entry = cacheStore.session;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cacheStore.session = null;
    return null;
  }
  return entry.data;
}

export function setCachedSession(data: SessionData): void {
  cacheStore.session = { data, timestamp: Date.now() };
}

export function clearServerCache(): void {
  cacheStore.overview.clear();
  cacheStore.streamLog.clear();
  cacheStore.session = null;
  console.log("[SERVER CACHE] All server listening caches purged.");

  try {
    revalidateTag("listening-data", "max");
  } catch {
    // Graceful fallback if called outside Next.js request context
  }
}
