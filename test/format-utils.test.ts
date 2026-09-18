import test from "node:test";
import assert from "node:assert/strict";
import {
  formatOverviewMetrics,
  formatStreamLogMetrics,
  formatCadenceTooltip,
} from "../src/lib/format-utils";

test("formatOverviewMetrics formats minutes correctly with commas", () => {
  const raw = {
    totalMs: 7470000000, // 124,500 minutes
    trackCount: 8620,
    artistCount: 1310,
    elapsedDays: 730,
  };
  const [time, tracks, artists, dailyAvg] = formatOverviewMetrics(raw, "minutes", "all");
  assert.equal(time, "124,500");
  assert.equal(tracks, "8,620");
  assert.equal(artists, "1,310");
  assert.equal(dailyAvg, "2.8h");
});

test("formatOverviewMetrics formats hours with decimal for 1d and 1w, and integer for 1m and all", () => {
  const rawShort = {
    totalMs: 12960000, // 3.6 hours
    trackCount: 42,
    artistCount: 20,
    elapsedDays: 1,
  };
  const [time1d] = formatOverviewMetrics(rawShort, "hours", "1d");
  assert.equal(time1d, "3.6");

  const [time1w] = formatOverviewMetrics(rawShort, "hours", "1w");
  assert.equal(time1w, "3.6");

  const [time1m] = formatOverviewMetrics(rawShort, "hours", "1m");
  assert.equal(time1m, "4");

  const rawLong = {
    totalMs: 7470000000, // 2,075 hours
    trackCount: 8620,
    artistCount: 1310,
    elapsedDays: 730,
  };
  const [timeLong] = formatOverviewMetrics(rawLong, "hours", "all");
  assert.equal(timeLong, "2,075");
});

test("formatStreamLogMetrics formats unique tracks and streak days", () => {
  const raw = {
    totalPlays: 15420,
    uniqueTracks: 4250,
    uniqueArtists: 740,
    streakDays: 14,
  };
  const [plays, tracks, artists, streak] = formatStreamLogMetrics(raw);
  assert.equal(plays, "15,420");
  assert.equal(tracks, "4,250");
  assert.equal(artists, "740");
  assert.equal(streak, "14 DAYS");

  const singleStreak = formatStreamLogMetrics({ ...raw, streakDays: 1 });
  assert.equal(singleStreak[3], "1 DAY");
});

test("formatCadenceTooltip formats dates month-first in upper and lowercase", () => {
  // 6M Weekly bucket within same month
  const weekSameMonth = {
    startTime: "2026-08-24T00:00:00.000Z",
    endTime: "2026-08-30T23:59:59.000Z",
    count: 85,
  };
  assert.equal(
    formatCadenceTooltip(weekSameMonth, "6m", "UTC"),
    "Aug 24 – Aug 30, 2026 — 85 plays"
  );

  // 6M Weekly bucket crossing month boundary
  const weekCrossMonth = {
    startTime: "2026-08-28T00:00:00.000Z",
    endTime: "2026-09-03T23:59:59.000Z",
    count: 92,
  };
  assert.equal(
    formatCadenceTooltip(weekCrossMonth, "6m", "UTC"),
    "Aug 28 – Sep 03, 2026 — 92 plays"
  );

  // 6M Weekly bucket crossing year boundary
  const weekCrossYear = {
    startTime: "2025-12-28T00:00:00.000Z",
    endTime: "2026-01-03T23:59:59.000Z",
    count: 50,
  };
  assert.equal(
    formatCadenceTooltip(weekCrossYear, "6m", "UTC"),
    "Dec 28, 2025 – Jan 03, 2026 — 50 plays"
  );

  // 1Y Monthly bucket
  const monthBucket = {
    startTime: "2026-09-01T00:00:00.000Z",
    endTime: "2026-09-30T23:59:59.000Z",
    count: 95,
  };
  assert.equal(
    formatCadenceTooltip(monthBucket, "1y", "UTC"),
    "Sep 2026 — 95 plays"
  );

  // 1M Daily bucket
  const dayBucket = {
    startTime: "2026-09-15T00:00:00.000Z",
    endTime: "2026-09-15T23:59:59.000Z",
    count: 24,
  };
  assert.equal(
    formatCadenceTooltip(dayBucket, "1m", "UTC"),
    "Sep 15, 2026 — 24 plays"
  );

  // 1W Hourly bucket
  const hourRangeBucket = {
    startTime: "2026-09-15T14:00:00.000Z",
    endTime: "2026-09-15T16:00:00.000Z",
    count: 12,
  };
  assert.equal(
    formatCadenceTooltip(hourRangeBucket, "1w", "UTC"),
    "Sep 15, 14:00–16:00 — 12 plays"
  );

  // 1W 4th block (18:00 to 24:00)
  const fourthBlockBucket = {
    startTime: "2026-09-15T18:00:00.000Z",
    endTime: "2026-09-15T23:59:59.999Z",
    count: 18,
  };
  assert.equal(
    formatCadenceTooltip(fourthBlockBucket, "1w", "UTC"),
    "Sep 15, 18:00–24:00 — 18 plays"
  );

  const fourthBlockNextDayBucket = {
    startTime: "2026-09-15T18:00:00.000Z",
    endTime: "2026-09-16T00:00:00.000Z",
    count: 22,
  };
  assert.equal(
    formatCadenceTooltip(fourthBlockNextDayBucket, "1w", "UTC"),
    "Sep 15, 18:00–24:00 — 22 plays"
  );

  // 1D Hourly bucket
  const singleHourBucket = {
    startTime: "2026-09-15T14:30:00.000Z",
    endTime: "2026-09-15T14:45:00.000Z",
    count: 5,
  };
  assert.equal(
    formatCadenceTooltip(singleHourBucket, "1d", "UTC"),
    "14:30 — 5 plays"
  );

  // ALL Yearly bucket
  const yearBucket = {
    startTime: "2024-01-01T00:00:00.000Z",
    endTime: "2024-12-31T23:59:59.000Z",
    count: 12450,
  };
  assert.equal(
    formatCadenceTooltip(yearBucket, "all", "UTC"),
    "2024 — 12,450 plays"
  );
});
