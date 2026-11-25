import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTs } from './helpers/load-ts';
import {
  DEFAULT_OVERVIEW_RANGE,
  formatRangeParam,
  presetRange,
  todayDateKey,
  unitWindow,
  type RangeSelection,
} from '../src/lib/range';

/** Minimal hook runtime: refs persist across renders, effects run when their deps change. */
function mount(search: string, initialActiveMode?: number) {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const lastDeps: Array<unknown[] | undefined> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  let queued: Array<() => unknown> = [];
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

  (globalThis as unknown as { window: unknown }).window = { location: { search } };

  const calls = {
    modes: [] as number[],
    ranges: [] as RangeSelection[],
    sessions: [] as string[],
    fetched: [] as RangeSelection[],
    modalOpens: 0,
  };
  const props = {
    activeMode: initialActiveMode,
    visitorTimezone: 'UTC',
    openModal: () => { calls.modalOpens++; },
    setActiveMode: (mode: number) => { calls.modes.push(mode); },
    setActiveRange: (range: RangeSelection) => { calls.ranges.push(range); },
    activeRangeRef: { current: DEFAULT_OVERVIEW_RANGE },
    overviewCacheRef: { current: {} },
    setDisplayedRange: () => {},
    fetchOverview: async (range: RangeSelection) => { calls.fetched.push(range); },
    setSelectedSessionId: (id: string) => { calls.sessions.push(id); },
    sanitizeActiveMode,
  };
  const render = (isAuthenticated: boolean) => {
    stateIndex = 0;
    refIndex = 0;
    effectIndex = 0;
    queued = [];
    const result = useListeningUrlSync({ ...props, isAuthenticated }) as {
      isPendingLivePlayer: boolean;
      pendingLivePlayerRef: { current: boolean };
      clearPendingLivePlayer: () => void;
      skipNextUrlSyncRef: { current: boolean };
    };
    for (const effect of queued) effect();
    return result;
  };
  return { render, calls };
}

function withFixedClock(fixedIso: string, fn: () => void) {
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
  (globalThis as unknown as { Date: unknown }).Date = FixedDate;
  try {
    fn();
  } finally {
    (globalThis as unknown as { Date: unknown }).Date = RealDate;
  }
}

test('URL parameters are applied once and not again on login or lock', () => {
  withFixedClock('2026-11-24T12:00:00.000Z', () => {
    const { render, calls } = mount('?mode=1&range=1m&session=session-2&config=1');
    const expectedMonth = unitWindow(todayDateKey('UTC'), 'month');
    render(false);
    render(true);
    render(false);
    assert.deepEqual(calls.modes, [1]);
    assert.deepEqual(calls.ranges, [expectedMonth]);
    assert.deepEqual(calls.fetched, [expectedMonth]);
    assert.deepEqual(calls.sessions, ['session-2']);
    assert.equal(calls.modalOpens, 1);
  });
});

test('URL parameter mode=5 applies Calendar mode', () => {
  const { render, calls } = mount('?mode=5');
  render(false);
  assert.deepEqual(calls.modes, [5]);
});

test('URL window range parameter parses into a window RangeSelection and fetches it', () => {
  const { render, calls } = mount('?range=2025-11-01..2025-11-30');
  render(false);
  const expected: RangeSelection = { kind: 'window', from: '2025-11-01', to: '2025-11-30' };
  assert.deepEqual(calls.ranges, [expected]);
  assert.deepEqual(calls.fetched, [expected]);
});

test('a Live Player request made before login is applied once the visitor is authenticated', () => {
  withFixedClock('2026-11-24T12:00:00.000Z', () => {
    const { render, calls } = mount('?mode=3&range=6m');
    const expectedYear = unitWindow(todayDateKey('UTC'), 'year');
    render(false);
    assert.deepEqual(calls.modes, [0]);
    render(true);
    assert.deepEqual(calls.modes, [0, 3]);
    render(false);
    render(true);
    assert.deepEqual(calls.modes, [0, 3], 'the pending request is used up by the first login');
    assert.deepEqual(calls.ranges, [expectedYear]);
  });
});

test('a Live Player request from an authenticated visitor is applied once and defers initial URL sync', () => {
  const { render, calls } = mount('?mode=3', 0);
  const first = render(true);
  assert.equal(first.skipNextUrlSyncRef.current, true, 'initial mode=3 activation must defer URL rewrite until activeMode updates');
  render(false);
  render(true);
  assert.deepEqual(calls.modes, [3]);
});

test('clearing pending Live Player intent prevents later login from forcing mode 3', () => {
  const { render, calls } = mount('?mode=3', 0);
  const first = render(false);
  assert.equal(first.pendingLivePlayerRef.current, true);
  first.clearPendingLivePlayer();
  assert.equal(first.pendingLivePlayerRef.current, false);
  render(true);
  assert.deepEqual(calls.modes, [0], 'login after explicit navigation must not hijack back to Live Player');
});

test('buildListeningUrlSearch manages overview range in mode 0 and leaves it alone in mode 1', () => {
  const { buildListeningUrlSearch } = loadTs('src/components/listening-view/listening-helpers.ts');
  const novWindow: RangeSelection = { kind: 'window', from: '2025-11-01', to: '2025-11-30' };

  // Writes window range in mode 0
  assert.equal(
    buildListeningUrlSearch('', {
      activeMode: 0,
      overviewRange: novWindow,
      profileTarget: null,
      profileRange: presetRange('all'),
    }),
    `?range=${encodeURIComponent(formatRangeParam(novWindow))}`,
  );

  // Writes non-default preset range in mode 0
  assert.equal(
    buildListeningUrlSearch('', {
      activeMode: 0,
      overviewRange: presetRange('1y'),
      profileTarget: null,
      profileRange: presetRange('all'),
    }),
    '?range=1y',
  );

  // Omits range for 1w (default) in mode 0, removing any previous range param
  assert.equal(
    buildListeningUrlSearch('?range=2025-11-01..2025-11-30', {
      activeMode: 0,
      overviewRange: DEFAULT_OVERVIEW_RANGE,
      profileTarget: null,
      profileRange: presetRange('all'),
    }),
    '',
  );

  // Leaves range untouched in mode 1
  assert.equal(
    buildListeningUrlSearch('?mode=1&range=2025-11-01..2025-11-30', {
      activeMode: 1,
      overviewRange: DEFAULT_OVERVIEW_RANGE,
      profileTarget: null,
      profileRange: presetRange('all'),
    }),
    '?mode=1&range=2025-11-01..2025-11-30',
  );
  assert.equal(
    buildListeningUrlSearch('?mode=1', {
      activeMode: 1,
      overviewRange: novWindow,
      profileTarget: null,
      profileRange: presetRange('all'),
    }),
    '?mode=1',
  );
});

test('buildListeningUrlSearch keeps explicit mode aligned with activeMode and keeps default Overview compact', () => {
  const { buildListeningUrlSearch } = loadTs('src/components/listening-view/listening-helpers.ts');
  const novWindow: RangeSelection = { kind: 'window', from: '2025-11-01', to: '2025-11-30' };

  // Switching from explicit ?mode=1 or ?mode=2 to Overview clears stale mode
  assert.equal(
    buildListeningUrlSearch('?mode=1', {
      activeMode: 0,
      overviewRange: DEFAULT_OVERVIEW_RANGE,
      profileTarget: null,
      profileRange: presetRange('all'),
    }),
    '',
  );
  assert.equal(
    buildListeningUrlSearch('?mode=2', {
      activeMode: 0,
      overviewRange: novWindow,
      profileTarget: null,
      profileRange: presetRange('all'),
    }),
    `?range=${encodeURIComponent(formatRangeParam(novWindow))}`,
  );
  assert.equal(
    buildListeningUrlSearch('?mode=0', {
      activeMode: 0,
      overviewRange: DEFAULT_OVERVIEW_RANGE,
      profileTarget: null,
      profileRange: presetRange('all'),
    }),
    '',
  );

  // Switching between non-Overview tabs keeps explicit mode aligned with activeMode
  assert.equal(
    buildListeningUrlSearch('?mode=1', {
      activeMode: 2,
      overviewRange: DEFAULT_OVERVIEW_RANGE,
      profileTarget: null,
      profileRange: presetRange('all'),
    }),
    '?mode=2',
  );
  assert.equal(
    buildListeningUrlSearch('?mode=4', {
      activeMode: 1,
      overviewRange: DEFAULT_OVERVIEW_RANGE,
      profileTarget: null,
      profileRange: presetRange('all'),
    }),
    '?mode=1',
  );
  // Without an explicit mode param, non-Search tabs stay compact
  assert.equal(
    buildListeningUrlSearch('', {
      activeMode: 1,
      overviewRange: DEFAULT_OVERVIEW_RANGE,
      profileTarget: null,
      profileRange: presetRange('all'),
    }),
    '',
  );

  // mode=3 in Overview is preserved only while pending admin login intent is active
  assert.equal(
    buildListeningUrlSearch('?mode=3', {
      activeMode: 0,
      overviewRange: DEFAULT_OVERVIEW_RANGE,
      profileTarget: null,
      profileRange: presetRange('all'),
      preservePendingMode3: true,
    }),
    '?mode=3',
  );
  assert.equal(
    buildListeningUrlSearch('?mode=3', {
      activeMode: 0,
      overviewRange: DEFAULT_OVERVIEW_RANGE,
      profileTarget: null,
      profileRange: presetRange('all'),
    }),
    '',
  );
});

test('ListeningView restores DEFAULT_OVERVIEW_RANGE on mode 0 popstate without range and avoids stranding push flags on same-range selection', () => {
  const source = readFileSync('src/components/ListeningView.tsx', 'utf8');
  assert.ok(
    source.includes('DEFAULT_OVERVIEW_RANGE'),
    'ListeningView must reference DEFAULT_OVERVIEW_RANGE for mode 0 popstate fallback',
  );
  assert.ok(
    source.includes('isSameRange(activeRangeRef.current, normalized)'),
    'handleSelectRange must guard same-range selection before setting shouldPushHistoryRef',
  );
});
