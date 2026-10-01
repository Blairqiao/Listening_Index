import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MetricRibbon } from "../src/components/MetricRibbon";
import {
  computeLivePlayerMetrics,
  getTrackStatsCacheKey,
  resolveActiveEntity,
} from "../src/components/ListeningView";
import type { TrackTelemetryStats } from "../src/lib/db/queries";

const sampleStats: TrackTelemetryStats = {
  track: {
    id: "spotify:track:123",
    name: "Starless",
    rank: 14,
    plays: 42,
    totalTracks: 1400,
  },
  artist: {
    name: "King Crimson",
    rank: 3,
    plays: 280,
    totalArtists: 600,
  },
};

const zeroStats: TrackTelemetryStats = {
  track: {
    id: "spotify:track:999",
    name: "Unknown Track",
    rank: null,
    plays: 0,
    totalTracks: 1400,
  },
  artist: {
    name: "Unknown Artist",
    rank: null,
    plays: 0,
    totalArtists: 600,
  },
};

test("Mode 3 output with trackStats present (default rank format: 14 / 1,400, 42 PLAYS, 3 / 600, 280 PLAYS)", () => {
  const metrics = computeLivePlayerMetrics(sampleStats, "rank", "rank");
  assert.deepEqual(metrics, ["14 / 1,400", "42 PLAYS", "3 / 600", "280 PLAYS"]);
});

test("Mode 3 output with toggled percentile format (TOP 1%, 42 PLAYS, TOP 0.5%, 280 PLAYS)", () => {
  // 14 / 1400 = 1% -> TOP 1%
  // 3 / 600 = 0.5% -> TOP 0.5%
  const metrics = computeLivePlayerMetrics(sampleStats, "percentile", "percentile");
  assert.deepEqual(metrics, ["TOP 1%", "42 PLAYS", "TOP 0.5%", "280 PLAYS"]);
});

test("Mode 3 output with mixed rank format (track percentile, artist rank)", () => {
  const metrics = computeLivePlayerMetrics(sampleStats, "percentile", "rank");
  assert.deepEqual(metrics, ["TOP 1%", "42 PLAYS", "3 / 600", "280 PLAYS"]);
});


test("Mode 3 output when trackStats is null (unloaded/loading shows -- for plays)", () => {
  const metricsNull = computeLivePlayerMetrics(null, "rank", "rank");
  assert.deepEqual(metricsNull, ["NEW", "--", "NEW", "--"]);

  const metricsNullPercentile = computeLivePlayerMetrics(null, "percentile", "percentile");
  assert.deepEqual(metricsNullPercentile, ["NEW", "--", "NEW", "--"]);
});

test("Mode 3 output when trackStats is loaded with 0 plays (NEW, 0 PLAYS, NEW, 0 PLAYS)", () => {
  const metricsZero = computeLivePlayerMetrics(zeroStats, "rank", "rank");
  assert.deepEqual(metricsZero, ["NEW", "0 PLAYS", "NEW", "0 PLAYS"]);

  const metricsZeroPercentile = computeLivePlayerMetrics(zeroStats, "percentile", "percentile");
  assert.deepEqual(metricsZeroPercentile, ["NEW", "0 PLAYS", "NEW", "0 PLAYS"]);
});

test("resolveActiveEntity - candidate resolution without cross-source entity pollution", () => {
  // 1. When currentTrack has no ID, it must NOT steal trackId from the previous stream log entry
  const entityNoId = resolveActiveEntity(
    { id: null, name: "Live Song", artists: [{ name: "Live Band" }] },
    { trackId: "stale-track-id", title: "Previous Song", artist: "Previous Band" },
    null
  );
  assert.deepEqual(entityNoId, {
    id: undefined,
    title: "Live Song",
    artist: "Live Band",
  });

  // 2. Current track with multiple artists preserves compound artist string
  const entityCompound = resolveActiveEntity(
    { id: "trk-1", name: "Song", artists: [{ name: "Artist A" }, { name: "Artist B" }] },
    undefined,
    undefined
  );
  assert.deepEqual(entityCompound, {
    id: "trk-1",
    title: "Song",
    artist: "Artist A, Artist B",
  });

  // 3. Fallback to stream log when currentTrack is null
  const entityStreamLog = resolveActiveEntity(
    null,
    { trackId: "log-1", title: "Archive Track", artist: "Archive Artist" },
    { id: "init-1", name: "Initial Track", artist: "Initial Artist" }
  );
  assert.deepEqual(entityStreamLog, {
    id: "log-1",
    title: "Archive Track",
    artist: "Archive Artist",
  });

  // 4. Fallback to initialTrack when both currentTrack and streamLog are absent
  const entityInitial = resolveActiveEntity(
    null,
    undefined,
    { id: "init-1", name: "Initial Track", artist: "Initial Artist" }
  );
  assert.deepEqual(entityInitial, {
    id: "init-1",
    title: "Initial Track",
    artist: "Initial Artist",
  });

  // 5. Returns null when all sources are absent
  assert.equal(resolveActiveEntity(null, undefined, null), null);
});

test("In-memory track stats cache key and map caching logic", () => {
  const key1 = getTrackStatsCacheKey({
    trackId: "track-1",
    title: "Starless",
    artist: "King Crimson",
  });
  assert.equal(key1, "track-1:Starless:King Crimson");

  const keyNoId = getTrackStatsCacheKey({
    trackId: undefined,
    title: "Epitaph",
    artist: "King Crimson",
  });
  assert.equal(keyNoId, ":Epitaph:King Crimson");

  const cache = new Map<string, TrackTelemetryStats>();
  cache.set(key1, sampleStats);
  assert.equal(cache.has(key1), true);
  assert.equal(cache.get(key1)?.track.plays, 42);
  assert.equal(cache.has(keyNoId), false);
});

test("MetricRibbon integration with live player telemetry metrics and format toggle state", () => {
  const metrics = computeLivePlayerMetrics(sampleStats, "rank", "percentile");
  const html = renderToStaticMarkup(
    React.createElement(MetricRibbon, {
      mode: 3,
      metrics,
      trackRankFormat: "rank",
      artistRankFormat: "percentile",
      onToggleTrackRank: () => {},
      onToggleArtistRank: () => {},
    })
  );

  assert.match(html, /TRACK RANK/);
  assert.match(html, /14 \/ 1,400/);
  assert.match(html, /42 PLAYS/);
  assert.match(html, /ARTIST RANK/);
  assert.match(html, /TOP 0.5%/);
  assert.match(html, /280 PLAYS/);
});


test("ListeningView source contract for telemetry state, fetch API, and localStorage persistence", () => {
  const listeningViewSrc = fs.readFileSync(
    path.resolve(__dirname, "../src/components/ListeningView.tsx"),
    "utf-8"
  );

  assert.match(
    listeningViewSrc,
    /listening_track_rank_format/,
    "Must persist trackRankFormat using listening_track_rank_format key in localStorage"
  );
  assert.match(
    listeningViewSrc,
    /listening_artist_rank_format/,
    "Must persist artistRankFormat using listening_artist_rank_format key in localStorage"
  );
  assert.match(
    listeningViewSrc,
    /\/api\/listening\/track-stats/,
    "Must query /api/listening/track-stats for telemetry"
  );
  assert.match(
    listeningViewSrc,
    /handleToggleTrackRank/,
    "Must define handleToggleTrackRank handler"
  );
  assert.match(
    listeningViewSrc,
    /handleToggleArtistRank/,
    "Must define handleToggleArtistRank handler"
  );
  assert.match(
    listeningViewSrc,
    /onToggleTrackRank/,
    "Must pass onToggleTrackRank to MetricRibbon"
  );
  assert.match(
    listeningViewSrc,
    /onToggleArtistRank/,
    "Must pass onToggleArtistRank to MetricRibbon"
  );
  assert.match(
    listeningViewSrc,
    /resolveActiveEntity/,
    "Must resolve active entity candidate atomically via resolveActiveEntity"
  );
  assert.match(
    listeningViewSrc,
    /setTrackStats\(null\)/,
    "Must reset trackStats on cache miss when fetching"
  );
});
