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

export class CacheCapacityError extends Error {
  constructor() {
    super("Listening data is busy. Retry shortly.");
    this.name = "CacheCapacityError";
  }
}

export class KeyedAsyncCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private inFlight = new Map<string, Promise<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 128,
    private readonly maxInFlight = 16
  ) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp >= this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key: string, data: T): void {
    const now = Date.now();
    for (const [entryKey, entry] of this.cache) {
      if (now - entry.timestamp >= this.ttlMs) this.cache.delete(entryKey);
    }
    this.cache.delete(key);
    this.cache.set(key, { data, timestamp: now });
    while (this.cache.size > this.maxEntries) {
      this.cache.delete(this.cache.keys().next().value!);
    }
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
      if (this.inFlight.size >= this.maxInFlight) throw new CacheCapacityError();
      const startEpoch = getEpoch ? getEpoch() : 0;
      promise = Promise.resolve().then(async () => {
        try {
          const data = await fetcher();
          if (!getEpoch || startEpoch === getEpoch()) {
            this.set(key, data);
          }
          return data;
        } finally {
          if (this.inFlight.get(key) === promise) this.inFlight.delete(key);
        }
      });
      this.inFlight.set(key, promise);
    }
    return promise;
  }

  clear(): void {
    this.cache.clear();

  }
}
