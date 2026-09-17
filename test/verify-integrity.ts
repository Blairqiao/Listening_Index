import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import assert from "node:assert/strict";
import test from "node:test";
import {
  getOverviewData,
  getStreamLog,
  getCurrentSession,
  getEnrichmentProgress,
  getDailyApiQuotaStatus,
  getActiveSiteConfig,
  isCatalogFullyEnriched,
  ensureTablesExist,
  getInitialMusicData,
} from "../src/lib/db/queries";
import {
  parseHistoryRecords,
  isAudioMusicTrack,
  isQualifiedPlay,
  truncateToSeconds,
  debouncePlays,
} from "../src/lib/history-parser";
import { normalizeHex, isValidHex } from "../src/lib/color-utils";
import { isAudioHistoryFilename } from "../src/lib/zip-utils";

test("Database Schema Check", async () => {
  await ensureTablesExist();
  const fullyEnriched = await isCatalogFullyEnriched();
  assert.equal(typeof fullyEnriched, "boolean");
});

test("Overview Data across all ranges", async () => {
  const ranges = ["1d", "1w", "1m", "6m", "1y", "all"] as const;
  for (const range of ranges) {
    const data = await getOverviewData(range);
    assert.ok(data, `Data should exist for range ${range}`);
    assert.equal(data.metrics.length, 4, `Metrics should have 4 elements for ${range}`);
    assert.ok(Array.isArray(data.topTracks), `topTracks should be array for ${range}`);
    assert.ok(Array.isArray(data.topArtists), `topArtists should be array for ${range}`);
    assert.ok(Array.isArray(data.topAlbums), `topAlbums should be array for ${range}`);
    assert.ok(Array.isArray(data.activityCadence), `activityCadence should be array for ${range}`);

    if (data.topTracks.length > 0) {
      const t = data.topTracks[0];
      assert.ok(t.id, "Track should have id");
      assert.ok(t.name, "Track should have name");
      assert.ok(t.artist, "Track should have artist");
      assert.ok(t.rank, "Track should have rank");
      assert.ok(t.duration, "Track should have duration");
    }

    if (data.topArtists.length > 0) {
      const a = data.topArtists[0];
      assert.ok(a.name, "Artist should have name");
      assert.ok(typeof a.count === "number", "Artist should have count");
    }
  }
});

test("Stream Log Keyset Pagination", async () => {
  const page1 = await getStreamLog(20);
  assert.ok(page1.metrics.length === 4);
  assert.equal(page1.entries.length, 20);
  assert.ok(page1.hasMore);
  assert.ok(page1.nextCursor);

  // Fetch page 2
  const page2 = await getStreamLog(
    20,
    undefined,
    page1.nextCursor,
    page1.nextCursorId || undefined
  );
  assert.equal(page2.entries.length, 20);
  // Ensure entries are strictly older
  const lastP1 = new Date(page1.entries[page1.entries.length - 1].playedAt!).getTime();
  const firstP2 = new Date(page2.entries[0].playedAt!).getTime();
  assert.ok(firstP2 <= lastP1, "Page 2 plays must be older or equal in timestamp to Page 1 plays");
});

test("Session Data integrity", async () => {
  const session = await getCurrentSession();
  assert.ok(session);
  assert.equal(typeof session.isOpen, "boolean");
  assert.equal(session.metrics.length, 4);
  assert.ok(Array.isArray(session.sittingTracks));
  assert.ok(Array.isArray(session.previousSittings));
  if (session.histogram) {
    assert.ok(Array.isArray(session.histogram.bars));
    assert.equal(typeof session.histogram.avgRuntimeMinutes, "number");
  }
});

test("Enrichment Progress & Quota Status", async () => {
  const progress = await getEnrichmentProgress();
  assert.ok(progress.total > 0);
  assert.equal(progress.pending + progress.enriched, progress.total);

  const quota = await getDailyApiQuotaStatus();
  assert.ok(quota.remainingTotal <= 900);
  assert.ok(quota.remainingCron <= 700);
  assert.ok(quota.remainingDynamic <= 200);
});

test("Active Site Config", async () => {
  const cfg = await getActiveSiteConfig();
  assert.ok(cfg.title);
  assert.ok(cfg.accentColor);
  assert.ok(cfg.timezone);
});

test("History Parser & Filtering", () => {
  const validRecord = {
    ts: "2024-01-15T12:00:00.123Z",
    ms_played: 35000,
    master_metadata_track_name: "Test Track",
    master_metadata_album_artist_name: "Test Artist",
    master_metadata_album_album_name: "Test Album",
    spotify_track_uri: "spotify:track:4clD00s1c0rVqP9Ld0vV48",
  };

  assert.equal(isAudioMusicTrack(validRecord), true);
  assert.equal(isQualifiedPlay(validRecord), true);
  assert.equal(truncateToSeconds("2024-01-15T12:00:00.123Z"), "2024-01-15T12:00:00Z");

  const parsed = parseHistoryRecords([validRecord]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].trackId, "4clD00s1c0rVqP9Ld0vV48");
  assert.equal(parsed[0].artistGroupKey, "test artist");
  assert.equal(parsed[0].albumGroupKey, "test artist::test album");

  // Filtered out cases
  const podcast = { ...validRecord, episode_name: "Podcast Ep 1" };
  assert.equal(isAudioMusicTrack(podcast), false);

  const shortSkip = { ...validRecord, ms_played: 15000, reason_end: "fwdbtn" };
  assert.equal(isQualifiedPlay(shortSkip), false);

  const shortCompleted = { ...validRecord, ms_played: 15000, reason_end: "trackdone" };
  assert.equal(isQualifiedPlay(shortCompleted), true);
});

test("Color Utils", () => {
  assert.equal(isValidHex("#FF0000"), true);
  assert.equal(isValidHex("#123"), true);
  assert.equal(isValidHex("invalid"), false);
  assert.equal(normalizeHex("#abc"), "#AABBCC");
  assert.equal(normalizeHex("#112233"), "#112233");
});

test("Zip Utils Filename Matching", () => {
  assert.equal(isAudioHistoryFilename("endsong_0.json"), true);
  assert.equal(isAudioHistoryFilename("Streaming_History_Audio_2024_0.json"), true);
  assert.equal(isAudioHistoryFilename("Streaming_History_Video_2024.json"), false);
  assert.equal(isAudioHistoryFilename("__MACOSX/._endsong_0.json"), false);
});

test("Initial Music Data Concurrent Fetch", async () => {
  const data = await getInitialMusicData();
  assert.ok(data.overview, "Overview should not be null");
  assert.ok(data.streamLog, "StreamLog should not be null");
  assert.ok(data.session, "Session should not be null");
  assert.equal(data.overview.metrics.length, 4);
  assert.equal(data.streamLog.metrics.length, 4);
  assert.ok(Array.isArray(data.session.sessions));
});

test("Existing Entity IDs & Play Keys Batch Integrity", async () => {
  const { getExistingEntityIds, getExistingPlayKeys } = await import("../src/lib/db/queries");

  // Test empty array edge cases
  const emptyRes = await getExistingEntityIds({ artistIds: [], albumIds: [], trackIds: [] });
  assert.equal(emptyRes.existingArtistIds.size, 0);
  assert.equal(emptyRes.existingAlbumIds.size, 0);
  assert.equal(emptyRes.existingTrackIds.size, 0);

  const emptyKeys = await getExistingPlayKeys([]);
  assert.equal(emptyKeys.size, 0);

  // Test play key format matches truncateToSeconds
  const page = await getStreamLog(5);
  if (page.entries.length > 0) {
    const entry = page.entries[0];
    const trackId = entry.trackId || entry.id;
    const testTime = entry.playedAt || new Date().toISOString();
    const truncated = truncateToSeconds(testTime);

    const playKeys = await getExistingPlayKeys([{ playedAt: truncated, trackId }]);
    const expectedKey = `${truncated}::${trackId}`;
    assert.ok(playKeys.has(expectedKey), `Key ${expectedKey} should be present in playKeys`);
  }
});

test("Stream Log Cursor Resilience", async () => {
  // Pass non-numeric cursorId to ensure no Postgres syntax crash
  const page = await getStreamLog(5, undefined, "2024-01-01T00:00:00Z", "non-numeric-mock-id");
  assert.ok(page);
  assert.ok(Array.isArray(page.entries));
});

test("Cached Site Config & Last Sync in-flight deduplication", async () => {
  const [cfg1, cfg2, sync1, sync2] = await Promise.all([
    getActiveSiteConfig(),
    getActiveSiteConfig(),
    import("../src/lib/db/queries").then((m) => m.getLastSync("spotify")),
    import("../src/lib/db/queries").then((m) => m.getLastSync("spotify")),
  ]);

  assert.equal(cfg1.title, cfg2.title);
  assert.equal(sync1, sync2);
});

test("Modular Query Submodule Imports", async () => {
  const overviewMod = await import("../src/lib/db/queries/overview");
  const streamLogMod = await import("../src/lib/db/queries/stream-log");
  const sessionMod = await import("../src/lib/db/queries/session");
  const ingestionMod = await import("../src/lib/db/queries/ingestion");
  const enrichmentMod = await import("../src/lib/db/queries/enrichment");
  const configMod = await import("../src/lib/db/queries/config");
  const schemaMod = await import("../src/lib/db/queries/schema");
  const initialDataMod = await import("../src/lib/db/queries/initial-data");
  const cacheMod = await import("../src/lib/db/queries/cache");
  const indexMod = await import("../src/lib/db/queries/index");

  assert.equal(typeof overviewMod.getOverviewData, "function");
  assert.equal(typeof streamLogMod.getStreamLog, "function");
  assert.equal(typeof sessionMod.getCurrentSession, "function");
  assert.equal(typeof ingestionMod.bulkUpsertTracks, "function");
  assert.equal(typeof enrichmentMod.getEnrichmentProgress, "function");
  assert.equal(typeof configMod.getActiveSiteConfig, "function");
  assert.equal(typeof schemaMod.ensureTablesExist, "function");
  assert.equal(typeof initialDataMod.getInitialMusicData, "function");
  assert.equal(typeof cacheMod.clearDbQueryCaches, "function");

  // Check barrel re-exports match submodule exports
  assert.equal(indexMod.getOverviewData, overviewMod.getOverviewData);
  assert.equal(indexMod.getStreamLog, streamLogMod.getStreamLog);
  assert.equal(indexMod.getCurrentSession, sessionMod.getCurrentSession);
  assert.equal(indexMod.bulkUpsertTracks, ingestionMod.bulkUpsertTracks);
  assert.equal(indexMod.getEnrichmentProgress, enrichmentMod.getEnrichmentProgress);
  assert.equal(indexMod.getActiveSiteConfig, configMod.getActiveSiteConfig);
  assert.equal(indexMod.ensureTablesExist, schemaMod.ensureTablesExist);
  assert.equal(indexMod.getInitialMusicData, initialDataMod.getInitialMusicData);
  assert.equal(indexMod.clearDbQueryCaches, cacheMod.clearDbQueryCaches);
});

test("Timezone Sanitization & Query Robustness", async () => {
  const { sanitizeTimezone, getTimezone } = await import("../src/lib/db/queries");

  const defaultTz = getTimezone();
  assert.equal(sanitizeTimezone(undefined), defaultTz);
  assert.equal(sanitizeTimezone(""), defaultTz);
  assert.equal(sanitizeTimezone("   "), defaultTz);
  assert.equal(sanitizeTimezone("invalid/zone_foo"), defaultTz);
  assert.equal(sanitizeTimezone("America/New_York"), "America/New_York");
  assert.equal(sanitizeTimezone("UTC"), "UTC");

  // Verify that an invalid timezone passed to getOverviewData or getStreamLog does not crash PostgreSQL
  const overview = await getOverviewData("1d", "invalid/dangerous'; DROP TABLE plays; --");
  assert.ok(overview);
  assert.equal(overview.metrics.length, 4);

  const streamLog = await getStreamLog(5, "invalid/bogus_tz");
  assert.ok(streamLog);
  assert.ok(Array.isArray(streamLog.entries));
});

test("AsyncLatchCache Deep Module Concurrency & Invalidation", async () => {
  const { AsyncLatchCache, clearDbQueryCaches, lastSyncCache, catalogStatusCache, siteConfigCache } =
    await import("../src/lib/db/queries/cache");

  let fetchCount = 0;
  const testLatch = new AsyncLatchCache<number>(1000, async () => {
    fetchCount++;
    await new Promise((r) => setTimeout(r, 20));
    return 42;
  });

  // Concurrent in-flight latching: both get() calls should share 1 underlying fetcher execution
  const [v1, v2] = await Promise.all([testLatch.get(), testLatch.get()]);
  assert.equal(v1, 42);
  assert.equal(v2, 42);
  assert.equal(fetchCount, 1);

  // Subsequent call within TTL returns cached value
  const v3 = await testLatch.get();
  assert.equal(v3, 42);
  assert.equal(fetchCount, 1);

  // Invalidation resets cached state
  testLatch.invalidate();
  assert.equal(testLatch.peek(), null);

  // Verify clearDbQueryCaches clears all singletons
  lastSyncCache.set("2024-01-01T00:00:00Z");
  catalogStatusCache.set(true);
  siteConfigCache.set({
    title: "Test",
    ownerName: "Test",
    accentColor: "#000",
    siteUrl: "",
    githubUrl: "",
    timezone: "UTC",
  });

  assert.ok(lastSyncCache.peek());
  assert.ok(catalogStatusCache.peek());
  assert.ok(siteConfigCache.peek());

  clearDbQueryCaches();

  assert.equal(lastSyncCache.peek(), null);
  assert.equal(catalogStatusCache.peek(), null);
  assert.equal(siteConfigCache.peek(), null);
});

test("Playback Debounce (30-second duplicate catch)", () => {
  // 1. Exact user incident: 5 events of trackA spaced 24s, 3.5s, 3.5s, 3.7s apart
  const incidentEvents = [
    { playedAt: "2026-09-14T06:31:15.507Z", trackId: "trackA" },
    { playedAt: "2026-09-14T06:31:39.070Z", trackId: "trackA" }, // +23.56s (< 30s) -> dropped
    { playedAt: "2026-09-14T06:31:42.526Z", trackId: "trackA" }, // +3.45s (< 30s) -> dropped
    { playedAt: "2026-09-14T06:31:45.994Z", trackId: "trackA" }, // +3.47s (< 30s) -> dropped
    { playedAt: "2026-09-14T06:31:49.658Z", trackId: "trackA" }, // +3.66s (< 30s) -> dropped
  ];

  const res1 = debouncePlays(incidentEvents);
  assert.equal(res1.debounced.length, 1);
  assert.equal(res1.droppedCount, 4);
  assert.equal(res1.debounced[0].playedAt, "2026-09-14T06:31:15.507Z");

  // 2. Multi-track independence: Track A and Track B within < 30s
  const multiTrackEvents = [
    { playedAt: "2026-09-14T06:31:15.000Z", trackId: "trackA" },
    { playedAt: "2026-09-14T06:31:20.000Z", trackId: "trackB" }, // different track -> kept
    { playedAt: "2026-09-14T06:31:25.000Z", trackId: "trackA" }, // same trackA < 30s -> dropped
  ];

  const res2 = debouncePlays(multiTrackEvents);
  assert.equal(res2.debounced.length, 2);
  assert.equal(res2.droppedCount, 1);
  assert.equal(res2.debounced[0].trackId, "trackA");
  assert.equal(res2.debounced[1].trackId, "trackB");

  // 3. Cooldown expiration (>= 30s accepted)
  const cooldownEvents = [
    { playedAt: "2026-09-14T06:31:15.000Z", trackId: "trackA" },
    { playedAt: "2026-09-14T06:31:30.000Z", trackId: "trackA" }, // +15s -> dropped
    { playedAt: "2026-09-14T06:32:00.000Z", trackId: "trackA" }, // +30s from 06:31:30 -> kept
    { playedAt: "2026-09-14T06:32:05.000Z", trackId: "trackA" }, // +5s -> dropped
  ];

  const res3 = debouncePlays(cooldownEvents);
  assert.equal(res3.debounced.length, 2);
  assert.equal(res3.droppedCount, 2);
  assert.equal(res3.debounced[0].playedAt, "2026-09-14T06:31:15.000Z");
  assert.equal(res3.debounced[1].playedAt, "2026-09-14T06:32:00.000Z");

  // 4. Out-of-order handling
  const unsortedEvents = [
    { playedAt: "2026-09-14T06:31:45.000Z", trackId: "trackA" },
    { playedAt: "2026-09-14T06:31:15.000Z", trackId: "trackA" },
  ];
  const res4 = debouncePlays(unsortedEvents);
  assert.equal(res4.debounced.length, 2);
  assert.equal(res4.debounced[0].playedAt, "2026-09-14T06:31:15.000Z");
  assert.equal(res4.debounced[1].playedAt, "2026-09-14T06:31:45.000Z");

  // 5. Cross-batch boundary with initialLastSeen
  const initialMap = new Map<string, number>([
    ["trackA", new Date("2026-09-14T06:31:15.000Z").getTime()]
  ]);
  const newBatch = [
    { playedAt: "2026-09-14T06:31:39.000Z", trackId: "trackA" }, // +24s from DB play -> dropped
    { playedAt: "2026-09-14T06:32:15.000Z", trackId: "trackA" }, // +36s from previous event -> kept
  ];
  const res5 = debouncePlays(newBatch, 30_000, initialMap);
  assert.equal(res5.debounced.length, 1);
  assert.equal(res5.droppedCount, 1);
  assert.equal(res5.debounced[0].playedAt, "2026-09-14T06:32:15.000Z");
});

test("Database Ingestion Debounce & Proximity Protection", async () => {
  const { bulkInsertPlays, insertPlay, bulkUpsertTracks } = await import("../src/lib/db/queries");
  const { getDb } = await import("../src/lib/db");
  const sql = getDb();

  // Pick a dummy track ID for isolated testing
  const dummyTrackId = "test_debounce_track_123";
  await bulkUpsertTracks([
    {
      id: dummyTrackId,
      name: "Debounce Test Track",
      artistName: "Debounce Artist",
      albumName: "Debounce Album",
      durationMs: 180000,
      enrichmentStatus: "enriched",
    },
  ]);

  // Clean up any test plays for this track
  await sql`DELETE FROM plays WHERE track_id = ${dummyTrackId};`;

  try {
    // 1. Insert base play at t0
    const t0 = "2026-01-01T10:00:00.000Z";
    const inserted1 = await insertPlay(t0, dummyTrackId, 180000);
    assert.equal(inserted1, true);

    // 2. Try inserting within 30 seconds via insertPlay (t0 + 15s) -> should be rejected!
    const t1 = "2026-01-01T10:00:15.000Z";
    const inserted2 = await insertPlay(t1, dummyTrackId, 180000);
    assert.equal(inserted2, false);

    // 3. Try bulk inserting a batch with:
    // - t0 + 20s (duplicate of DB play at 10:00:00) -> dropped by DB check
    // - t0 + 60s (10:01:00, >= 30s from 10:00:20 and 10:00:00) -> kept
    // - t0 + 65s (10:01:05, < 30s from 10:01:00 in-batch) -> dropped
    const bulkBatch = [
      { playedAt: "2026-01-01T10:00:20.000Z", trackId: dummyTrackId, msPlayed: 180000 },
      { playedAt: "2026-01-01T10:01:00.000Z", trackId: dummyTrackId, msPlayed: 180000 },
      { playedAt: "2026-01-01T10:01:05.000Z", trackId: dummyTrackId, msPlayed: 180000 },
    ];
    const bulkRes = await bulkInsertPlays(bulkBatch);
    assert.equal(bulkRes.insertedCount, 1);

    // Verify plays in DB for this track
    const rows = (await sql`
      SELECT played_at FROM plays WHERE track_id = ${dummyTrackId} ORDER BY played_at ASC;
    `) as any[];
    assert.equal(rows.length, 2);
    assert.equal(new Date(rows[0].played_at).toISOString(), "2026-01-01T10:00:00.000Z");
    assert.equal(new Date(rows[1].played_at).toISOString(), "2026-01-01T10:01:00.000Z");
  } finally {
    // Clean up test data
    await sql`DELETE FROM plays WHERE track_id = ${dummyTrackId};`;
    await sql`DELETE FROM tracks WHERE id = ${dummyTrackId};`;
  }
});



