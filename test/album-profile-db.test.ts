import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { getDb } from "../src/lib/db";
import { migrateSchema } from "../src/lib/db/queries/schema";
import { isCatalogFullyEnriched } from "../src/lib/db/queries/enrichment";
import { OVERVIEW_INTERVAL_CONFIG } from "../src/lib/db/queries/overview";
import { getProfile } from "../src/lib/db/queries/profile";
import { hourHistogram } from "../src/lib/profile-stats";
import { PROFILE_ALBUM_PROFILE_TRACKS_LIMIT, PROFILE_RECENT_PLAYS_LIMIT } from "../src/lib/search-types";
import { loadTs } from "./helpers/load-ts";

dotenv.config({ path: ".env.local", quiet: true });

const skipWithoutDb = !process.env.DATABASE_URL;
type Db = ReturnType<typeof getDb>;

async function captureStableComparison<T>(sql: Db, label: string, run: () => Promise<T>): Promise<T> {
  const snap = async () => JSON.stringify((await sql`
    SELECT (SELECT COUNT(*)::text FROM plays) AS plays,
      (SELECT COALESCE(MAX(id), 0)::text FROM plays) AS max_play,
      (SELECT COUNT(*)::text FROM tracks) AS tracks,
      (SELECT COUNT(*)::text FROM tracks WHERE enrichment_status = 'pending') AS pending,
      (SELECT COUNT(*)::text FROM albums) AS albums;
  `)[0]);
  for (let i = 1; i <= 8; i++) {
    const before = await snap();
    const result = await run();
    if (before === (await snap())) return result;
    if (i < 8) await new Promise((r) => setTimeout(r, 150));
  }
  assert.fail(`[${label}] Shared test DB mutated across 8 read-only attempts`);
}

async function pickAlbumFixture(sql: Db) {
  const [row] = await sql`
    SELECT t.album_id, t.album_group_key,
      MAX(t.id) AS sample_track_id, MAX(t.artist_id) AS artist_id, MAX(t.artist_group_key) AS artist_group_key
    FROM tracks t JOIN plays p ON p.track_id = t.id
    WHERE t.album_id IS NOT NULL AND t.album_group_key IS NOT NULL
      AND t.artist_id IS NOT NULL AND t.artist_group_key IS NOT NULL
    GROUP BY t.album_id, t.album_group_key
    HAVING COUNT(DISTINCT t.id) <= ${PROFILE_ALBUM_PROFILE_TRACKS_LIMIT}
      AND (SELECT COUNT(DISTINCT t2.album_id) FROM tracks t2 WHERE t2.album_group_key = t.album_group_key AND t2.album_id IS NOT NULL) = 1
      AND (SELECT COUNT(DISTINCT t2.album_group_key) FROM tracks t2 WHERE t2.album_id = t.album_id AND t2.album_group_key IS NOT NULL) = 1
    ORDER BY COUNT(p.id) DESC, t.album_id ASC
    LIMIT 1;
  `;
  assert.ok(row, "expected an album with both album_id and album_group_key in test DB");
  return {
    albumId: String(row.album_id),
    albumGroupKey: String(row.album_group_key),
    sampleTrackId: String(row.sample_track_id),
    artistId: String(row.artist_id),
    artistGroupKey: String(row.artist_group_key),
  };
}

function localHours(rows: Record<string, unknown>[], tz: string): number[] {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" });
  return rows.map((r) => Number(fmt.format(new Date(r.played_at as string | Date))));
}

test("album profile DB queries", { skip: skipWithoutDb }, async (t) => {
  await migrateSchema();
  const sql = getDb();

  await t.test("active mode resolves both keys and matches raw plays, tracks, hours, rank, and cadence", async () => {
    const data = await captureStableComparison(sql, "album-active", async () => {
      const isEnriched = await isCatalogFullyEnriched();
      const fixture = await pickAlbumFixture(sql);
      const expectedKey = isEnriched ? fixture.albumId : fixture.albumGroupKey;
      const albumCol = isEnriched ? sql`t.album_id` : sql`t.album_group_key`;
      const albumFilter = isEnriched ? sql`t.album_id = ${expectedKey}` : sql`t.album_group_key = ${expectedKey}`;
      const tz = "America/Chicago";
      const time1m = sql`p.played_at >= NOW() - (${OVERVIEW_INTERVAL_CONFIG["1m"].cur})::interval`;

      const [byIdAll, byGroupAll, byId1m, rawAll, raw1m, albumTracks, [totalAll], [total1m]] = await Promise.all([
        getProfile({ kind: "album", key: fixture.albumId }, "all", tz),
        getProfile({ kind: "album", key: fixture.albumGroupKey }, "all", tz),
        getProfile({ kind: "album", key: fixture.albumId }, "1m", tz),
        sql`SELECT p.played_at FROM plays p JOIN tracks t ON t.id = p.track_id WHERE ${albumFilter}`,
        sql`SELECT p.played_at FROM plays p JOIN tracks t ON t.id = p.track_id WHERE ${albumFilter} AND ${time1m}`,
        sql`SELECT DISTINCT t.id FROM tracks t WHERE ${albumFilter}`,
        sql`SELECT COUNT(DISTINCT ${albumCol})::int AS total FROM plays p JOIN tracks t ON t.id = p.track_id WHERE ${albumCol} IS NOT NULL`,
        sql`SELECT COUNT(DISTINCT ${albumCol})::int AS total FROM plays p JOIN tracks t ON t.id = p.track_id WHERE ${time1m} AND ${albumCol} IS NOT NULL`,
      ]);
      return { isEnriched, fixture, expectedKey, tz, byIdAll, byGroupAll, byId1m, rawAll, raw1m, albumTracks, totalAll, total1m };
    });

    const { isEnriched, fixture, expectedKey, tz, byIdAll, byGroupAll, byId1m, rawAll, raw1m, albumTracks, totalAll, total1m } = data;
    assert.ok(byIdAll && byGroupAll && byId1m);
    assert.equal(byIdAll.kind, "album");
    assert.equal(byIdAll.key, expectedKey);
    assert.equal(byGroupAll.key, byIdAll.key);
    assert.equal(byGroupAll.plays, byIdAll.plays);
    assert.equal(byGroupAll.rank, byIdAll.rank);
    assert.equal(byIdAll.albumName, null);
    assert.ok(byIdAll.artistName);
    assert.equal(byIdAll.artistKey, isEnriched ? fixture.artistId : fixture.artistGroupKey);
    assert.deepEqual(byIdAll.topAlbums, []);
    assert.equal(byIdAll.trackStats, undefined);
    assert.equal(byIdAll.albumTracks, undefined);
    assert.ok(byIdAll.firstPlayedAt && byIdAll.lastPlayedAt);
    assert.ok(Date.parse(byIdAll.firstPlayedAt) <= Date.parse(byIdAll.lastPlayedAt));
    assert.equal(byId1m.firstPlayedAt, byIdAll.firstPlayedAt);
    assert.equal(byId1m.lastPlayedAt, byIdAll.lastPlayedAt);

    assert.equal(byIdAll.plays, rawAll.length);
    assert.equal(byId1m.plays, raw1m.length);
    assert.equal(byIdAll.rankedTotal, Number(totalAll.total));
    assert.equal(byId1m.rankedTotal, Number(total1m.total));
    assert.ok(byIdAll.rank != null && byIdAll.rank >= 1 && byIdAll.rank <= byIdAll.rankedTotal);
    assert.ok(byId1m.plays > 0 ? byId1m.rank != null && byId1m.rank >= 1 && byId1m.rank <= byId1m.rankedTotal : byId1m.rank === null);

    assert.ok(byIdAll.topTracks.length > 0 && byIdAll.topTracks.length <= PROFILE_ALBUM_PROFILE_TRACKS_LIMIT);
    assert.equal(byIdAll.topTracks.reduce((s, tr) => s + tr.plays, 0), byIdAll.plays);
    assert.equal(byId1m.topTracks.reduce((s, tr) => s + tr.plays, 0), byId1m.plays);
    for (let i = 1; i < byIdAll.topTracks.length; i++) {
      assert.ok(byIdAll.topTracks[i - 1].plays >= byIdAll.topTracks[i].plays);
    }

    const albumTrackIds = new Set(albumTracks.map((r) => String(r.id)));
    assert.ok(byIdAll.recentPlays.length > 0 && byIdAll.recentPlays.length <= PROFILE_RECENT_PLAYS_LIMIT);
    for (const play of byIdAll.recentPlays) assert.ok(albumTrackIds.has(play.trackId));
    for (let i = 1; i < byIdAll.recentPlays.length; i++) {
      const [prev, curr] = [byIdAll.recentPlays[i - 1], byIdAll.recentPlays[i]];
      const [pt, ct] = [Date.parse(prev.playedAt), Date.parse(curr.playedAt)];
      assert.ok(pt > ct || (pt === ct && BigInt(prev.id) > BigInt(curr.id)));
    }

    assert.deepEqual(byIdAll.hourOfDay, hourHistogram(localHours(rawAll, tz)));
    assert.equal(byIdAll.hourOfDay?.reduce((s, n) => s + n, 0), byIdAll.plays);
    assert.deepEqual(byId1m.hourOfDay, hourHistogram(localHours(raw1m, tz)));
    assert.equal(byIdAll.activityCadence.reduce((s, b) => s + b.count, 0), byIdAll.plays);
    assert.ok(byIdAll.monthlyCadence && byIdAll.monthlyCadence.length > 0);
  });

  await t.test("track albumKey, artist topAlbums key, and unknown album key", async () => {
    const { isEnriched, fixture, track, artist, unknown } = await captureStableComparison(sql, "track-artist-links", async () => {
      const isEnriched = await isCatalogFullyEnriched();
      const fixture = await pickAlbumFixture(sql);
      const artistKey = isEnriched ? fixture.artistId : fixture.artistGroupKey;
      const [track, artist, unknown] = await Promise.all([
        getProfile({ kind: "track", key: fixture.sampleTrackId }, "all", "UTC"),
        getProfile({ kind: "artist", key: artistKey }, "all", "UTC"),
        getProfile({ kind: "album", key: "unknown-album-000000000000" }, "all", "UTC"),
      ]);
      return { isEnriched, fixture, track, artist, unknown };
    });

    assert.equal(unknown, null);
    assert.equal(track?.albumKey, isEnriched ? fixture.albumId : fixture.albumGroupKey);
    assert.ok(artist && artist.topAlbums.length > 0);
    for (const album of artist.topAlbums) {
      assert.ok(album.key, `expected topAlbum "${album.name}" to have key`);
      if (isEnriched) assert.equal(album.key, album.id);
    }
  });

  await t.test("group-key mode resolves both keys and populates albumKey and topAlbums key", async () => {
    const { getProfile: getGroupKeyProfile } = loadTs("src/lib/db/queries/profile.ts", {
      "../index": { getDb },
      "./enrichment": { isCatalogFullyEnriched: async () => false },
    }) as { getProfile: typeof getProfile };

    const { fixture, byId, byGroup, rawCount, totalAlbums, track, artist, unknown } = await captureStableComparison(
      sql,
      "album-group-key",
      async () => {
        const fixture = await pickAlbumFixture(sql);
        const [byId, byGroup, [rawCount], [totalAlbums], track, artist, unknown] = await Promise.all([
          getGroupKeyProfile({ kind: "album", key: fixture.albumId }, "all", "UTC"),
          getGroupKeyProfile({ kind: "album", key: fixture.albumGroupKey }, "all", "UTC"),
          sql`SELECT COUNT(*)::int AS plays FROM plays p JOIN tracks t ON t.id = p.track_id WHERE t.album_group_key = ${fixture.albumGroupKey}`,
          sql`SELECT COUNT(DISTINCT t.album_group_key)::int AS total FROM plays p JOIN tracks t ON t.id = p.track_id WHERE t.album_group_key IS NOT NULL`,
          getGroupKeyProfile({ kind: "track", key: fixture.sampleTrackId }, "all", "UTC"),
          getGroupKeyProfile({ kind: "artist", key: fixture.artistGroupKey }, "all", "UTC"),
          getGroupKeyProfile({ kind: "album", key: "unknown-album-000000000000" }, "all", "UTC"),
        ]);
        return { fixture, byId, byGroup, rawCount, totalAlbums, track, artist, unknown };
      },
    );

    assert.equal(unknown, null);
    assert.ok(byId && byGroup);
    assert.equal(byId.kind, "album");
    assert.equal(byId.key, fixture.albumGroupKey);
    assert.equal(byGroup.key, fixture.albumGroupKey);
    assert.equal(byId.artistKey, fixture.artistGroupKey);
    assert.equal(byId.plays, Number(rawCount.plays));
    assert.equal(byGroup.plays, byId.plays);
    assert.equal(byId.rankedTotal, Number(totalAlbums.total));
    assert.ok(byId.rank != null && byId.rank >= 1 && byId.rank <= byId.rankedTotal);
    assert.equal(byId.topTracks.reduce((s, tr) => s + tr.plays, 0), byId.plays);
    assert.equal(byId.hourOfDay?.reduce((s, n) => s + n, 0), byId.plays);
    assert.equal(byId.activityCadence.reduce((s, b) => s + b.count, 0), byId.plays);
    assert.equal(track?.albumKey, fixture.albumGroupKey);
    assert.ok(artist && artist.topAlbums.length > 0);
    for (const album of artist.topAlbums) assert.ok(album.key);
    const matched = artist.topAlbums.find((a) => a.key === fixture.albumGroupKey);
    if (matched) assert.equal(matched.id, fixture.albumId);
  });
});
