import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { shouldShowMiniPlayer, miniPlayerProgress } from "../src/components/listening-view/mini-player";
import { MiniPlayerBar } from "../src/components/listening-view/MiniPlayerBar";
import type { Mode } from "../src/lib/types";

test("shouldShowMiniPlayer returns true only when authenticated, not in Mode 3, and has a track", () => {
  const modes: Mode[] = [0, 1, 2, 3, 4];

  // 1. Authenticated with track: true for all modes except Mode 3 (Live Player)
  for (const mode of modes) {
    const result = shouldShowMiniPlayer({
      isAuthenticated: true,
      activeMode: mode,
      hasTrack: true,
    });
    if (mode === 3) {
      assert.equal(result, false, "Mode 3 must not show mini-player even when authenticated and track is present");
    } else {
      assert.equal(result, true, `Mode ${mode} must show mini-player when authenticated and track is present`);
    }
  }

  // 2. Unauthenticated: false for all modes
  for (const mode of modes) {
    for (const hasTrack of [true, false]) {
      const result = shouldShowMiniPlayer({
        isAuthenticated: false,
        activeMode: mode,
        hasTrack,
      });
      assert.equal(result, false, `Unauthenticated user must never see mini-player (mode ${mode}, hasTrack ${hasTrack})`);
    }
  }

  // 3. No track: false for all modes even when authenticated
  for (const mode of modes) {
    const result = shouldShowMiniPlayer({
      isAuthenticated: true,
      activeMode: mode,
      hasTrack: false,
    });
    assert.equal(result, false, `Authenticated user with no track must not see mini-player (mode ${mode})`);
  }
});

test("miniPlayerProgress calculates progress, clamps between 0 and 1, and returns 0 when duration <= 0", () => {
  // Normal progress
  assert.equal(miniPlayerProgress(500, 1000), 0.5);
  assert.equal(miniPlayerProgress(0, 1000), 0);
  assert.equal(miniPlayerProgress(1000, 1000), 1);

  // Clamping
  assert.equal(miniPlayerProgress(-100, 1000), 0);
  assert.equal(miniPlayerProgress(1500, 1000), 1);

  // Zero duration
  assert.equal(miniPlayerProgress(500, 0), 0);
  assert.equal(miniPlayerProgress(0, 0), 0);

  // Negative duration
  assert.equal(miniPlayerProgress(500, -1000), 0);
});

test("MiniPlayerBar renders without context, shows Play/Pause based on isPlaying, and disables controls when controlsDisabled", () => {
  const baseTrack = {
    name: "Everything In Its Right Place",
    artist: "Radiohead",
    imageUrl: "https://example.com/art.jpg",
    id: "track-123",
  };

  // 1. Renders without context when isPlaying is false
  const markupPaused = renderToStaticMarkup(
    React.createElement(MiniPlayerBar, {
      track: baseTrack,
      isPlaying: false,
      progress: 0.35,
      controlsDisabled: false,
      onTogglePlay: () => {},
      onPrevious: () => {},
      onNext: () => {},
      onOpenPlayer: () => {},
    })
  );

  assert.ok(markupPaused.includes("Play"), "Markup must show 'Play' when isPlaying is false");
  assert.ok(!markupPaused.includes("Pause"), "Markup must not show 'Pause' when isPlaying is false");
  assert.ok(markupPaused.includes("Everything In Its Right Place"), "Track name must be rendered");
  assert.ok(markupPaused.includes("Radiohead"), "Artist must be rendered");

  // Every control must have an aria-label
  assert.ok(markupPaused.includes('aria-label="Play"'), "Play button must have aria-label='Play'");
  assert.ok(markupPaused.includes('aria-label="Previous"'), "Previous button must have aria-label");
  assert.ok(markupPaused.includes('aria-label="Next"'), "Next button must have aria-label");
  assert.ok(markupPaused.includes('aria-label="Open Live Player"'), "Track button must have aria-label");

  // Controls must not be disabled when controlsDisabled is false
  assert.ok(!markupPaused.includes('disabled=""'), "Buttons must not be disabled when controlsDisabled is false");

  // 2. When isPlaying is true
  const markupPlaying = renderToStaticMarkup(
    React.createElement(MiniPlayerBar, {
      track: baseTrack,
      isPlaying: true,
      progress: 0.75,
      controlsDisabled: false,
      onTogglePlay: () => {},
      onPrevious: () => {},
      onNext: () => {},
      onOpenPlayer: () => {},
    })
  );

  assert.ok(markupPlaying.includes("Pause"), "Markup must show 'Pause' when isPlaying is true");
  assert.ok(markupPlaying.includes('aria-label="Pause"'), "Play/pause button must have aria-label='Pause'");

  // 3. When controlsDisabled is true
  const markupDisabled = renderToStaticMarkup(
    React.createElement(MiniPlayerBar, {
      track: baseTrack,
      isPlaying: false,
      progress: 0,
      controlsDisabled: true,
      onTogglePlay: () => {},
      onPrevious: () => {},
      onNext: () => {},
      onOpenPlayer: () => {},
    })
  );

  assert.equal(markupDisabled.match(/ disabled=""/g)?.length, 3, "All three transport buttons must be disabled");
});
