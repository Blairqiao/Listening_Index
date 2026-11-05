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
  private generation = 0;

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

    const currentGen = this.generation;
    this.inFlight = (async () => {
      try {
        const val = await fn();
        if (this.generation === currentGen) {
          this.cached = { value: val, expiresAt: Date.now() + this.ttlMs };
        }
        return val;
      } finally {
        if (this.generation === currentGen) {
          this.inFlight = null;
        }
      }
    })();

    return this.inFlight;
  }

  /**
   * Invalidates the cached entry immediately.
   */
  invalidate(): void {
    this.generation++;
    this.cached = null;
    this.inFlight = null;
  }

  /**
   * Manually sets the cached value with an optional custom TTL.
   */
  set(value: T, customTtlMs?: number): void {
    this.cached = { value, expiresAt: Date.now() + (customTtlMs ?? this.ttlMs) };
  }


}

// ---------------------------------------------------------------------------
// Dedicated Query Cache Singletons
// ---------------------------------------------------------------------------

export const lastSyncCache = new AsyncLatchCache<string | undefined>(15_000);
export const catalogStatusCache = new AsyncLatchCache<boolean>(60_000);
export const siteConfigCache = new AsyncLatchCache<SiteConfigState>(60_000);
export const catalogTotalsCache = new AsyncLatchCache<{ totalTracks: number; totalArtists: number }>(300_000);

