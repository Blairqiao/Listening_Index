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

test("Mode 3 output with trackStats present (default rank format: #14, 42 PLAYS, #3, 280 PLAYS)", () => {
  const metrics = computeLivePlayerMetrics(sampleStats, "rank", "rank");
  assert.deepEqual(metrics, ["#14", "42 PLAYS", "#3", "280 PLAYS"]);
});

test("Mode 3 output with toggled percentile format (TOP 1%, 42 PLAYS, TOP 0.5%, 280 PLAYS)", () => {
  // 14 / 1400 = 1% -> TOP 1%
  // 3 / 600 = 0.5% -> TOP 0.5%
  const metrics = computeLivePlayerMetrics(sampleStats, "percentile", "percentile");
  assert.deepEqual(metrics, ["TOP 1%", "42 PLAYS", "TOP 0.5%", "280 PLAYS"]);
});

test("Mode 3 output with mixed rank format (track percentile, artist rank)", () => {
  const metrics = computeLivePlayerMetrics(sampleStats, "percentile", "rank");
  assert.deepEqual(metrics, ["TOP 1%", "42 PLAYS", "#3", "280 PLAYS"]);
});

test("Mode 3 output when trackStats is null or 0 plays (NEW, 0 PLAYS, NEW, 0 PLAYS)", () => {
  const metricsNull = computeLivePlayerMetrics(null, "rank", "rank");
  assert.deepEqual(metricsNull, ["NEW", "0 PLAYS", "NEW", "0 PLAYS"]);

  const metricsZero = computeLivePlayerMetrics(zeroStats, "rank", "rank");
  assert.deepEqual(metricsZero, ["NEW", "0 PLAYS", "NEW", "0 PLAYS"]);

  const metricsNullPercentile = computeLivePlayerMetrics(null, "percentile", "percentile");
  assert.deepEqual(metricsNullPercentile, ["NEW", "0 PLAYS", "NEW", "0 PLAYS"]);
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
  assert.match(html, /#14/);
  assert.match(html, /42 PLAYS/);
  assert.match(html, /ARTIST TOP %/);
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
});
