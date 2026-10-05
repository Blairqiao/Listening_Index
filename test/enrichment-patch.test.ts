import test from "node:test";
import assert from "node:assert/strict";
import {
  patchOverviewCacheWithEnrichment,
  patchStreamLogWithEnrichment,
  patchSessionWithEnrichment,
} from "../src/lib/enrichment-patch";
import type { OverviewData, StreamLogData, SessionData } from "../src/lib/db/queries/types";
import type { RangeKey } from "../src/lib/types";

test("patchOverviewCacheWithEnrichment - patches topTracks across ranges without mutating unchanged items", () => {
  const initialCache: Partial<Record<RangeKey, OverviewData>> = {
    "1d": {
      logStartDate: "2026-10-01",
      rawMetrics: { totalMs: 1000, trackCount: 1, artistCount: 1, elapsedDays: 1 },
      metrics: ["16m", "1", "1", "16m"],
      topTracks: [
        {
          id: "track-1",
          rank: "01",
          drift: "·",
          name: "Song One",
          artist: "Artist One",
          album: "Album One",
          duration: "3:30",
          plays: 5,
          swatchColor: "#111111",
          albumImageUrl: null,
        },
        {
          id: "track-2",
          rank: "02",
          drift: "·",
          name: "Song Two",
          artist: "Artist Two",
          album: "Album Two",
          duration: "4:00",
          plays: 3,
          swatchColor: "#222222",
          albumImageUrl: "https://example.com/existing.jpg",
        },
      ],
      topArtists: [],
      topAlbums: [],
      activityCadence: [],
    },
    "1w": {
      logStartDate: "2026-09-24",
      rawMetrics: { totalMs: 5000, trackCount: 2, artistCount: 2, elapsedDays: 7 },
      metrics: ["1h", "2", "2", "10m"],
      topTracks: [
        {
          id: "track-1",
          rank: "01",
          drift: "·",
          name: "Song One",
          artist: "Artist One",
          album: "Album One",
          duration: "3:30",
          plays: 12,
          swatchColor: "#111111",
          albumImageUrl: null,
        },
      ],
      topArtists: [],
      topAlbums: [],
      activityCadence: [],
    },
  };

  const enrichmentMap = new Map([
    [
      "track-1",
      {
        albumImageUrl: "https://example.com/track-1.jpg",
        artistId: "artist-id-1",
        albumId: "album-id-1",
      },
    ],
  ]);

  const { updatedCache, changed } = patchOverviewCacheWithEnrichment(initialCache, enrichmentMap);

  assert.equal(changed, true);
  assert.equal(updatedCache["1d"]?.topTracks[0].albumImageUrl, "https://example.com/track-1.jpg");
  assert.equal(updatedCache["1d"]?.topTracks[0].artistId, "artist-id-1");
  assert.equal(updatedCache["1d"]?.topTracks[0].albumId, "album-id-1");
  // Track 2 was untouched
  assert.equal(updatedCache["1d"]?.topTracks[1], initialCache["1d"]?.topTracks[1]);
  // 1w cache was also patched
  assert.equal(updatedCache["1w"]?.topTracks[0].albumImageUrl, "https://example.com/track-1.jpg");
});

test("patchOverviewCacheWithEnrichment - returns unchanged cache reference if no matching tracks", () => {
  const initialCache: Partial<Record<RangeKey, OverviewData>> = {
    "1d": {
      logStartDate: "2026-10-01",
      rawMetrics: { totalMs: 1000, trackCount: 1, artistCount: 1, elapsedDays: 1 },
      metrics: ["16m", "1", "1", "16m"],
      topTracks: [
        {
          id: "track-99",
          rank: "01",
          drift: "·",
          name: "Song 99",
          artist: "Artist 99",
          album: "Album 99",
          duration: "3:00",
          plays: 1,
          swatchColor: "#333333",
          albumImageUrl: null,
        },
      ],
      topArtists: [],
      topAlbums: [],
      activityCadence: [],
    },
  };

  const enrichmentMap = new Map([
    [
      "track-other",
      {
        albumImageUrl: "https://example.com/other.jpg",
      },
    ],
  ]);

  const { updatedCache, changed } = patchOverviewCacheWithEnrichment(initialCache, enrichmentMap);

  assert.equal(changed, false);
  assert.equal(updatedCache, initialCache);
});

test("patchStreamLogWithEnrichment - patches entries and marks delisted items", () => {
  const initialStreamLog: StreamLogData = {
    rawMetrics: { totalPlays: 2, uniqueTracks: 2, uniqueArtists: 2, streakDays: 1 },
    metrics: ["2", "2", "2", "1"],
    entries: [
      {
        id: "play-1",
        trackId: "track-10",
        timeStr: "12:00",
        title: "Track 10",
        artist: "Artist 10",
        album: "Album 10",
        duration: "3:10",
        albumImageUrl: null,
      },
      {
        id: "play-2",
        trackId: "track-20",
        timeStr: "12:05",
        title: "Track 20",
        artist: "Artist 20",
        album: "Album 20",
        duration: "2:50",
        albumImageUrl: null,
      },
    ],
  };

  const enrichmentMap = new Map([
    [
      "track-10",
      {
        albumImageUrl: "https://example.com/track-10.jpg",
        artistId: "art-10",
        albumId: "alb-10",
      },
    ],
  ]);
  const delistedSet = new Set(["track-20"]);

  const updated = patchStreamLogWithEnrichment(initialStreamLog, enrichmentMap, delistedSet);

  assert.notEqual(updated, null);
  assert.equal(updated?.entries[0].albumImageUrl, "https://example.com/track-10.jpg");
  assert.equal(updated?.entries[0].artistId, "art-10");
  assert.equal(updated?.entries[0].albumId, "alb-10");
  assert.equal(updated?.entries[1].status, "[DELISTED]");
  assert.equal(updated?.entries[1].albumImageUrl, null);
});

test("patchSessionWithEnrichment - patches sittingTracks and active sittings", () => {
  const initialSession: SessionData = {
    isOpen: true,
    tagTime: "22:15 CDT",
    metrics: ["45m", "10", "5", "21:30"],
    sittingTracks: [
      {
        id: "track-30",
        timestamp: "21:30",
        title: "Track 30",
        artist: "Artist 30",
        album: "Album 30",
        swatchColor: "#444444",
        albumImageUrl: null,
      },
    ],
    previousSittings: [],
    sittings: [
      {
        id: "sess-1",
        dateStr: "2026-10-01",
        tagTime: "22:15 CDT",
        startTime: "21:30",
        trackCount: 1,
        uniqueArtistsCount: 1,
        runtimeMinutes: 45,
        runtimeStr: "45m",
        isOpen: true,
        tracks: [
          {
            id: "track-30",
            timestamp: "21:30",
            title: "Track 30",
            artist: "Artist 30",
            album: "Album 30",
            swatchColor: "#444444",
            albumImageUrl: null,
          },
        ],
      },
    ],
  };

  const enrichmentMap = new Map([
    [
      "track-30",
      {
        albumImageUrl: "https://example.com/track-30.jpg",
        artistId: "art-30",
        albumId: "alb-30",
      },
    ],
  ]);

  const updated = patchSessionWithEnrichment(initialSession, enrichmentMap);

  assert.notEqual(updated, null);
  assert.equal(updated?.sittingTracks[0].albumImageUrl, "https://example.com/track-30.jpg");
  assert.equal(updated?.sittings?.[0].tracks?.[0].albumImageUrl, "https://example.com/track-30.jpg");
  assert.equal(updated?.sittings?.[0].tracks?.[0].artistId, "art-30");
});
