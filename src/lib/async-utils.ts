/**
 * Async concurrency and caching utilities.
 */

export function createSingleFlight<T>() {
  let inFlightPromise: Promise<T> | null = null;

  return function runSingleFlight(fn: () => Promise<T>): Promise<T> {
    if (inFlightPromise) {
      return inFlightPromise;
    }

    inFlightPromise = fn().finally(() => {
      inFlightPromise = null;
    });

    return inFlightPromise;
  };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class KeyedAsyncCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private inFlight = new Map<string, Promise<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async getOrFetch(
    key: string,
    fetcher: () => Promise<T>,
    getEpoch?: () => number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    let promise = this.inFlight.get(key);
    if (!promise) {
      const startEpoch = getEpoch ? getEpoch() : 0;
      promise = (async () => {
        try {
          const data = await fetcher();
          if (!getEpoch || startEpoch === getEpoch()) {
            this.set(key, data);
          }
          return data;
        } finally {
          this.inFlight.delete(key);
        }
      })();
      this.inFlight.set(key, promise);
    }
    return promise;
  }

  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }
}
