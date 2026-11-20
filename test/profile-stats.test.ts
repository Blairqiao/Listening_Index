import test from "node:test";
import assert from "node:assert/strict";
import {
  artistShare,
  buildShareSegments,
  computeCompletionRate,
  computePeakDay,
  countFullAlbumSessions,
  dayOfWeekHistogram,
  formatCompactPlayDate,
  formatListeningDuration,
  formatShare,
  hourHistogram,
  longestStreak,
  OTHER_SEGMENT_ID,
  peakDayOfWeek,
  peakHour,
  segmentIdForTrack,
} from "../src/lib/profile-stats";

test("longestStreak counts distinct consecutive calendar days", () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak([
    "2025-01-02", "2024-12-31", "2025-01-01", "2025-01-01", "2025-01-04",
  ]), 3);
  assert.equal(longestStreak(["2026-03-07", "2026-03-08", "2026-03-09"]), 3);
});

test("hourHistogram includes all 24 hours", () => {
  const histogram = hourHistogram([0, 23, 23]);
  assert.equal(histogram.length, 24);
  assert.equal(histogram[0], 1);
  assert.equal(histogram[23], 2);
  assert.equal(histogram.reduce((sum, count) => sum + count, 0), 3);
});

test("artist shares format for the profile", () => {
  assert.equal(artistShare(0, 1), null);
  assert.equal(artistShare(1, 0), null);
  assert.equal(artistShare(1, 4), 0.25);
  assert.equal(formatShare(null), "—");
  assert.equal(formatShare(0.004), "<1%");
  assert.equal(formatShare(0.236), "24%");
});

const tracks = [
  { id: "b", name: "Second", plays: 3 },
  { id: "zero", name: "Zero", plays: 0 },
  { id: "a", name: "First", plays: 4 },
];

test("share segments preserve order and include positive counts and remainder", () => {
  const listed = [
    { id: "b", label: "Second", plays: 3 },
    { id: "a", label: "First", plays: 4 },
  ];
  assert.deepEqual(buildShareSegments(tracks, 10), [
    ...listed,
    { id: OTHER_SEGMENT_ID, label: "Other Tracks", plays: 3 },
  ]);
  assert.deepEqual(buildShareSegments(tracks, 7), listed);
  assert.deepEqual(buildShareSegments(tracks, 6), listed);
  assert.deepEqual(buildShareSegments(tracks, 0), []);
});

test("segment lookup resolves a Track or falls back to Other", () => {
  const segments = buildShareSegments(tracks, 10);
  assert.equal(segmentIdForTrack("a", segments), "a");
  assert.equal(segmentIdForTrack("missing", segments), OTHER_SEGMENT_ID);
  assert.equal(segmentIdForTrack("missing", buildShareSegments(tracks, 7)), null);
});

test("peakHour picks the earliest maximum and omits an empty peak", () => {
  assert.equal(peakHour(hourHistogram([0, 3, 3, 4, 4])), 3);
  assert.equal(peakHour(hourHistogram([])), null);
});

test("dayOfWeekHistogram indexes 0 (Mon) through 6 (Sun) and ignores invalid values", () => {
  assert.deepEqual(dayOfWeekHistogram([]), [0, 0, 0, 0, 0, 0, 0]);
  const counts = dayOfWeekHistogram([1, 1, 2, 7, 0, 8, -1, 100, 2.5, NaN]);
  assert.deepEqual(counts, [2, 1, 0, 0, 0, 0, 1]);
});

test("peakDayOfWeek returns earliest index 0..6 with max count, or null when max is 0", () => {
  assert.equal(peakDayOfWeek([0, 0, 0, 0, 0, 0, 0]), null);
  assert.equal(peakDayOfWeek([]), null);
  assert.equal(peakDayOfWeek([0, 5, 2, 5, 1, 0, 0]), 1); // earliest max at index 1
  assert.equal(peakDayOfWeek([1, 2, 3, 4, 5, 6, 7, 100]), 6);
});

test("computePeakDay returns entry with highest positive plays and breaks ties by newest date", () => {
  assert.equal(computePeakDay([]), null);
  assert.equal(computePeakDay([{ date: "2024-01-01", plays: 0 }]), null);
  assert.equal(computePeakDay([{ date: "2024-01-01", plays: -2 }]), null);

  const entries = [
    { date: "2024-03-01", plays: 12 },
    { date: "2024-03-15", plays: 25 },
    { date: "2024-03-10", plays: 25 },
    { date: "2024-02-01", plays: 5 },
  ];
  // 25 plays tied on 2024-03-15 and 2024-03-10; newest date 2024-03-15 wins
  assert.deepEqual(computePeakDay(entries), { date: "2024-03-15", plays: 25 });
});

test("computeCompletionRate filters valid durations, clamps to [0, 1], and returns mean", () => {
  assert.equal(computeCompletionRate([]), null);
  assert.equal(
    computeCompletionRate([
      { msPlayed: 1000, durationMs: 0 },
      { msPlayed: 500, durationMs: -10 },
    ]),
    null,
  );

  const plays = [
    { msPlayed: 50_000, durationMs: 100_000 },  // 0.5
    { msPlayed: 120_000, durationMs: 100_000 }, // clamped to 1.0
    { msPlayed: -10_000, durationMs: 100_000 }, // clamped to 0.0
    { msPlayed: 20_000, durationMs: 0 },        // ignored (durationMs <= 0)
  ];
  // (0.5 + 1.0 + 0.0) / 3 = 0.5
  assert.equal(computeCompletionRate(plays), 0.5);
});

test("countFullAlbumSessions counts sessions with minDistinctTracks, respecting exact 30m gap", () => {
  assert.equal(countFullAlbumSessions([]), 0);

  // Exact 30m boundary: 1_800_000 ms stays in SAME session
  const t0 = new Date("2024-11-18T10:00:00.000Z").getTime();
  const sameSessionPlays = [
    { trackId: "t1", playedAt: new Date(t0).toISOString() },
    { trackId: "t2", playedAt: new Date(t0 + 900_000).toISOString() },
    { trackId: "t3", playedAt: new Date(t0 + 1_800_000).toISOString() }, // 15m later (staying in session)
  ];
  assert.equal(countFullAlbumSessions(sameSessionPlays), 1);

  // Exact 30m gap (1_800_000 ms) from previous play stays in SAME session
  const exactGapPlays = [
    { trackId: "t1", playedAt: new Date(t0).toISOString() },
    { trackId: "t2", playedAt: new Date(t0 + 1_800_000).toISOString() }, // exactly 30 min later
    { trackId: "t3", playedAt: new Date(t0 + 3_600_000).toISOString() }, // exactly 30 min later
  ];
  assert.equal(countFullAlbumSessions(exactGapPlays), 1);

  // Strictly greater than 30m gap (1_800_001 ms) splits into separate sessions
  const splitPlays = [
    { trackId: "t1", playedAt: new Date(t0).toISOString() },
    { trackId: "t2", playedAt: new Date(t0 + 60_000).toISOString() },
    // Gap: 1_800_001 ms -> starts session 2
    { trackId: "t3", playedAt: new Date(t0 + 60_000 + 1_800_001).toISOString() },
    { trackId: "t4", playedAt: new Date(t0 + 60_000 + 1_800_001 + 60_000).toISOString() },
    { trackId: "t4", playedAt: new Date(t0 + 60_000 + 1_800_001 + 90_000).toISOString() },
  ];
  // Each Session has two distinct Tracks.
  assert.equal(countFullAlbumSessions(splitPlays, 3), 0);

  // If one session has 3 distinct tracks and one has 2
  const oneQualifying = [
    ...splitPlays,
    { trackId: "t5", playedAt: new Date(t0 + 60_000 + 1_800_001 + 120_000).toISOString() },
  ];
  assert.equal(countFullAlbumSessions(oneQualifying, 3), 1);

  // Out of order timestamps should be sorted ascending
  const shuffled = [
    { trackId: "t3", playedAt: new Date(t0 + 120_000).toISOString() },
    { trackId: "t1", playedAt: new Date(t0).toISOString() },
    { trackId: "t2", playedAt: new Date(t0 + 60_000).toISOString() },
  ];
  assert.equal(countFullAlbumSessions(shuffled, 3), 1);
});

test("formatListeningDuration formats 0m, <1m, minutes, hours, and 100h+", () => {
  assert.equal(formatListeningDuration(-500), "0M");
  assert.equal(formatListeningDuration(0), "0M");
  assert.equal(formatListeningDuration(1), "<1M");
  assert.equal(formatListeningDuration(59_999), "<1M");
  assert.equal(formatListeningDuration(60_000), "1M");
  assert.equal(formatListeningDuration(120_000), "2M");
  assert.equal(formatListeningDuration(59 * 60_000), "59M");

  // Rounding 59m 50s up to 60m formats as "1H", never "60M" or "1H 60M"
  assert.equal(formatListeningDuration(59 * 60_000 + 50_000), "1H");

  // 1 <= hours < 100
  assert.equal(formatListeningDuration(60 * 60_000), "1H");
  assert.equal(formatListeningDuration(90 * 60_000), "1H 30M");
  assert.equal(formatListeningDuration(99 * 3_600_000), "99H");
  assert.equal(formatListeningDuration(99 * 3_600_000 + 45 * 60_000), "99H 45M");

  // >= 100 hours uses toLocaleString() + "H"
  assert.equal(formatListeningDuration(100 * 3_600_000), "100H");
  assert.equal(formatListeningDuration(1_234 * 3_600_000), `${(1_234).toLocaleString()}H`);
});

test("formatCompactPlayDate formats DD MMM YY in timezone and returns -- for invalid dates", () => {
  assert.equal(formatCompactPlayDate(null, "UTC"), "--");
  assert.equal(formatCompactPlayDate(undefined, "UTC"), "--");
  assert.equal(formatCompactPlayDate("", "UTC"), "--");
  assert.equal(formatCompactPlayDate("invalid-date", "UTC"), "--");
  assert.equal(formatCompactPlayDate("2024-11-18T12:00:00Z", "Invalid/Tz"), "--");

  // Standard UTC date
  assert.equal(formatCompactPlayDate("2024-11-18T12:00:00Z", "UTC"), "18 NOV 24");

  // Timezone shifts date back
  assert.equal(formatCompactPlayDate("2024-11-18T01:00:00Z", "America/New_York"), "17 NOV 24");

  // Timezone shifts date forward
  assert.equal(formatCompactPlayDate("2024-11-18T20:00:00Z", "Asia/Tokyo"), "19 NOV 24");
});
