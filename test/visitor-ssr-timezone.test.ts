import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as timezoneUtils from '../src/lib/timezone-utils';
import * as searchUtils from '../src/lib/search-utils';
import * as range from '../src/lib/range';
import { parseModeParam } from '../src/components/listening-view/listening-helpers';

test('SSR explicitly passes a valid detected cookie zone or UTC fallback to all initial queries', async () => {
  for (const [cookie, expected] of [['Asia/Tokyo', 'Asia/Tokyo'], ['Invalid/Zone', 'UTC'], ['', 'UTC']]) {
    const calls: unknown[][] = [];
    const deps: Record<string, unknown> = {
      'next/headers': { cookies: async () => ({ get: (key: string) => key === 'listening_timezone' && cookie ? { value: encodeURIComponent(cookie) } : undefined }) },
      '@/components/ListeningView': { ListeningView: 'view' }, '@/lib/mock/overview-data': { getMockOverview: () => ({}) },
      '@/components/listening-view/listening-helpers': { parseModeParam },
      '@/lib/config-utils': { DEFAULT_SITE_CONFIG: {} },
      '@/lib/types': { RANGE_KEYS: ['1d', '1w', '1m', '6m', '1y', 'all'] },
      '@/lib/range': range,
      '@/lib/db/queries': { getActiveSiteConfig: async () => ({}), getInitialMusicData: async (...args: unknown[]) => { calls.push(args); return {}; } },
      '@/lib/db': { isDbConfigured: () => true }, '@/lib/admin-auth': { ADMIN_COOKIE_NAME: 'admin_session', verifySessionToken: () => false },
      '@/lib/timezone-utils': timezoneUtils,
      '@/lib/search-utils': searchUtils,
    };
    const js = ts.transpileModule(readFileSync('src/app/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
    const mod = { exports: {} as { default: (props: object) => Promise<{ props: Record<string, unknown> }> } };
    new Function('require', 'module', 'exports', 'React', js)((id: string) => { if (!(id in deps)) throw new Error(id); return deps[id]; }, mod, mod.exports, { createElement: (_type: unknown, props: object) => ({ props }) });
    const rendered = await mod.exports.default({});
    assert.equal(calls[0][1], expected);
    assert.equal(rendered.props.initialVisitorTimezone, expected);
  }
});

test('SSR passes full fixed selection to queries and forwards fixed selection and overview to ListeningView', async () => {
  const queryCalls: unknown[][] = [];
  const mockOverviewCalls: unknown[][] = [];
  const fakeOverview = {
    range: '2025-11-01..2025-11-30',
    granularity: 'day',
    activityCadence: [],
  };

  const makeDeps = (configured: boolean): Record<string, unknown> => ({
    'next/headers': { cookies: async () => ({ get: () => undefined }) },
    '@/components/ListeningView': { ListeningView: 'view' },
    '@/components/listening-view/listening-helpers': { parseModeParam },
    '@/lib/mock/overview-data': {
      MOCK_DATA: { streamLog: [], session: {} },
      getMockOverview: (...args: unknown[]) => {
        mockOverviewCalls.push(args);
        return fakeOverview;
      },
    },
    '@/lib/config-utils': { DEFAULT_SITE_CONFIG: {} },
    '@/lib/types': { RANGE_KEYS: ['1d', '1w', '1m', '6m', '1y', 'all'] },
    '@/lib/range': range,
    '@/lib/db/queries': {
      getActiveSiteConfig: async () => ({}),
      getInitialMusicData: async (...args: unknown[]) => {
        queryCalls.push(args);
        return { overview: fakeOverview, streamLog: [], session: {} };
      },
    },
    '@/lib/db': { isDbConfigured: () => configured },
    '@/lib/admin-auth': { ADMIN_COOKIE_NAME: 'admin_session', verifySessionToken: () => false },
    '@/lib/timezone-utils': timezoneUtils,
    '@/lib/search-utils': searchUtils,
  });

  const js = ts.transpileModule(readFileSync('src/app/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;

  // 1. Configured DB branch
  const modDb = { exports: {} as { default: (props: object) => Promise<{ props: Record<string, unknown> }> } };
  new Function('require', 'module', 'exports', 'React', js)(
    (id: string) => makeDeps(true)[id],
    modDb,
    modDb.exports,
    { createElement: (_type: unknown, props: object) => ({ props }) }
  );
  const renderedDb = await modDb.exports.default({ searchParams: Promise.resolve({ range: '2025-11-01..2025-11-30' }) });
  assert.deepEqual(queryCalls[0][0], { kind: 'window', from: '2025-11-01', to: '2025-11-30' });
  assert.deepEqual(renderedDb.props.initialRange, { kind: 'window', from: '2025-11-01', to: '2025-11-30' });
  assert.deepEqual(renderedDb.props.initialOverview, fakeOverview);

  // 2. Unconfigured / mock branch
  const modMock = { exports: {} as { default: (props: object) => Promise<{ props: Record<string, unknown> }> } };
  new Function('require', 'module', 'exports', 'React', js)(
    (id: string) => makeDeps(false)[id],
    modMock,
    modMock.exports,
    { createElement: (_type: unknown, props: object) => ({ props }) }
  );
  const renderedMock = await modMock.exports.default({ searchParams: Promise.resolve({ range: '2025-11-01..2025-11-30' }) });
  assert.deepEqual(mockOverviewCalls[0][0], { kind: 'window', from: '2025-11-01', to: '2025-11-30' });
  assert.deepEqual(renderedMock.props.initialRange, { kind: 'window', from: '2025-11-01', to: '2025-11-30' });
  assert.deepEqual(renderedMock.props.initialOverview, fakeOverview);

  // SSR initialMode accepts mode 5 and excludes mode 3 (falling back to 0)
  const renderedMode5 = await modMock.exports.default({ searchParams: Promise.resolve({ mode: '5' }) });
  assert.equal(renderedMode5.props.initialMode, 5);
  const renderedMode3 = await modMock.exports.default({ searchParams: Promise.resolve({ mode: '3' }) });
  assert.equal(renderedMode3.props.initialMode, 0);
});
