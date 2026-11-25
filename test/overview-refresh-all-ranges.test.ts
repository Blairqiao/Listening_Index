import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { loadTs } from './helpers/load-ts';
import { formatRangeParam, presetRange, type RangeSelection } from '../src/lib/range';

const SOURCE = 'src/components/listening-view/useListeningSync.ts';
const DATA_SOURCE = 'src/components/listening-view/useListeningData.ts';

function callbackFrom(file: string, name: string, scope: Record<string, unknown>) {
  const source = readFileSync(file, 'utf8');
  const start = source.indexOf(`  const ${name} = useCallback(`);
  assert.ok(start >= 0, `${name} must exist in ${file}`);
  const ending = source.indexOf('\n  }, [', start);
  const end = source.indexOf('\n', ending + 1);
  const statement = source.slice(start, end);
  const js = ts.transpileModule(`${statement}\nreturn ${name};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function('useCallback', ...Object.keys(scope), js)((fn: unknown) => fn, ...Object.values(scope)) as (...args: unknown[]) => Promise<unknown>;
}

function callback(name: string, scope: Record<string, unknown>) {
  return callbackFrom(SOURCE, name, scope);
}

function helpers() {
  return loadTs('src/components/listening-view/listening-helpers.ts');
}

test('overviewRefreshOrder with a preset returns only that preset', () => {
  const order = helpers().overviewRefreshOrder(presetRange('all')) as RangeSelection[];
  assert.deepEqual(order.map(formatRangeParam), ['all']);
});

test('overviewRefreshOrder with a window returns only that window', () => {
  const win: RangeSelection = { kind: 'window', from: '2025-11-01', to: '2025-11-30' };
  const order = helpers().overviewRefreshOrder(win) as RangeSelection[];
  assert.deepEqual(order.map(formatRangeParam), ['2025-11-01..2025-11-30']);
});

function harness(activeRange: RangeSelection) {
  const fetched: RangeSelection[] = [];
  const cacheWrites: unknown[] = [];
  const requestGenerationRef = { current: 0 };
  const scope = {
    activeRangeRef: { current: activeRange },
    requestGenerationRef,
    overviewRefreshOrder: helpers().overviewRefreshOrder,
    pruneOverviewCacheWindows: helpers().pruneOverviewCacheWindows,
    STREAM_LOG_PAGE_SIZE: 50,
    fetchOverview: async (range: RangeSelection) => { fetched.push(range); return { metrics: [] }; },
    fetchStreamLog: async () => undefined,
    fetchSession: async () => undefined,
    setOverviewCache: (value: unknown) => cacheWrites.push(value),
    fetch: async () => Response.json({ success: true, syncedAt: '2026-11-04T00:00:00.000Z' }),
    isAuthenticated: true,
    isSyncing: false,
    setIsSyncing: () => {},
    setSyncError: () => {},
    setLastSyncedAt: () => {},
    setSyncedAgoStr: () => {},
  };
  return { scope, fetched, cacheWrites, requestGenerationRef };
}

test('background refetch refreshes active range, bumps generation, and drops non-active cache entries including stale all', async () => {
  const activeWin: RangeSelection = { kind: 'window', from: '2025-11-01', to: '2025-11-30' };
  const { scope, fetched, cacheWrites, requestGenerationRef } = harness(activeWin);
  await callback('refetchActiveData', scope)();
  assert.deepEqual(fetched.map(formatRangeParam), ['2025-11-01..2025-11-30']);
  assert.equal(requestGenerationRef.current, 1, 'overlapping refreshes must bump requestGenerationRef');
  assert.ok(cacheWrites.length >= 1, 'refresh must prune non-active cached entries');
  const write = cacheWrites[0] as (prev: Record<string, string>) => Record<string, string>;
  const pruned = write({
    all: 'stale-all',
    '2025-10-01..2025-10-31': 'stale-oct',
    '2025-11-01..2025-11-30': 'active-nov',
  });
  assert.ok('2025-11-01..2025-11-30' in pruned, 'active window must stay visible until replaced');
  assert.ok(!('all' in pruned), 'stale non-active all must be dropped');
  assert.ok(!('2025-10-01..2025-10-31' in pruned), 'stale non-active windows must be dropped');
});

test('manual sync refreshes active range, retains active cache entry, and drops non-active entries including stale all', async () => {
  const activeWin: RangeSelection = { kind: 'window', from: '2025-11-01', to: '2025-11-30' };
  const { scope, fetched, cacheWrites } = harness(activeWin);
  await callback('handleTriggerSync', scope)();
  assert.deepEqual(fetched.map(formatRangeParam), ['2025-11-01..2025-11-30']);
  assert.ok(cacheWrites.length >= 1);
  for (const write of cacheWrites) {
    const next = typeof write === 'function'
      ? write({ all: 'stale-all', '2025-10-01..2025-10-31': 'stale-oct', '2025-11-01..2025-11-30': 'active-nov' })
      : write;
    assert.ok(next && '2025-11-01..2025-11-30' in next, 'sync must retain active entry until replaced');
    assert.ok(next && !('all' in next), 'sync must drop stale non-active all');
    assert.ok(next && !('2025-10-01..2025-10-31' in next), 'sync must drop stale non-active windows');
  }
});

test('upload completion refreshes active range, retains active cache entry, and drops non-active entries including stale all', async () => {
  const activeWin: RangeSelection = { kind: 'window', from: '2025-11-01', to: '2025-11-30' };
  const { scope, fetched, cacheWrites } = harness(activeWin);
  await callback('handleUploadComplete', scope)();
  assert.deepEqual(fetched.map(formatRangeParam), ['2025-11-01..2025-11-30']);
  assert.ok(cacheWrites.length >= 1);
  const write = cacheWrites[0] as (prev: Record<string, string>) => Record<string, string>;
  const pruned = write({ all: 'stale-all', '2025-09-01..2025-09-30': 'stale-sep', '2025-11-01..2025-11-30': 'active-nov' });
  assert.ok('2025-11-01..2025-11-30' in pruned, 'upload refresh must retain active entry until replaced');
  assert.ok(!('all' in pruned), 'upload refresh must drop stale non-active all');
  assert.ok(!('2025-09-01..2025-09-30' in pruned), 'upload refresh must drop stale non-active windows');
});

test('fetchOverview drops stale response in an A -> B -> A range race', async () => {
  const resolvers: Array<(res: Response) => void> = [];
  const cacheWrites: Array<Record<string, { marker: string }>> = [];
  const displayed: RangeSelection[] = [];
  const rangeA: RangeSelection = { kind: 'window', from: '2025-11-01', to: '2025-11-30' };
  const rangeB: RangeSelection = presetRange('1y');
  const activeRangeRef: { current: RangeSelection } = { current: rangeA };

  const fetchOverview = callbackFrom(DATA_SOURCE, 'fetchOverview', {
    formatRangeParam,
    tzRef: { current: 'UTC' },
    requestGenerationRef: { current: 0 },
    overviewFetchSeqRef: { current: new Map<string, number>() },
    activeRangeRef,
    enrichmentOverlayRef: { current: new Map() },
    delistedSetRef: { current: new Set() },
    setOverviewCache: (updater: (prev: Record<string, unknown>) => Record<string, { marker: string }>) => {
      cacheWrites.push(updater({}));
    },
    setDisplayedRange: (sel: RangeSelection) => { displayed.push(sel); },
    setIsRangeLoading: () => {},
    setLastSyncedAt: () => {},
    fetch: () => new Promise<Response>((resolve) => { resolvers.push(resolve); }),
  });

  // 1. Start request for A (#1)
  const reqA1 = fetchOverview(rangeA);
  // 2. Switch to B (#2)
  activeRangeRef.current = rangeB;
  const reqB = fetchOverview(rangeB);
  // 3. Switch back to A (#3)
  activeRangeRef.current = rangeA;
  const reqA2 = fetchOverview(rangeA);

  // Resolve stale A (#1) first — must be ignored
  resolvers[0](Response.json({ metrics: ['1'], marker: 'stale-A1' }));
  await reqA1;
  assert.equal(cacheWrites.length, 0, 'stale A1 response must not write to cache');
  assert.equal(displayed.length, 0, 'stale A1 response must not update displayedRange');

  // Resolve B (#2) — may cache B, must not change displayedRange (active is A)
  resolvers[1](Response.json({ metrics: ['2'], marker: 'B' }));
  await reqB;
  assert.equal(displayed.length, 0, 'B response must not update displayedRange while A is active');

  // Resolve current A (#3) — must write to cache and update displayedRange
  resolvers[2](Response.json({ metrics: ['3'], marker: 'fresh-A2' }));
  await reqA2;
  const lastWrite = cacheWrites[cacheWrites.length - 1];
  assert.equal(lastWrite['2025-11-01..2025-11-30']?.marker, 'fresh-A2');
  assert.deepEqual(displayed, [rangeA]);
});

test('pending uncached range preserves displayed window across sync prune and ignores superseded selectRange completion', async () => {
  const React = await import('react');
  const { useListeningData } = await import('../src/components/listening-view/useListeningData');
  const { useListeningSync } = await import('../src/components/listening-view/useListeningSync');
  const { formatRangeParam: fmt, presetRange: preset } = await import('../src/lib/range');

  const stateValues: unknown[] = [];
  const stateSetters: Array<(v: unknown) => void> = [];
  const refValues: Array<{ current: unknown }> = [];
  const callbackValues: Array<{ fn: unknown; deps: unknown[] }> = [];
  const effectDeps: unknown[][] = [];
  const effectCleanups: Array<(() => void) | void> = [];
  let effectPending: Array<{ idx: number; effect: () => (() => void) | void }> = [];
  let stateCursor = 0;
  let refCursor = 0;
  let callbackCursor = 0;
  let effectCursor = 0;
  let stateUpdated = false;

  const mockReact = {
    useState: <T>(initial: T | (() => T)): [T, (v: unknown) => void] => {
      const idx = stateCursor++;
      if (!(idx in stateValues)) {
        stateValues[idx] = typeof initial === 'function' ? (initial as () => T)() : initial;
      }
      if (!stateSetters[idx]) {
        stateSetters[idx] = (value: unknown) => {
          const next = typeof value === 'function' ? (value as (prev: unknown) => unknown)(stateValues[idx]) : value;
          if (!Object.is(next, stateValues[idx])) {
            stateValues[idx] = next;
            stateUpdated = true;
          }
        };
      }
      return [stateValues[idx] as T, stateSetters[idx]];
    },
    useRef: <T>(initial: T): { current: T } => {
      const idx = refCursor++;
      if (!(idx in refValues)) refValues[idx] = { current: initial };
      return refValues[idx] as { current: T };
    },
    useCallback: <T>(fn: T, deps: unknown[]): T => {
      const idx = callbackCursor++;
      const prev = callbackValues[idx];
      if (!prev || deps.some((d, i) => !Object.is(d, prev.deps[i]))) {
        callbackValues[idx] = { fn, deps };
      }
      return callbackValues[idx].fn as T;
    },
    useEffect: (effect: () => (() => void) | void, deps: unknown[] = []) => {
      const idx = effectCursor++;
      const prev = effectDeps[idx];
      if (!prev || deps.some((d, i) => !Object.is(d, prev[i]))) {
        effectDeps[idx] = deps;
        effectPending.push({ idx, effect });
      }
    },
  };

  const origUseState = React.default.useState;
  const origUseRef = React.default.useRef;
  const origUseCallback = React.default.useCallback;
  const origUseEffect = React.default.useEffect;
  const origFetch = globalThis.fetch;
  const origDoc = (globalThis as unknown as { document?: unknown }).document;
  const origWin = (globalThis as unknown as { window?: unknown }).window;
  const origStorage = (globalThis as unknown as { localStorage?: unknown }).localStorage;

  const pendingFetches: Array<{ url: string; resolve: (res: Response) => void }> = [];
  const makeOverview = (range: string, marker: string) => ({
    range,
    granularity: range === '1y' ? 'month' : 'day',
    logStartDate: 'Jan 2024',
    rawMetrics: { totalMs: 60_000, trackCount: 1, artistCount: 1, elapsedDays: 1 },
    metrics: [marker, '1', '1', '1'],
    topTracks: [],
    topArtists: [],
    topAlbums: [],
    activityCadence: [],
  });

  const win1: RangeSelection = { kind: 'window', from: '2025-11-01', to: '2025-11-30' };
  const range1y = preset('1y');

  try {
    (React.default as unknown as { useState: unknown }).useState = mockReact.useState;
    (React.default as unknown as { useRef: unknown }).useRef = mockReact.useRef;
    (React.default as unknown as { useCallback: unknown }).useCallback = mockReact.useCallback;
    (React.default as unknown as { useEffect: unknown }).useEffect = mockReact.useEffect;
    (globalThis as unknown as { document: unknown }).document = {
      visibilityState: 'visible',
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    const mockStorage = { getItem: () => null, setItem: () => {} };
    (globalThis as unknown as { localStorage: unknown }).localStorage = mockStorage;
    (globalThis as unknown as { window: unknown }).window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      localStorage: mockStorage,
    };

    globalThis.fetch = ((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/sync')) {
        return Promise.resolve(Response.json({ success: true, syncedAt: '2026-11-05T00:00:00.000Z' }));
      }
      if (url.startsWith('/api/listening/stream-log')) {
        return Promise.resolve(Response.json({ entries: [], metrics: ['0', '0', '0', '0'] }));
      }
      if (url.startsWith('/api/listening/session')) {
        return Promise.resolve(Response.json({ sessions: [] }));
      }
      return new Promise<Response>((resolve) => {
        pendingFetches.push({ url, resolve });
      });
    }) as typeof fetch;

    const render = (visitorTimezone = 'UTC') => {
      let data!: ReturnType<typeof useListeningData>;
      let sync!: ReturnType<typeof useListeningSync>;
      let passes = 0;
      do {
        stateUpdated = false;
        stateCursor = 0;
        refCursor = 0;
        callbackCursor = 0;
        effectCursor = 0;
        data = useListeningData({
          initialOverview: makeOverview(fmt(win1), 'win1-initial') as never,
          initialStreamLog: { entries: [], metrics: ['0', '0', '0', '0'] } as never,
          initialSession: { sessions: [] } as never,
          initialRange: win1,
          visitorTimezone,
        });
        sync = useListeningSync({
          isAuthenticated: true,
          activeRangeRef: data.activeRangeRef,
          requestGenerationRef: data.requestGenerationRef,
          setOverviewCache: data.setOverviewCache,
          fetchOverview: data.fetchOverview,
          fetchStreamLog: data.fetchStreamLog,
          fetchSession: data.fetchSession,
          lastSyncedAt: data.lastSyncedAt,
          setLastSyncedAt: data.setLastSyncedAt,
        });
        const pending = [...effectPending];
        effectPending = [];
        for (const item of pending) {
          const cleanup = effectCleanups[item.idx];
          if (typeof cleanup === 'function') cleanup();
          effectCleanups[item.idx] = item.effect();
        }
        if (++passes > 15) throw new Error('Infinite render loop');
      } while (stateUpdated);
      return { data, sync };
    };

    const flush = async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    };

    // 1. Initial window is displayed
    let { data, sync } = render();
    assert.equal(fmt(data.displayedRange), fmt(win1));
    assert.equal(
      ((data as unknown as { displayedOverview?: { metrics: string[] } | null }).displayedOverview ?? data.overviewCache[fmt(data.displayedRange)])?.metrics[0],
      'win1-initial',
    );

    // 2. Select uncached 1y -> displayed window stays visible, loading is true
    data.selectRange(range1y);
    ({ data, sync } = render());
    assert.equal(data.isRangeLoading, true);
    assert.equal(fmt(data.displayedRange), fmt(win1));
    const supersededReq = pendingFetches.find((f) => f.url.includes('range=1y'));
    assert.ok(supersededReq, 'selectRange(1y) must issue an overview fetch');

    // 3. Manual sync fires while 1y is still pending
    const syncPromise = sync.handleTriggerSync();
    await flush();
    ({ data, sync } = render());

    // Displayed content must STILL be win1-initial (not pruned to empty!), while win1 is evicted from cache
    const visibleDuringSync =
      (data as unknown as { displayedOverview?: { metrics: string[] } | null }).displayedOverview ??
      data.overviewCache[fmt(data.displayedRange)];
    assert.equal(visibleDuringSync?.metrics[0], 'win1-initial', 'displayed window must remain visible during sync');
    assert.equal(data.overviewCache[fmt(win1)], undefined, 'stale window must be evicted from overviewCache');

    // 4. Superseded selectRange(1y) resolves BEFORE sync's replacement 1y request
    supersededReq.resolve(Response.json(makeOverview('1y', 'stale-1y')));
    await flush();
    ({ data, sync } = render());
    assert.equal(data.isRangeLoading, true, 'superseded selectRange fetch must not clear isRangeLoading early');
    assert.equal(fmt(data.displayedRange), fmt(win1), 'superseded selectRange fetch must not advance displayedRange');
    assert.equal(data.overviewCache['1y'], undefined, 'superseded selectRange fetch must not populate cache');

    // 5. Resolve sync's replacement fetches (with fresh-1y)
    for (const req of pendingFetches) {
      if (req === supersededReq) continue;
      const r = new URL(req.url, 'http://127.0.0.1:8888').searchParams.get('range') || '1w';
      req.resolve(Response.json(makeOverview(r, `fresh-${r}`)));
    }
    await syncPromise;
    await flush();
    ({ data, sync } = render());

    assert.equal(data.isRangeLoading, false, 'replacement fetch must clear isRangeLoading');
    assert.equal(fmt(data.displayedRange), '1y');
    assert.equal(data.overviewCache['1y']?.metrics[0], 'fresh-1y');
    assert.equal(data.overviewCache[fmt(win1)], undefined, 'stale window must not remain in cache after sync');

    // 6. Selecting win1 again must miss cache and fetch fresh win1
    const countBefore = pendingFetches.length;
    data.selectRange(win1);
    ({ data, sync } = render());
    assert.equal(data.isRangeLoading, true, 'selecting pruned window after sync must fetch instead of hitting stale cache');
    assert.equal(pendingFetches.length, countBefore + 1);
    assert.ok(pendingFetches[pendingFetches.length - 1].url.includes(encodeURIComponent(fmt(win1))));

    // 7. Timezone change while win1 is pending drops pre-tz win1 and keeps loading until post-tz win1 resolves
    const preTzWin1 = pendingFetches[pendingFetches.length - 1];
    ({ data, sync } = render('America/Chicago'));
    const postTzWin1 = pendingFetches[pendingFetches.length - 1];
    assert.ok(postTzWin1.url.includes('tz=America%2FChicago'));
    preTzWin1.resolve(Response.json(makeOverview(fmt(win1), 'stale-utc-win1')));
    await flush();
    ({ data, sync } = render('America/Chicago'));
    assert.equal(data.isRangeLoading, true, 'pre-timezone fetch must not clear isRangeLoading');

    postTzWin1.resolve(Response.json(makeOverview(fmt(win1), 'fresh-chi-win1')));
    await flush();
    ({ data, sync } = render('America/Chicago'));
    assert.equal(data.isRangeLoading, false, 'post-timezone fetch must clear isRangeLoading');
    assert.equal(data.overviewCache[fmt(win1)]?.metrics[0], 'fresh-chi-win1');
  } finally {
    for (const c of effectCleanups) {
      if (typeof c === 'function') c();
    }
    (React.default as unknown as { useState: unknown }).useState = origUseState;
    (React.default as unknown as { useRef: unknown }).useRef = origUseRef;
    (React.default as unknown as { useCallback: unknown }).useCallback = origUseCallback;
    (React.default as unknown as { useEffect: unknown }).useEffect = origUseEffect;
    globalThis.fetch = origFetch;
    (globalThis as unknown as { document?: unknown }).document = origDoc;
    (globalThis as unknown as { window?: unknown }).window = origWin;
    (globalThis as unknown as { localStorage?: unknown }).localStorage = origStorage;
  }
});
