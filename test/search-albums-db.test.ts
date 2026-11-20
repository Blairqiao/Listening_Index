import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { getDb } from "../src/lib/db";
import { migrateSchema } from "../src/lib/db/queries/schema";
import { getRandomProfileTarget, searchCatalog } from "../src/lib/db/queries/search";
import { isCatalogFullyEnriched } from "../src/lib/db/queries/enrichment";
import {
  SEARCH_SIDE_ROWS,
  SEARCH_SINGLE_TYPE_ROWS,
  SEARCH_TRACK_ROWS,
  type SearchResponse,
} from "../src/lib/search-types";
import { loadTs } from "./helpers/load-ts";

dotenv.config({ path: ".env.local", quiet: true });

const skipWithoutDb = !process.env.DATABASE_URL;
const MAX_SNAPSHOT_ATTEMPTS = 8;
const SNAPSHOT_RETRY_MS = 150;
const PAGING_QUERY = "the";

type Db = ReturnType<typeof getDb>;

async function captureStableComparison<T>(sql: Db, label: string, run: () => Promise<T>): Promise<T> {
  const readSnap = async () => {
    const [row] = await sql`
      SELECT
        (SELECT COUNT(*)::text FROM plays) AS plays,
        (SELECT COALESCE(MAX(id), 0)::text FROM plays) AS max_play,
        (SELECT COUNT(*)::text FROM tracks) AS tracks,
        (SELECT COUNT(*)::text FROM tracks WHERE enrichment_status = 'pending') AS pending,
        (SELECT COUNT(*)::text FROM artists) AS artists,
        (SELECT COUNT(*)::text FROM albums) AS albums;
    `;
    return JSON.stringify(row);
  };

  const changes: string[] = [];
  for (let attempt = 1; attempt <= MAX_SNAPSHOT_ATTEMPTS; attempt++) {
    const before = await readSnap();
    const result = await run();
    const after = await readSnap();
    if (before === after) return result;
    changes.push(`attempt ${attempt}: before=${before} after=${after}`);
    if (attempt < MAX_SNAPSHOT_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, SNAPSHOT_RETRY_MS));
    }
  }
  assert.fail(`[${label}] Shared test DB mutated across ${MAX_SNAPSHOT_ATTEMPTS} attempts:\n${changes.join("\n")}`);
}

function assertPageBounds(res: SearchResponse, context: string): void {
  assert.ok(res.tracks.length <= SEARCH_TRACK_ROWS, `${context}: tracks ${res.tracks.length} > ${SEARCH_TRACK_ROWS}`);
  const maxSide = res.artists.length > 0 && res.albums.length > 0 ? SEARCH_SIDE_ROWS : SEARCH_SIDE_ROWS + 1;
  assert.ok(
    res.artists.length + res.albums.length <= maxSide,
    `${context}: artists (${res.artists.length}) + albums (${res.albums.length}) > ${maxSide}`,
  );
}

async function walkPages(searchFn: typeof searchCatalog, query: string, label: string) {
  const pages: SearchResponse[] = [];
  const artistKeys = new Set<string>();
  const albumKeys = new Set<string>();
  const trackIds = new Set<string>();
  const addUnique = (set: Set<string>, key: string, kind: string, page: number) => {
    assert.ok(!set.has(key), `${label}: duplicate ${kind} ${key} on page ${page}`);
    set.add(key);
  };

  for (let page = 1; page <= 40; page++) {
    const res = await searchFn(query, "most-plays", page);
    assertPageBounds(res, `${label} page ${page}`);
    for (const a of res.artists) addUnique(artistKeys, a.key, "artist", page);
    for (const al of res.albums) addUnique(albumKeys, al.key, "album", page);
    for (const tr of res.tracks) addUnique(trackIds, tr.id, "track", page);
    pages.push(res);
    if (!res.hasMore) break;
  }

  assert.equal(pages.at(-1)?.hasMore, false, `${label}: expected final page hasMore = false`);
  return { pages, artistKeys, albumKeys, trackIds };
}

async function queryTopAlbum(sql: Db, isEnriched: boolean) {
  const keyCol = isEnriched ? sql`t.album_id` : sql`t.album_group_key`;
  const matchCol = isEnriched ? sql`al.name` : sql`t.album_name`;
  const [row] = await sql`
    SELECT ${keyCol} AS key, MAX(${matchCol}) AS match_name,
      COALESCE(MAX(al.name), MAX(t.album_name), '') AS name,
      COALESCE(MAX(ar.name), MAX(t.artist_name), '') AS artist,
      MAX(al.image_url) AS image_url, COUNT(p.id)::int AS plays
    FROM plays p JOIN tracks t ON p.track_id = t.id
    LEFT JOIN albums al ON t.album_id = al.id LEFT JOIN artists ar ON t.artist_id = ar.id
    WHERE ${keyCol} IS NOT NULL
    GROUP BY ${keyCol}
    HAVING char_length(trim(COALESCE(MAX(${matchCol}), ''))) BETWEEN 2 AND 100
    ORDER BY plays DESC, name ASC, key ASC LIMIT 1;
  `;
  assert.ok(row, "expected at least one played album in test DB");
  return {
    key: String(row.key),
    matchName: String(row.match_name),
    name: String(row.name),
    artist: String(row.artist),
    imageUrl: (row.image_url as string | null) ?? null,
    plays: Number(row.plays),
  };
}

async function expectedKeysForQuery(sql: Db, isEnriched: boolean, likePattern: string) {
  const [artistRows, albumRows, trackRows] = await Promise.all([
    isEnriched
      ? sql`SELECT DISTINCT t.artist_id AS key FROM plays p JOIN tracks t ON p.track_id = t.id JOIN artists ar ON t.artist_id = ar.id WHERE ar.name_search LIKE ${likePattern};`
      : sql`SELECT t.artist_group_key AS key FROM plays p JOIN tracks t ON p.track_id = t.id LEFT JOIN artists ar ON t.artist_id = ar.id WHERE t.artist_group_key IS NOT NULL GROUP BY t.artist_group_key HAVING bool_or(t.artist_name_search LIKE ${likePattern} OR ar.name_search LIKE ${likePattern});`,
    isEnriched
      ? sql`SELECT t.album_id AS key FROM plays p JOIN tracks t ON p.track_id = t.id LEFT JOIN albums al ON t.album_id = al.id LEFT JOIN artists ar ON t.artist_id = ar.id WHERE t.album_id IS NOT NULL GROUP BY t.album_id HAVING bool_or(al.name_search LIKE ${likePattern} OR ar.name_search LIKE ${likePattern} OR t.artist_name_search LIKE ${likePattern});`
      : sql`SELECT t.album_group_key AS key FROM plays p JOIN tracks t ON p.track_id = t.id LEFT JOIN albums al ON t.album_id = al.id LEFT JOIN artists ar ON t.artist_id = ar.id WHERE t.album_group_key IS NOT NULL GROUP BY t.album_group_key HAVING bool_or(t.album_name_search LIKE ${likePattern} OR al.name_search LIKE ${likePattern} OR t.artist_name_search LIKE ${likePattern} OR ar.name_search LIKE ${likePattern});`,
    sql`SELECT DISTINCT t.id AS key FROM plays p JOIN tracks t ON p.track_id = t.id LEFT JOIN artists ar ON t.artist_id = ar.id LEFT JOIN albums al ON t.album_id = al.id WHERE t.name_search LIKE ${likePattern} OR t.artist_name_search LIKE ${likePattern} OR ar.name_search LIKE ${likePattern} OR t.album_name_search LIKE ${likePattern} OR al.name_search LIKE ${likePattern};`,
  ]);
  return {
    artistKeys: new Set(artistRows.map((r) => String(r.key))),
    albumKeys: new Set(albumRows.map((r) => String(r.key))),
    trackIds: new Set(trackRows.map((r) => String(r.key))),
  };
}

test("searchCatalog albums DB queries", { skip: skipWithoutDb }, async (t) => {
  await migrateSchema();
  const sql = getDb();

  await t.test("exact album name, case folding, and accent folding", async () => {
    const data = await captureStableComparison(sql, "album-matching", async () => {
      const isEnriched = await isCatalogFullyEnriched();
      const keyCol = isEnriched ? sql`t.album_id` : sql`t.album_group_key`;
      const nameCol = isEnriched ? sql`al.name` : sql`t.album_name`;
      const searchCol = isEnriched ? sql`al.name_search` : sql`t.album_name_search`;
      const [topAlbum, [accentRow]] = await Promise.all([
        queryTopAlbum(sql, isEnriched),
        sql`
          SELECT ${keyCol} AS key, MAX(${searchCol}) AS name_search
          FROM plays p JOIN tracks t ON p.track_id = t.id LEFT JOIN albums al ON t.album_id = al.id
          WHERE ${keyCol} IS NOT NULL AND ${searchCol} IS DISTINCT FROM lower(${nameCol})
            AND char_length(${searchCol}) BETWEEN 2 AND 100
          GROUP BY ${keyCol}
          ORDER BY bool_or(${searchCol} IS DISTINCT FROM lower(normalize(${nameCol}, NFKD))) DESC, COUNT(p.id) DESC, key ASC
          LIMIT 1;
        `,
      ]);
      const [exact, upper, lower, accented] = await Promise.all([
        searchCatalog(topAlbum.matchName),
        searchCatalog(topAlbum.matchName.toUpperCase()),
        searchCatalog(topAlbum.matchName.toLowerCase()),
        accentRow ? walkPages(searchCatalog, String(accentRow.name_search), "accented-album") : Promise.resolve(null),
      ]);
      return { topAlbum, accentRow, exact, upper, lower, accented };
    });

    assertPageBounds(data.exact, "exact album");
    const matched = data.exact.albums.find((a) => a.key === data.topAlbum.key);
    assert.ok(matched, `expected exact search for "${data.topAlbum.matchName}" to include ${data.topAlbum.key}`);
    assert.equal(matched.name, data.topAlbum.name);
    assert.equal(matched.artist, data.topAlbum.artist);
    assert.equal(matched.plays, data.topAlbum.plays);
    assert.equal(matched.imageUrl, data.topAlbum.imageUrl);

    assertPageBounds(data.upper, "uppercase album");
    assert.ok(data.upper.albums.some((a) => a.key === data.topAlbum.key));
    assertPageBounds(data.lower, "lowercase album");
    assert.ok(data.lower.albums.some((a) => a.key === data.topAlbum.key));
    if (data.accentRow && data.accented) {
      assert.ok(data.accented.albumKeys.has(String(data.accentRow.key)));
    }
  });

  await t.test("cross-entity matching: artist matches albums, album matches tracks, and lastPlayedAt is ISO", async () => {
    const { artistCandidate, artistAlbumKeys, artistWalked, topAlbum, albumTrackIds, albumWalked } =
      await captureStableComparison(sql, "cross-entity", async () => {
        const isEnriched = await isCatalogFullyEnriched();
        const artistKey = isEnriched ? sql`t.artist_id` : sql`t.artist_group_key`;
        const albumKey = isEnriched ? sql`t.album_id` : sql`t.album_group_key`;
        const artistName = isEnriched ? sql`ar.name` : sql`t.artist_name`;
        const artistSearch = isEnriched ? sql`ar.name_search` : sql`t.artist_name_search`;
        const albumKey2 = isEnriched ? sql`t2.album_id` : sql`t2.album_group_key`;
        const albumSearch2 = isEnriched ? sql`al2.name_search` : sql`t2.album_name_search`;
        const [artistCandidate] = await sql`
          SELECT ${artistKey} AS key, ${artistName} AS match_name, COUNT(p.id)::int AS plays
          FROM plays p JOIN tracks t ON p.track_id = t.id LEFT JOIN artists ar ON t.artist_id = ar.id
          WHERE ${artistKey} IS NOT NULL AND ${albumKey} IS NOT NULL
            AND char_length(${artistSearch}) BETWEEN 3 AND 100
            AND NOT EXISTS (
              SELECT 1 FROM plays p2 JOIN tracks t2 ON p2.track_id = t2.id LEFT JOIN albums al2 ON t2.album_id = al2.id
              WHERE ${albumKey2} IS NOT NULL
                AND ${albumSearch2} LIKE '%' || replace(replace(replace(${artistSearch}, '!', '!!'), '%', '!%'), '_', '!_') || '%' ESCAPE '!'
            )
          GROUP BY ${artistKey}, ${artistName}, ${artistSearch}
          ORDER BY plays DESC, ${artistName} ASC LIMIT 1;
        `;
        assert.ok(artistCandidate, "expected an artist whose name matches no album name");

        const [artistAlbumRows, topAlbum] = await Promise.all([
          sql`
            SELECT DISTINCT ${albumKey} AS key
            FROM plays p JOIN tracks t ON p.track_id = t.id
            WHERE ${artistKey} = ${String(artistCandidate.key)} AND ${albumKey} IS NOT NULL;
          `,
          queryTopAlbum(sql, isEnriched),
        ]);

        const albumTrackRows = await sql`
          SELECT DISTINCT t.id AS id
          FROM plays p JOIN tracks t ON p.track_id = t.id
          WHERE ${albumKey} = ${topAlbum.key};
        `;

        const [artistWalked, albumWalked] = await Promise.all([
          walkPages(searchCatalog, String(artistCandidate.match_name), "artist-cross-entity"),
          walkPages(searchCatalog, topAlbum.matchName, "album-cross-entity"),
        ]);

        return {
          artistCandidate,
          artistAlbumKeys: artistAlbumRows.map((r) => String(r.key)),
          artistWalked,
          topAlbum,
          albumTrackIds: albumTrackRows.map((r) => String(r.id)),
          albumWalked,
        };
      });

    assert.ok(artistWalked.artistKeys.has(String(artistCandidate.key)));
    assert.ok(artistAlbumKeys.length > 0);
    for (const albumKey of artistAlbumKeys) {
      assert.ok(artistWalked.albumKeys.has(albumKey), `expected artist search to match album ${albumKey}`);
    }

    assert.ok(albumWalked.albumKeys.has(topAlbum.key));
    assert.ok(albumTrackIds.length > 0);
    for (const trackId of albumTrackIds) {
      assert.ok(albumWalked.trackIds.has(trackId), `expected album search to match track ${trackId}`);
    }

    const firstPage = albumWalked.pages[0];
    const assertIso = (value: string | null | undefined, label: string) => {
      assert.equal(typeof value, "string", `${label}: expected ISO string`);
      const iso = value as string;
      assert.ok(!Number.isNaN(Date.parse(iso)), `${label}: invalid ISO date ${iso}`);
      assert.equal(new Date(iso).toISOString(), iso, `${label}: not canonical ISO`);
    };
    for (const tr of firstPage.tracks) assertIso(tr.lastPlayedAt, `track ${tr.id}`);
    for (const al of firstPage.albums) assertIso(al.lastPlayedAt, `album ${al.key}`);
    for (const ar of artistWalked.pages[0].artists) assertIso(ar.lastPlayedAt, `artist ${ar.key}`);
  });

  await t.test("single-type filters paginate at 16 per page with accurate totals and totalPages", async () => {
    const { expectedTotals, allP1, tracksP1, tracksP2, artistsP1, artistsP2, albumsP1, albumsP2 } =
      await captureStableComparison(sql, "single-type-filters", async () => {
        const isEnriched = await isCatalogFullyEnriched();
        const artistKey = isEnriched ? sql`t.artist_id` : sql`t.artist_group_key`;
        const albumKey = isEnriched ? sql`t.album_id` : sql`t.album_group_key`;

        const [
          [trackCountRow],
          [artistCountRow],
          [albumCountRow],
          allP1,
          tracksP1,
          tracksP2,
          artistsP1,
          artistsP2,
          albumsP1,
          albumsP2,
        ] = await Promise.all([
          sql`SELECT COUNT(DISTINCT t.id) AS total FROM plays p JOIN tracks t ON p.track_id = t.id;`,
          sql`SELECT COUNT(DISTINCT ${artistKey}) AS total FROM plays p JOIN tracks t ON p.track_id = t.id WHERE ${artistKey} IS NOT NULL;`,
          sql`SELECT COUNT(DISTINCT ${albumKey}) AS total FROM plays p JOIN tracks t ON p.track_id = t.id WHERE ${albumKey} IS NOT NULL;`,
          searchCatalog("", "most-plays", 1, "all"),
          searchCatalog("", "most-plays", 1, "tracks"),
          searchCatalog("", "most-plays", 2, "tracks"),
          searchCatalog("", "most-plays", 1, "artists"),
          searchCatalog("", "most-plays", 2, "artists"),
          searchCatalog("", "most-plays", 1, "albums"),
          searchCatalog("", "most-plays", 2, "albums"),
        ]);

        return {
          expectedTotals: {
            tracks: Number(trackCountRow?.total ?? 0),
            artists: Number(artistCountRow?.total ?? 0),
            albums: Number(albumCountRow?.total ?? 0),
          },
          allP1,
          tracksP1,
          tracksP2,
          artistsP1,
          artistsP2,
          albumsP1,
          albumsP2,
        };
      });

    assert.ok(expectedTotals.tracks > 0);
    assert.ok(expectedTotals.artists > 0);
    assert.ok(expectedTotals.albums > 0);

    for (const [label, res] of [
      ["all p1", allP1],
      ["tracks p1", tracksP1],
      ["tracks p2", tracksP2],
      ["artists p1", artistsP1],
      ["artists p2", artistsP2],
      ["albums p1", albumsP1],
      ["albums p2", albumsP2],
    ] as const) {
      assert.deepEqual(res.totals, expectedTotals, `${label}: totals should match independent DB counts`);
    }

    const assertSingleTypePaging = (
      kind: "tracks" | "artists" | "albums",
      p1: SearchResponse,
      p2: SearchResponse,
      expectedCount: number,
      getKey: (res: SearchResponse) => string[],
    ) => {
      const expectedPages = Math.max(1, Math.ceil(expectedCount / SEARCH_SINGLE_TYPE_ROWS));
      assert.equal(p1.totalPages, expectedPages, `${kind} p1 totalPages`);
      assert.equal(p1.hasMore, 1 < expectedPages, `${kind} p1 hasMore`);

      const p1Keys = getKey(p1);
      assert.equal(p1Keys.length, Math.min(SEARCH_SINGLE_TYPE_ROWS, expectedCount), `${kind} p1 row count`);
      if (kind !== "tracks") assert.equal(p1.tracks.length, 0, `${kind} p1 tracks empty`);
      if (kind !== "artists") assert.equal(p1.artists.length, 0, `${kind} p1 artists empty`);
      if (kind !== "albums") assert.equal(p1.albums.length, 0, `${kind} p1 albums empty`);

      if (expectedCount > SEARCH_SINGLE_TYPE_ROWS) {
        const p2Keys = getKey(p2);
        const expectedP2Count = Math.min(SEARCH_SINGLE_TYPE_ROWS, expectedCount - SEARCH_SINGLE_TYPE_ROWS);
        assert.equal(p2Keys.length, expectedP2Count, `${kind} p2 row count`);
        if (kind !== "tracks") assert.equal(p2.tracks.length, 0, `${kind} p2 tracks empty`);
        if (kind !== "artists") assert.equal(p2.artists.length, 0, `${kind} p2 artists empty`);
        if (kind !== "albums") assert.equal(p2.albums.length, 0, `${kind} p2 albums empty`);
        assert.equal(p2.hasMore, 2 < expectedPages, `${kind} p2 hasMore`);

        const p1Set = new Set(p1Keys);
        assert.equal(p1Set.size, p1Keys.length, `${kind} p1 unique keys`);
        const p2Set = new Set(p2Keys);
        assert.equal(p2Set.size, p2Keys.length, `${kind} p2 unique keys`);
        for (const key of p2Keys) {
          assert.ok(!p1Set.has(key), `${kind}: duplicate key ${key} between page 1 and page 2`);
        }
      }
    };

    assertSingleTypePaging("tracks", tracksP1, tracksP2, expectedTotals.tracks, (r) => r.tracks.map((tr) => tr.id));
    assertSingleTypePaging("artists", artistsP1, artistsP2, expectedTotals.artists, (r) =>
      r.artists.map((ar) => ar.key),
    );
    assertSingleTypePaging("albums", albumsP1, albumsP2, expectedTotals.albums, (r) => r.albums.map((al) => al.key));
  });

  await t.test("getRandomProfileTarget returns valid played targets for each filter", async () => {
    const { targets, exists } = await captureStableComparison(sql, "random-profile-targets", async () => {
      const isEnriched = await isCatalogFullyEnriched();
      const artistKey = isEnriched ? sql`t.artist_id` : sql`t.artist_group_key`;
      const albumKey = isEnriched ? sql`t.album_id` : sql`t.album_group_key`;

      const [anyTarget, trackTarget, artistTarget, albumTarget] = await Promise.all([
        getRandomProfileTarget("all"),
        getRandomProfileTarget("tracks"),
        getRandomProfileTarget("artists"),
        getRandomProfileTarget("albums"),
      ]);

      const checkPlayed = async (target: Awaited<ReturnType<typeof getRandomProfileTarget>>) => {
        if (!target) return false;
        const rows =
          target.kind === "track"
            ? await sql`SELECT 1 FROM plays p JOIN tracks t ON p.track_id = t.id WHERE t.id = ${target.key} LIMIT 1;`
            : target.kind === "artist"
              ? await sql`SELECT 1 FROM plays p JOIN tracks t ON p.track_id = t.id WHERE ${artistKey} = ${target.key} LIMIT 1;`
              : await sql`SELECT 1 FROM plays p JOIN tracks t ON p.track_id = t.id WHERE ${albumKey} = ${target.key} LIMIT 1;`;
        return rows.length > 0;
      };

      const targets = { anyTarget, trackTarget, artistTarget, albumTarget };
      const [anyExists, trackExists, artistExists, albumExists] = await Promise.all([
        checkPlayed(anyTarget),
        checkPlayed(trackTarget),
        checkPlayed(artistTarget),
        checkPlayed(albumTarget),
      ]);

      return { targets, exists: { anyExists, trackExists, artistExists, albumExists } };
    });

    assert.ok(
      targets.anyTarget && ["track", "artist", "album"].includes(targets.anyTarget.kind) && targets.anyTarget.key.length > 0,
    );
    assert.equal(exists.anyExists, true, `random 'all' target ${JSON.stringify(targets.anyTarget)} must exist in played catalog`);

    assert.ok(targets.trackTarget && targets.trackTarget.kind === "track" && targets.trackTarget.key.length > 0);
    assert.equal(exists.trackExists, true, `random 'tracks' target ${targets.trackTarget.key} must exist in played catalog`);

    assert.ok(targets.artistTarget && targets.artistTarget.kind === "artist" && targets.artistTarget.key.length > 0);
    assert.equal(exists.artistExists, true, `random 'artists' target ${targets.artistTarget.key} must exist in played catalog`);

    assert.ok(targets.albumTarget && targets.albumTarget.kind === "album" && targets.albumTarget.key.length > 0);
    assert.equal(exists.albumExists, true, `random 'albums' target ${targets.albumTarget.key} must exist in played catalog`);
  });

  await t.test("paging returns every matching key once within page size bounds", async () => {
    const { expected, walked, afterEnd } = await captureStableComparison(sql, "paging-active", async () => {
      const isEnriched = await isCatalogFullyEnriched();
      const [expected, walked] = await Promise.all([
        expectedKeysForQuery(sql, isEnriched, `%${PAGING_QUERY}%`),
        walkPages(searchCatalog, PAGING_QUERY, `active "${PAGING_QUERY}"`),
      ]);
      const afterEnd = await searchCatalog(PAGING_QUERY, "most-plays", walked.pages.length + 1);
      return { expected, walked, afterEnd };
    });

    assert.ok(walked.pages.length >= 2, `expected multi-page results for "${PAGING_QUERY}"`);
    assert.ok(walked.pages.some((p) => p.artists.length > 0 && p.albums.length > 0));
    assert.deepEqual(walked.artistKeys, expected.artistKeys);
    assert.deepEqual(walked.albumKeys, expected.albumKeys);
    assert.deepEqual(walked.trackIds, expected.trackIds);
    assert.equal(afterEnd.artists.length + afterEnd.albums.length + afterEnd.tracks.length, 0);
    assert.equal(afterEnd.hasMore, false);
  });

  await t.test("group-key mode paging and raw album name match against real DB", async () => {
    const { searchCatalog: searchGroupKey } = loadTs("src/lib/db/queries/search.ts", {
      "../index": { getDb },
      "./enrichment": { isCatalogFullyEnriched: async () => false },
    }) as { searchCatalog: typeof searchCatalog };

    const { expected, walked, topGroupAlbum, exact } = await captureStableComparison(sql, "group-key", async () => {
      const [expected, topGroupAlbum, walked] = await Promise.all([
        expectedKeysForQuery(sql, false, `%${PAGING_QUERY}%`),
        queryTopAlbum(sql, false),
        walkPages(searchGroupKey, PAGING_QUERY, `group-key "${PAGING_QUERY}"`),
      ]);
      const exact = await searchGroupKey(topGroupAlbum.matchName);
      return { expected, walked, topGroupAlbum, exact };
    });

    assert.ok(walked.pages.length >= 2, `expected multi-page group-key results for "${PAGING_QUERY}"`);
    assert.deepEqual(walked.artistKeys, expected.artistKeys);
    assert.deepEqual(walked.albumKeys, expected.albumKeys);
    assertPageBounds(exact, "group-key exact album");
    const matched = exact.albums.find((a) => a.key === topGroupAlbum.key);
    assert.ok(matched, `expected group-key search to match ${topGroupAlbum.key}`);
    assert.equal(matched.plays, topGroupAlbum.plays);
  });
});
