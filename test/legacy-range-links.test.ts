import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts';
import {
  DEFAULT_OVERVIEW_RANGE,
  presetRange,
  unitWindow,
  type RangeSelection,
} from '../src/lib/range';

function mountWithFixedClock(search: string, visitorTimezone: string, fixedIso: string) {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const lastDeps: Array<unknown[] | undefined> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  const queued: Array<() => unknown> = [];
  const react = {
    useState: (init: unknown) => {
      const idx = stateIndex++;
      if (!(idx in states)) states[idx] = typeof init === 'function' ? (init as () => unknown)() : init;
      return [states[idx], (next: unknown) => { states[idx] = typeof next === 'function' ? (next as (p: unknown) => unknown)(states[idx]) : next; }];
    },
    useCallback: (fn: unknown) => fn,
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

  const RealDate = globalThis.Date;
  const fixedTime = new RealDate(fixedIso).getTime();
  class FixedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(fixedTime);
      } else {
        super(...(args as [number | string | Date]));
      }
    }
    static now() {
      return fixedTime;
    }
  }

  const origWindow = (globalThis as unknown as { window?: unknown }).window;
  (globalThis as unknown as { window: unknown }).window = { location: { search } };
  (globalThis as unknown as { Date: unknown }).Date = FixedDate;

  const calls = {
    ranges: [] as RangeSelection[],
    fetched: [] as RangeSelection[],
  };

  try {
    useListeningUrlSync({
      isAuthenticated: false,
      visitorTimezone,
      activeMode: 0,
      openModal: () => {},
      setActiveMode: () => {},
      setActiveRange: (range: RangeSelection) => { calls.ranges.push(range); },
      activeRangeRef: { current: DEFAULT_OVERVIEW_RANGE },
      overviewCacheRef: { current: {} },
      setDisplayedRange: () => {},
      fetchOverview: async (range: RangeSelection) => { calls.fetched.push(range); },
      setSelectedSessionId: () => {},
      sanitizeActiveMode,
    });
    for (const effect of queued) effect();
  } finally {
    (globalThis as unknown as { Date: unknown }).Date = RealDate;
    (globalThis as unknown as { window?: unknown }).window = origWindow;
  }

  return calls;
}

test('useListeningUrlSync normalizes ?range=1w to Monday..Sunday window in visitorTimezone for fixed clock', () => {
  // 2026-11-23T01:00:00Z is Monday 2026-11-23 in UTC, but Sunday 2026-11-22 in Pacific/Honolulu (UTC-10)
  const calls = mountWithFixedClock('?range=1w', 'Pacific/Honolulu', '2026-11-23T01:00:00.000Z');
  const expected = unitWindow('2026-11-22', 'week');
  assert.deepEqual(expected, { kind: 'window', from: '2026-11-16', to: '2026-11-22' });
  assert.deepEqual(calls.ranges, [expected]);
  assert.deepEqual(calls.fetched, [expected]);
});

test('useListeningUrlSync passes ?range=all and explicit fixed windows through unchanged', () => {
  const allCalls = mountWithFixedClock('?range=all', 'Pacific/Honolulu', '2026-11-23T01:00:00.000Z');
  assert.deepEqual(allCalls.ranges, [presetRange('all')]);
  assert.deepEqual(allCalls.fetched, [presetRange('all')]);

  const win: RangeSelection = { kind: 'window', from: '2026-11-03', to: '2026-11-17' };
  const winCalls = mountWithFixedClock('?range=2026-11-03..2026-11-17', 'Pacific/Honolulu', '2026-11-23T01:00:00.000Z');
  assert.deepEqual(winCalls.ranges, [win]);
  assert.deepEqual(winCalls.fetched, [win]);
});
