import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { NextRequest } from 'next/server';
import { createSessionToken } from '../src/lib/admin-auth';
import { getMockStreamLog } from '../src/lib/mock-listening-data';
import * as auth from '../src/lib/admin-auth';
import * as routeUtils from '../src/lib/route-utils';
import * as asyncUtils from '../src/lib/async-utils';
import { sanitizeTimezone } from '../src/lib/db/queries/helpers';
import type { OverviewData, StreamLogData, SessionData } from '../src/lib/db/queries/types';
import { KeyedAsyncCache } from '../src/lib/async-utils';
import { clearServerCache, getOrFetchOverview, getOrFetchStreamLog, getOrFetchSession } from '../src/lib/db/server-cache';

function loadStreamRoute() {
  const calls: unknown[][] = [];
  const cacheLimits: number[] = [];
  const query = async (...args: unknown[]) => { calls.push(args); return { entries: [], limit: args[0] }; };
  const deps: Record<string, unknown> = {
    'next/server': { NextRequest },
    '@/lib/db/queries': { getStreamLog: query, getActiveSiteConfig: async () => ({ timezone: 'America/Chicago' }), sanitizeTimezone },
    '@/lib/async-utils': asyncUtils,
    '@/lib/db': { isDbConfigured: () => true },
    '@/lib/db/server-cache': {
      getOrFetchStreamLog: async (limit: number, _tz: string, fetcher: () => Promise<unknown>) => { cacheLimits.push(limit); return fetcher(); },
    },
    '@/lib/mock-listening-data': { getMockStreamLog },
    '@/lib/admin-auth': auth,
    '@/lib/route-utils': routeUtils,
  };
  const source = readFileSync('src/app/api/listening/stream-log/route.ts', 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} as { GET: (request: NextRequest) => Promise<Response> } };
  new Function('require', 'module', 'exports', js)((id: string) => deps[id] ?? (() => { throw new Error(`Missing test dependency: ${id}`); })(), module, module.exports);
  return { ...module.exports, calls, cacheLimits };
}

test('Stream Log guest default and ceiling apply to first and cursor pages; signed admins are exempt', async () => {
  const previous = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = 'test-only-read-bounds';
  try {
    const { GET, calls, cacheLimits } = loadStreamRoute();
    const request = (params: string, cookie?: string) => new NextRequest(`http://127.0.0.1:8888/api/listening/stream-log?${params}`, { headers: cookie ? { cookie } : {} });
    assert.equal((await GET(request(''))).status, 200);
    assert.equal(calls.at(-1)?.[0], 50);
    await GET(request('limit=1000000'));
    assert.equal(calls.at(-1)?.[0], 250);
    await GET(request('limit=1000000&cursor=2026-10-01T00:00:00.000Z&cursorId=42'));
    assert.equal(calls.at(-1)?.[0], 250);
    await GET(request('limit=1000000', `admin_session=${createSessionToken()}`));
    assert.equal(calls.at(-1)?.[0], 1000000);
    assert.ok(!cacheLimits.includes(1000000), 'oversized admin response must bypass shared cache');
    await GET(request('limit=1000000', 'admin_session=forged'));
    assert.equal(calls.at(-1)?.[0], 250);
  } finally { if (previous === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = previous; }
});

test('Stream Log rejects malformed pagination before querying', async () => {
  const { GET, calls } = loadStreamRoute();
  for (const params of ['limit=abc', 'limit=10x', 'limit=1.5', 'limit=0', 'limit=-1', 'limit=Infinity', 'limit=', 'limit=9007199254740992', 'cursor=bad', 'cursorId=42', 'cursor=2026-10-01T00:00:00Z&cursorId=x', 'prevPlayedAt=bad', 'cursor=', 'cursorId=', 'prevPlayedAt=', 'cursor=2026-02-31T00:00:00Z', 'cursor=2026-10-01T24:00:00Z']) {
    const response = await GET(new NextRequest(`http://localhost:8888/api/listening/stream-log?${params}`));
    assert.equal(response.status, 400, params);
    assert.match((await response.json()).error, /invalid/i);
  }
  assert.equal(calls.length, 0);
});

test('listening cache separates effective timezone for every query and normalizes aliases', async () => {
  clearServerCache();
  for (const get of [
    (tz: string, fetcher: () => Promise<OverviewData & StreamLogData & SessionData & { marker: number }>) => getOrFetchOverview('1w', tz, fetcher),
    (tz: string, fetcher: () => Promise<OverviewData & StreamLogData & SessionData & { marker: number }>) => getOrFetchStreamLog(50, tz, fetcher),
    (tz: string, fetcher: () => Promise<OverviewData & StreamLogData & SessionData & { marker: number }>) => getOrFetchSession(tz, fetcher),
  ]) {
    let calls = 0;
    const fetcher = async () => ({ marker: ++calls } as OverviewData & StreamLogData & SessionData & { marker: number });
    assert.equal((await get('UTC', fetcher)).marker, 1);
    assert.equal((await get('America/Chicago', fetcher)).marker, 2);
    assert.equal((await get('Etc/UTC', fetcher)).marker, 1);
    assert.equal(calls, 2);
  }
});

test('completed cache evicts LRU at 128 entries and removes expired entries', () => {
  const cache = new KeyedAsyncCache<number>(1000);
  for (let i = 0; i < 128; i++) cache.set(String(i), i);
  assert.equal(cache.get('0'), 0);
  cache.set('128', 128);
  assert.equal(cache.get('1'), undefined);
  assert.equal(cache.get('0'), 0);
  const expired = new KeyedAsyncCache<number>(0);
  expired.set('old', 1);
  assert.equal(expired.get('old'), undefined);
});

test('distinct cache misses are bounded while the same key shares its work', async () => {
  const cache = new KeyedAsyncCache<number>(1000);
  let resolve!: (value: number) => void;
  const deferred = new Promise<number>(r => { resolve = r; });
  let calls = 0;
  const fetcher = () => { calls++; return deferred; };
  const pending = Array.from({ length: 16 }, (_, i) => cache.getOrFetch(String(i), fetcher));
  const duplicate = cache.getOrFetch('0', fetcher);
  const overflow = cache.getOrFetch('overflow', fetcher);
  resolve(4);
  await assert.rejects(overflow, /busy|capacity/i);
  assert.equal(calls, 16);
  assert.deepEqual(await Promise.all([...pending, duplicate]), Array(17).fill(4));
  assert.equal(await cache.getOrFetch('next', async () => 5), 5);
});

test('demo cursor IDs remain usable without accepting them as database cursors', async () => {
  const previous = process.env.FORCE_MOCK_DATA;
  process.env.FORCE_MOCK_DATA = 'true';
  try {
    const { GET } = loadStreamRoute();
    const response = await GET(new NextRequest('http://localhost:8888/api/listening/stream-log?cursorId=sl-50'));
    assert.equal(response.status, 200);
  } finally { if (previous === undefined) delete process.env.FORCE_MOCK_DATA; else process.env.FORCE_MOCK_DATA = previous; }
});

test('cache invalidation starts fresh work and ignores stale completion', async () => {
  clearServerCache();
  let resolve!: (value: OverviewData) => void;
  const pending = getOrFetchOverview('1d', 'UTC', () => new Promise<OverviewData>(r => { resolve = r; }));
  await Promise.resolve();
  clearServerCache();
  let freshCalls = 0;
  const fresh = getOrFetchOverview('1d', 'UTC', async () => { freshCalls++; return { marker: 'fresh' } as unknown as OverviewData; });
  resolve({ marker: 'stale' } as unknown as OverviewData);
  await pending;
  assert.equal(freshCalls, 1);
  assert.equal((await fresh as unknown as { marker: string }).marker, 'fresh');
});
