import test from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../src/lib/db";
import { getOverviewData, OVERVIEW_INTERVAL_CONFIG } from "../src/lib/db/queries/overview";
import { dbTest, useTestDatabase } from "./helpers/test-db";
import { searchCatalog } from "../src/lib/db/queries/search";
import { isCatalogFullyEnriched } from "../src/lib/db/queries/enrichment";
import {
  computeCompletionRate,
  computePeakDay,
  dayOfWeekHistogram,
  hourHistogram,
  longestStreak,
} from "../src/lib/profile-stats";
import { getProfile } from "../src/lib/db/queries/profile";
import {
  PROFILE_ALBUM_TRACKS_LIMIT,
  PROFILE_RELATED_TRACKS_LIMIT,
  PROFILE_TOP_ALBUMS_LIMIT,
  PROFILE_TOP_TRACKS_LIMIT,
  SEARCH_RESULT_LIMIT,
} from "../src/lib/search-types";
import { checkSearchQuery, normalizeForSearch } from "../src/lib/search-utils";
import { loadTs } from "./helpers/load-ts";

const MAX_STABLE_SNAPSHOT_ATTEMPTS = 8;
const STABLE_SNAPSHOT_RETRY_DELAY_MS = 150;

interface DatasetSnapshot {
  playCount: string;
  maxPlayId: string;
  trackCount: string;
  pendingTrackCount: string;
  artistCount: string;
}

async function readDatasetSnapshot(sql: ReturnType<typeof getDb>): Promise<DatasetSnapshot> {
  const [row] = await sql`
    SELECT
      (SELECT COUNT(*)::text FROM plays) AS play_count,
      (SELECT COALESCE(MAX(id), 0)::text FROM plays) AS max_play_id,
      (SELECT COUNT(*)::text FROM tracks) AS track_count,
      (SELECT COUNT(*)::text FROM tracks WHERE enrichment_status = 'pending') AS pending_track_count,
      (SELECT COUNT(*)::text FROM artists) AS artist_count;
  `;
  return {
    playCount: String(row.play_count),
    maxPlayId: String(row.max_play_id),
    trackCount: String(row.track_count),
    pendingTrackCount: String(row.pending_track_count),
    artistCount: String(row.artist_count),
  };
}

function snapshotsEqual(a: DatasetSnapshot, b: DatasetSnapshot): boolean {
  return (
    a.playCount === b.playCount &&
    a.maxPlayId === b.maxPlayId &&
    a.trackCount === b.trackCount &&
    a.pendingTrackCount === b.pendingTrackCount &&
    a.artistCount === b.artistCount
  );
}

async function captureStableComparison<T>(
  sql: ReturnType<typeof getDb>,
  label: string,
  runQueries: () => Promise<T>
): Promise<T> {
  const changes: string[] = [];

  for (let attempt = 1; attempt <= MAX_STABLE_SNAPSHOT_ATTEMPTS; attempt++) {
    const before = await readDatasetSnapshot(sql);
    const result = await runQueries();
    const after = await readDatasetSnapshot(sql);

    if (snapshotsEqual(before, after)) {
      return result;
    }

    changes.push(
      `attempt ${attempt}: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`
    );

    if (attempt < MAX_STABLE_SNAPSHOT_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, STABLE_SNAPSHOT_RETRY_DELAY_MS));
    }
  }

  assert.fail(
    `[${label}] Shared test DB mutated across all ${MAX_STABLE_SNAPSHOT_ATTEMPTS} read-only attempts:\n${changes.join("\n")}`
  );
}

test("search and profile DB queries", dbTest, async (t) => {
  await useTestDatabase();
  const sql = getDb();

  await t.test("ranks and plays match Overview for 1w and all", async () => {
    for (const range of ["1w", "all"] as const) {
      const { trackPairs, artistPairs } = await captureStableComparison(
        sql,
        `ranks-and-plays-${range}`,
        async () => {
          const overview = await getOverviewData(range, "UTC");
          const tracksToCheck = overview.topTracks.slice(0, 3);
          const trackProfiles = await Promise.all(
            tracksToCheck.map((track) => getProfile({ kind: "track", key: track.id }, range, "UTC"))
          );
          const trackPairs = tracksToCheck.map((track, idx) => ({
            track,
            profile: trackProfiles[idx],
          }));

          const topArtists = overview.topArtists;
          const artistCandidates: Array<{
            index: number;
            artist: (typeof topArtists)[number];
          }> = [];
          for (let i = 0; i < Math.min(3, topArtists.length); i++) {
            const artist = topArtists[i];
            if (!artist.id) continue;

            const prevTies =
              i > 0 &&
              topArtists[i - 1].count === artist.count &&
              topArtists[i - 1].name === artist.name;
            const nextTies =
              i + 1 < topArtists.length &&
              topArtists[i + 1].count === artist.count &&
              topArtists[i + 1].name === artist.name;
            if (prevTies || nextTies) continue;

            artistCandidates.push({ index: i, artist });
          }

          const artistProfiles = await Promise.all(
            artistCandidates.map(({ artist }) =>
              getProfile({ kind: "artist", key: artist.id! }, range, "UTC")
            )
          );
          const artistPairs = artistCandidates.map((candidate, idx) => ({
            ...candidate,
            profile: artistProfiles[idx],
          }));

          return { trackPairs, artistPairs };
        }
      );

      const assertStreakDates = (stats: {
        longestStreakDays: number;
        longestStreakStart: string | null;
        longestStreakEnd: string | null;
      }) => {
        if (stats.longestStreakDays === 0) {
          assert.equal(stats.longestStreakStart, null);
          assert.equal(stats.longestStreakEnd, null);
        } else {
          assert.equal(typeof stats.longestStreakStart, "string");
          assert.equal(typeof stats.longestStreakEnd, "string");
          assert.ok(stats.longestStreakStart! <= stats.longestStreakEnd!);
          const spanDays =
            (Date.parse(stats.longestStreakEnd!) - Date.parse(stats.longestStreakStart!)) / 86_400_000 + 1;
          assert.equal(spanDays, stats.longestStreakDays);
        }
      };

      for (const { track, profile } of trackPairs) {
        assert.ok(profile, `expected track profile for ${track.id} in ${range}`);
        assert.equal(profile.kind, "track");
        assert.equal(profile.key, track.id);
        assert.equal(profile.plays, track.plays);
        assert.equal(profile.rank, Number(track.rank));
        assert.ok(profile.rankedTotal >= (profile.rank ?? 0));
        assert.ok(profile.stats);
        assertStreakDates(profile.stats);
      }

      for (const { index: i, artist, profile } of artistPairs) {
        assert.ok(profile, `expected artist profile for ${artist.id} in ${range}`);
        assert.equal(profile.kind, "artist");
        assert.equal(profile.plays, artist.count);
        assert.equal(profile.rank, i + 1);
        assert.ok(profile.rankedTotal >= (profile.rank ?? 0));
        assert.ok(profile.stats);
        assertStreakDates(profile.stats);
        if (profile.plays > 0) {
          assert.equal(typeof profile.stats.playShare, "number");
          assert.ok(profile.stats.playShare! > 0 && profile.stats.playShare! <= 1);
        } else {
          assert.equal(profile.stats.playShare, null);
        }
        assert.equal(typeof profile.stats.tracksHeardInRange, "number");
        assert.equal(typeof profile.stats.tracksHeardLifetime, "number");
        assert.ok(profile.stats.tracksHeardInRange! <= profile.stats.tracksHeardLifetime!);
        assert.ok(
          profile.stats.completionRate === null ||
            (typeof profile.stats.completionRate === "number" &&
              profile.stats.completionRate >= 0 &&
              profile.stats.completionRate <= 1),
        );
      }
    }
  });

  await t.test("artist profile resolves both artist_id and artist_group_key to the same canonical profile", async () => {
    const { rows, byId, byGroupKey } = await captureStableComparison(
      sql,
      "artist-key-forms",
      async () => {
        const rows = await sql`
          SELECT t.artist_id, t.artist_group_key
          FROM tracks t
          JOIN plays p ON p.track_id = t.id
          WHERE t.artist_id IS NOT NULL
            AND t.artist_group_key IS NOT NULL
          GROUP BY t.artist_id, t.artist_group_key
          HAVING (
            SELECT COUNT(DISTINCT t2.artist_id)
            FROM tracks t2
            WHERE t2.artist_group_key = t.artist_group_key
              AND t2.artist_id IS NOT NULL
          ) = 1
          ORDER BY COUNT(p.id) DESC
          LIMIT 1;
        `;
        if (rows.length === 0) {
          return { rows, byId: null, byGroupKey: null };
        }

        const { artist_id: artistId, artist_group_key: groupKey } = rows[0] as {
          artist_id: string;
          artist_group_key: string;
        };

        const [byId, byGroupKey] = await Promise.all([
          getProfile({ kind: "artist", key: artistId }, "all", "UTC"),
          getProfile({ kind: "artist", key: groupKey }, "all", "UTC"),
        ]);
        return { rows, byId, byGroupKey };
      }
    );

    assert.ok(rows.length > 0, "expected at least one enriched artist with artist_group_key");
    assert.ok(byId);
    assert.ok(byGroupKey);
    assert.equal(byId.key, byGroupKey.key);
    assert.equal(byId.plays, byGroupKey.plays);
    assert.equal(byId.name, byGroupKey.name);
  });

  await t.test("overview profile keys open the matching profiles", async () => {
    const overview = await getOverviewData("all", "UTC");
    const track = overview.topTracks[0];
    const artist = overview.topArtists[0];
    const album = overview.topAlbums[0];
    assert.ok(track && artist && album, "expected overview top lists");
    assert.ok(track.artistKey && track.albumKey && artist.key && album.key && album.artistKey);

    const [trackArtist, trackAlbum, artistProfile, albumProfile, albumArtist] = await Promise.all([
      getProfile({ kind: "artist", key: track.artistKey }, "all", "UTC"),
      getProfile({ kind: "album", key: track.albumKey }, "all", "UTC"),
      getProfile({ kind: "artist", key: artist.key }, "all", "UTC"),
      getProfile({ kind: "album", key: album.key }, "all", "UTC"),
      getProfile({ kind: "artist", key: album.artistKey }, "all", "UTC"),
    ]);
    assert.equal(trackArtist?.name, track.artist);
    assert.equal(trackAlbum?.name, track.album);
    assert.equal(artistProfile?.name, artist.name);
    assert.equal(artistProfile?.plays, artist.count);
    assert.equal(albumProfile?.name, album.name);
    assert.equal(albumProfile?.plays, album.count);
    assert.equal(albumArtist?.name, album.artist);
  });

  await t.test("lifetime fields, recentPlays order/limit, and artist lists", async () => {
    const { overviewAll, topArtist, track1d, trackAll, artist1d, artistAll } =
      await captureStableComparison(sql, "lifetime-fields-and-lists", async () => {
        const overviewAll = await getOverviewData("all", "UTC");
        const topTrack = overviewAll.topTracks[0];
        const topArtist = overviewAll.topArtists.find((a) => Boolean(a.id));

        const [track1d, trackAll, artist1d, artistAll] = await Promise.all([
          topTrack ? getProfile({ kind: "track", key: topTrack.id }, "1d", "UTC") : null,
          topTrack ? getProfile({ kind: "track", key: topTrack.id }, "all", "UTC") : null,
          topArtist?.id ? getProfile({ kind: "artist", key: topArtist.id }, "1d", "UTC") : null,
          topArtist?.id ? getProfile({ kind: "artist", key: topArtist.id }, "all", "UTC") : null,
        ]);

        return { overviewAll, topArtist, track1d, trackAll, artist1d, artistAll };
      });

    assert.ok(overviewAll.topTracks.length > 0, "expected top tracks in all-time overview");
    assert.ok(overviewAll.topArtists.length > 0, "expected top artists in all-time overview");

    assert.ok(track1d);
    assert.ok(trackAll);
    assert.ok(trackAll.firstPlayedAt);
    assert.ok(trackAll.lastPlayedAt);
    assert.equal(track1d.firstPlayedAt, trackAll.firstPlayedAt);
    assert.equal(track1d.lastPlayedAt, trackAll.lastPlayedAt);
    assert.ok(Date.parse(trackAll.firstPlayedAt) <= Date.parse(trackAll.lastPlayedAt));
    assert.equal(trackAll.topTracks.length, 0);
    assert.equal(trackAll.topAlbums.length, 0);
    // Main's 1d cadence has 25 hourly buckets unless now falls exactly on the hour.
    assert.ok([24, 25].includes(track1d.activityCadence.length));
    assert.equal(
      track1d.activityCadence.reduce((sum, b) => sum + b.count, 0),
      track1d.plays,
      "scoped 1d cadence counts only this track's plays in range"
    );
    assert.ok(trackAll.recentPlays.length > 0);
    assert.equal(trackAll.recentPlays.length, trackAll.plays, "recentPlays lists every Play in range");

    for (let i = 1; i < trackAll.recentPlays.length; i++) {
      const prev = trackAll.recentPlays[i - 1];
      const curr = trackAll.recentPlays[i];
      const prevTime = Date.parse(prev.playedAt);
      const currTime = Date.parse(curr.playedAt);
      assert.ok(
        prevTime > currTime || (prevTime === currTime && BigInt(prev.id) > BigInt(curr.id)),
        "expected recentPlays ordered by played_at DESC, id DESC"
      );
    }

    assert.ok(topArtist?.id, "expected an all-time top artist with id");
    assert.ok(artist1d);
    assert.ok(artistAll);
    assert.equal(artistAll.artistName, null);
    assert.equal(artistAll.albumName, null);
    assert.equal(artist1d.firstPlayedAt, artistAll.firstPlayedAt);
    assert.equal(artist1d.lastPlayedAt, artistAll.lastPlayedAt);
    assert.ok(artistAll.topTracks.length > 0);
    assert.ok(artistAll.topTracks.length <= PROFILE_TOP_TRACKS_LIMIT);
    assert.ok(artistAll.topAlbums.length > 0);
    assert.ok(artistAll.topAlbums.length <= PROFILE_TOP_ALBUMS_LIMIT);
    assert.equal(artistAll.recentPlays.length, artistAll.plays, "recentPlays lists every Play in range");
    assert.ok([24, 25].includes(artist1d.activityCadence.length));
    assert.equal(
      artist1d.activityCadence.reduce((sum, b) => sum + b.count, 0),
      artist1d.plays,
      "scoped 1d cadence counts only this artist's plays in range"
    );

    for (let i = 1; i < artistAll.topTracks.length; i++) {
      assert.ok(artistAll.topTracks[i - 1].plays >= artistAll.topTracks[i].plays);
    }
    for (let i = 1; i < artistAll.topAlbums.length; i++) {
      assert.ok(artistAll.topAlbums[i - 1].plays >= artistAll.topAlbums[i].plays);
    }
  });

  await t.test("Track stats match raw plays by range and local time", async () => {
    const comparisons = await captureStableComparison(sql, "track-story", async () => {
      const [{ id }] = await sql`
        SELECT track_id AS id FROM plays GROUP BY track_id
        ORDER BY COUNT(*) DESC, track_id LIMIT 1;
      `;
      const enriched = await isCatalogFullyEnriched();

      return Promise.all((["all", "1m"] as const).map(async (range) => {
        const timeFilter = range === "all" ? sql`TRUE` :
          sql`p.played_at >= NOW() - (${OVERVIEW_INTERVAL_CONFIG[range].cur})::interval`;
        const orderedPlays = await sql`
          SELECT p.id::text, p.track_id, p.played_at
          FROM plays p
          WHERE ${timeFilter}
          ORDER BY p.played_at ASC, p.id ASC;
        `;
        const coPlayCounts = new Map<string, number>();
        for (let i = 0; i < orderedPlays.length; i++) {
          if (String(orderedPlays[i].track_id) !== id) continue;
          const currMs = Date.parse(String(orderedPlays[i].played_at));
          if (i > 0) {
            const prevId = String(orderedPlays[i - 1].track_id);
            const prevMs = Date.parse(String(orderedPlays[i - 1].played_at));
            if (prevId !== id && currMs - prevMs <= 30 * 60 * 1000) {
              coPlayCounts.set(prevId, (coPlayCounts.get(prevId) ?? 0) + 1);
            }
          }
          if (i + 1 < orderedPlays.length) {
            const nextId = String(orderedPlays[i + 1].track_id);
            const nextMs = Date.parse(String(orderedPlays[i + 1].played_at));
            if (nextId !== id && nextMs - currMs <= 30 * 60 * 1000) {
              coPlayCounts.set(nextId, (coPlayCounts.get(nextId) ?? 0) + 1);
            }
          }
        }
        const neighborIds = [...coPlayCounts.keys()];
        const neighborMeta = neighborIds.length > 0
          ? await sql`
              SELECT t.id, t.name, COALESCE(ar.name, t.artist_name, '') AS artist, al.image_url AS album_image_url
              FROM tracks t
              LEFT JOIN artists ar ON t.artist_id = ar.id
              LEFT JOIN albums al ON t.album_id = al.id
              WHERE t.id = ANY(${neighborIds});
            `
          : [];
        const expectedRelated = neighborMeta
          .map((row) => ({
            id: String(row.id),
            name: String(row.name),
            artist: String(row.artist),
            albumImageUrl: (row.album_image_url as string | null) ?? null,
            coPlays: coPlayCounts.get(String(row.id)) ?? 0,
          }))
          .sort((a, b) =>
            b.coPlays - a.coPlays ||
            (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) ||
            (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
          )
          .slice(0, PROFILE_RELATED_TRACKS_LIMIT);

        return Promise.all(["UTC", "America/Chicago"].map(async (tz) => {
          const [profile, rawPlays, [identity]] = await Promise.all([
            getProfile({ kind: "track", key: id }, range, tz),
            sql`
              SELECT p.id::text, p.played_at, p.ms_played, t.duration_ms
              FROM plays p JOIN tracks t ON t.id = p.track_id
              WHERE p.track_id = ${id} AND ${timeFilter}
            `,
            sql`SELECT artist_id, artist_group_key, album_id, album_group_key FROM tracks WHERE id = ${id}`,
          ]);
          const artistKey = enriched ? identity.artist_id : identity.artist_group_key;
          const artist = artistKey == null ? null : await getProfile({ kind: "artist", key: artistKey }, range, tz);
          const albumFilter = enriched
            ? identity.album_id != null
              ? sql`t.album_id = ${identity.album_id}`
              : null
            : identity.album_group_key != null
              ? sql`t.album_group_key = ${identity.album_group_key}`
              : null;
          const [siblings, albumPlayRows] = albumFilter
            ? await Promise.all([
                sql`
                  SELECT t.id, t.name, COUNT(*)::int AS plays
                  FROM tracks t JOIN plays p ON p.track_id = t.id
                  WHERE ${timeFilter} AND ${albumFilter}
                  GROUP BY t.id, t.name ORDER BY plays DESC, t.name ASC, t.id ASC
                  LIMIT ${PROFILE_ALBUM_TRACKS_LIMIT};
                `,
                sql`
                  SELECT COUNT(*)::int AS plays
                  FROM tracks t JOIN plays p ON p.track_id = t.id
                  WHERE ${timeFilter} AND ${albumFilter};
                `,
              ])
            : [[], []];
          return {
            id,
            range,
            tz,
            profile,
            rawPlays,
            artist,
            siblings,
            albumPlays: Number(albumPlayRows[0]?.plays ?? 0),
            expectedRelated,
          };
        }));
      })).then((groups) => groups.flat());
    });

    const weekdayToIso: Record<string, number> = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
    };

    for (const { id, range, tz, profile, rawPlays, artist, siblings, albumPlays, expectedRelated } of comparisons) {
      assert.ok(profile?.trackStats);
      assert.ok(profile.hourOfDay);
      assert.ok(profile.dayOfWeek);
      assert.ok(profile.stats);
      assert.ok(Array.isArray(profile.relatedTracks));
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", hourCycle: "h23", weekday: "short",
      });
      const local = rawPlays.map(({ played_at }) => {
        const parts = Object.fromEntries(formatter.formatToParts(new Date(played_at))
          .map(({ type, value }) => [type, value]));
        return {
          day: `${parts.year}-${parts.month}-${parts.day}`,
          hour: Number(parts.hour),
          isoDow: weekdayToIso[parts.weekday],
        };
      });
      const dayCounts = new Map<string, number>();
      for (const { day } of local) dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
      const dayList = [...dayCounts.entries()].map(([date, plays]) => ({ date, plays }));
      const expectedTotalMs = rawPlays.reduce((sum, r) => sum + Number(r.ms_played ?? 0), 0);
      const expectedCompletion = computeCompletionRate(
        rawPlays.map((r) => ({ msPlayed: Number(r.ms_played ?? 0), durationMs: Number(r.duration_ms ?? 0) })),
      );

      assert.equal(profile.plays, rawPlays.length);
      assert.deepEqual(profile.hourOfDay, hourHistogram(local.map(({ hour }) => hour)));
      assert.equal(profile.hourOfDay.reduce((sum, count) => sum + count, 0), profile.plays);
      assert.equal(profile.dayOfWeek.length, 7);
      assert.deepEqual(profile.dayOfWeek, dayOfWeekHistogram(local.map(({ isoDow }) => isoDow)));
      assert.equal(profile.dayOfWeek.reduce((sum, count) => sum + count, 0), profile.plays);
      assert.equal(profile.trackStats.longestStreakDays, longestStreak(local.map(({ day }) => day)));
      assert.equal(profile.trackStats.artistPlays, artist?.plays ?? 0);
      assert.equal(profile.trackStats.artistShare, profile.plays && artist?.plays ? profile.plays / artist.plays : null);
      assert.equal(profile.stats.totalMs, expectedTotalMs);
      assert.equal(profile.stats.activeDays, dayList.length);
      assert.equal(profile.stats.longestStreakDays, profile.trackStats.longestStreakDays);
      assert.deepEqual(profile.stats.peakDay, computePeakDay(dayList));
      if (expectedCompletion === null) {
        assert.equal(profile.stats.completionRate, null);
      } else {
        assert.ok(
          profile.stats.completionRate != null &&
            Math.abs(profile.stats.completionRate - expectedCompletion) < 1e-9,
          `expected completionRate ${profile.stats.completionRate} ≈ ${expectedCompletion}`
        );
      }
      assert.equal(profile.stats.artistPlays, artist?.plays ?? 0);
      assert.equal(profile.stats.artistShare, profile.trackStats.artistShare);
      assert.equal(profile.stats.albumPlays, albumPlays);
      assert.equal(profile.stats.albumShare, profile.plays && albumPlays ? profile.plays / albumPlays : null);
      if (range === "all") {
        assert.ok(expectedRelated.length > 0, "expected nonempty relatedTracks on configured archive");
      }
      assert.deepEqual(profile.relatedTracks, expectedRelated);
      const rawMsById = new Map(rawPlays.map((r) => [String(r.id), Number(r.ms_played ?? 0)]));
      for (const play of profile.recentPlays) {
        assert.equal(play.msPlayed, rawMsById.get(play.id));
      }
      assert.deepEqual(profile.albumTracks, siblings.map((row) => ({
        id: row.id, name: row.name, plays: row.plays, isCurrent: row.id === id,
      })));
    }
  });

  await t.test("Artist hours match a recount by range and local time", async () => {
    for (const range of ["all", "1m"] as const) {
      for (const tz of ["UTC", "America/Chicago"]) {
        const { profile, rawPlays, track } = await captureStableComparison(
          sql, `artist-hours-${range}-${tz}`, async () => {
            const overview = await getOverviewData(range, tz);
            const key = overview.topArtists.find((artist) => artist.id)?.id;
            assert.ok(key);
            const profile = await getProfile({ kind: "artist", key }, range, tz);
            assert.ok(profile?.topTracks[0]);
            const enriched = await isCatalogFullyEnriched();
            const artistFilter = enriched
              ? sql`t.artist_id = ${profile.key}`
              : sql`t.artist_group_key = ${profile.key}`;
            const timeFilter = range === "all" ? sql`TRUE` :
              sql`p.played_at >= NOW() - (${OVERVIEW_INTERVAL_CONFIG[range].cur})::interval`;
            const [rawPlays, track] = await Promise.all([
              sql`SELECT p.id::text, p.played_at, p.ms_played FROM plays p JOIN tracks t ON t.id = p.track_id
                  WHERE ${artistFilter} AND ${timeFilter}`,
              getProfile({ kind: "track", key: profile.topTracks[0].id }, range, tz),
            ]);
            return { profile, rawPlays, track };
          },
        );
        const formatter = new Intl.DateTimeFormat("en-GB", {
          timeZone: tz, hour: "2-digit", hourCycle: "h23",
        });
        assert.ok(profile.hourOfDay);
        assert.ok(profile.dayOfWeek);
        assert.ok(profile.stats);
        assert.deepEqual(profile.hourOfDay, hourHistogram(rawPlays.map(({ played_at }) =>
          Number(formatter.format(new Date(played_at)))
        )));
        assert.equal(profile.hourOfDay.reduce((sum, count) => sum + count, 0), profile.plays);
        assert.equal(profile.dayOfWeek.length, 7);
        assert.equal(profile.dayOfWeek.reduce((sum, count) => sum + count, 0), profile.plays);
        const expectedTotalMs = rawPlays.reduce((sum, r) => sum + Number(r.ms_played ?? 0), 0);
        assert.equal(profile.stats.totalMs, expectedTotalMs);
        assert.ok(profile.stats.activeDays > 0);
        assert.ok(profile.stats.longestStreakDays > 0);
        assert.ok(profile.stats.peakDay && profile.stats.peakDay.plays > 0);
        const rawMsById = new Map(rawPlays.map((r) => [String(r.id), Number(r.ms_played ?? 0)]));
        for (const play of profile.recentPlays) {
          assert.equal(play.msPlayed, rawMsById.get(play.id));
        }
        assert.equal(track?.trackStats?.artistPlays, profile.plays);
      }
    }
  });

  await t.test("Track stats are empty when the range has no plays", async () => {
    const profile = await captureStableComparison(sql, "track-story-empty-range", async () => {
      const [track] = await sql`
        SELECT track_id AS id FROM plays GROUP BY track_id
        HAVING MAX(played_at) < NOW() - INTERVAL '24 hours'
        ORDER BY MAX(played_at) ASC LIMIT 1;
      `;
      return track ? getProfile({ kind: "track", key: track.id }, "1d", "America/Chicago") : null;
    });

    assert.ok(profile);
    assert.equal(profile.plays, 0);
    assert.ok(profile.trackStats);
    assert.equal(profile.trackStats.artistShare, null);
    assert.equal(profile.trackStats.longestStreakDays, 0);
    assert.deepEqual(profile.hourOfDay, Array(24).fill(0));
    assert.deepEqual(profile.dayOfWeek, Array(7).fill(0));
    assert.ok(profile.stats);
    assert.equal(profile.stats.totalMs, 0);
    assert.equal(profile.stats.activeDays, 0);
    assert.equal(profile.stats.longestStreakDays, 0);
    assert.equal(profile.stats.peakDay, null);
    assert.equal(profile.stats.completionRate, null);
    assert.deepEqual(profile.relatedTracks, []);
  });

  await t.test("Track albumFilter uses album_group_key in group-key mode", async () => {
    const { getProfile: getGroupKeyProfile } = loadTs("src/lib/db/queries/profile.ts", {
      "../index": { getDb },
      "./enrichment": { isCatalogFullyEnriched: async () => false },
    }) as { getProfile: typeof getProfile };

    const { profile, albumPlays } = await captureStableComparison(sql, "track-dual-phase-album-filter", async () => {
      const [row] = await sql`
        SELECT t.id, t.album_group_key
        FROM tracks t JOIN plays p ON p.track_id = t.id
        WHERE t.album_group_key IS NOT NULL
        GROUP BY t.id, t.album_group_key
        ORDER BY COUNT(p.id) DESC, t.id ASC
        LIMIT 1;
      `;
      assert.ok(row, "expected a track with album_group_key");
      const [profile, [countRow]] = await Promise.all([
        getGroupKeyProfile({ kind: "track", key: String(row.id) }, "all", "UTC"),
        sql`
          SELECT COUNT(*)::int AS plays
          FROM plays p JOIN tracks t ON t.id = p.track_id
          WHERE t.album_group_key = ${row.album_group_key};
        `,
      ]);
      return { profile, albumPlays: Number(countRow.plays) };
    });

    assert.ok(profile?.stats);
    assert.equal(profile.stats.albumPlays, albumPlays);
    assert.equal(profile.stats.albumShare, profile.plays > 0 && albumPlays > 0 ? profile.plays / albumPlays : null);
  });

  await t.test("searchCatalog handles case, substrings, accents, and escaped wildcards", async () => {
    const {
      topArtist,
      exact,
      upper,
      sub,
      subRes,
      accented,
      accentedRes,
      wildcardResults,
    } = await captureStableComparison(sql, "search-catalog", async () => {
      const overviewAll = await getOverviewData("all", "UTC");
      const topArtist = overviewAll.topArtists[0];
      if (!topArtist) {
        return {
          topArtist: undefined,
          exact: null,
          upper: null,
          sub: "",
          subRes: null,
          accented: null,
          accentedRes: null,
          wildcardResults: [] as Array<{ query: string; res: Awaited<ReturnType<typeof searchCatalog>> }>,
        };
      }

      const sub = [...topArtist.name].slice(0, Math.min(3, [...topArtist.name].length)).join("");

      const [exact, upper, subRes, accentedRows, ...wildcards] = await Promise.all([
        searchCatalog(topArtist.name),
        searchCatalog(topArtist.name.toUpperCase()),
        checkSearchQuery(sub).ok ? searchCatalog(sub) : Promise.resolve(null),
        sql`
          WITH track_plays AS (
            SELECT t.id, t.name, t.name_search, t.artist_name_search,
              MAX(ar.name_search) AS ar_name_search, COUNT(p.id)::int AS plays
            FROM tracks t
            JOIN plays p ON p.track_id = t.id
            LEFT JOIN artists ar ON t.artist_id = ar.id
            GROUP BY t.id, t.name, t.name_search, t.artist_name_search
          )
          SELECT tp.id, tp.name, tp.name_search, tp.plays
          FROM track_plays tp
          WHERE tp.name_search IS DISTINCT FROM lower(tp.name)
            AND char_length(tp.name_search) >= 2
            AND char_length(tp.name_search) <= 100
            AND (
              SELECT COUNT(*)
              FROM track_plays tp2
              WHERE (tp2.name_search LIKE '%' || replace(replace(replace(tp.name_search, '!', '!!'), '%', '!%'), '_', '!_') || '%' ESCAPE '!'
                  OR tp2.artist_name_search LIKE '%' || replace(replace(replace(tp.name_search, '!', '!!'), '%', '!%'), '_', '!_') || '%' ESCAPE '!'
                  OR tp2.ar_name_search LIKE '%' || replace(replace(replace(tp.name_search, '!', '!!'), '%', '!%'), '_', '!_') || '%' ESCAPE '!')
                AND (tp2.plays > tp.plays OR (tp2.plays = tp.plays AND tp2.name <= tp.name))
            ) <= 8
          ORDER BY tp.plays DESC, tp.name ASC
          LIMIT 1;
        `,
        ...["%%", "__", "％％", "＿＿"].map(async (query) => ({
          query,
          res: await searchCatalog(query),
        })),
      ]);

      const accented =
        accentedRows.length > 0
          ? (accentedRows[0] as { id: string; name: string; name_search: string })
          : null;
      const accentedRes =
        accented && checkSearchQuery(accented.name_search).ok
          ? await searchCatalog(accented.name_search)
          : null;

      return {
        topArtist,
        exact,
        upper,
        sub,
        subRes,
        accented,
        accentedRes,
        wildcardResults: wildcards,
      };
    });

    assert.ok(topArtist, "expected #1 all-time artist");
    assert.ok(exact);
    assert.equal(exact.query, topArtist.name);
    assert.ok(exact.artists.length <= SEARCH_RESULT_LIMIT);
    assert.ok(exact.tracks.length <= SEARCH_RESULT_LIMIT);
    assert.ok(
      exact.artists.some((a) => a.name === topArtist.name),
      "exact search should include #1 artist"
    );
    assert.ok(
      exact.tracks.some((tr) => tr.artist === topArtist.name),
      "searching the #1 artist's name should list that artist's tracks"
    );

    assert.ok(upper);
    assert.ok(
      upper.artists.some((a) => a.name === topArtist.name),
      "uppercase search should include #1 artist"
    );

    if (subRes) {
      assert.ok(
        subRes.artists.some((a) => a.name === topArtist.name),
        `substring search (${sub}) should include #1 artist`
      );
    }

    if (accented && accentedRes) {
      assert.ok(
        accentedRes.tracks.some((tr) => tr.id === accented.id),
        `normalized search for "${accented.name_search}" should include track "${accented.name}"`
      );
    }

    for (const { query, res } of wildcardResults) {
      const wildcard = normalizeForSearch(query);
      for (const a of res.artists) {
        assert.ok(normalizeForSearch(a.name).includes(wildcard));
      }
      for (const tr of res.tracks) {
        assert.ok(
          normalizeForSearch(tr.name).includes(wildcard) ||
            normalizeForSearch(tr.artist).includes(wildcard)
        );
      }
    }
  });

  await t.test("getProfile returns null for unknown targets", async () => {
    const unknownTrack = await getProfile(
      { kind: "track", key: "unknown-track-000000000000" },
      "all",
      "UTC"
    );
    const unknownArtist = await getProfile(
      { kind: "artist", key: "unknown-artist-000000000000" },
      "1w",
      "UTC"
    );

    assert.equal(unknownTrack, null);
    assert.equal(unknownArtist, null);
  });
});
