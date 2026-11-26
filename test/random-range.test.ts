import { test } from "node:test";
import assert from "node:assert/strict";
import { pickRandomRange, RANDOM_RANGE_MIN_PLAYS } from "../src/lib/random-range";
import { unitWindow } from "../src/lib/range";

// Weeks run Sunday..Saturday: Nov 1 week = 6 Plays, Nov 8 week = 2, Nov 15 week = 10.
const DAYS = [
  { date: "2026-11-01", count: 3 },
  { date: "2026-11-03", count: 3 },
  { date: "2026-11-10", count: 2 },
  { date: "2026-11-12", count: 0 },
  { date: "2026-11-20", count: 10 },
];

test("pickRandomRange sums days into the unit and only lands on periods with enough Plays", () => {
  assert.equal(RANDOM_RANGE_MIN_PLAYS, 5);
  assert.deepEqual(
    pickRandomRange(DAYS, "week", { minPlays: 5 }, () => 0),
    unitWindow("2026-11-01", "week"),
  );
  assert.deepEqual(
    pickRandomRange(DAYS, "week", { minPlays: 5 }, () => 0.99),
    unitWindow("2026-11-15", "week"),
    "the 2-Play week is skipped",
  );
  assert.deepEqual(
    pickRandomRange(DAYS, "day", { minPlays: 5 }, () => 0.5),
    unitWindow("2026-11-20", "day"),
  );
  assert.deepEqual(
    pickRandomRange(DAYS, "month", {}, () => 0.5),
    unitWindow("2026-11-01", "month"),
  );
});

test("pickRandomRange never repeats the current period while another exists", () => {
  const current = unitWindow("2026-11-01", "week");
  for (const r of [0, 0.3, 0.6, 0.99]) {
    assert.deepEqual(
      pickRandomRange(DAYS, "week", { minPlays: 5, current }, () => r),
      unitWindow("2026-11-15", "week"),
    );
  }
  const onlyMonth = unitWindow("2026-11-01", "month");
  assert.deepEqual(
    pickRandomRange(DAYS, "month", { current: onlyMonth }, () => 0),
    onlyMonth,
    "a lone candidate is still returned",
  );
});

test("pickRandomRange falls back to any period with Plays, and returns null for an empty archive", () => {
  const picks = new Set(
    [0, 0.4, 0.8].map((r) => JSON.stringify(pickRandomRange(DAYS, "week", { minPlays: 100 }, () => r))),
  );
  assert.equal(picks.size, 3, "with nothing above the minimum, every week with Plays is a candidate");
  assert.equal(pickRandomRange([], "week"), null);
  assert.equal(pickRandomRange([{ date: "2026-11-12", count: 0 }], "day"), null);
});
