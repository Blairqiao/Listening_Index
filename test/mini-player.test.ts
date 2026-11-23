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

const mergedProps = {
  track: { name: "Anytime Anywhere", artist: "milet", imageUrl: null, id: "t1" },
  isPlaying: true,
  progress: 0.5,
  controlsDisabled: false,
  onTogglePlay: () => {},
  onPrevious: () => {},
  onNext: () => {},
  onOpenPlayer: () => {},
  sync: { isLive: true, syncedAgo: "3m ago", isSyncing: false, isAuthenticated: true, onTriggerSync: () => {} },
};

test("the merged bar centers the transport in a three-column grid from sm up", () => {
  const html = renderToStaticMarkup(React.createElement(MiniPlayerBar, mergedProps));
  assert.match(html, /sm:grid-cols-\[1fr_auto_1fr\]/);
});

test("the merged bar carries the footer's sync status: full on the right, short in the artist line on phones", () => {
  const html = renderToStaticMarkup(React.createElement(MiniPlayerBar, mergedProps));
  assert.match(html, /hidden sm:flex[^"]*justify-end/, "desktop status zone must hide on phones and align right");
  assert.ok(html.includes("▪ Live · synced 3m ago"), "desktop status shows the full label");
  const syncButtons = html.match(/title="Click to trigger manual Spotify sync"/g) ?? [];
  assert.equal(syncButtons.length, 2, "one sync control per breakpoint");
  assert.match(html, /sm:hidden[^>]*>[\s\S]*?▪ Live</, "phone status shows the short label");
});

test("the merged bar keeps the transport enabled while a sync runs", () => {
  const html = renderToStaticMarkup(
    React.createElement(MiniPlayerBar, { ...mergedProps, sync: { ...mergedProps.sync, isSyncing: true } })
  );
  assert.ok(html.includes("Syncing..."));
  assert.equal(html.match(/aria-label="(Previous|Pause|Next)"[^>]*disabled=""/g), null);
});

test("ListeningView drops the footer while the mini-player shows", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const source = fs.readFileSync(path.resolve(__dirname, "../src/components/ListeningView.tsx"), "utf-8");
  assert.match(source, /!showMiniPlayer && \(\s*<ListeningFooter/);
  assert.match(source, /<MiniPlayerBar[\s\S]*?sync=\{/);
});
