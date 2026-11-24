import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { presetRange } from "../src/lib/range";
import {
  LEVELS,
  PAD,
  boundaryLabel,
  buildRulerUnits,
  indexForDate,
  isMajorTick,
  placementForRange,
} from "../src/lib/ruler/units";

const FIRST_KEY = "2019-03-01";
const TODAY_KEY = "2026-11-22";

describe("ruler units constants", () => {
  it("exports LEVELS from zoomed out to in and PAD counts", () => {
    assert.deepEqual(LEVELS, ["all", "year", "month", "week", "day"]);
    assert.deepEqual(PAD, { day: 60, week: 30, month: 24, year: 8 });
  });
});

describe("buildRulerUnits", () => {
  it("builds month units with 24 phantoms on each side and unclamped Nov 2026", () => {
    const { units, realFirst, realLast } = buildRulerUnits(
      "month",
      FIRST_KEY,
      TODAY_KEY,
    );

    assert.equal(realFirst, 24);
    assert.equal(units.length - 1 - realLast, 24);
    assert.equal(units[realFirst].from, "2019-03-01");
    assert.equal(units[realFirst].to, "2019-03-31");
    assert.equal(units[realFirst].phantom, false);

    assert.equal(units[realLast].from, "2026-11-01");
    assert.equal(units[realLast].to, "2026-11-30");
    assert.equal(units[realLast].phantom, false);
    assert.equal(units[realLast].short, "Nov");

    assert.equal(units[0].phantom, true);
    assert.equal(units[realFirst - 1].phantom, true);
    assert.equal(units[realLast + 1].phantom, true);
    assert.equal(units[units.length - 1].phantom, true);
  });

  it("builds week units with 30 phantoms on each side and Monday..Sunday bounds", () => {
    const { units, realFirst, realLast } = buildRulerUnits(
      "week",
      FIRST_KEY,
      TODAY_KEY,
    );

    assert.equal(realFirst, 30);
    assert.equal(units.length - 1 - realLast, 30);
    assert.equal(units[realLast].from, "2026-11-16");
    assert.equal(units[realLast].to, "2026-11-22");
    assert.equal(units[realLast].short, "22");
    assert.equal(units[realLast].phantom, false);

    // Week containing 2026-11-01 (2026-10-26..2026-11-01) is a monthStart
    const novStartIdx = indexForDate(units, "2026-11-01");
    assert.ok(novStartIdx >= realFirst);
    assert.equal(units[novStartIdx].monthStart, true);
    assert.equal(units[novStartIdx].short, "1");

    // Week containing Jan 1 2026 (2025-12-29..2026-01-04) is both monthStart and yearStart
    const janStartIdx = indexForDate(units, "2026-01-01");
    assert.equal(units[janStartIdx].monthStart, true);
    assert.equal(units[janStartIdx].yearStart, true);
  });

  it("builds day and year units with expected PAD phantoms and flags", () => {
    const dayRes = buildRulerUnits("day", FIRST_KEY, TODAY_KEY);
    assert.equal(dayRes.realFirst, 60);
    assert.equal(dayRes.units.length - 1 - dayRes.realLast, 60);
    assert.equal(dayRes.units[dayRes.realFirst].from, FIRST_KEY);
    assert.equal(dayRes.units[dayRes.realFirst].monthStart, true);
    assert.equal(dayRes.units[dayRes.realFirst].yearStart, false);
    assert.equal(dayRes.units[dayRes.realFirst].short, "1");

    const yearRes = buildRulerUnits("year", FIRST_KEY, TODAY_KEY);
    assert.equal(yearRes.realFirst, 8);
    assert.equal(yearRes.units.length - 1 - yearRes.realLast, 8);
    assert.equal(yearRes.units[yearRes.realFirst].from, "2019-01-01");
    assert.equal(yearRes.units[yearRes.realFirst].to, "2019-12-31");
    assert.equal(yearRes.units[yearRes.realFirst].short, "2019");
    assert.equal(yearRes.units[yearRes.realLast].from, "2026-01-01");
    assert.equal(yearRes.units[yearRes.realLast].to, "2026-12-31");
  });
});

describe("indexForDate", () => {
  it("returns the matching unit index or -1 outside the padded list", () => {
    const { units } = buildRulerUnits("month", FIRST_KEY, TODAY_KEY);
    const idx = indexForDate(units, "2026-11-15");
    assert.notEqual(idx, -1);
    assert.equal(units[idx].from, "2026-11-01");
    assert.equal(indexForDate(units, "1999-01-01"), -1);
    assert.equal(indexForDate(units, "2099-01-01"), -1);
  });
});

describe("isMajorTick and boundaryLabel", () => {
  it("treats phantom and real units identically for isMajorTick", () => {
    const { units, realFirst } = buildRulerUnits("month", FIRST_KEY, TODAY_KEY);
    const janPhantom = units.find((u) => u.phantom && u.yearStart);
    const janReal = units.find(
      (u, i) => i >= realFirst && !u.phantom && u.yearStart,
    );
    assert.ok(janPhantom);
    assert.ok(janReal);
    assert.equal(
      isMajorTick("month", janPhantom),
      isMajorTick("month", janReal),
    );
    assert.equal(isMajorTick("month", janPhantom), true);
    assert.equal(isMajorTick("month", units[realFirst]), false);
    assert.equal(isMajorTick("all", units[realFirst]), true);
    assert.equal(isMajorTick("year", units[realFirst]), true);
  });

  it("computes boundary labels per level", () => {
    const dayRes = buildRulerUnits("day", FIRST_KEY, TODAY_KEY);
    const jan1Day = dayRes.units.find((u) => u.from === "2026-01-01")!;
    const mar1Day = dayRes.units[dayRes.realFirst];
    const mar2Day = dayRes.units[dayRes.realFirst + 1];
    assert.equal(boundaryLabel("day", jan1Day), "2026");
    assert.equal(boundaryLabel("day", mar1Day), "Mar");
    assert.equal(boundaryLabel("day", mar2Day), null);

    const monthRes = buildRulerUnits("month", FIRST_KEY, TODAY_KEY);
    const janMonth = monthRes.units.find((u) => u.from === "2026-01-01")!;
    assert.equal(boundaryLabel("month", janMonth), "2026");
    assert.equal(boundaryLabel("month", monthRes.units[monthRes.realLast]), "Nov");
    assert.equal(boundaryLabel("all", { ...janMonth, short: "2026" }), "2026");
  });
});

describe("placementForRange", () => {
  it("places full month, 1w preset, 15-day window, and all", () => {
    assert.deepEqual(
      placementForRange(
        { kind: "window", from: "2026-10-01", to: "2026-10-31" },
        FIRST_KEY,
        TODAY_KEY,
      ),
      {
        level: "month",
        anchorKey: "2026-10-16",
        exact: true,
        label: null,
      },
    );

    assert.deepEqual(
      placementForRange(presetRange("1w"), FIRST_KEY, TODAY_KEY),
      {
        level: "week",
        anchorKey: TODAY_KEY,
        exact: true,
        label: null,
      },
    );

    assert.deepEqual(
      placementForRange(
        { kind: "window", from: "2026-11-03", to: "2026-11-17" },
        FIRST_KEY,
        TODAY_KEY,
      ),
      {
        level: "month",
        anchorKey: "2026-11-10",
        exact: false,
        label: "Nov 3–17, 2026",
      },
    );

    assert.deepEqual(
      placementForRange(presetRange("all"), FIRST_KEY, TODAY_KEY),
      {
        level: "all",
        anchorKey: TODAY_KEY,
        exact: true,
        label: null,
      },
    );
  });

  it("anchors an exact unit on today when it holds today, else on its middle day", () => {
    // Zooming in from the current year must open today's month, not January.
    assert.equal(
      placementForRange(
        { kind: "window", from: "2026-01-01", to: "2026-12-31" },
        FIRST_KEY,
        TODAY_KEY,
      ).anchorKey,
      TODAY_KEY,
    );
    // Zooming in from October must open a week inside October, not Sep 28..Oct 4.
    assert.equal(
      placementForRange(
        { kind: "window", from: "2026-10-01", to: "2026-10-31" },
        FIRST_KEY,
        TODAY_KEY,
      ).anchorKey,
      "2026-10-16",
    );
    assert.equal(
      placementForRange(
        { kind: "window", from: "2025-01-01", to: "2025-12-31" },
        FIRST_KEY,
        TODAY_KEY,
      ).anchorKey,
      "2025-07-02",
    );
  });

  it("clamps anchorKey to firstKey..todayKey", () => {
    assert.deepEqual(
      placementForRange(
        { kind: "window", from: "2018-01-01", to: "2018-12-31" },
        FIRST_KEY,
        TODAY_KEY,
      ),
      {
        level: "year",
        anchorKey: FIRST_KEY,
        exact: true,
        label: null,
      },
    );
  });
});
