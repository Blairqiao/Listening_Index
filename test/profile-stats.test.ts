import test from "node:test";
import assert from "node:assert/strict";
import {
  artistShare,
  buildShareSegments,
  formatShare,
  hourHistogram,
  longestStreak,
  OTHER_SEGMENT_ID,
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
