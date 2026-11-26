import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { clearServerCache, getOrFetchSearchBrowse } from "../src/lib/db/server-cache";
import type { SearchResponse } from "../src/lib/search-types";

function browse(label: string): SearchResponse {
  return { query: "", artists: [], albums: [], tracks: [], label } as unknown as SearchResponse;
}

test("getOrFetchSearchBrowse shares one fetch per sort, page and filter until the cache clears", async () => {
  clearServerCache();
  let calls = 0;
  const fetcher = async () => browse(`call-${++calls}`);

  const [a, b] = await Promise.all([
    getOrFetchSearchBrowse("most-plays", 1, "all", fetcher),
    getOrFetchSearchBrowse("most-plays", 1, "all", fetcher),
  ]);
  assert.equal(calls, 1, "concurrent identical browses share one query");
  assert.equal(a, b);

  await getOrFetchSearchBrowse("most-plays", 1, "artists", fetcher);
  await getOrFetchSearchBrowse("most-plays", 2, "all", fetcher);
  await getOrFetchSearchBrowse("recent", 1, "all", fetcher);
  assert.equal(calls, 4, "sort, page and filter each get their own entry");

  clearServerCache();
  await getOrFetchSearchBrowse("most-plays", 1, "all", fetcher);
  assert.equal(calls, 5, "a sync clears the browse cache");
});

test("Search route serves an empty query from the browse cache", async () => {
  const saved = { db: process.env.DATABASE_URL, mock: process.env.FORCE_MOCK_DATA };
  // A database URL nothing listens on: a cache miss would try to query it and fail.
  process.env.DATABASE_URL = "postgres://user:pass@127.0.0.1:1/none";
  delete process.env.FORCE_MOCK_DATA;
  try {
    clearServerCache();
    const sentinel = browse("cached");
    await getOrFetchSearchBrowse("most-plays", 1, "all", async () => sentinel);

    const { GET } = await import("../src/app/api/listening/search/route");
    const res = await GET(new NextRequest("http://localhost/api/listening/search?q=&sort=most-plays&page=1&type=all"));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), sentinel);
  } finally {
    clearServerCache();
    if (saved.db === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved.db;
    if (saved.mock !== undefined) process.env.FORCE_MOCK_DATA = saved.mock;
  }
});
