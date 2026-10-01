import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import test from "node:test";
import assert from "node:assert/strict";
import { getTrackTelemetryStats } from "../src/lib/db/queries";
import { GET } from "../src/app/api/listening/track-stats/route";

test("Track & Artist Telemetry Stats - Red/Green TDD Verification", async (t) => {
  await t.test("getTrackTelemetryStats - graceful fallback when DB is unconfigured", async () => {
    const originalDbUrl = process.env.DATABASE_URL;
    const originalPgUrl = process.env.POSTGRES_URL;

    try {
      delete process.env.DATABASE_URL;
      delete process.env.POSTGRES_URL;

      const stats = await getTrackTelemetryStats({
        trackId: "track_test_123",
        title: "Test Track",
        artist: "Test Artist",
      });

      assert.deepStrictEqual(stats, {
        track: {
          id: "track_test_123",
          name: "Test Track",
          plays: 0,
          rank: null,
          totalTracks: 0,
        },
        artist: {
          name: "Test Artist",
          plays: 0,
          rank: null,
          totalArtists: 0,
        },
      });
    } finally {
      if (originalDbUrl) process.env.DATABASE_URL = originalDbUrl;
      if (originalPgUrl) process.env.POSTGRES_URL = originalPgUrl;
    }
  });

  await t.test("getTrackTelemetryStats - returns accurate stats and rank for known track and artist", async () => {
    // 1VY48jCBWuapKl0N5MXoJD is Karen Mok - 忽然之間 in seed data
    const stats = await getTrackTelemetryStats({
      trackId: "1VY48jCBWuapKl0N5MXoJD",
      title: "忽然之間",
      artist: "Karen Mok",
    });

    assert.equal(stats.track.id, "1VY48jCBWuapKl0N5MXoJD");
    assert.equal(stats.track.plays, 11);
    assert.equal(stats.track.rank, 1);
    assert.ok(stats.track.totalTracks >= 600, `Expected totalTracks >= 600, got ${stats.track.totalTracks}`);

    assert.equal(stats.artist.name, "Karen Mok");
    assert.ok(stats.artist.plays >= 45, `Expected artist.plays >= 45, got ${stats.artist.plays}`);
    assert.equal(stats.artist.rank, 4);
    assert.ok(stats.artist.totalArtists >= 200, `Expected totalArtists >= 200, got ${stats.artist.totalArtists}`);
  });

  await t.test("getTrackTelemetryStats - adopts canonical artist group key when caller passes featured/compound artist string", async () => {
    // 1VY48jCBWuapKl0N5MXoJD is Karen Mok in seed DB, but player SDK might send "Karen Mok, Featured Artist"
    const stats = await getTrackTelemetryStats({
      trackId: "1VY48jCBWuapKl0N5MXoJD",
      title: "忽然之間",
      artist: "Karen Mok, Featured Artist",
    });

    assert.equal(stats.track.plays, 11);
    assert.equal(stats.artist.name, "Karen Mok");
    assert.ok(stats.artist.plays >= 45, `Expected artist.plays >= 45, got ${stats.artist.plays}`);
    assert.equal(stats.artist.rank, 4);
  });

  await t.test("getTrackTelemetryStats - fallback to title and artist lookup when trackId is missing or unmatched", async () => {
    // Case 1: no trackId provided, but title and artist provided
    const statsNoId = await getTrackTelemetryStats({
      title: "忽然之間",
      artist: "Karen Mok",
    });

    assert.equal(statsNoId.track.plays, 11);
    assert.equal(statsNoId.track.rank, 1);
    assert.ok(statsNoId.artist.plays >= 45, `Expected artist.plays >= 45, got ${statsNoId.artist.plays}`);
    assert.equal(statsNoId.artist.rank, 4);

    // Case 2: unmatched trackId provided, fallback matches by title + artist
    const statsUnmatchedId = await getTrackTelemetryStats({
      trackId: "spotify:track:unmatched_foreign_id_999",
      title: "忽然之間",
      artist: "Karen Mok",
    });

    assert.equal(statsUnmatchedId.track.plays, 11);
    assert.equal(statsUnmatchedId.track.rank, 1);
  });

  await t.test("getTrackTelemetryStats - handles zero plays and null rank for completely unknown music", async () => {
    const stats = await getTrackTelemetryStats({
      trackId: "nonexistent_track_xyz_999",
      title: "Completely Unheard Song 12345",
      artist: "Never Heard Artist 99999",
    });

    assert.equal(stats.track.plays, 0);
    assert.equal(stats.track.rank, null);
    assert.equal(stats.artist.plays, 0);
    assert.equal(stats.artist.rank, null);
    assert.ok(stats.track.totalTracks > 0);
    assert.ok(stats.artist.totalArtists > 0);
  });

  await t.test("GET /api/listening/track-stats - route handler returns JSON with cache-control headers", async () => {
    const req = new Request(
      "http://localhost:3000/api/listening/track-stats?trackId=1VY48jCBWuapKl0N5MXoJD&title=%E5%BF%BD%E7%84%B6%E4%B9%8B%E9%96%93&artist=Karen+Mok"
    );

    const res = await GET(req);
    assert.equal(res.status, 200);

    const cacheControl = res.headers.get("cache-control");
    assert.ok(cacheControl, "Cache-Control header must be present");
    assert.ok(
      cacheControl.includes("public") &&
        cacheControl.includes("s-maxage=10") &&
        cacheControl.includes("stale-while-revalidate=30"),
      `Expected Cache-Control header with s-maxage=10 and stale-while-revalidate=30, got: ${cacheControl}`
    );

    const data = await res.json();
    assert.equal(data.track.plays, 11);
    assert.equal(data.track.rank, 1);
    assert.equal(data.artist.name, "Karen Mok");
    assert.ok(data.artist.plays >= 45, `Expected data.artist.plays >= 45, got ${data.artist.plays}`);
    assert.equal(data.artist.rank, 4);
    assert.ok(data.track.totalTracks > 0);
    assert.ok(data.artist.totalArtists > 0);
  });
});
