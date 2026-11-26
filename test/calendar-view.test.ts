import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { shouldRefetchCalendar } from "../src/components/listening-view/useCalendarData";
import { CalendarView, CalendarLegend } from "../src/components/views/CalendarView";
import type { CalendarData, CalendarSelection } from "../src/lib/calendar";
import { loadTs } from "./helpers/load-ts";

test("shouldRefetchCalendar logic", () => {
  const current = { timezone: "America/Chicago", refreshKey: 100 };

  // null last -> true
  assert.equal(shouldRefetchCalendar(null, current), true);

  // same values -> false
  assert.equal(
    shouldRefetchCalendar({ timezone: "America/Chicago", refreshKey: 100 }, current),
    false
  );

  // changed timezone -> true
  assert.equal(
    shouldRefetchCalendar({ timezone: "UTC", refreshKey: 100 }, current),
    true
  );

  // changed refreshKey -> true
  assert.equal(
    shouldRefetchCalendar({ timezone: "America/Chicago", refreshKey: 101 }, current),
    true
  );
});

test("renderToStaticMarkup(CalendarView) with small fixture", () => {
  const fixtureData: CalendarData = {
    firstDate: "2026-09-04",
    today: "2026-11-23",
    timezone: "America/Chicago",
    days: [
      { date: "2026-09-04", count: 12 },
      { date: "2026-10-15", count: 35 },
      { date: "2026-11-20", count: 8 },
    ],
  };

  const html = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: fixtureData,
      isLoading: false,
      selection: null,
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
    })
  );

  // 2026-09-03 and 2026-11-24 have no data-date attribute
  assert.ok(!html.includes('data-date="2026-09-03"'), "2026-09-03 should not have data-date");
  assert.ok(!html.includes('data-date="2026-11-24"'), "2026-11-24 should not have data-date");
  assert.ok(html.includes('data-date="2026-09-04"'), "2026-09-04 should have data-date");
  assert.ok(html.includes('data-date="2026-11-23"'), "2026-11-23 should have data-date");

  // The August month button is disabled, and the October one isn't
  const augMatches = html.match(/<button[^>]*>[^<]*Aug[^<]*<\/button>/gi) || [];
  assert.ok(augMatches.length > 0, "should render August button");
  for (const match of augMatches) {
    assert.match(match, /\sdisabled(?=[>\s=])/, "August button must have disabled attribute");
  }

  const octMatches = html.match(/<button[^>]*>[^<]*Oct[^<]*<\/button>/gi) || [];
  assert.ok(octMatches.length > 0, "should render October button");
  for (const match of octMatches) {
    assert.doesNotMatch(match, /\sdisabled(?=[>\s=])/, "October button must not have disabled attribute");
  }

  // With selection null, Open in Overview button is disabled
  const overviewButtonMatch = html.match(/<button[^>]*>[^<]*Open in Overview[^<]*<\/button>/i);
  assert.ok(overviewButtonMatch, "should render Open in Overview button");
  assert.match(overviewButtonMatch[0], /\sdisabled(?=[>\s=])/, "Open in Overview button must have disabled attribute when selection is null");
});

test("CalendarView with selection contains formatted label and enabled Open in Overview button", () => {
  const fixtureData: CalendarData = {
    firstDate: "2026-09-04",
    today: "2026-11-23",
    timezone: "America/Chicago",
    days: [
      { date: "2026-09-04", count: 12 },
      { date: "2026-10-15", count: 35 },
      { date: "2026-11-20", count: 8 },
    ],
  };

  const html = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: fixtureData,
      isLoading: false,
      selection: { from: "2026-10-01", to: "2026-10-31" },
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
    })
  );

  // Bar contains Oct 2026
  assert.ok(html.includes("Oct 2026"), "bar must contain 'Oct 2026'");

  // Open in Overview button is enabled
  const overviewButtonMatch = html.match(/<button[^>]*>[^<]*Open in Overview[^<]*<\/button>/i);
  assert.ok(overviewButtonMatch, "should render Open in Overview button");
  assert.doesNotMatch(overviewButtonMatch[0], /\sdisabled(?=[>\s=])/, "Open in Overview button must not have disabled attribute with selection");
  assert.match(overviewButtonMatch[0], /hover:enabled:bg-music-accent\/10/, "Open in Overview button must tint on hover");
});

test("CalendarView first load with no data renders animate-pulse and no loading text", () => {
  const html = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: null,
      isLoading: true,
      selection: null,
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
    })
  );

  assert.match(html, /animate-pulse/, "must contain animate-pulse skeleton");
  assert.doesNotMatch(html, /loading/i, "must not contain text matching /loading/i");
});

test("CalendarLegend renders swatches and labels", () => {
  const html = renderToStaticMarkup(React.createElement(CalendarLegend));
  assert.ok(html.includes("Less"), "must contain 'Less'");
  assert.ok(html.includes("More"), "must contain 'More'");
  assert.ok(html.includes("calendar-level-0"), "must contain calendar-level-0");
  assert.ok(html.includes("calendar-level-4"), "must contain calendar-level-4");
});

test("CalendarView multi-year dimming, rings, and active year block border", () => {
  const multiYearData: CalendarData = {
    firstDate: "2024-06-01",
    today: "2025-06-01",
    timezone: "UTC",
    days: [
      { date: "2024-11-15", count: 10 },
      { date: "2024-12-20", count: 20 },
      { date: "2025-01-10", count: 30 },
      { date: "2025-02-14", count: 40 },
    ],
  };

  // Selection from 2024-11-15 to 2024-12-31 (only in 2024)
  const html = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: multiYearData,
      isLoading: false,
      selection: { from: "2024-11-15", to: "2024-12-31" },
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
    })
  );

  // 2024 block has border-[#383830]
  const sec2024 = html.match(/<section\b[^>]*\bdata-year="2024"[^>]*>/)?.[0] ?? "";
  assert.match(sec2024, /border-\[#383830\]/);

  // 2025 block has border-[#1C1C1A]
  const sec2025 = html.match(/<section\b[^>]*\bdata-year="2025"[^>]*>/)?.[0] ?? "";
  assert.match(sec2025, /border-\[#1C1C1A\]/);

  // 2024-11-15 has ring-1
  const cellStart = html.match(/<div[^>]*data-date="2024-11-15"[^>]*class="[^"]*"/);
  assert.ok(cellStart, "should find 2024-11-15 cell");
  assert.match(cellStart[0], /ring-1 ring-inset ring-\[#EDEDE8\]/);
  assert.match(cellStart[0], /opacity-100/);

  // 2024-12-20 is inside the selection but not an edge -> no ring
  const cellMid = html.match(/<div[^>]*data-date="2024-12-20"[^>]*class="[^"]*"/);
  assert.ok(cellMid, "should find 2024-12-20 cell");
  assert.match(cellMid[0], /opacity-100/);
  assert.doesNotMatch(cellMid[0], /ring-1/);

  // Empty days inside the selection are lifted so they stand apart from empty days outside it
  const emptyIn = html.match(/<div[^>]*data-date="2024-11-20"[^>]*class="[^"]*"/)?.[0] ?? "";
  assert.match(emptyIn, /calendar-level-0/);
  assert.match(emptyIn, /calendar-in-range/);
  const emptyOut = html.match(/<div[^>]*data-date="2025-01-20"[^>]*class="[^"]*"/)?.[0] ?? "";
  assert.match(emptyOut, /calendar-level-0/);
  assert.doesNotMatch(emptyOut, /calendar-in-range/);

  // 2025-01-10 is outside selection -> calendar-out-of-range
  const cellOut = html.match(/<div[^>]*data-date="2025-01-10"[^>]*class="[^"]*"/);
  assert.ok(cellOut, "should find 2025-01-10 cell");
  assert.match(cellOut[0], /calendar-out-of-range/);
  assert.doesNotMatch(cellOut[0], /ring-1 ring-inset ring-\[#EDEDE8\]/);
});

test("CalendarView renders 'No Plays yet.' when data has no plays or null firstDate", () => {
  const emptyData: CalendarData = {
    firstDate: null,
    today: "2026-11-23",
    timezone: "UTC",
    days: [],
  };

  const html = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: emptyData,
      isLoading: false,
      selection: null,
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
    })
  );

  assert.ok(html.includes("No Plays yet."), "must show 'No Plays yet.'");
  assert.doesNotMatch(html, /animate-pulse/, "must not render skeleton for loaded empty data");
});

test("CalendarView renders no content when data is null and isLoading is false", () => {
  const htmlIdle = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: null,
      isLoading: false,
      selection: null,
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
    })
  );

  assert.equal(htmlIdle, "", "must render no content when data is null and not loading");
  assert.doesNotMatch(htmlIdle, /animate-pulse/, "must not render skeleton when isLoading is false");
  assert.ok(!htmlIdle.includes("No Plays yet."), "must not show 'No Plays yet.' when data is null");
});

test("CalendarView aligns M/W/F weekday labels to row tracks 2, 4, 6 of the week grid", () => {
  const fixtureData: CalendarData = {
    firstDate: "2026-09-04",
    today: "2026-11-23",
    timezone: "America/Chicago",
    days: [{ date: "2026-09-04", count: 12 }],
  };

  const html = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: fixtureData,
      isLoading: false,
      selection: null,
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
    })
  );

  // Check that M, W, F are placed in grid-column: 1 and grid-row: 2, 4, 6
  assert.match(html, /grid-column:1;\s*grid-row:2/);
  assert.match(html, /grid-column:1;\s*grid-row:4/);
  assert.match(html, /grid-column:1;\s*grid-row:6/);
  assert.match(html, />M<\/div>/);
  assert.match(html, />W<\/div>/);
  assert.match(html, />F<\/div>/);
});

function createReactHookHarness() {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const lastDeps: Array<unknown[] | undefined> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  let queuedEffects: Array<() => unknown> = [];

  const reactMock = {
    ...React,
    useState: (init: unknown) => {
      const idx = stateIndex++;
      if (!(idx in states)) {
        states[idx] = typeof init === "function" ? (init as () => unknown)() : init;
      }
      return [
        states[idx],
        (next: unknown) => {
          states[idx] =
            typeof next === "function"
              ? (next as (p: unknown) => unknown)(states[idx])
              : next;
        },
      ];
    },
    useRef: (init: unknown) => {
      const idx = refIndex++;
      if (!refs[idx]) refs[idx] = { current: init };
      return refs[idx];
    },
    useMemo: (factory: () => unknown) => factory(),
    useCallback: (fn: unknown) => fn,
    useEffect: (effect: () => unknown, deps?: unknown[]) => {
      const idx = effectIndex++;
      const prev = lastDeps[idx];
      if (!prev || !deps || deps.some((d, i) => !Object.is(d, prev[i]))) {
        queuedEffects.push(effect);
      }
      lastDeps[idx] = deps;
    },
    memo: (comp: unknown) => comp,
  };

  function runRender<T>(renderFn: () => T, rerenderAfterEffects = false): T {
    stateIndex = 0;
    refIndex = 0;
    effectIndex = 0;
    queuedEffects = [];
    let result = renderFn();
    if (queuedEffects.length > 0) {
      const effectsToRun = queuedEffects;
      queuedEffects = [];
      for (const eff of effectsToRun) {
        eff();
      }
      if (rerenderAfterEffects) {
        stateIndex = 0;
        refIndex = 0;
        effectIndex = 0;
        result = renderFn();
      }
    }
    return result;
  }

  return { reactMock, runRender };
}

function createCalendarDataHarness() {
  const { reactMock, runRender } = createReactHookHarness();
  const { useCalendarData } = loadTs("src/components/listening-view/useCalendarData.ts", {
    react: reactMock,
  });

  const pendingRequests: Array<{
    url: string;
    resolve: (val: unknown) => void;
    reject: (err: unknown) => void;
  }> = [];

  const originalFetch = globalThis.fetch;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = (url: string) => {
    return new Promise((resolve, reject) => {
      pendingRequests.push({ url, resolve, reject });
    });
  };

  return {
    pendingRequests,
    renderHook(opts: { enabled: boolean; timezone: string; refreshKey: number }) {
      return runRender(() => useCalendarData(opts), true);
    },
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

test("CalendarView shows 'Tap an end day' hint during pending second tap on touch screens", () => {
  const fixtureData: CalendarData = {
    firstDate: "2026-09-04",
    today: "2026-11-23",
    timezone: "America/Chicago",
    days: [
      { date: "2026-09-04", count: 12 },
      { date: "2026-10-15", count: 35 },
    ],
  };

  const { reactMock, runRender } = createReactHookHarness();
  const { CalendarView: CalendarViewUnderTest } = loadTs("src/components/views/CalendarView.tsx", {
    react: reactMock,
  });

  let currentSelection: CalendarSelection | null = null;
  const selectionsChanged: (CalendarSelection | null)[] = [];

  function renderView() {
    return runRender(() =>
      CalendarViewUnderTest({
        data: fixtureData,
        isLoading: false,
        selection: currentSelection,
        onSelectionChange: (sel: CalendarSelection | null) => {
          currentSelection = sel;
          selectionsChanged.push(sel);
        },
        onOpenInOverview: () => {},
      })
    );
  }

  // 1. Initial render without selection
  let tree = renderView();
  let markup = renderToStaticMarkup(tree);
  assert.ok(markup.includes("Drag across days or pick a month"));
  assert.ok(!markup.includes("Tap an end day"));

  // Find container handlers
  const container = tree.props.children[1];
  assert.ok(container.props.onPointerDown && container.props.onPointerUp);

  const mockCell1 = {
    closest: (selector: string) => (selector === "[data-date]" ? { dataset: { date: "2026-09-04" } } : null),
  };

  // 2. First tap on 2026-09-04
  container.props.onPointerDown({
    isPrimary: true,
    pointerId: 1,
    pointerType: "touch",
    clientX: 100,
    clientY: 100,
    target: mockCell1,
  });
  container.props.onPointerUp({
    pointerId: 1,
    pointerType: "touch",
    clientX: 100,
    clientY: 100,
    target: mockCell1,
  });

  assert.deepEqual(currentSelection, { from: "2026-09-04", to: "2026-09-04" });

  // Re-render after first tap
  tree = renderView();
  markup = renderToStaticMarkup(tree);

  // During pending second tap, "Tap an end day" must be shown!
  assert.ok(markup.includes("Tap an end day"), "must show 'Tap an end day' hint during pending second tap");

  // 3. Second tap on 2026-10-15
  const mockCell2 = {
    closest: (selector: string) => (selector === "[data-date]" ? { dataset: { date: "2026-10-15" } } : null),
  };
  container.props.onPointerDown({
    isPrimary: true,
    pointerId: 1,
    pointerType: "touch",
    clientX: 150,
    clientY: 150,
    target: mockCell2,
  });
  container.props.onPointerUp({
    pointerId: 1,
    pointerType: "touch",
    clientX: 150,
    clientY: 150,
    target: mockCell2,
  });

  assert.deepEqual(currentSelection, { from: "2026-09-04", to: "2026-10-15" });

  // Re-render after second tap
  tree = renderView();
  markup = renderToStaticMarkup(tree);

  // After second tap commits range, "Tap an end day" is cleared
  assert.ok(!markup.includes("Tap an end day"));
  assert.ok(markup.includes("Sep 4 – Oct 15, 2026"));
});

test("useCalendarData avoids A -> B -> A race condition and restores status", async () => {
  const { pendingRequests, renderHook, restore } = createCalendarDataHarness();

  try {
    // 1. Initial mount with Target A
    let res = renderHook({ enabled: true, timezone: "America/Chicago", refreshKey: 0 });
    assert.equal(res.status, "loading");
    assert.equal(pendingRequests.length, 1);
    assert.ok(pendingRequests[0].url.includes("America%2FChicago"));

    // Complete request A
    const dataA = {
      firstDate: "2026-01-01",
      today: "2026-01-02",
      timezone: "America/Chicago",
      days: [{ date: "2026-01-01", count: 5 }],
    };
    pendingRequests[0].resolve({
      ok: true,
      json: async () => dataA,
    });
    await new Promise((r) => setTimeout(r, 10));

    // After resolving A, re-render
    res = renderHook({ enabled: true, timezone: "America/Chicago", refreshKey: 0 });
    assert.equal(res.status, "ready");
    assert.deepEqual(res.data, dataA);

    // 2. Switch to Target B
    res = renderHook({ enabled: true, timezone: "Europe/London", refreshKey: 0 });
    assert.equal(res.status, "loading");
    assert.deepEqual(res.data, dataA, "dataA is preserved while loading B");
    assert.equal(pendingRequests.length, 2);
    assert.ok(pendingRequests[1].url.includes("Europe%2FLondon"));

    // 3. User reverts back to Target A BEFORE B resolves
    res = renderHook({ enabled: true, timezone: "America/Chicago", refreshKey: 0 });
    assert.equal(res.status, "ready", "status must restore to ready immediately");
    assert.deepEqual(res.data, dataA, "dataA is preserved");
    assert.equal(pendingRequests.length, 2, "no third request is made");

    // 4. Now B finishes late
    const dataB = {
      firstDate: "2026-01-01",
      today: "2026-01-02",
      timezone: "Europe/London",
      days: [{ date: "2026-01-01", count: 99 }],
    };
    pendingRequests[1].resolve({
      ok: true,
      json: async () => dataB,
    });
    await new Promise((r) => setTimeout(r, 10));

    // Re-render: data must NOT be overwritten by B!
    res = renderHook({ enabled: true, timezone: "America/Chicago", refreshKey: 0 });
    assert.equal(res.status, "ready");
    assert.deepEqual(res.data, dataA, "late B response must be discarded and dataA preserved");
  } finally {
    restore();
  }
});

test("useCalendarData deduplicates pending leave/re-enter, preserves cached re-entry, and allows retry after failure", async () => {
  const { pendingRequests, renderHook, restore } = createCalendarDataHarness();
  const originalConsoleError = console.error;
  console.error = () => {};

  const dataA: CalendarData = {
    firstDate: "2026-01-01",
    today: "2026-01-02",
    timezone: "UTC",
    days: [{ date: "2026-01-01", count: 7 }],
  };

  try {
    // 1. Initial load starts in-flight request
    let res = renderHook({ enabled: true, timezone: "UTC", refreshKey: 0 });
    assert.equal(res.status, "loading");
    assert.equal(pendingRequests.length, 1);

    // 2. Leave Calendar before resolution
    res = renderHook({ enabled: false, timezone: "UTC", refreshKey: 0 });
    assert.equal(pendingRequests.length, 1, "no fetch while disabled");

    // 3. Re-enter Calendar with same target before resolution -> must NOT duplicate request
    res = renderHook({ enabled: true, timezone: "UTC", refreshKey: 0 });
    assert.equal(res.status, "loading");
    assert.equal(pendingRequests.length, 1, "must not duplicate pending request on leave/re-enter");

    // 4. First request fails -> status becomes error and retry must be allowed on next re-entry
    pendingRequests[0].reject(new Error("network failure"));
    await new Promise((r) => setTimeout(r, 10));
    res = renderHook({ enabled: true, timezone: "UTC", refreshKey: 0 });
    assert.equal(res.status, "error");
    assert.equal(res.data, null);

    // Leave and re-enter -> triggers retry fetch
    res = renderHook({ enabled: false, timezone: "UTC", refreshKey: 0 });
    res = renderHook({ enabled: true, timezone: "UTC", refreshKey: 0 });
    assert.equal(res.status, "loading");
    assert.equal(pendingRequests.length, 2, "must retry after previous failure");

    // Resolve retry request
    pendingRequests[1].resolve({
      ok: true,
      json: async () => dataA,
    });
    await new Promise((r) => setTimeout(r, 10));
    res = renderHook({ enabled: true, timezone: "UTC", refreshKey: 0 });
    assert.equal(res.status, "ready");
    assert.deepEqual(res.data, dataA);

    // 5. Cached re-entry: leave and re-enter after resolution -> no redundant fetch
    res = renderHook({ enabled: false, timezone: "UTC", refreshKey: 0 });
    assert.equal(pendingRequests.length, 2, "no fetch while disabled");
    assert.deepEqual(res.data, dataA, "data preserved while disabled");
    assert.equal(res.status, "ready");

    res = renderHook({ enabled: true, timezone: "UTC", refreshKey: 0 });
    assert.equal(pendingRequests.length, 2, "no redundant fetch when re-enabled with same target");
    assert.deepEqual(res.data, dataA);
    assert.equal(res.status, "ready");
  } finally {
    console.error = originalConsoleError;
    restore();
  }
});
