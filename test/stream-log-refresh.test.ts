import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { loadTs } from './helpers/load-ts';

const DATA = 'src/components/listening-view/useListeningData.ts';
const SYNC = 'src/components/listening-view/useListeningSync.ts';

interface Row { id: string; playedAt: string }
interface Log { entries: Row[]; hasMore?: boolean; nextCursor?: string | null; nextCursorId?: string | null; metrics?: string[] }

function callback(file: string, name: string, scope: Record<string, unknown>) {
  const source = readFileSync(file, 'utf8');
  const start = source.indexOf(`  const ${name} = useCallback(`);
  assert.ok(start >= 0, `${name} must exist in ${file}`);
  const ending = source.indexOf('\n  }, [', start);
  const end = source.indexOf('\n', ending + 1);
  const statement = source.slice(start, end);
  const js = ts.transpileModule(`${statement}\nreturn ${name};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function('useCallback', ...Object.keys(scope), js)((fn: unknown) => fn, ...Object.values(scope)) as (...args: unknown[]) => Promise<unknown>;
}

const playedAt = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 60_000).toISOString();

/** Rows with ids from..to, newest first, as the Stream Log endpoint returns them. */
function page(from: number, to: number, hasMore = true): Log {
  const entries: Row[] = [];
  for (let n = from; n >= to; n--) entries.push({ id: String(n), playedAt: playedAt(n) });
  return { entries, hasMore, nextCursor: hasMore ? playedAt(to) : null, nextCursorId: hasMore ? String(to) : null, metrics: [] };
}

const ids = (log: Log | null) => (log ? log.entries.map((e) => e.id) : []);

function harness(initial: Log | null, respond: (url: string) => Promise<Log> | Log) {
  const streamLogStateRef = { current: initial };
  const loaded = { count: initial ? initial.entries.length : 50 };
  const helpers = loadTs('src/components/listening-view/listening-helpers.ts');
  const scope = {
    ...helpers,
    fetch: async (url: string) => Response.json(await respond(url)),
    tzRef: { current: 'UTC' },
    requestGenerationRef: { current: 0 },
    enrichmentOverlayRef: { current: new Map() },
    delistedSetRef: { current: new Set() },
    patchStreamLogWithEnrichment: (log: Log) => log,
    streamLogStateRef,
    setStreamLogState: (update: (prev: Log | null) => Log | null) => { streamLogStateRef.current = update(streamLogStateRef.current); },
    setLoadedPlaysCount: (update: (prev: number) => number) => { loaded.count = update(loaded.count); },
    setLastSyncedAt: () => {},
    setIsLoadingMorePlays: () => {},
    setCachedStreamLogDepth: () => {},
    isLoadingMorePlays: false,
  };
  return { scope, streamLogStateRef, loaded };
}

test('head refresh with no overlap replaces the retained rows and takes the server cursor', async () => {
  const fresh = page(150, 101);
  const { scope, streamLogStateRef, loaded } = harness(page(50, 1), () => fresh);
  await callback(DATA, 'fetchStreamLog', scope)();
  const state = streamLogStateRef.current!;
  assert.deepEqual(ids(state), ids(fresh), 'rows 100..51 were never fetched, so the old rows must not stay below a gap');
  assert.equal(state.nextCursor, fresh.nextCursor);
  assert.equal(state.nextCursorId, fresh.nextCursorId);
  assert.equal(state.hasMore, true);
  assert.equal(loaded.count, 50);
});

test('head refresh that overlaps the retained rows merges and keeps the old cursor', async () => {
  const retained = page(50, 1, false);
  const { scope, streamLogStateRef, loaded } = harness(retained, () => page(60, 11));
  await callback(DATA, 'fetchStreamLog', scope)();
  const state = streamLogStateRef.current!;
  assert.deepEqual(ids(state), ids(page(60, 1)));
  assert.equal(state.nextCursor, retained.nextCursor);
  assert.equal(state.hasMore, false);
  assert.equal(loaded.count, 50);
});

test('head refresh onto an empty Stream Log takes the fresh response', async () => {
  const fresh = page(50, 1);
  const { scope, streamLogStateRef, loaded } = harness({ entries: [], hasMore: false, nextCursor: null, nextCursorId: null }, () => fresh);
  await callback(DATA, 'fetchStreamLog', scope)();
  const state = streamLogStateRef.current!;
  assert.deepEqual(ids(state), ids(fresh));
  assert.equal(state.hasMore, true, 'an exhausted ledger must page again after an import');
  assert.equal(state.nextCursor, fresh.nextCursor);
  assert.equal(loaded.count, 50);
});

test('upload completion replaces the Stream Log instead of merging the head', async () => {
  const calls: unknown[][] = [];
  const base = {
    activeRangeRef: { current: { kind: 'preset', key: '1w' } },
    requestGenerationRef: { current: 0 },
    overviewRefreshOrder: (active: unknown) => [active],
    pruneOverviewCacheWindows: (prev: unknown) => prev,
    setOverviewCache: () => {},
    fetchOverview: async () => undefined,
    fetchStreamLog: async (...args: unknown[]) => { calls.push(args); },
    fetchSession: async () => undefined,
    STREAM_LOG_PAGE_SIZE: 50,
  };
  await callback(SYNC, 'handleUploadComplete', base)();
  assert.equal(calls.length, 1);
  assert.ok(typeof calls[0][0] === 'number' && calls[0][0] > 0, 'an explicit depth makes fetchStreamLog replace its state');

  calls.length = 0;
  await callback(SYNC, 'refetchActiveData', base)();
  assert.deepEqual(calls, [[]], 'background refresh still merges the head');
});

test('a load-more response is dropped when a depth restore replaced the list first', async () => {
  const initial = page(100, 51);
  let releaseLoadMore!: (log: Log) => void;
  const pendingLoadMore = new Promise<Log>((resolve) => { releaseLoadMore = resolve; });
  const restored = page(100, 1);
  const { scope, streamLogStateRef, loaded } = harness(initial, (url) => (url.includes('cursor=') ? pendingLoadMore : restored));

  const loadMore = callback(DATA, 'handleLoadMoreStreamLog', { ...scope, streamLogState: initial })();
  await callback(DATA, 'fetchStreamLog', scope)(100);
  releaseLoadMore(page(50, 26));
  await loadMore;

  const state = streamLogStateRef.current!;
  assert.equal(new Set(ids(state)).size, state.entries.length, 'no Play may appear twice');
  assert.deepEqual(ids(state), ids(restored));
  assert.equal(state.nextCursor, restored.nextCursor, 'the cursor must not move back to the stale page');
  assert.equal(loaded.count, 100);
});

test('a load-more response appends when the cursor is still current', async () => {
  const initial = page(100, 51);
  const { scope, streamLogStateRef, loaded } = harness(initial, () => page(50, 26));
  await callback(DATA, 'handleLoadMoreStreamLog', { ...scope, streamLogState: initial })();
  const state = streamLogStateRef.current!;
  assert.deepEqual(ids(state), ids(page(100, 26)));
  assert.equal(state.nextCursor, playedAt(26));
  assert.equal(loaded.count, 75);
});

function timezoneRefetch(streamLog: Log | null, session: object | null) {
  const calls: string[] = [];
  const refetch = callback(DATA, 'refetchAfterTimezoneChange', {
    requestGenerationRef: { current: 0 },
    activeRangeRef: { current: '1w' },
    overviewCacheRef: { current: {} },
    streamLogStateRef: { current: streamLog },
    sessionStateRef: { current: session },
    setOverviewCache: () => {},
    fetchOverview: async (range: string) => { calls.push(`overview:${range}`); },
    fetchStreamLog: async (count?: number, aggregatesOnly = false) => { calls.push(aggregatesOnly ? 'stream-log:aggregates' : 'stream-log:full'); },
    fetchSession: async () => { calls.push('session'); },
  });
  refetch();
  return calls;
}

test('timezone change with nothing loaded refetches the full Stream Log and the Sessions', () => {
  assert.deepEqual(timezoneRefetch(null, null), ['overview:1w', 'stream-log:full', 'session']);
});

test('timezone change with loaded data refetches only the Stream Log aggregates', () => {
  assert.deepEqual(timezoneRefetch(page(50, 1), { sessions: [] }), ['overview:1w', 'stream-log:aggregates']);
});
