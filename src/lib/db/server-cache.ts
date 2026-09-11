import { revalidateTag } from "next/cache";
import type { OverviewData, StreamLogData, SessionData } from "./queries";
import { RangeKey } from "@/lib/mock-listening-data";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface ServerListeningCache {
  overview: Map<string, CacheEntry<OverviewData>>;
  streamLog: Map<string, CacheEntry<StreamLogData>>;
  session: Map<string, CacheEntry<SessionData>>;
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
  };
}

const cacheStore: ServerListeningCache = globalForCache.__serverListeningCache;

export function getCachedOverview(range: RangeKey, tz = ""): OverviewData | undefined {
  const key = `${range}:${tz}`;
  const entry = cacheStore.overview.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cacheStore.overview.delete(key);
    return undefined;
  }
  return entry.data;
}

export function setCachedOverview(range: RangeKey, data: OverviewData, tz = ""): void {
  const key = `${range}:${tz}`;
  cacheStore.overview.set(key, { data, timestamp: Date.now() });
}

export function getCachedStreamLog(limit: number, tz = ""): StreamLogData | undefined {
  const key = `${limit}:${tz}`;
  const entry = cacheStore.streamLog.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cacheStore.streamLog.delete(key);
    return undefined;
  }
  return entry.data;
}

export function setCachedStreamLog(limit: number, data: StreamLogData, tz = ""): void {
  const key = `${limit}:${tz}`;
  cacheStore.streamLog.set(key, { data, timestamp: Date.now() });
}

export function getCachedSession(tz = ""): SessionData | null {
  const key = tz || "default";
  const entry = cacheStore.session.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cacheStore.session.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedSession(data: SessionData, tz = ""): void {
  const key = tz || "default";
  cacheStore.session.set(key, { data, timestamp: Date.now() });
}

export function clearServerCache(): void {
  cacheStore.overview.clear();
  cacheStore.streamLog.clear();
  cacheStore.session.clear();
  console.log("[SERVER CACHE] All server listening caches purged.");

  try {
    revalidateTag("listening-data", "max");
  } catch {
    // Graceful fallback if called outside Next.js request context
  }
}

