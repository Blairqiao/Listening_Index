import { registerCacheClearListener } from "../server-cache";
import type { SiteConfigState } from "./types";

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Deep cache module encapsulating in-memory TTL caching and in-flight promise
 * latch deduplication for cold-start database queries.
 */
export class AsyncLatchCache<T> {
  private cached: CacheEntry<T> | null = null;
  private inFlight: Promise<T> | null = null;

  constructor(
    private readonly ttlMs: number,
    private readonly defaultFetcher?: () => Promise<T>
  ) {
    registerCacheClearListener(() => this.invalidate());
  }

  /**
   * Retrieves the cached value if valid, or invokes the fetcher with in-flight deduplication.
   */
  async get(fetcher?: () => Promise<T>): Promise<T> {
    const now = Date.now();
    if (this.cached && now < this.cached.expiresAt) {
      return this.cached.value;
    }
    if (this.inFlight) {
      return this.inFlight;
    }

    const fn = fetcher || this.defaultFetcher;
    if (!fn) {
      throw new Error("[AsyncLatchCache] No fetcher provided for cache miss.");
    }

    this.inFlight = (async () => {
      try {
        const val = await fn();
        this.cached = { value: val, expiresAt: Date.now() + this.ttlMs };
        return val;
      } finally {
        this.inFlight = null;
      }
    })();

    return this.inFlight;
  }

  /**
   * Invalidates the cached entry immediately.
   */
  invalidate(): void {
    this.cached = null;
  }

  /**
   * Manually sets the cached value with an optional custom TTL.
   */
  set(value: T, customTtlMs?: number): void {
    this.cached = { value, expiresAt: Date.now() + (customTtlMs ?? this.ttlMs) };
  }

  /**
   * Peeks at current cache entry without triggering a fetch.
   */
  peek(): CacheEntry<T> | null {
    return this.cached;
  }

  getInFlight(): Promise<T> | null {
    return this.inFlight;
  }

  setInFlight(p: Promise<T> | null): void {
    this.inFlight = p;
  }
}

// ---------------------------------------------------------------------------
// Dedicated Query Cache Singletons
// ---------------------------------------------------------------------------

export const lastSyncCache = new AsyncLatchCache<string | undefined>(15_000);
export const catalogStatusCache = new AsyncLatchCache<boolean>(60_000);
export const siteConfigCache = new AsyncLatchCache<SiteConfigState>(60_000);

/**
 * Purges all database query in-memory caches.
 */
export function clearDbQueryCaches(): void {
  lastSyncCache.invalidate();
  catalogStatusCache.invalidate();
  siteConfigCache.invalidate();
}

registerCacheClearListener(clearDbQueryCaches);

// ---------------------------------------------------------------------------
// Backward Compatibility Bridge Exports
// ---------------------------------------------------------------------------

export function getCachedLastSync(): { value: string | undefined; expiresAt: number } | null {
  return lastSyncCache.peek();
}

export function setCachedLastSync(entry: { value: string | undefined; expiresAt: number } | null): void {
  if (entry) {
    lastSyncCache.set(entry.value, Math.max(0, entry.expiresAt - Date.now()));
  } else {
    lastSyncCache.invalidate();
  }
}

export function getInFlightLastSync(): Promise<string | undefined> | null {
  return lastSyncCache.getInFlight();
}

export function setInFlightLastSync(p: Promise<string | undefined> | null): void {
  lastSyncCache.setInFlight(p);
}

export function getCachedCatalogStatus(): { fullyEnriched: boolean; expiresAt: number } | null {
  const peek = catalogStatusCache.peek();
  return peek ? { fullyEnriched: peek.value, expiresAt: peek.expiresAt } : null;
}

export function setCachedCatalogStatus(entry: { fullyEnriched: boolean; expiresAt: number } | null): void {
  if (entry) {
    catalogStatusCache.set(entry.fullyEnriched, Math.max(0, entry.expiresAt - Date.now()));
  } else {
    catalogStatusCache.invalidate();
  }
}

export function getInFlightCatalogStatus(): Promise<boolean> | null {
  return catalogStatusCache.getInFlight();
}

export function setInFlightCatalogStatus(p: Promise<boolean> | null): void {
  catalogStatusCache.setInFlight(p);
}

export function getCachedSiteConfig(): { config: SiteConfigState; expiresAt: number } | null {
  const peek = siteConfigCache.peek();
  return peek ? { config: peek.value, expiresAt: peek.expiresAt } : null;
}

export function setCachedSiteConfig(entry: { config: SiteConfigState; expiresAt: number } | null): void {
  if (entry) {
    siteConfigCache.set(entry.config, Math.max(0, entry.expiresAt - Date.now()));
  } else {
    siteConfigCache.invalidate();
  }
}

export function getInFlightSiteConfig(): Promise<SiteConfigState> | null {
  return siteConfigCache.getInFlight();
}

export function setInFlightSiteConfig(p: Promise<SiteConfigState> | null): void {
  siteConfigCache.setInFlight(p);
}
