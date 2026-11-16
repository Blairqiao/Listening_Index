import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts';

interface Item { id: string; trackId?: string; albumImageUrl?: string | null }

const enrichedRow = (requestedId: string) => ({ requestedId, albumImageUrl: `https://img/${requestedId}`, artistId: 'artist', albumId: 'album' });

/** Run the hook once with fake React hooks, fire its debounce, and wait for the response to be handled. */
async function runHook(items: Item[], response: object) {
  const storage = new Map<string, string>();
  globalThis.sessionStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, String(value)); },
    removeItem: (key: string) => { storage.delete(key); },
  } as Storage;
  (globalThis as unknown as { window: unknown }).window = {};

  const effects: Array<() => unknown> = [];
  let stateIndex = 0;
  let retryBumps = 0;
  const hookModule = loadTs('src/lib/hooks/useDeferredEnrichment.ts', {
    react: {
      // First state is the quota flag, second is the retry trigger
      useState: (init: unknown) => {
        const value = typeof init === 'function' ? (init as () => unknown)() : init;
        const isRetryTrigger = stateIndex++ === 1;
        return [value, () => { if (isRetryTrigger) retryBumps++; }];
      },
      useRef: (init: unknown) => ({ current: init }),
      useEffect: (effect: () => unknown) => { effects.push(effect); },
    },
  });
  const requested = hookModule.sessionRequestedTrackIds as unknown as Set<string>;

  const bodies: Array<{ trackIds: string[] }> = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(init?.body as string));
    return Response.json(response);
  }) as typeof fetch;

  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    hookModule.useDeferredEnrichment({ items, enabled: true });
    for (const effect of effects) effect();
    mock.timers.tick(600);
    for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
    mock.timers.tick(60_000);
  } finally {
    mock.timers.reset();
    globalThis.fetch = previousFetch;
  }
  return { requested, bodies, retryBumps };
}

test('quota-denied response with nothing resolved releases the candidate for a later retry', async () => {
  const { requested, bodies, retryBumps } = await runHook(
    [{ id: 'track-a', albumImageUrl: null }],
    { success: true, quotaReached: true, quotaResetAt: '2026-11-16T00:00:00.000Z', enriched: [], delistedIds: [] }
  );
  assert.deepEqual(bodies[0].trackIds, ['track-a']);
  assert.equal(requested.has('track-a'), false, 'a Track the quota denied must be requested again after the reset');
  assert.equal(retryBumps, 0, 'only a rate limit schedules the cooldown retry');
});

test('quota-denied response keeps the ids it resolved and releases the rest', async () => {
  const { requested } = await runHook(
    [{ id: 'track-a', albumImageUrl: null }, { id: 'track-b', albumImageUrl: null }, { id: 'track-c', albumImageUrl: null }],
    { success: true, quotaReached: true, enriched: [enrichedRow('track-a')], delistedIds: ['track-b'] }
  );
  assert.deepEqual([...requested].sort(), ['track-a', 'track-b']);
});

test('rate-limited response still releases unresolved ids and schedules the retry', async () => {
  const { requested, retryBumps } = await runHook(
    [{ id: 'track-a', albumImageUrl: null }, { id: 'track-b', albumImageUrl: null }],
    { success: true, rateLimited: true, retryAfterSeconds: 10, enriched: [enrichedRow('track-a')], delistedIds: [] }
  );
  assert.deepEqual([...requested], ['track-a']);
  assert.equal(retryBumps, 1);
});

test('an answered response keeps unresolved ids so they are not requested again', async () => {
  const { requested } = await runHook(
    [{ id: 'track-a', albumImageUrl: null }],
    { success: true, enriched: [], delistedIds: [] }
  );
  assert.equal(requested.has('track-a'), true);
});

test('one Track played several times in a row takes a single slot in the batch', async () => {
  const repeated = [1, 2, 3, 4, 5].map((n) => ({ id: `play-${n}`, trackId: 'track-a', albumImageUrl: null }));
  const { bodies } = await runHook(
    [...repeated, { id: 'play-6', trackId: 'track-b', albumImageUrl: null }, { id: 'play-7', trackId: 'track-c', albumImageUrl: null }],
    { success: true, enriched: [], delistedIds: [] }
  );
  assert.deepEqual(bodies[0].trackIds, ['track-a', 'track-b', 'track-c']);
});
