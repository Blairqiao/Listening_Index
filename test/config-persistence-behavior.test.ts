import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { NextRequest, NextResponse } from 'next/server';
import * as configUtils from '../src/lib/config-utils';

function evaluate(source: string, imports: Record<string, unknown>) {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} as Record<string, (...args: unknown[]) => Promise<unknown>> };
  new Function('require', 'module', 'exports', js)((id: string) => { if (!(id in imports)) throw new Error(id); return imports[id]; }, mod, mod.exports);
  return mod.exports;
}

test('config route returns an error when neither database nor local file persists', async () => {
  const routes = evaluate(readFileSync('src/app/api/config/route.ts', 'utf8'), {
    'next/server': { NextRequest, NextResponse },
    'fs/promises': { default: { writeFile: async () => { throw new Error('read-only filesystem'); } } },
    path: { default: { join: (...parts: string[]) => parts.join('/') } },
    '@/lib/db': { isDbConfigured: () => false },
    '@/lib/db/queries': {}, '@/config': { siteConfig: configUtils.DEFAULT_SITE_CONFIG },
    '@/lib/auth-utils': { isSameOriginRequest: () => true, isAuthorizedAdminRequest: () => true },
    '@/lib/config-utils': configUtils,
  });
  const response = await routes.POST(new NextRequest('http://localhost:8888/api/config', { method: 'POST', body: JSON.stringify(configUtils.DEFAULT_SITE_CONFIG) })) as Response;
  assert.equal(response.status, 500);
  assert.equal((await response.json()).success, false);
});

test('failed admin save keeps draft local and leaves deployed site state unchanged', async () => {
  const source = readFileSync('src/components/modals/customization-modal/CustomizationModal.tsx', 'utf8');
  const start = source.indexOf('  const handleSave = async () => {');
  const end = source.indexOf('\n  // Reset accent', start);
  const js = ts.transpileModule(source.slice(start, end) + '\nreturn handleSave;', {}).outputText;
  const writes: unknown[] = [];
  const errors: unknown[] = [];
  const draft = { ...configUtils.DEFAULT_SITE_CONFIG, title: 'Unsaved owner title' };
  const scope = {
    isAuthenticated: true, canSave: true, isSaving: false, draft,
    DEFAULT_SITE_CONFIG: configUtils.DEFAULT_SITE_CONFIG,
    areSiteConfigsEqual: configUtils.areSiteConfigsEqual,
    applyAccentColorToDom: () => {}, updateConfig: (value: unknown) => writes.push(value),
    resetToDefaults: () => writes.push('reset'), markAsDeployed: (value: unknown) => writes.push(value), closeModal: () => {},
    setSaveError: (error: unknown) => errors.push(error), setIsSaving: () => {},
    fetch: async () => Response.json({ success: false, error: 'Persistence failed' }, { status: 500 }),
  };
  const save = new Function(...Object.keys(scope), js)(...Object.values(scope));
  await save();
  assert.deepEqual(writes, []);
  assert.equal(errors.at(-1), 'Persistence failed');
  assert.equal(draft.title, 'Unsaved owner title');
});

test('config reset clears deprecated client ID while preserving Owner Token columns', async () => {
  const statements: string[] = [];
  const config = evaluate(readFileSync('src/lib/db/queries/config.ts', 'utf8'), {
    'node:crypto': {}, '../index': { isDbConfigured: () => true, getDb: () => async (strings: TemplateStringsArray) => { statements.push(strings.join('?')); return []; } },
    '@/config': { siteConfig: { ...configUtils.DEFAULT_SITE_CONFIG, livePlayerLayout: 'stacked' } },
    './schema': { ensureTablesExist: async () => {} }, './cache': { siteConfigCache: { invalidate: () => {} } },
  });
  const result = await config.resetActiveSiteConfig() as configUtils.SiteConfigState;
  assert.equal(result.spotifyClientId, '');
  assert.equal(result.livePlayerLayout, 'stacked');
  assert.match(statements.join(''), /spotify_client_id\s*=\s*EXCLUDED\.spotify_client_id/);
  assert.doesNotMatch(statements.join(''), /owner_playback_token\s*=/);
});
