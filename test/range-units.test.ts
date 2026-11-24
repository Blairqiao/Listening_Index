import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RANGE_KEYS } from "../src/lib/types";
import {
  addCalendarDays,
  daysBetween,
  exactUnitOf,
  normalizeLegacyRange,
  presetRange,
  todayDateKey,
  unitBounds,
  unitWindow,
  type CalendarUnit,
} from "../src/lib/range";

describe("unitBounds / unitWindow", () => {
  it("computes bounds for day, week (Monday-first), month (including leap Feb), and year", () => {
    assert.deepEqual(unitBounds("2026-11-22", "day"), {
      from: "2026-11-22",
      to: "2026-11-22",
    });

    // Sunday -> Monday..Sunday
    assert.deepEqual(unitBounds("2026-11-22", "week"), {
      from: "2026-11-16",
      to: "2026-11-22",
    });

    // Monday -> same Monday..Sunday
    assert.deepEqual(unitBounds("2026-11-16", "week"), {
      from: "2026-11-16",
      to: "2026-11-22",
    });

    // Week crossing a year boundary (2026-01-01 is Thursday)
    assert.deepEqual(unitBounds("2026-01-01", "week"), {
      from: "2025-12-29",
      to: "2026-01-04",
    });

    // Leap year February
    assert.deepEqual(unitBounds("2024-02-10", "month"), {
      from: "2024-02-01",
      to: "2024-02-29",
    });

    // Non-leap February
    assert.deepEqual(unitBounds("2025-02-10", "month"), {
      from: "2025-02-01",
      to: "2025-02-28",
    });

    // Year
    assert.deepEqual(unitBounds("2026-11-22", "year"), {
      from: "2026-01-01",
      to: "2026-12-31",
    });

    const units: CalendarUnit[] = ["day", "week", "month", "year"];
    for (const unit of units) {
      assert.deepEqual(unitWindow("2026-11-22", unit), {
        kind: "window",
        ...unitBounds("2026-11-22", unit),
      });
    }
  });
});

describe("exactUnitOf", () => {
  it("identifies exact day, week, month, and year windows and returns null for non-unit spans and presets", () => {
    assert.deepEqual(exactUnitOf(unitWindow("2026-11-22", "day")), {
      unit: "day",
      from: "2026-11-22",
    });
    assert.deepEqual(exactUnitOf(unitWindow("2026-11-22", "week")), {
      unit: "week",
      from: "2026-11-16",
    });
    assert.deepEqual(exactUnitOf(unitWindow("2024-02-10", "month")), {
      unit: "month",
      from: "2024-02-01",
    });
    assert.deepEqual(exactUnitOf(unitWindow("2026-06-15", "year")), {
      unit: "year",
      from: "2026-01-01",
    });

    // 7-day window starting on a Tuesday is not a calendar week
    assert.equal(
      exactUnitOf({ kind: "window", from: "2026-11-17", to: "2026-11-23" }),
      null,
    );

    // Arbitrary span
    assert.equal(
      exactUnitOf({ kind: "window", from: "2026-11-03", to: "2026-11-17" }),
      null,
    );

    // All presets including "all" return null
    for (const key of RANGE_KEYS) {
      assert.equal(exactUnitOf(presetRange(key)), null);
    }
  });
});

describe("normalizeLegacyRange", () => {
  const todayKey = "2026-11-22";

  it("maps legacy presets to today's calendar units and leaves all and windows unchanged", () => {
    assert.deepEqual(normalizeLegacyRange(presetRange("1d"), todayKey), {
      kind: "window",
      from: "2026-11-22",
      to: "2026-11-22",
    });
    assert.deepEqual(normalizeLegacyRange(presetRange("1w"), todayKey), {
      kind: "window",
      from: "2026-11-16",
      to: "2026-11-22",
    });
    assert.deepEqual(normalizeLegacyRange(presetRange("1m"), todayKey), {
      kind: "window",
      from: "2026-11-01",
      to: "2026-11-30",
    });
    assert.deepEqual(normalizeLegacyRange(presetRange("6m"), todayKey), {
      kind: "window",
      from: "2026-01-01",
      to: "2026-12-31",
    });
    assert.deepEqual(normalizeLegacyRange(presetRange("1y"), todayKey), {
      kind: "window",
      from: "2026-01-01",
      to: "2026-12-31",
    });

    const all = presetRange("all");
    assert.deepEqual(normalizeLegacyRange(all, todayKey), all);

    const win = { kind: "window" as const, from: "2025-05-03", to: "2025-05-19" };
    assert.deepEqual(normalizeLegacyRange(win, todayKey), win);
  });
});

describe("addCalendarDays / daysBetween / todayDateKey", () => {
  it("adds calendar days, computes daysBetween, and resolves todayDateKey in the given timezone", () => {
    assert.equal(addCalendarDays("2025-12-31", 1), "2026-01-01");
    assert.equal(addCalendarDays("2026-01-01", -3), "2025-12-29");

    assert.equal(daysBetween("2019-03-01", "2019-03-02"), 1);
    assert.equal(daysBetween("2019-03-01", "2019-03-01"), 0);
    assert.equal(daysBetween("2019-03-02", "2019-03-01"), -1);
    assert.equal(daysBetween("2024-02-28", "2024-03-01"), 2);

    assert.equal(
      todayDateKey("Pacific/Auckland", new Date("2026-11-22T12:00:00Z")),
      "2026-11-23",
    );
  });
});
