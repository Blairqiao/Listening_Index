import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts';

/** Minimal hook runtime: refs persist across renders, effects run when their deps change. */
function mount(search: string) {
  const refs: Array<{ current: unknown }> = [];
  const lastDeps: Array<unknown[] | undefined> = [];
  let refIndex = 0;
  let effectIndex = 0;
  let queued: Array<() => unknown> = [];
  const react = {
    useRef: (init: unknown) => (refs[refIndex++] ??= { current: init }),
    useEffect: (effect: () => unknown, deps?: unknown[]) => {
      const index = effectIndex++;
      const previous = lastDeps[index];
      if (!previous || !deps || deps.some((dep, i) => !Object.is(dep, previous[i]))) queued.push(effect);
      lastDeps[index] = deps;
    },
  };
  const { useListeningUrlSync } = loadTs('src/components/listening-view/useListeningUrlSync.ts', { react });
  const { sanitizeActiveMode } = loadTs('src/components/listening-view/listening-helpers.ts');

  (globalThis as unknown as { window: unknown }).window = { location: { search } };

  const calls = { modes: [] as number[], ranges: [] as string[], sessions: [] as string[], fetched: [] as string[], modalOpens: 0 };
  const props = {
    rangeKeys: ['1d', '1w', '1m', '6m', '1y', 'all'],
    openModal: () => { calls.modalOpens++; },
    setActiveMode: (mode: number) => { calls.modes.push(mode); },
    setActiveRange: (range: string) => { calls.ranges.push(range); },
    activeRangeRef: { current: '1w' },
    overviewCacheRef: { current: {} },
    setDisplayedRange: () => {},
    fetchOverview: async (range: string) => { calls.fetched.push(range); },
    setSelectedSessionId: (id: string) => { calls.sessions.push(id); },
    sanitizeActiveMode,
  };
  const render = (isAuthenticated: boolean) => {
    refIndex = 0;
    effectIndex = 0;
    queued = [];
    useListeningUrlSync({ ...props, isAuthenticated });
    for (const effect of queued) effect();
  };
  return { render, calls };
}

test('URL parameters are applied once and not again on login or lock', () => {
  const { render, calls } = mount('?mode=1&range=1m&session=session-2&config=1');
  render(false);
  render(true);
  render(false);
  assert.deepEqual(calls.modes, [1]);
  assert.deepEqual(calls.ranges, ['1m']);
  assert.deepEqual(calls.fetched, ['1m']);
  assert.deepEqual(calls.sessions, ['session-2']);
  assert.equal(calls.modalOpens, 1);
});

test('a Live Player request made before login is applied once the visitor is authenticated', () => {
  const { render, calls } = mount('?mode=3&range=6m');
  render(false);
  assert.deepEqual(calls.modes, [0]);
  render(true);
  assert.deepEqual(calls.modes, [0, 3]);
  render(false);
  render(true);
  assert.deepEqual(calls.modes, [0, 3], 'the pending request is used up by the first login');
  assert.deepEqual(calls.ranges, ['6m']);
});

test('a Live Player request from an authenticated visitor is applied once', () => {
  const { render, calls } = mount('?mode=3');
  render(true);
  render(false);
  render(true);
  assert.deepEqual(calls.modes, [3]);
});
