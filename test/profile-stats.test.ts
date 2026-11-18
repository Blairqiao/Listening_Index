import test from "node:test";
import assert from "node:assert/strict";
import {
  artistShare,
  formatMonthLabel,
  formatShare,
  hourHistogram,
  longestStreak,
  pickBestMonth,
} from "../src/lib/profile-stats";

test("longestStreak counts distinct consecutive calendar days", () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak([
    "2025-01-02", "2024-12-31", "2025-01-01", "2025-01-01", "2025-01-04",
  ]), 3);
  assert.equal(longestStreak(["2026-03-07", "2026-03-08", "2026-03-09"]), 3);
});

test("pickBestMonth favors the latest month when play counts tie", () => {
  assert.equal(pickBestMonth([]), null);
  assert.deepEqual(pickBestMonth(["2026-03", "2026-02", "2026-02", "2026-03"]), {
    month: "2026-03",
    plays: 2,
  });
});

test("hourHistogram includes all 24 hours", () => {
  const histogram = hourHistogram([0, 23, 23]);
  assert.equal(histogram.length, 24);
  assert.equal(histogram[0], 1);
  assert.equal(histogram[23], 2);
  assert.equal(histogram.reduce((sum, count) => sum + count, 0), 3);
});

test("artist shares and month labels format for the profile", () => {
  assert.equal(artistShare(0, 1), null);
  assert.equal(artistShare(1, 0), null);
  assert.equal(artistShare(1, 4), 0.25);
  assert.equal(formatMonthLabel("2026-03"), "MAR 2026");
  assert.equal(formatShare(null), "—");
  assert.equal(formatShare(0.004), "<1%");
  assert.equal(formatShare(0.236), "24%");
});
