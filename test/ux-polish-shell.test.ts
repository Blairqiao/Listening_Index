import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfigProvider } from "../src/context/ConfigContext";
import { ModeTabs } from "../src/components/listening-view/ModeTabs";
import { SyncStatus } from "../src/components/listening-view/SyncStatus";
import { MiniPlayerBar } from "../src/components/listening-view/MiniPlayerBar";
import { OverviewView } from "../src/components/views/OverviewView";
import { StreamLogView } from "../src/components/views/StreamLogView";
import { ActivityChart } from "../src/components/views/ActivityChart";
import type {
  ActivityBucket,
  AlbumSummary,
  ArtistSummary,
  StreamLogItem,
  TrackSummary,
} from "../src/lib/types";

const sampleTracks: TrackSummary[] = [
  {
    id: "t1",
    rank: "01",
    drift: "·",
    name: "Weird Fishes",
    artist: "Radiohead",
    artistKey: "radiohead",
    album: "In Rainbows",
    albumKey: "in-rainbows",
    duration: "5:18",
    plays: 12,
    swatchColor: "#141413",
  },
];

const sampleArtists: ArtistSummary[] = [
  { rank: "01", name: "Radiohead", count: 12, key: "radiohead" },
];

const sampleAlbums: AlbumSummary[] = [
  {
    rank: "01",
    name: "In Rainbows",
    artist: "Radiohead",
    key: "in-rainbows",
    artistKey: "radiohead",
    count: 12,
  },
];

const sampleBuckets: ActivityBucket[] = [
  {
    date: "2026-11-24",
    count: 12,
    startTime: "2026-11-24T00:00:00.000Z",
    endTime: "2026-11-24T23:59:59.999Z",
  },
];

const sampleEntries: StreamLogItem[] = [
  {
    id: "play-1",
    trackId: "t1",
    playedAt: "2026-11-24T12:00:00.000Z",
    durationMs: 318000,
    title: "Weird Fishes",
    artist: "Radiohead",
    album: "In Rainbows",
  },
];

test("OverviewView renders 10 track skeleton rows while loading and animate-content-enter once loaded", () => {
  const loadingMarkup = renderToStaticMarkup(
    React.createElement(OverviewView, {
      granularity: "day",
      topTracks: [],
      topArtists: [],
      topAlbums: [],
      activityCadence: [],
      isLoading: true,
    })
  );

  const trackSkeletonMatches = loadingMarkup.match(/h-\[54px\] md:h-\[55px\] animate-pulse/g) ?? [];
  assert.equal(trackSkeletonMatches.length, 10, "Overview track skeleton must render 10 rows");
  assert.ok(loadingMarkup.includes(">10<"), "10th skeleton row must be numbered 10");
  assert.ok(!loadingMarkup.includes("animate-content-enter"), "Skeleton state must not animate content enter");

  const loadedMarkup = renderToStaticMarkup(
    React.createElement(OverviewView, {
      granularity: "day",
      topTracks: sampleTracks,
      topArtists: sampleArtists,
      topAlbums: sampleAlbums,
      activityCadence: sampleBuckets,
      isLoading: false,
    })
  );

  const enterMatches = loadedMarkup.match(/animate-content-enter/g) ?? [];
  assert.equal(enterMatches.length, 4, "Loaded tracks, artists, albums, and chart must get animate-content-enter");
});

test("ActivityChart omits animate-content-enter on skeleton and keeps it on loaded and dimmed states", () => {
  const loadingMarkup = renderToStaticMarkup(
    React.createElement(ActivityChart, {
      granularity: "day",
      activityCadence: [],
      isLoading: true,
      visitorTimezone: "UTC",
    })
  );
  assert.ok(loadingMarkup.includes("animate-pulse"));
  assert.ok(!loadingMarkup.includes("animate-content-enter"));

  const loadedMarkup = renderToStaticMarkup(
    React.createElement(ActivityChart, {
      granularity: "day",
      activityCadence: sampleBuckets,
      isLoading: false,
      visitorTimezone: "UTC",
    })
  );
  assert.ok(loadedMarkup.includes("animate-content-enter"));

  const refreshingMarkup = renderToStaticMarkup(
    React.createElement(ActivityChart, {
      granularity: "day",
      activityCadence: sampleBuckets,
      isLoading: true,
      visitorTimezone: "UTC",
    })
  );
  assert.ok(
    refreshingMarkup.includes("animate-content-enter"),
    "Refreshing with existing buckets keeps animate-content-enter mounted without flipping back to skeleton"
  );
});

test("StreamLogView renders centered empty state, skeleton without empty text, and press/focus/hit-area on buttons", () => {
  const emptyMarkup = renderToStaticMarkup(
    React.createElement(ConfigProvider, {
      initialVisitorTimezone: "UTC",
      children: React.createElement(StreamLogView, {
        entries: [],
        isLoading: false,
      }),
    })
  );
  assert.ok(emptyMarkup.includes("No plays"), "Empty stream log must render centered 'No plays'");
  assert.ok(
    !emptyMarkup.includes('class="h-[54px] border-b border-[#191917]"'),
    "Empty stream log must not render 9 blank rows"
  );
  assert.ok(emptyMarkup.includes("animate-content-enter"));

  const loadingMarkup = renderToStaticMarkup(
    React.createElement(ConfigProvider, {
      initialVisitorTimezone: "UTC",
      children: React.createElement(StreamLogView, {
        entries: [],
        isLoading: true,
      }),
    })
  );
  assert.ok(!loadingMarkup.includes("No plays"), "Loading skeleton must not render empty-state label");
  assert.ok(!loadingMarkup.includes("animate-content-enter"), "Loading skeleton must not get animate-content-enter");
  assert.equal((loadingMarkup.match(/animate-pulse/g) ?? []).length, 9);

  const loadedHasMoreMarkup = renderToStaticMarkup(
    React.createElement(ConfigProvider, {
      initialVisitorTimezone: "UTC",
      children: React.createElement(StreamLogView, {
        entries: sampleEntries,
        hasMore: true,
        isLoading: false,
      }),
    })
  );
  assert.ok(!loadedHasMoreMarkup.includes("No plays"));
  assert.ok(loadedHasMoreMarkup.includes("animate-content-enter"));
  const hasMoreButtons = loadedHasMoreMarkup.match(/<button\b[^>]*>/g) ?? [];
  assert.equal(hasMoreButtons.length, 2);
  for (const btn of hasMoreButtons) {
    assert.match(btn, /\bpress\b/, "Stream log pagination/scroll button must include press");
    assert.match(btn, /\bfocus-ring\b/, "Stream log pagination/scroll button must include focus-ring");
    assert.match(btn, /\brelative\b/, "Stream log pagination/scroll button must include relative");
    assert.match(btn, /\bhit-area\b/, "Stream log pagination/scroll button must include hit-area");
  }

  const loadedArchivedMarkup = renderToStaticMarkup(
    React.createElement(ConfigProvider, {
      initialVisitorTimezone: "UTC",
      children: React.createElement(StreamLogView, {
        entries: sampleEntries,
        hasMore: false,
        isLoading: false,
      }),
    })
  );
  const archivedButtons = loadedArchivedMarkup.match(/<button\b[^>]*>/g) ?? [];
  assert.equal(archivedButtons.length, 1);
  assert.match(archivedButtons[0], /\bpress\b/);
  assert.match(archivedButtons[0], /\bfocus-ring\b/);
  assert.match(archivedButtons[0], /\brelative\b/);
  assert.match(archivedButtons[0], /\bhit-area\b/);
});

test("ModeTabs and SyncStatus use focus-ring without outline-none, and ModeTabs buttons expand tap targets", () => {
  const adminTabsMarkup = renderToStaticMarkup(
    React.createElement(
      ConfigProvider,
      null,
      React.createElement(ModeTabs, {
        activeMode: 0,
        onSelectMode: () => {},
        onOpenUpload: () => {},
        spotifyStatus: { connected: false, isExpiringSoon: false },
        isAuthenticated: true,
      })
    )
  );
  const adminButtons = adminTabsMarkup.match(/<button\b[^>]*>/g) ?? [];
  assert.equal(adminButtons.length, 10);
  for (const btn of adminButtons) {
    assert.match(btn, /\bfocus-ring\b/, `ModeTabs button missing focus-ring: ${btn}`);
    assert.match(btn, /\brelative\b/, `ModeTabs button missing relative: ${btn}`);
    assert.match(btn, /\bhit-area\b/, `ModeTabs button missing hit-area: ${btn}`);
    assert.doesNotMatch(btn, /outline-none/, `ModeTabs button still has outline-none: ${btn}`);
  }

  const guestTabsMarkup = renderToStaticMarkup(
    React.createElement(
      ConfigProvider,
      null,
      React.createElement(ModeTabs, {
        activeMode: 0,
        onSelectMode: () => {},
        isAuthenticated: false,
      })
    )
  );
  const guestButtons = guestTabsMarkup.match(/<button\b[^>]*>/g) ?? [];
  assert.equal(guestButtons.length, 7);
  for (const btn of guestButtons) {
    assert.match(btn, /\bfocus-ring\b/);
    assert.match(btn, /\brelative\b/);
    assert.match(btn, /\bhit-area\b/);
    assert.doesNotMatch(btn, /outline-none/);
  }

  const syncMarkup = renderToStaticMarkup(
    React.createElement(SyncStatus, {
      isLive: true,
      syncedAgo: "1m ago",
      isAuthenticated: true,
      onTriggerSync: () => {},
    })
  );
  const syncButton = syncMarkup.match(/<button\b[^>]*>/)?.[0];
  assert.ok(syncButton);
  assert.match(syncButton, /\bfocus-ring\b/);
  assert.doesNotMatch(syncButton, /outline-none/);
});

test("MiniPlayerBar transport buttons include press and focus-ring", () => {
  const markup = renderToStaticMarkup(
    React.createElement(MiniPlayerBar, {
      track: { name: "Track", artist: "Artist", imageUrl: null, id: "t1" },
      isPlaying: false,
      progress: 0.4,
      controlsDisabled: false,
      onTogglePlay: () => {},
      onPrevious: () => {},
      onNext: () => {},
      onOpenPlayer: () => {},
    })
  );

  for (const label of ["Previous", "Play", "Next"]) {
    const match = markup.match(new RegExp(`<button\\b[^>]*aria-label="${label}"[^>]*>`));
    assert.ok(match, `Expected button with aria-label="${label}"`);
    assert.match(match[0], /\bpress\b/, `${label} button must include press`);
    assert.match(match[0], /\bfocus-ring\b/, `${label} button must include focus-ring`);
  }
});

test("ListeningView configures showpiece reveal on black veil and keyed animate-view-enter on view wrapper", () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/components/ListeningView.tsx"),
    "utf8"
  );

  assert.ok(
    src.includes("duration-[var(--motion-showpiece)]") && src.includes("ease-expressive"),
    "Black veil must fade over var(--motion-showpiece) with --ease-expressive"
  );
  assert.ok(
    !src.includes("duration-300 ease-in-out"),
    "Black veil must replace duration-300 ease-in-out"
  );
  assert.match(
    src,
    /<div\s+key=\{activeMode\}\s+aria-busy=\{isViewDimmed\}\s+className=\{`animate-view-enter /,
    "View wrapper must be keyed by activeMode and apply animate-view-enter"
  );
  assert.ok(
    src.includes("transition-opacity duration-150") && src.includes("opacity-60 pointer-events-none"),
    "View wrapper must preserve existing dim transition classes"
  );
});
