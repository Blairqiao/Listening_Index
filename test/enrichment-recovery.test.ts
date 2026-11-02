import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts';

// ---------------------------------------------------------------------------
// N004 Engine Tests: runEnrichmentBatch with mixed rate-limit outcomes
// ---------------------------------------------------------------------------

function setupEngineHarness() {
  const persistedEnriched: unknown[] = [];
  const persistedDelisted: string[] = [];
  let cacheClears = 0;
  let cooldownRecorded: { seconds: number; reason?: string } | null = null;
  let debits = 0;

  const queries = {
    getActiveApiCooldown: async () => ({ active: false }),
    checkAndIncrementApiQuota: async (_bucket: string, count: number) => {
      debits += count;
      return { allowed: true, remaining: 100 - debits };
    },
    getPendingTracksForEnrichment: async (limit: number) => [
      { id: 'track-0', name: 'Track 0', artistName: 'Artist 0', albumName: 'Album 0', albumGroupKey: 'grp-0' },
      { id: 'track-1', name: 'Track 1', artistName: 'Artist 1', albumName: 'Album 1', albumGroupKey: 'grp-1' },
      { id: 'track-2', name: 'Track 2', artistName: 'Artist 2', albumName: 'Album 2', albumGroupKey: 'grp-2' },
    ].slice(0, limit),
    getPendingTracksInAlbum: async () => [],
    bulkApplyEnrichment: async (args: { enriched: unknown[]; delistedIds: string[] }) => {
      persistedEnriched.push(...args.enriched);
      persistedDelisted.push(...args.delistedIds);
    },
    recordApiCooldown: async (seconds: number, reason?: string) => {
      cooldownRecorded = { seconds, reason };
    },
    getEnrichmentProgress: async () => ({
      pending: 3 - persistedEnriched.length - persistedDelisted.length,
      enriched: persistedEnriched.length,
      delisted: persistedDelisted.length,
      total: 3,
    }),
  };

  const engine = loadTs('src/lib/enrichment.ts', {
    '@/lib/db/queries': queries,
    '@/lib/spotify': { getAccessToken: async () => 'test-token' },
    '@/lib/db/server-cache': {
      clearServerCache: () => {
        cacheClears++;
      },
    },
  });

  return {
    engine,
    get persistedEnriched() {
      return persistedEnriched;
    },
    get persistedDelisted() {
      return persistedDelisted;
    },
    get cacheClears() {
      return cacheClears;
    },
    get cooldownRecorded() {
      return cooldownRecorded;
    },
  };
}

test('N004 engine: mixed dynamic batch [200, 429, 200] persists all successes, clears cache, and returns enriched patch array', async () => {
  const h = setupEngineHarness();
  const previousFetch = globalThis.fetch;

  globalThis.fetch = (async (url: RequestInfo | URL) => {
    const urlStr = String(url);
    if (urlStr.includes('track-0')) {
      return Response.json({
        id: 'track-0',
        name: 'Track 0',
        duration_ms: 180000,
        artists: [{ id: 'art-0', name: 'Artist 0' }],
        album: { id: 'alb-0', name: 'Album 0', images: [{ url: 'https://img.scdn.co/0' }] },
      });
    }
    if (urlStr.includes('track-1')) {
      return new Response(JSON.stringify({ error: 'rate limited' }), {
        status: 429,
        headers: { 'Retry-After': '12', 'Content-Type': 'application/json' },
      });
    }
    if (urlStr.includes('track-2')) {
      return Response.json({
        id: 'track-2',
        name: 'Track 2',
        duration_ms: 210000,
        artists: [{ id: 'art-2', name: 'Artist 2' }],
        album: { id: 'alb-2', name: 'Album 2', images: [{ url: 'https://img.scdn.co/2' }] },
      });
    }
    return new Response('Not found', { status: 404 });
  }) as typeof fetch;

  try {
    const result = await h.engine.runEnrichmentBatch({
      bucket: 'dynamic',
      trackIds: ['track-0', 'track-1', 'track-2'],
    });

    assert.equal(result.rateLimited, true, 'Result must report rateLimited: true');
    assert.equal(result.retryAfterSeconds, 12, 'Must report the Retry-After value');
    assert.equal(h.cooldownRecorded?.seconds, 12, 'Must record the cooldown in database');

    // Both track-0 and track-2 succeeded and must be persisted
    assert.equal(h.persistedEnriched.length, 2, 'Must persist both track-0 and track-2');
    assert.equal(h.cacheClears, 1, 'Server cache must be cleared so fresh data is visible');

    // The enriched patch array must be returned so caller/client can update state
    assert.ok(Array.isArray(result.enriched), 'Must return enriched array');
    assert.equal(result.enriched.length, 2, 'Enriched array must contain both successful tracks');
    assert.equal((result.enriched[0] as { requestedId: string }).requestedId, 'track-0');
    assert.equal((result.enriched[1] as { requestedId: string }).requestedId, 'track-2');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

// ---------------------------------------------------------------------------
// N003 & N004 Client Hook Tests: useDeferredEnrichment
// ---------------------------------------------------------------------------

function setupHookHarness() {
  const storage = new Map<string, string>();
  globalThis.sessionStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, val: string) => {
      storage.set(key, String(val));
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
    key: (i: number) => Array.from(storage.keys())[i] ?? null,
    length: storage.size,
  } as Storage;

  (globalThis as unknown as { window: unknown }).window = {};

  return { storage };
}

test('N003 hook: expired quota reset timestamp resets exhaustion state and cleans storage', () => {
  const { storage } = setupHookHarness();

  // Set quota reached with a reset timestamp in the past
  const pastReset = new Date(Date.now() - 60_000).toISOString();
  storage.set('spotify_quota_reached', 'true');
  storage.set('spotify_quota_reset_at', pastReset);

  // Load hook module
  let stateVal: unknown;
  const reactStub = {
    useState: (init: unknown) => {
      stateVal = typeof init === 'function' ? (init as () => unknown)() : init;
      return [stateVal, (newV: unknown) => { stateVal = newV; }];
    },
    useRef: (init: unknown) => ({ current: init }),
    useEffect: () => undefined,
  };

  const hookModule = loadTs('src/lib/hooks/useDeferredEnrichment.ts', {
    react: reactStub,
  });

  const { isQuotaExhausted } = hookModule.useDeferredEnrichment({
    items: [{ id: 'track-x', albumImageUrl: null }],
    enabled: true,
  });

  assert.equal(isQuotaExhausted, false, 'Expired quota must result in isQuotaExhausted = false');
  assert.equal(storage.get('spotify_quota_reached'), undefined, 'spotify_quota_reached should be cleared from storage');
  assert.equal(storage.get('spotify_quota_reset_at'), undefined, 'spotify_quota_reset_at should be cleared from storage');
});

test('N004 hook: rate-limited response prunes unresolved candidates to allow future retry', async () => {
  const { storage } = setupHookHarness();
  storage.clear();

  let effectCallback: (() => void | (() => void)) | null = null;
  let stateVal: boolean = false;
  const reactStub = {
    useState: (init: unknown) => {
      stateVal = (typeof init === 'function' ? (init as () => unknown)() : init) as boolean;
      return [stateVal, (newV: unknown) => { stateVal = typeof newV === 'function' ? (newV as (prev: boolean) => boolean)(stateVal) : (newV as boolean); }];
    },
    useRef: (init: unknown) => ({ current: init }),
    useEffect: (cb: () => void | (() => void)) => {
      effectCallback = cb;
    },
  };

  const hookModule = loadTs('src/lib/hooks/useDeferredEnrichment.ts', {
    react: reactStub,
  });

  const enrichedCalls: unknown[] = [];
  const candidates = [
    { id: 'cand-0', albumImageUrl: null },
    { id: 'cand-1', albumImageUrl: null },
    { id: 'cand-2', albumImageUrl: null },
  ];

  const previousFetch = globalThis.fetch;
  let requestedBody: { trackIds: string[]; source: string } | null = null;

  globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    requestedBody = JSON.parse(init?.body as string);
    // Return HTTP 200 with partial enriched and rateLimited: true
    return Response.json({
      success: true,
      rateLimited: true,
      retryAfterSeconds: 10,
      enriched: [
        {
          requestedId: 'cand-0',
          name: 'Cand 0',
          durationMs: 120000,
          artistId: 'art-0',
          artistName: 'Artist 0',
          albumId: 'alb-0',
          albumName: 'Album 0',
          albumImageUrl: 'https://img/0',
        },
      ],
      delistedIds: [],
    });
  }) as typeof fetch;

  try {
    hookModule.useDeferredEnrichment({
      items: candidates,
      onEnriched: (enriched: unknown[], delisted: string[]) => {
        enrichedCalls.push({ enriched, delisted });
      },
      enabled: true,
    });

    assert.ok(effectCallback, 'Effect callback must be registered');

    // Run effect
    (effectCallback as () => void)();

    // Advance debounce timer (600ms)
    await new Promise((resolve) => setTimeout(resolve, 700));

    assert.ok(requestedBody, 'Fetch must have been called');
    assert.deepEqual((requestedBody as { trackIds: string[] }).trackIds, ['cand-0', 'cand-1', 'cand-2']);
    assert.equal(enrichedCalls.length, 1, 'onEnriched must be called with successful cand-0');

    // Now test that cand-1 and cand-2 (unresolved) are released for future retry:
    let secondFetchBody: { trackIds: string[] } | null = null;
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      secondFetchBody = JSON.parse(init?.body as string);
      return Response.json({ success: true, enriched: [], delistedIds: [] });
    }) as typeof fetch;

    // Run effect again with cand-1 and cand-2
    (effectCallback as () => void)();
    await new Promise((resolve) => setTimeout(resolve, 700));

    assert.ok(secondFetchBody, 'Second fetch must be scheduled for unresolved candidates');
    assert.ok((secondFetchBody as { trackIds: string[] }).trackIds.includes('cand-1'), 'cand-1 must be retried');
    assert.ok((secondFetchBody as { trackIds: string[] }).trackIds.includes('cand-2'), 'cand-2 must be retried');
  } finally {
    globalThis.fetch = previousFetch;
  }
});
