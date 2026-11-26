import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CalendarView, areYearDayGridPropsEqual } from "../src/components/views/CalendarView";
import type { CalendarData } from "../src/lib/calendar";
import type { TastePhase, TastePhasesData } from "../src/lib/taste/types";
import { phaseSelection, tasteRow } from "../src/lib/taste/view";
import { loadTs } from "./helpers/load-ts";

const CALENDAR_FIXTURE: CalendarData = {
  firstDate: "2024-06-02",
  today: "2025-12-27",
  timezone: "UTC",
  days: [
    { date: "2024-06-15", count: 14 },
    { date: "2024-12-01", count: 28 },
    { date: "2025-03-10", count: 40 },
    { date: "2025-08-20", count: 22 },
  ],
};

function makePhase(
  start: string,
  end: string,
  minK: number,
  maxK: number,
  plays: number,
  topArtist: string,
): TastePhase {
  return {
    id: `${start}_${end}`,
    start,
    end,
    minK,
    maxK,
    plays,
    topArtists: [
      { name: topArtist, plays: Math.round(plays * 0.45), share: 0.45 },
      { name: "Artist Beta", plays: Math.round(plays * 0.25), share: 0.25 },
      { name: "Artist Gamma", plays: Math.round(plays * 0.15), share: 0.15 },
    ],
    inShift: false,
  };
}

const TASTE_FIXTURE: TastePhasesData = {
  timezone: "UTC",
  analyzedWeeks: 70,
  kEra: 2,
  kFine: 4,
  phases: [
    makePhase("2024-06-02", "2025-12-27", 1, 1, 4200, "Artist Alpha"),
    makePhase("2024-06-02", "2025-02-08", 2, 2, 2100, "Artist Alpha"),
    makePhase("2025-02-09", "2025-12-27", 2, 3, 2100, "Artist Delta"),
    makePhase("2024-06-02", "2024-08-31", 3, 4, 1000, "Artist Alpha"),
    makePhase("2024-11-03", "2025-02-08", 3, 4, 1100, "Artist Epsilon"),
    makePhase("2025-02-09", "2025-05-24", 4, 4, 1200, "Artist Delta"),
    makePhase("2025-05-25", "2025-12-27", 4, 4, 900, "Artist Zeta"),
  ],
  shifts: [
    {
      week: "2025-02-09",
      minK: 2,
      levels: [
        { k: 2, kind: "gradual", widthWeeks: 6, rampStart: "2025-01-19", rampEnd: "2025-03-01" },
        { k: 3, kind: "gradual", widthWeeks: 6, rampStart: "2025-01-19", rampEnd: "2025-03-01" },
        { k: 4, kind: "sharp", widthWeeks: 2, rampStart: "2025-02-02", rampEnd: "2025-02-15" },
      ],
    },
    {
      week: "2024-11-03",
      minK: 3,
      levels: [
        { k: 3, kind: "sharp", widthWeeks: 1, rampStart: "2024-11-03", rampEnd: "2024-11-09" },
        { k: 4, kind: "sharp", widthWeeks: 1, rampStart: "2024-11-03", rampEnd: "2024-11-09" },
      ],
    },
    {
      week: "2025-05-25",
      minK: 4,
      levels: [
        { k: 4, kind: "sharp", widthWeeks: 1, rampStart: "2025-05-25", rampEnd: "2025-05-31" },
      ],
    },
  ],
  gaps: [{ start: "2024-09-01", end: "2024-11-02" }],
};

test("CalendarView renders identical markup with no Taste UI when taste is omitted, null, or kFine === 1", () => {
  const htmlOmitted = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: CALENDAR_FIXTURE,
      isLoading: false,
      selection: null,
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
    }),
  );

  const htmlNull = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: CALENDAR_FIXTURE,
      isLoading: false,
      selection: null,
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
      taste: null,
      tasteLevel: null,
    }),
  );

  const singlePhaseTaste: TastePhasesData = {
    timezone: "UTC",
    analyzedWeeks: 12,
    kEra: 1,
    kFine: 1,
    phases: [makePhase("2024-06-02", "2025-12-27", 1, 1, 1000, "Artist Alpha")],
    shifts: [],
    gaps: [],
  };

  const htmlSingle = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: CALENDAR_FIXTURE,
      isLoading: false,
      selection: null,
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
      taste: singlePhaseTaste,
      tasteLevel: null,
    }),
  );

  assert.equal(htmlNull, htmlOmitted, "taste: null must match omitted taste markup exactly");
  assert.equal(htmlSingle, htmlOmitted, "kFine === 1 must match omitted taste markup exactly");

  for (const html of [htmlOmitted, htmlNull, htmlSingle]) {
    assert.ok(!html.includes('aria-label="Taste detail"'));
    assert.ok(!html.includes("aria-pressed="));
    assert.ok(!html.includes("taste-tone-a"));
    assert.ok(!html.includes("taste-tone-b"));
    assert.ok(!html.includes("taste-gap"));
    assert.ok(html.includes("Drag across days or pick a month"));
  }
});

test("CalendarView renders default Taste Era level, 2 cards, slider bounds, label, and updated hint", () => {
  const html = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: CALENDAR_FIXTURE,
      isLoading: false,
      selection: null,
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
      taste: TASTE_FIXTURE,
      tasteLevel: null,
      onTasteLevelChange: () => {},
    }),
  );

  // Exactly 2 phase cards (aria-pressed buttons)
  const cardButtons = html.match(/<button\b[^>]*\baria-pressed="false"[^>]*>/g) ?? [];
  assert.equal(cardButtons.length, 2, "must render exactly 2 phase cards at default kEra=2");

  // Slider with min="2", max="4", aria-label="Taste detail", aria-valuetext="2 Taste Eras"
  const sliderMatch = html.match(/<input\b[^>]*type="range"[^>]*>/);
  assert.ok(sliderMatch, "must render range slider");
  assert.match(sliderMatch[0], /\bmin="2"/);
  assert.match(sliderMatch[0], /\bmax="4"/);
  assert.match(sliderMatch[0], /\baria-label="Taste detail"/);
  assert.match(sliderMatch[0], /\baria-valuetext="2 Taste Eras"/);

  // Level label & updated hint
  assert.ok(html.includes("2 Taste Eras"));
  assert.ok(html.includes("Drag across days, pick a month, or pick a phase"));

  // Gap card, gradual connector, and legend render when present at level
  assert.ok(html.includes("9 weeks"), "must render interior gap week count");
  assert.ok(html.includes("no data"), "must render gap card and legend");
  assert.ok(html.includes("6w"), "must render gradual shift widthWeeks on connector");
  assert.ok(html.includes("gradual shift"), "must render gradual shift legend");

  // Ribbon pieces exist and never carry data-date
  assert.ok(html.includes("taste-tone-a"));
  assert.ok(html.includes("taste-tone-b"));
  const ribbonButtons = html.match(/<button\b[^>]*taste-tone-[ab][^>]*>/g) ?? [];
  assert.ok(ribbonButtons.length > 0, "must render ribbon buttons");
  for (const btn of ribbonButtons) {
    assert.ok(!btn.includes("data-date="), "ribbon pieces must never carry data-date");
  }
});

test("CalendarView highlights selected phase card and its ribbon pieces when selection matches a phase", () => {
  const era1 = TASTE_FIXTURE.phases.find((p) => p.id === "2024-06-02_2025-02-08")!;
  const html = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: CALENDAR_FIXTURE,
      isLoading: false,
      selection: phaseSelection(era1),
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
      taste: TASTE_FIXTURE,
      tasteLevel: 2,
      onTasteLevelChange: () => {},
    }),
  );

  const pressedTrue = html.match(/<button\b[^>]*\baria-pressed="true"[^>]*>/g) ?? [];
  const pressedFalse = html.match(/<button\b[^>]*\baria-pressed="false"[^>]*>/g) ?? [];
  assert.equal(pressedTrue.length, 1, "exactly one card must be pressed");
  assert.equal(pressedFalse.length, 1, "the other card must not be pressed");

  // Ribbon piece for selected phase has bg-music-accent
  const accentRibbonButtons =
    html.match(/<button\b[^>]*bg-music-accent[^>]*data-taste-ribbon="phase"[^>]*>|<button\b[^>]*data-taste-ribbon="phase"[^>]*bg-music-accent[^>]*>/g) ?? [];
  assert.ok(accentRibbonButtons.length >= 2, "selected phase ribbon segments (desktop & mobile) must use bg-music-accent");
});

test("CalendarView leaves all cards unpressed when selection matches no phase, while dimming days", () => {
  const html = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: CALENDAR_FIXTURE,
      isLoading: false,
      selection: { from: "2024-06-10", to: "2024-06-20" },
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
      taste: TASTE_FIXTURE,
      tasteLevel: 2,
      onTasteLevelChange: () => {},
    }),
  );

  const pressedTrue = html.match(/<button\b[^>]*\baria-pressed="true"[^>]*>/g) ?? [];
  const pressedFalse = html.match(/<button\b[^>]*\baria-pressed="false"[^>]*>/g) ?? [];
  assert.equal(pressedTrue.length, 0, "no card may be pressed for a non-matching range");
  assert.equal(pressedFalse.length, 2, "both cards remain unpressed");

  // Outside day is still dimmed
  const outDay = html.match(/<div[^>]*data-date="2025-03-10"[^>]*class="[^"]*"/)?.[0] ?? "";
  assert.match(outDay, /opacity-40/);
});

test("CalendarView hides slider when kEra === kFine while still rendering cards and ribbon", () => {
  const singleLevelTaste: TastePhasesData = {
    timezone: "UTC",
    analyzedWeeks: 40,
    kEra: 2,
    kFine: 2,
    phases: [
      makePhase("2024-06-02", "2025-12-27", 1, 1, 4200, "Artist Alpha"),
      makePhase("2024-06-02", "2025-02-08", 2, 2, 2100, "Artist Alpha"),
      makePhase("2025-02-09", "2025-12-27", 2, 2, 2100, "Artist Delta"),
    ],
    shifts: [
      {
        week: "2025-02-09",
        minK: 2,
        levels: [
          { k: 2, kind: "sharp", widthWeeks: 1, rampStart: "2025-02-09", rampEnd: "2025-02-15" },
        ],
      },
    ],
    gaps: [],
  };

  const html = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: CALENDAR_FIXTURE,
      isLoading: false,
      selection: null,
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
      taste: singleLevelTaste,
      tasteLevel: null,
      onTasteLevelChange: () => {},
    }),
  );

  assert.ok(!html.includes('aria-label="Taste detail"'), "slider must be hidden when kEra === kFine");
  const cardButtons = html.match(/<button\b[^>]*\baria-pressed="false"[^>]*>/g) ?? [];
  assert.equal(cardButtons.length, 2, "cards still render when kEra === kFine");
  assert.ok(html.includes("taste-tone-a"), "ribbon still renders when kEra === kFine");
  assert.ok(!html.includes("gradual shift"), "legend hides gradual shift when absent");
  assert.ok(!html.includes("no data"), "legend hides no data when no visible gap");
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
    useEffect: (effect: () => unknown, deps?: unknown[]) => {
      const idx = effectIndex++;
      const prev = lastDeps[idx];
      if (!prev || !deps || deps.some((d, i) => !Object.is(d, prev[i]))) {
        queuedEffects.push(effect);
      }
      lastDeps[idx] = deps;
    },
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

test("useTasteData fetches /api/listening/taste?tz= and resolves TastePhasesData", async () => {
  const { reactMock, runRender } = createReactHookHarness();
  const { useTasteData } = loadTs("src/components/listening-view/useTasteData.ts", {
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

  try {
    let res = runRender(
      () => useTasteData({ enabled: true, timezone: "America/Chicago", refreshKey: 0 }),
      true,
    );
    assert.equal(res.status, "loading");
    assert.equal(pendingRequests.length, 1);
    assert.equal(pendingRequests[0].url, "/api/listening/taste?tz=America%2FChicago");

    pendingRequests[0].resolve({
      ok: true,
      json: async () => TASTE_FIXTURE,
    });
    await new Promise((r) => setTimeout(r, 10));

    res = runRender(
      () => useTasteData({ enabled: true, timezone: "America/Chicago", refreshKey: 0 }),
      true,
    );
    assert.equal(res.status, "ready");
    assert.deepEqual(res.data, TASTE_FIXTURE);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("CalendarView keeps Clear mounted (disabled + invisible when empty) and stabilizes bar metrics", () => {
  const htmlNoSelection = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: CALENDAR_FIXTURE,
      isLoading: false,
      selection: null,
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
      taste: TASTE_FIXTURE,
      tasteLevel: 2,
      onTasteLevelChange: () => {},
    }),
  );

  const clearNoSel = htmlNoSelection.match(/<button\b[^>]*>Clear<\/button>/);
  assert.ok(clearNoSel, "Clear button must stay mounted when selection is null");
  assert.match(clearNoSel[0], /\sdisabled(?=[>\s=])/, "Clear must be disabled without selection");
  assert.match(clearNoSel[0], /\binvisible\b/, "Clear must be invisible without selection");
  assert.match(clearNoSel[0], /\bfocus-ring\b/, "Clear must carry focus-ring");

  const labelSpan = htmlNoSelection.match(/<span\b[^>]*>2 Taste Eras<\/span>/);
  assert.ok(labelSpan, "must render levelLabel span");
  assert.match(labelSpan[0], /\btabular-nums\b/, "levelLabel must use tabular-nums");
  assert.match(labelSpan[0], /\bmin-w-/, "levelLabel must reserve a fixed minimum width");

  const statusSlot = htmlNoSelection.match(
    /<div\b[^>]*class="[^"]*min-h-\[36px\][^"]*"[^>]*>[^]*?Drag across days, pick a month, or pick a phase/,
  );
  assert.ok(statusSlot, "status slot must reserve min-h-[36px] for the two-line mobile hint");
  assert.ok(!statusSlot[0].includes("truncate"), "hint must never be truncated");

  const htmlNoTaste = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: CALENDAR_FIXTURE,
      isLoading: false,
      selection: null,
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
      taste: null,
      tasteLevel: null,
    }),
  );
  const clearNoTaste = htmlNoTaste.match(/<button\b[^>]*>Clear<\/button>/);
  assert.ok(clearNoTaste, "Clear button must stay mounted when taste is null");
  assert.match(clearNoTaste[0], /\sdisabled(?=[>\s=])/);
  assert.match(clearNoTaste[0], /\binvisible\b/);

  const era1 = TASTE_FIXTURE.phases.find((p) => p.id === "2024-06-02_2025-02-08")!;
  const htmlSelected = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: CALENDAR_FIXTURE,
      isLoading: false,
      selection: phaseSelection(era1),
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
      taste: TASTE_FIXTURE,
      tasteLevel: 2,
      onTasteLevelChange: () => {},
    }),
  );
  const clearSelected = htmlSelected.match(/<button\b[^>]*>Clear<\/button>/);
  assert.ok(clearSelected, "Clear button must render when selection exists");
  assert.doesNotMatch(clearSelected[0], /\sdisabled(?=[>\s=])/, "Clear must be enabled with selection");
  assert.doesNotMatch(clearSelected[0], /\binvisible\b/, "Clear must be visible with selection");
});

test("CalendarView and TastePhaseCards apply focus-ring, press, mobile hit-area-y, and drag group suppression", () => {
  const html = renderToStaticMarkup(
    React.createElement(CalendarView, {
      data: CALENDAR_FIXTURE,
      isLoading: false,
      selection: null,
      onSelectionChange: () => {},
      onOpenInOverview: () => {},
      taste: TASTE_FIXTURE,
      tasteLevel: 2,
      onTasteLevelChange: () => {},
    }),
  );

  const ribbonButtons = html.match(/<button\b[^>]*data-taste-ribbon="phase"[^>]*>/g) ?? [];
  assert.ok(ribbonButtons.length >= 4, "must render mobile and desktop ribbon phase buttons");
  const mobileRibbons = ribbonButtons.filter((btn) => btn.includes("h-[8px]"));
  const desktopRibbons = ribbonButtons.filter((btn) => btn.includes("h-[10px]"));
  assert.ok(mobileRibbons.length >= 2, "must render mobile ribbon phase buttons");
  assert.ok(desktopRibbons.length >= 2, "must render desktop ribbon phase buttons");

  for (const btn of mobileRibbons) {
    assert.match(btn, /\bhit-area-y\b/, "mobile ribbon buttons must include hit-area-y");
    assert.match(btn, /\bfocus-ring\b/, "mobile ribbon buttons must include focus-ring");
    assert.match(btn, /\bhover:brightness-125\b/, "mobile ribbon buttons must brighten on hover");
    assert.ok(!btn.includes("data-date="), "ribbon buttons must never carry data-date");
  }
  for (const btn of desktopRibbons) {
    assert.match(btn, /\bfocus-ring\b/, "desktop ribbon buttons must include focus-ring");
    assert.match(btn, /\bhover:brightness-125\b/, "desktop ribbon buttons must brighten on hover");
    assert.ok(!btn.includes("data-date="), "ribbon buttons must never carry data-date");
  }

  const yearButtons = html.match(/<button\b[^>]*title="Select year \d+"[^>]*>/g) ?? [];
  assert.equal(yearButtons.length, 2, "must render year buttons for 2024 and 2025");
  for (const btn of yearButtons) {
    assert.match(btn, /\bfocus-ring\b/, "year buttons must include focus-ring");
  }

  const monthButtons = html.match(/<button\b[^>]*title="(?:Select|No data for) [A-Z][a-z]{2} \d+"[^>]*>/g) ?? [];
  assert.equal(monthButtons.length, 48, "must render 12 mobile + 12 desktop month buttons per year");
  for (const btn of monthButtons) {
    assert.match(btn, /\bfocus-ring\b/, "month buttons must include focus-ring");
  }

  const slider = html.match(/<input\b[^>]*aria-label="Taste detail"[^>]*>/);
  assert.ok(slider);
  assert.match(slider[0], /\bfocus-ring\b/, "slider must include focus-ring");

  const overviewBtn = html.match(/<button\b[^>]*>Open in Overview[^<]*<\/button>/);
  assert.ok(overviewBtn);
  assert.match(overviewBtn[0], /\bfocus-ring\b/, "Open in Overview button must include focus-ring");

  const cardButtons = html.match(/<button\b[^>]*data-taste-phase="[^"]+"[^>]*>/g) ?? [];
  assert.equal(cardButtons.length, 2);
  for (const card of cardButtons) {
    assert.match(card, /\bfocus-ring\b/, "phase cards must include focus-ring");
    assert.match(card, /\bactive:scale-\[0\.99\]/, "phase cards must use active:scale-[0.99]");
    assert.ok(!card.includes("data-date="), "phase cards must never carry data-date");
  }

  assert.match(
    html,
    /<div\b[^>]*class="[^"]*\bgroup\b[^"]*"[^>]*><section\b/,
    "heatmaps container must carry group class for drag transition suppression",
  );

  const dayCells = html.match(/<div\b[^>]*data-date="[^"]+"[^>]*>/g) ?? [];
  assert.ok(dayCells.length > 0, "must render day cells");
  for (const cell of dayCells) {
    assert.match(cell, /\btransition-\[opacity,box-shadow\]/);
    assert.match(cell, /\bduration-75\b/);
    assert.match(cell, /\bgroup-data-\[dragging=true\]:transition-none\b/);
    assert.ok(!cell.includes("will-change"), "day cells must not use will-change");
    assert.ok(!cell.includes("transition-transform"), "day cells must not animate transform");
  }
});

test("areYearDayGridPropsEqual compares day-grid props independently of ribbon state", () => {
  assert.equal(typeof areYearDayGridPropsEqual, "function", "areYearDayGridPropsEqual must be exported");

  const dayCounts = new Map<string, number>([["2024-06-15", 14]]);
  const base = {
    year: 2024,
    firstDate: "2024-06-02",
    today: "2025-12-27",
    clippedSelection: { from: "2024-06-02", to: "2024-12-31" },
    hasActiveSelection: true,
    dayCounts,
    thresholds: [5, 15, 30] as [number, number, number],
  };

  assert.equal(
    areYearDayGridPropsEqual(base, {
      ...base,
      clippedSelection: { from: "2024-06-02", to: "2024-12-31" },
      thresholds: [5, 15, 30],
    }),
    true,
  );
  assert.equal(areYearDayGridPropsEqual(base, { ...base, year: 2025 }), false);
  assert.equal(areYearDayGridPropsEqual(base, { ...base, firstDate: "2024-06-03" }), false);
  assert.equal(areYearDayGridPropsEqual(base, { ...base, today: "2025-12-28" }), false);
  assert.equal(areYearDayGridPropsEqual(base, { ...base, hasActiveSelection: false }), false);
  assert.equal(areYearDayGridPropsEqual(base, { ...base, dayCounts: new Map(dayCounts) }), false);
  assert.equal(areYearDayGridPropsEqual(base, { ...base, thresholds: [5, 16, 30] }), false);
  assert.equal(areYearDayGridPropsEqual(base, { ...base, clippedSelection: null }), false);
  assert.equal(
    areYearDayGridPropsEqual(base, { ...base, clippedSelection: { from: "2024-06-02", to: "2024-12-30" } }),
    false,
  );
});

function visitReactElements(node: unknown, visit: (el: React.ReactElement<Record<string, unknown>>) => void): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) visitReactElements(child, visit);
    return;
  }
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<Record<string, unknown>>;
    visit(el);
    visitReactElements(el.props.children, visit);
  }
}

test("TastePhaseCards uses scrollTo with scrollBehavior() and respects prefers-reduced-motion", () => {
  const { reactMock, runRender } = createReactHookHarness();
  const { TastePhaseCards: TastePhaseCardsUnderTest } = loadTs(
    "src/components/views/TastePhaseCards.tsx",
    { react: reactMock },
  );

  const items = tasteRow(TASTE_FIXTURE, 2);
  const phaseItems = items.filter((item) => item.kind === "phase");
  assert.equal(phaseItems.length, 2);
  const phase1Id = phaseItems[0].phase.id;
  const phase2Id = phaseItems[1].phase.id;

  const scrollCalls: Array<{ left?: number; behavior?: ScrollBehavior }> = [];
  let reduceMotion = false;
  const originalWindow = globalThis.window;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = {
    matchMedia: () => ({ matches: reduceMotion }),
  };

  try {
    const initialTree = runRender(
      () =>
        TastePhaseCardsUnderTest({
          items,
          selectedPhaseId: null,
          onSelectPhase: () => {},
        }),
      true,
    );

    let attachedRowRef = false;
    visitReactElements(initialTree, (el) => {
      const refProp = el.props.ref;
      if (!attachedRowRef && refProp && typeof refProp === "object" && "current" in refProp) {
        (refProp as { current: unknown }).current = {
          clientWidth: 300,
          scrollTo: (opts: { left?: number; behavior?: ScrollBehavior }) => {
            scrollCalls.push(opts);
          },
        };
        attachedRowRef = true;
      }
      if (el.props["data-taste-phase"] === phase1Id && typeof refProp === "function") {
        (refProp as (val: unknown) => void)({ offsetLeft: 0, offsetWidth: 210 });
      }
      if (el.props["data-taste-phase"] === phase2Id && typeof refProp === "function") {
        (refProp as (val: unknown) => void)({ offsetLeft: 250, offsetWidth: 210 });
      }
    });
    assert.equal(attachedRowRef, true, "must find row ref on TastePhaseCards");

    runRender(
      () =>
        TastePhaseCardsUnderTest({
          items,
          selectedPhaseId: phase2Id,
          onSelectPhase: () => {},
        }),
      true,
    );
    assert.deepEqual(scrollCalls, [{ left: 205, behavior: "smooth" }]);

    reduceMotion = true;
    runRender(
      () =>
        TastePhaseCardsUnderTest({
          items,
          selectedPhaseId: phase1Id,
          onSelectPhase: () => {},
        }),
      true,
    );
    assert.deepEqual(scrollCalls, [
      { left: 205, behavior: "smooth" },
      { left: 0, behavior: "auto" },
    ]);
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window = originalWindow;
  }
});
