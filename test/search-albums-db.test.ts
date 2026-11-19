import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { getDb } from "../src/lib/db";
import { migrateSchema } from "../src/lib/db/queries/schema";
import { searchCatalog } from "../src/lib/db/queries/search";
import { isCatalogFullyEnriched } from "../src/lib/db/queries/enrichment";
import { SEARCH_SIDE_ROWS, SEARCH_TRACK_ROWS, type SearchResponse } from "../src/lib/search-types";
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
      : sql`SELECT t.artist_group_key AS key FROM plays p JOIN tracks t ON p.track_id = t.id WHERE t.artist_group_key IS NOT NULL GROUP BY t.artist_group_key HAVING bool_or(t.artist_name_search LIKE ${likePattern});`,
    isEnriched
      ? sql`SELECT DISTINCT t.album_id AS key FROM plays p JOIN tracks t ON p.track_id = t.id JOIN albums al ON t.album_id = al.id WHERE al.name_search LIKE ${likePattern};`
      : sql`SELECT t.album_group_key AS key FROM plays p JOIN tracks t ON p.track_id = t.id WHERE t.album_group_key IS NOT NULL GROUP BY t.album_group_key HAVING bool_or(t.album_name_search LIKE ${likePattern});`,
    sql`SELECT DISTINCT t.id AS key FROM plays p JOIN tracks t ON p.track_id = t.id LEFT JOIN artists ar ON t.artist_id = ar.id WHERE t.name_search LIKE ${likePattern} OR t.artist_name_search LIKE ${likePattern} OR ar.name_search LIKE ${likePattern};`,
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

  await t.test("artist-only query excludes non-matching albums", async () => {
    const { candidate, res } = await captureStableComparison(sql, "artist-only", async () => {
      const isEnriched = await isCatalogFullyEnriched();
      const artistKey = isEnriched ? sql`t.artist_id` : sql`t.artist_group_key`;
      const albumKey = isEnriched ? sql`t.album_id` : sql`t.album_group_key`;
      const artistName = isEnriched ? sql`ar.name` : sql`t.artist_name`;
      const artistSearch = isEnriched ? sql`ar.name_search` : sql`t.artist_name_search`;
      const albumKey2 = isEnriched ? sql`t2.album_id` : sql`t2.album_group_key`;
      const albumSearch2 = isEnriched ? sql`al2.name_search` : sql`t2.album_name_search`;
      const [candidate] = await sql`
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
      assert.ok(candidate, "expected an artist whose name matches no album name");
      return { candidate, res: await searchCatalog(String(candidate.match_name)) };
    });

    assertPageBounds(res, "artist-only");
    assert.ok(res.artists.some((a) => a.key === String(candidate.key)));
    assert.equal(res.albums.length, 0);
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
