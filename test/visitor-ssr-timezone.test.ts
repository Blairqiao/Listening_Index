import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as timezoneUtils from '../src/lib/timezone-utils';

test('SSR explicitly passes a valid detected cookie zone or UTC fallback to all initial queries', async () => {
  for (const [cookie, expected] of [['Asia/Tokyo', 'Asia/Tokyo'], ['Invalid/Zone', 'UTC'], ['', 'UTC']]) {
    const calls: unknown[][] = [];
    const deps: Record<string, unknown> = {
      'next/headers': { cookies: async () => ({ get: (key: string) => key === 'listening_timezone' && cookie ? { value: encodeURIComponent(cookie) } : undefined }) },
      '@/components/ListeningView': { ListeningView: 'view' }, '@/lib/mock-listening-data': {},
      '@/lib/db/queries': { getActiveSiteConfig: async () => ({}), getInitialMusicData: async (...args: unknown[]) => { calls.push(args); return {}; } },
      '@/lib/db': { isDbConfigured: () => true }, '@/lib/admin-auth': { ADMIN_COOKIE_NAME: 'admin_session', verifySessionToken: () => false },
      '@/lib/timezone-utils': timezoneUtils,
    };
    const js = ts.transpileModule(readFileSync('src/app/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
    const mod = { exports: {} as { default: (props: object) => Promise<{ props: Record<string, unknown> }> } };
    new Function('require', 'module', 'exports', 'React', js)((id: string) => { if (!(id in deps)) throw new Error(id); return deps[id]; }, mod, mod.exports, { createElement: (_type: unknown, props: object) => ({ props }) });
    const rendered = await mod.exports.default({});
    assert.equal(calls[0][1], expected);
    assert.equal(rendered.props.initialVisitorTimezone, expected);
  }
});
