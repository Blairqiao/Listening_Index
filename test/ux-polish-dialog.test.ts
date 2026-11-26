import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTs } from "./helpers/load-ts";

const root = path.resolve(__dirname, "..");

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

const MODAL_FILES = [
  "src/components/modals/customization-modal/CustomizationModal.tsx",
  "src/components/modals/admin-login-modal/AdminLoginModal.tsx",
  "src/components/modals/upload-modal/UploadModal.tsx",
  "src/components/modals/admin-spotify-modal/AdminSpotifyModal.tsx",
] as const;

test("nextFocusIndex wraps forward and backward and handles edge counts", async () => {
  const { nextFocusIndex } = await import("../src/lib/hooks/useDialogFocus");

  assert.equal(nextFocusIndex(0, 3, false), 1);
  assert.equal(nextFocusIndex(2, 3, false), 0, "wraps forward from last index to 0");
  assert.equal(nextFocusIndex(2, 3, true), 1);
  assert.equal(nextFocusIndex(0, 3, true), 2, "wraps backward from 0 to last index");

  assert.equal(nextFocusIndex(0, 1, false), 0, "count === 1 stays at 0 forward");
  assert.equal(nextFocusIndex(0, 1, true), 0, "count === 1 stays at 0 backward");

  assert.equal(nextFocusIndex(0, 0, false), -1, "count === 0 returns -1");
  assert.equal(nextFocusIndex(0, 0, true), -1, "count === 0 returns -1");

  assert.equal(nextFocusIndex(-1, 3, false), 0);
  assert.equal(nextFocusIndex(-1, 3, true), 2);
  assert.equal(nextFocusIndex(5, 3, false), 0);
  assert.equal(nextFocusIndex(5, 3, true), 2);
});

test("all four modals integrate useDialogFocus and the shared modal motion classes", () => {
  for (const relPath of MODAL_FILES) {
    const src = readSrc(relPath);
    assert.ok(src.includes("useDialogFocus"), `${relPath} must use useDialogFocus`);
    assert.ok(src.includes("modalPanelClass(phase)"), `${relPath} must use modalPanelClass`);
    assert.ok(src.includes("modalBackdropClass(phase)"), `${relPath} must use modalBackdropClass`);
    assert.ok(
      !src.includes("ease-[cubic-bezier(0.16,1,0.3,1)]"),
      `${relPath} must not keep inline cubic-bezier`,
    );
  }
});

test("UploadModal animates enter via requestAnimationFrame and stabilizes step height", () => {
  const src = readSrc("src/components/modals/upload-modal/UploadModal.tsx");
  assert.match(src, /useState(?:<boolean>)?\(false\)/, "isVisible should initialize to false");
  assert.ok(src.includes("requestAnimationFrame"), "UploadModal must use requestAnimationFrame for enter transition");
  assert.match(src, /min-h-\[\d+px\]/, "UploadModal step content wrapper must reserve min-h");
});

test("AdminLoginModal supports mobile keyboard viewport and accessible password toggle", () => {
  const src = readSrc("src/components/modals/admin-login-modal/AdminLoginModal.tsx");
  assert.ok(src.includes("max-h-[90dvh]"), "AdminLoginModal panel must bound height to 90dvh");
  assert.ok(src.includes("overflow-y-auto"), "AdminLoginModal panel must allow vertical scrolling");
  assert.ok(src.includes("items-start sm:items-center"), "AdminLoginModal backdrop must align top on mobile");
  assert.ok(src.includes("hit-area"), "AdminLoginModal password toggle must include hit-area");
  assert.ok(src.includes("focus-ring"), "AdminLoginModal buttons must use focus-ring");
  assert.doesNotMatch(
    src,
    /title=\{showPassword[^}]*\}[\s\S]{0,160}focus:outline-none/,
    "AdminLoginModal password toggle must not suppress focus outline",
  );
  assert.doesNotMatch(
    src,
    /title="Close \(Esc\)"[\s\S]{0,160}focus:outline-none/,
    "AdminLoginModal close button must not suppress focus outline",
  );
});

test("modal close buttons and ColorPicker preset swatches use focus-ring without focus:outline-none", () => {
  for (const relPath of MODAL_FILES) {
    const src = readSrc(relPath);
    assert.match(
      src,
      /title="Close(?: modal)? \(Esc\)"[\s\S]{0,200}focus-ring|focus-ring[\s\S]{0,200}title="Close(?: modal)? \(Esc\)"/,
      `${relPath} close button must include focus-ring`,
    );
    assert.doesNotMatch(
      src,
      /title="Close(?: modal)? \(Esc\)"[\s\S]{0,160}focus:outline-none/,
      `${relPath} close button must not suppress focus outline`,
    );
  }

  const colorPicker = readSrc("src/components/modals/customization-modal/ColorPicker.tsx");
  assert.ok(colorPicker.includes("h-10 sm:h-6"), "ColorPicker swatches must use taller mobile height");
  assert.match(
    colorPicker,
    /handleSelectPreset[\s\S]{0,240}focus-ring/,
    "ColorPicker preset swatches must include focus-ring",
  );
  assert.doesNotMatch(
    colorPicker,
    /handleSelectPreset[\s\S]{0,240}focus:outline-none/,
    "ColorPicker preset swatches must not suppress focus outline",
  );

  const spotifyModal = readSrc("src/components/modals/admin-spotify-modal/AdminSpotifyModal.tsx");
  assert.ok(spotifyModal.includes("animate-slow-blink"), "AdminSpotifyModal must preserve animate-slow-blink");
});

const emptyAnalysis = {
  firstPlaysCount: 0,
  totalTracks: 0,
  topTrack: null,
  topAlbum: { title: "None", count: 0 },
  topArtist: { name: "None", count: 0 },
};

function renderSessionView(tracks: Array<Record<string, unknown>>) {
  const { SessionView } = loadTs("src/components/views/session-view/SessionView.tsx", {
    "@/context/ConfigContext": { useConfig: () => ({ visitorTimezone: "UTC" }) },
    "../../Artwork": { Artwork: () => null },
    "./SessionHistogram": { SessionHistogram: () => null },
    "./SessionAnalysisPanel": { SessionAnalysisPanel: () => null },
  });
  const sessions = [
    {
      id: "s1",
      startedAt: "2026-11-15T10:00:00.000Z",
      endedAt: "2026-11-15T10:30:00.000Z",
      runtimeMs: 1_800_000,
      trackCount: tracks.length,
      uniqueArtistsCount: tracks.length > 0 ? 1 : 0,
      isOpen: false,
      tracks,
      analysis: emptyAnalysis,
    },
  ];
  return renderToStaticMarkup(
    React.createElement(SessionView as unknown as React.FC<Record<string, unknown>>, {
      sessions,
      selectedSessionId: "s1",
    }),
  );
}

test("SessionView renders centered empty state without placeholder rows when activeTracks is empty", () => {
  const emptyHtml = renderSessionView([]);
  assert.ok(emptyHtml.includes("No tracks in session"), "empty session must show centered empty state");
  assert.ok(!emptyHtml.includes('aria-hidden="true"'), "empty session must not render blank placeholder rows");

  const populatedHtml = renderSessionView([
    {
      id: "play-1",
      trackId: "track-1",
      title: "Weird Fishes",
      artist: "Radiohead",
      album: "In Rainbows",
      playedAt: "2026-11-15T10:05:00.000Z",
      durationMs: 318_000,
    },
  ]);
  assert.ok(!populatedHtml.includes("No tracks in session"), "populated session must not show empty state");
  assert.ok(populatedHtml.includes("focus-ring"), "session list items must include focus-ring");
  assert.ok(!populatedHtml.includes("focus:outline-none"), "session list items must not suppress focus outline");
});

test("SessionHistogram renders focus-ring, keyboard selection, and fast selection color transition", () => {
  const { SessionHistogram } = loadTs("src/components/views/session-view/SessionHistogram.tsx");
  const html = renderToStaticMarkup(
    React.createElement(SessionHistogram as unknown as React.FC<Record<string, unknown>>, {
      selectedSessionId: "s1",
      histogram: {
        avgRuntimeMinutes: 30,
        oldestDate: "14 Nov",
        newestDate: "15 Nov",
        bars: [
          { id: "s1", dateStr: "15 Nov", runtimeMinutes: 40, title: "40m" },
          { id: "s2", dateStr: "14 Nov", runtimeMinutes: 20, title: "20m" },
        ],
      },
    }),
  );

  assert.ok(html.includes('role="button"'), "histogram bars must keep role=button");
  assert.ok(html.includes('aria-pressed="true"'), "selected histogram bar must expose aria-pressed");
  assert.ok(html.includes("focus-ring"), "histogram bars must use focus-ring");
  assert.ok(!html.includes("focus:outline-none"), "histogram bars must not suppress focus outline");
  assert.ok(
    html.includes("duration-[var(--motion-fast)]"),
    "histogram bar selection color must transition over --motion-fast",
  );
  assert.ok(!html.includes("transition-all"), "histogram bar heights must not animate via transition-all");

  const src = readSrc("src/components/views/session-view/SessionHistogram.tsx");
  assert.match(src, /onKeyDown=/, "SessionHistogram must handle keyboard events");
  assert.match(src, /"Enter"[\s\S]*" "|" "[\s\S]*"Enter"/, "SessionHistogram must select on Enter and Space");
});
