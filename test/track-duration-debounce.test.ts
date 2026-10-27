import { test } from "node:test";
import assert from "node:assert/strict";
import { debouncePlays } from "../src/lib/history-parser";

test("debouncePlays preserves legitimate intentional repeat loops", () => {
  const songDurationMs = 180_000; // 3 minutes
  const play1Time = new Date("2026-10-26T12:03:00.000Z");
  const play2Time = new Date("2026-10-26T12:06:00.000Z"); // 3m later
  const play3Time = new Date("2026-10-26T12:09:00.000Z"); // 3m later

  const plays = [
    { trackId: "track-loop-1", playedAt: play1Time, durationMs: songDurationMs },
    { trackId: "track-loop-1", playedAt: play2Time, durationMs: songDurationMs },
    { trackId: "track-loop-1", playedAt: play3Time, durationMs: songDurationMs },
  ];

  const { debounced, droppedCount } = debouncePlays(plays);

  assert.equal(debounced.length, 3, "All 3 repeat plays must be preserved");
  assert.equal(droppedCount, 0, "No legitimate repeat plays should be dropped");
});

test("debouncePlays eliminates rapid CarPlay reconnection storms (>30s apart but < duration)", () => {
  const songDurationMs = 210_000; // 3.5 minutes
  const baseTime = new Date("2026-10-26T12:00:00.000Z").getTime();

  // Simulates 6 duplicate events emitted across 3 minutes by CarPlay reconnects
  // All spaced 35 seconds apart (which previously slipped through 30s debounce!)
  const plays = [
    { trackId: "track-carplay-1", playedAt: new Date(baseTime).toISOString(), durationMs: songDurationMs },
    { trackId: "track-carplay-1", playedAt: new Date(baseTime + 35_000).toISOString(), durationMs: songDurationMs },
    { trackId: "track-carplay-1", playedAt: new Date(baseTime + 70_000).toISOString(), durationMs: songDurationMs },
    { trackId: "track-carplay-1", playedAt: new Date(baseTime + 105_000).toISOString(), durationMs: songDurationMs },
    { trackId: "track-carplay-1", playedAt: new Date(baseTime + 140_000).toISOString(), durationMs: songDurationMs },
    { trackId: "track-carplay-1", playedAt: new Date(baseTime + 175_000).toISOString(), durationMs: songDurationMs },
  ];

  const { debounced, droppedCount } = debouncePlays(plays);

  assert.equal(debounced.length, 1, "Only 1 play must be recorded for the entire storm");
  assert.equal(droppedCount, 5, "5 duplicate reconnect events must be dropped");
  // Timestamp should update to the latest completion event
  assert.equal(
    new Date(debounced[0].playedAt).getTime(),
    baseTime + 175_000,
    "The single surviving play should reflect the latest completion timestamp"
  );
});

test("debouncePlays merges pause-and-resume stream events for the same track", () => {
  const songDurationMs = 200_000; // 3m 20s
  const baseTime = new Date("2026-10-26T14:00:00.000Z").getTime();

  const pauseEvent = {
    trackId: "track-pause-1",
    playedAt: new Date(baseTime + 45_000).toISOString(), // Paused 45s in
    durationMs: songDurationMs,
  };
  const resumeAndFinishEvent = {
    trackId: "track-pause-1",
    playedAt: new Date(baseTime + 220_000).toISOString(), // Resumed after 20s pause, finished track (delta 175s < 200s duration)
    durationMs: songDurationMs,
  };

  const { debounced, droppedCount } = debouncePlays([pauseEvent, resumeAndFinishEvent]);

  assert.equal(debounced.length, 1, "Pause and finish events must be merged into 1 play");
  assert.equal(droppedCount, 1);
  assert.equal(
    new Date(debounced[0].playedAt).getTime(),
    baseTime + 220_000,
    "Should retain the final track completion timestamp"
  );
});

test('merge retains greatest observed duration and advances the comparison timestamp', () => {
  const base = Date.parse('2026-10-26T12:00:00Z');
  const items = [0,29_000,31_000].map((offset,i) => ({trackId:'chain', playedAt:new Date(base+offset).toISOString(), msPlayed: i === 1 ? 31_000 : 30_000}));
  const result = debouncePlays(items);
  assert.equal(result.debounced.length,1);
  assert.equal(result.debounced[0].msPlayed,31_000);
  assert.equal(result.debounced[0].playedAt,items[2].playedAt);
});
