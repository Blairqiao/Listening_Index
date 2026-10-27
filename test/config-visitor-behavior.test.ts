import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as configUtils from '../src/lib/config-utils';
import * as colors from '../src/lib/color-utils';
import * as timezoneUtils from '../src/lib/timezone-utils';

type Element = { type: unknown; props: Record<string, unknown> };
function configHarness(initial = configUtils.DEFAULT_SITE_CONFIG, stored?: object) {
  const values: unknown[] = [];
  const deps: unknown[][] = [];
  let cursor = 0;
  let pending: Array<() => void> = [];
  let dirty = false;
  let root: Element;
  const storage = new Map<string, string>(stored ? [['listening_index_config', JSON.stringify(stored)]] : []);
  const listeners = new Map<string, () => void>();
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    createElement: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
    useState: (initialValue: unknown) => {
      const i = cursor++;
      if (!(i in values)) values[i] = typeof initialValue === 'function' ? initialValue() : initialValue;
      return [values[i], (value: unknown) => {
        const next = typeof value === 'function' ? value(values[i]) : value;
        if (next !== values[i]) { values[i] = next; dirty = true; }
      }];
    },
    useEffect: (effect: () => void, nextDeps: unknown[] = []) => {
      const i = cursor++;
      if (!deps[i] || nextDeps.some((d, index) => d !== deps[i][index])) { deps[i] = nextDeps; pending.push(effect); }
    },
    useMemo: (fn: () => unknown) => fn(),
    useCallback: (fn: unknown) => fn,
    useRef: (value: unknown) => {
      const i = cursor++;
      if (!(i in values)) values[i] = { current: value };
      return values[i];
    },
  };
  const stubColors = { ...colors, applyAccentColorToDom: () => {} };
  const imports: Record<string, unknown> = { react: { ...react, default: react }, '@/lib/color-utils': stubColors, '@/lib/config-utils': configUtils,
    '@/lib/timezone-utils': { ...timezoneUtils, syncLocalTimezoneCookie: (tz: string) => { document.cookie = `listening_timezone=${encodeURIComponent(tz)}`; } } };
  const js = ts.transpileModule(readFileSync('src/context/ConfigContext.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  const mod = { exports: {} as { ConfigProvider: (props: object) => Element } };
  const document = { title: '', cookie: '' };
  const localStorage = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) };
  const window = { addEventListener: (name: string, fn: () => void) => listeners.set(name, fn), removeEventListener: (name: string) => listeners.delete(name) };
  new Function('require', 'module', 'exports', 'document', 'window', 'localStorage', 'fetch', js)(
    (id: string) => { if (!(id in imports)) throw new Error(`Missing dependency ${id}`); return imports[id]; },
    mod, mod.exports, document, window, localStorage, () => new Promise(() => {}));
  const flush = () => {
    for (let i = 0; i < 20; i++) {
      dirty = false; cursor = 0;
      root = mod.exports.ConfigProvider({ children: null, initialConfig: initial, isDbConfigured: true });
      const effects = pending; pending = []; effects.forEach(fn => fn());
      if (!dirty) break;
      if (i === 19) throw new Error('Hook harness did not settle');
    }
    return root!.props.value as { config: configUtils.SiteConfigState; visitorTimezone: string; updateConfig: (patch: Partial<configUtils.SiteConfigState>) => void };
  };
  return { flush, storage, document, listeners };
}

test('legacy visitor preference retains only accent while deployed owner fields stay current', () => {
  const initial = { ...configUtils.DEFAULT_SITE_CONFIG, title: 'Current title', timezone: 'Pacific/Auckland', livePlayerLayout: 'stacked' as const };
  const harness = configHarness(initial, { ...initial, title: 'Old title', timezone: 'UTC', livePlayerLayout: 'split', accentColor: '#ff00aa' });
  const state = harness.flush();
  assert.equal(state.config.title, 'Current title');
  assert.equal(state.config.timezone, 'Pacific/Auckland');
  assert.equal(state.config.livePlayerLayout, 'stacked');
  assert.equal(state.config.accentColor, '#FF00AA');
  const record = JSON.parse(harness.storage.get('listening_index_config')!);
  assert.deepEqual(record, { version: 1, accentColor: '#FF00AA' });
  state.updateConfig({ accentColor: '#123456' });
  harness.flush();
  assert.deepEqual(JSON.parse(harness.storage.get('listening_index_config')!), { version: 1, accentColor: '#123456' });
});

test('visitor timezone is detected separately and cannot overwrite owner fallback', () => {
  const owner = { ...configUtils.DEFAULT_SITE_CONFIG, timezone: 'Pacific/Auckland' };
  const harness = configHarness(owner);
  const state = harness.flush();
  assert.equal(state.visitorTimezone, Intl.DateTimeFormat().resolvedOptions().timeZone);
  assert.equal(state.config.timezone, owner.timezone);
  assert.match(harness.document.cookie, /listening_timezone=/);
  assert.ok(harness.listeners.has('focus'), 'zone is rechecked after sleep or travel');
});

test('invalid hexadecimal colors use fallback before normalization', () => {
  assert.equal(colors.normalizeHex('#GGGGGG', '#123456'), '#123456');
  assert.equal(colors.normalizeHex('xyz', '#123456'), '#123456');
  assert.equal(configUtils.normalizeSiteConfig({ accentColor: '#invalid' }).accentColor, configUtils.DEFAULT_SITE_CONFIG.accentColor);
});
