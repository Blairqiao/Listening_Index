import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function callback(name: string, scope: Record<string, unknown>) {
  const source = readFileSync('src/components/ListeningView.tsx', 'utf8');
  const start = source.indexOf(`  const ${name} = useCallback(`);
  const ending = source.indexOf('\n  }, [', start);
  const end = source.indexOf('\n', ending + 1);
  const statement = source.slice(start, end);
  const js = ts.transpileModule(`${statement}\nreturn ${name};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function('useCallback', ...Object.keys(scope), js)((fn: unknown) => fn, ...Object.values(scope)) as (...args: unknown[]) => Promise<unknown>;
}

test('background response is stored only under the range captured before its request', async () => {
  const activeRangeRef = { current: '1w' };
  let resolve!: (value: object) => void;
  const pending = new Promise<object>(r => { resolve = r; });
  const writes: Record<string, unknown>[] = [];
  const refetch = callback('refetchActiveData', {
    activeRangeRef,
    fetchOverview: () => pending,
    fetchStreamLog: async () => undefined,
    fetchSession: async () => undefined,
    setOverviewCache: (update: (prev: object) => Record<string, unknown>) => writes.push(update({})),
  });
  const work = refetch();
  activeRangeRef.current = '1m';
  resolve({ marker: 'weekly' });
  await work;
  assert.ok(writes.every(write => !('1m' in write)), 'weekly response must never populate monthly range');
});

test('a response from a previous timezone generation cannot update current cache', async () => {
  let resolve!: (value: Response) => void;
  const pending = new Promise<Response>(r => { resolve = r; });
  const tzRef = { current: 'UTC' };
  const requestGenerationRef = { current: 0 };
  const writes: unknown[] = [];
  const fetchOverview = callback('fetchOverview', {
    fetch: () => pending, tzRef, requestGenerationRef,
    activeRangeRef: { current: '1w' },
    enrichmentOverlayRef: { current: new Map() }, delistedSetRef: { current: new Set() },
    setOverviewCache: (update: (prev: object) => object) => writes.push(update({})),
    setDisplayedRange: () => {}, setLastSyncedAt: () => {},
  });
  const work = fetchOverview('1w');
  tzRef.current = 'America/Chicago';
  requestGenerationRef.current++;
  resolve(Response.json({ metrics: ['1', '2', '3', '4'] }));
  await work;
  assert.equal(writes.length, 0);
});
