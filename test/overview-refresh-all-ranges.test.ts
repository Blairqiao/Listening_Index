import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { loadTs } from './helpers/load-ts';

const SOURCE = 'src/components/listening-view/useListeningSync.ts';
const ALL_RANGES = ['1d', '1w', '1m', '6m', '1y', 'all'];

function callback(name: string, scope: Record<string, unknown>) {
  const source = readFileSync(SOURCE, 'utf8');
  const start = source.indexOf(`  const ${name} = useCallback(`);
  assert.ok(start >= 0, `${name} must exist in ${SOURCE}`);
  const ending = source.indexOf('\n  }, [', start);
  const end = source.indexOf('\n', ending + 1);
  const statement = source.slice(start, end);
  const js = ts.transpileModule(`${statement}\nreturn ${name};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function('useCallback', ...Object.keys(scope), js)((fn: unknown) => fn, ...Object.values(scope)) as (...args: unknown[]) => Promise<unknown>;
}

function helpers() {
  return loadTs('src/components/listening-view/listening-helpers.ts');
}

test('overviewRefreshOrder puts the active range first, then every other range', () => {
  assert.deepEqual(helpers().overviewRefreshOrder('1m'), ['1m', '1d', '1w', '6m', '1y', 'all']);
});

function harness(activeRange: string) {
  const fetched: string[] = [];
  const cacheWrites: unknown[] = [];
  const scope = {
    activeRangeRef: { current: activeRange },
    requestGenerationRef: { current: 0 },
    overviewRefreshOrder: helpers().overviewRefreshOrder,
    fetchOverview: async (range: string) => { fetched.push(range); return { metrics: [] }; },
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
  return { scope, fetched, cacheWrites };
}

test('background refetch refreshes every range, active range first', async () => {
  const { scope, fetched } = harness('1w');
  await callback('refetchActiveData', scope)();
  assert.equal(fetched[0], '1w');
  assert.deepEqual([...fetched].sort(), [...ALL_RANGES].sort());
});

test('manual sync refreshes every range and does not drop cached ranges', async () => {
  const { scope, fetched, cacheWrites } = harness('6m');
  await callback('handleTriggerSync', scope)();
  assert.equal(fetched[0], '6m');
  assert.deepEqual([...fetched].sort(), [...ALL_RANGES].sort());
  for (const write of cacheWrites) {
    const next = typeof write === 'function' ? write({ '1d': 'old-1d', '6m': 'old-6m' }) : write;
    assert.ok(next && '1d' in next, 'sync must not wipe other cached ranges');
  }
});

test('upload completion refreshes every range', async () => {
  const { scope, fetched } = harness('1y');
  await callback('handleUploadComplete', scope)();
  assert.equal(fetched[0], '1y');
  assert.deepEqual([...fetched].sort(), [...ALL_RANGES].sort());
});
