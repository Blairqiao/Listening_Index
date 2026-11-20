import test from "node:test";
import assert from "node:assert/strict";
import { planSideColumn, computeSearchTotalPages } from "../src/lib/search-layout";
import { SEARCH_TRACK_ROWS, SEARCH_SIDE_ROWS } from "../src/lib/search-types";

test("planSideColumn splits seven rows four to three and advances both offsets", () => {
  const input = { artistTotal: 10, albumTotal: 10, sideRows: 7 };

  assert.deepEqual(planSideColumn({ ...input, page: 1 }), {
    artistOffset: 0, artistLimit: 4, albumOffset: 0, albumLimit: 3,
  });
  assert.deepEqual(planSideColumn({ ...input, page: 2 }), {
    artistOffset: 4, artistLimit: 4, albumOffset: 3, albumLimit: 3,
  });
});

test("planSideColumn gives spare rows to the group with more results", () => {
  assert.deepEqual(planSideColumn({ artistTotal: 1, albumTotal: 20, sideRows: 7, page: 1 }), {
    artistOffset: 0, artistLimit: 1, albumOffset: 0, albumLimit: 6,
  });
  assert.deepEqual(planSideColumn({ artistTotal: 20, albumTotal: 1, sideRows: 7, page: 1 }), {
    artistOffset: 0, artistLimit: 6, albumOffset: 0, albumLimit: 1,
  });
});

test("planSideColumn uses the hidden heading row when only one group has results", () => {
  assert.deepEqual(planSideColumn({ artistTotal: 0, albumTotal: 20, sideRows: 7, page: 1 }), {
    artistOffset: 0, artistLimit: 0, albumOffset: 0, albumLimit: 8,
  });
  assert.deepEqual(planSideColumn({ artistTotal: 20, albumTotal: 0, sideRows: 7, page: 1 }), {
    artistOffset: 0, artistLimit: 8, albumOffset: 0, albumLimit: 0,
  });
  assert.deepEqual(planSideColumn({ artistTotal: 2, albumTotal: 0, sideRows: 7, page: 1 }), {
    artistOffset: 0, artistLimit: 2, albumOffset: 0, albumLimit: 0,
  });
});

test("planSideColumn uses the hidden heading row after a group runs out", () => {
  const input = { artistTotal: 3, albumTotal: 20, sideRows: 7 };

  assert.deepEqual(planSideColumn({ ...input, page: 1 }), {
    artistOffset: 0, artistLimit: 3, albumOffset: 0, albumLimit: 4,
  });
  assert.deepEqual(planSideColumn({ ...input, page: 2 }), {
    artistOffset: 3, artistLimit: 0, albumOffset: 4, albumLimit: 8,
  });
});

test("planSideColumn returns final offsets and zero limits after exhaustion", () => {
  const input = { artistTotal: 3, albumTotal: 20, sideRows: 7 };
  const exhausted = { artistOffset: 3, artistLimit: 0, albumOffset: 20, albumLimit: 0 };

  assert.deepEqual(planSideColumn({ ...input, page: 4 }), exhausted);
  assert.deepEqual(planSideColumn({ ...input, page: 1_000_000 }), exhausted);
});

test("planSideColumn visits each Artist and Album index exactly once", () => {
  for (const [artistTotal, albumTotal] of [[0, 0], [0, 20], [20, 0], [3, 20], [20, 3], [12, 12]]) {
    for (const sideRows of [1, 2, 4, 7, 9]) {
      const artistIndexes: number[] = [];
      const albumIndexes: number[] = [];
      const context = `artistTotal=${artistTotal}, albumTotal=${albumTotal}, sideRows=${sideRows}`;

      for (let page = 1; page <= artistTotal + albumTotal + 1; page += 1) {
        const { artistOffset, artistLimit, albumOffset, albumLimit } = planSideColumn({
          artistTotal, albumTotal, sideRows, page,
        });
        if (artistLimit === 0 && albumLimit === 0) break;

        for (let index = artistOffset; index < artistOffset + artistLimit; index += 1) {
          artistIndexes.push(index);
        }
        for (let index = albumOffset; index < albumOffset + albumLimit; index += 1) {
          albumIndexes.push(index);
        }
      }

      assert.deepEqual(artistIndexes, Array.from({ length: artistTotal }, (_, index) => index), context);
      assert.deepEqual(albumIndexes, Array.from({ length: albumTotal }, (_, index) => index), context);
    }
  }
});

test("planSideColumn fills every page that has results after it, so the columns end level", () => {
  for (const [artistTotal, albumTotal] of [[1, 20], [20, 1], [3, 20], [20, 3], [12, 12], [0, 30], [30, 0]]) {
    for (const sideRows of [2, 4, 7, 9]) {
      for (let page = 1; ; page += 1) {
        const slice = planSideColumn({ artistTotal, albumTotal, sideRows, page });
        const { artistOffset, artistLimit, albumOffset, albumLimit } = slice;
        if (artistLimit === 0 && albumLimit === 0) break;

        const left = artistTotal - artistOffset - artistLimit + albumTotal - albumOffset - albumLimit;
        if (left === 0) break; // The last page may be short.

        const expected = artistLimit > 0 && albumLimit > 0 ? sideRows : sideRows + 1;
        assert.equal(
          artistLimit + albumLimit,
          expected,
          `artistTotal=${artistTotal}, albumTotal=${albumTotal}, sideRows=${sideRows}, page=${page}`,
        );
      }
    }
  }
});

test("computeSearchTotalPages returns at least 1 for empty totals across all filters", () => {
  for (const filter of ["all", "tracks", "artists", "albums"] as const) {
    assert.equal(
      computeSearchTotalPages({ filter, trackTotal: 0, artistTotal: 0, albumTotal: 0 }),
      1,
      `Filter ${filter} should return 1 for empty totals`,
    );
  }
});

test("computeSearchTotalPages calculates total pages for single-type filters using SEARCH_SINGLE_TYPE_ROWS", () => {
  // tracks filter
  assert.equal(computeSearchTotalPages({ filter: "tracks", trackTotal: 0, artistTotal: 100, albumTotal: 100 }), 1);
  assert.equal(computeSearchTotalPages({ filter: "tracks", trackTotal: 1, artistTotal: 0, albumTotal: 0 }), 1);
  assert.equal(computeSearchTotalPages({ filter: "tracks", trackTotal: 16, artistTotal: 0, albumTotal: 0 }), 1);
  assert.equal(computeSearchTotalPages({ filter: "tracks", trackTotal: 17, artistTotal: 0, albumTotal: 0 }), 2);
  assert.equal(computeSearchTotalPages({ filter: "tracks", trackTotal: 32, artistTotal: 0, albumTotal: 0 }), 2);
  assert.equal(computeSearchTotalPages({ filter: "tracks", trackTotal: 33, artistTotal: 0, albumTotal: 0 }), 3);

  // artists filter
  assert.equal(computeSearchTotalPages({ filter: "artists", trackTotal: 100, artistTotal: 0, albumTotal: 100 }), 1);
  assert.equal(computeSearchTotalPages({ filter: "artists", trackTotal: 0, artistTotal: 1, albumTotal: 0 }), 1);
  assert.equal(computeSearchTotalPages({ filter: "artists", trackTotal: 0, artistTotal: 16, albumTotal: 0 }), 1);
  assert.equal(computeSearchTotalPages({ filter: "artists", trackTotal: 0, artistTotal: 17, albumTotal: 0 }), 2);
  assert.equal(computeSearchTotalPages({ filter: "artists", trackTotal: 0, artistTotal: 32, albumTotal: 0 }), 2);
  assert.equal(computeSearchTotalPages({ filter: "artists", trackTotal: 0, artistTotal: 48, albumTotal: 0 }), 3);

  // albums filter
  assert.equal(computeSearchTotalPages({ filter: "albums", trackTotal: 100, artistTotal: 100, albumTotal: 0 }), 1);
  assert.equal(computeSearchTotalPages({ filter: "albums", trackTotal: 0, artistTotal: 0, albumTotal: 1 }), 1);
  assert.equal(computeSearchTotalPages({ filter: "albums", trackTotal: 0, artistTotal: 0, albumTotal: 16 }), 1);
  assert.equal(computeSearchTotalPages({ filter: "albums", trackTotal: 0, artistTotal: 0, albumTotal: 17 }), 2);
  assert.equal(computeSearchTotalPages({ filter: "albums", trackTotal: 0, artistTotal: 0, albumTotal: 32 }), 2);
});

test("computeSearchTotalPages for 'all' filter matches exact final non-empty page of planSideColumn and track pagination", () => {
  // Test multiples of 8 for trackTotal when side column is empty
  assert.equal(computeSearchTotalPages({ filter: "all", trackTotal: 0, artistTotal: 0, albumTotal: 0 }), 1);
  assert.equal(computeSearchTotalPages({ filter: "all", trackTotal: 8, artistTotal: 0, albumTotal: 0 }), 1);
  assert.equal(computeSearchTotalPages({ filter: "all", trackTotal: 9, artistTotal: 0, albumTotal: 0 }), 2);
  assert.equal(computeSearchTotalPages({ filter: "all", trackTotal: 16, artistTotal: 0, albumTotal: 0 }), 2);
  assert.equal(computeSearchTotalPages({ filter: "all", trackTotal: 24, artistTotal: 0, albumTotal: 0 }), 3);

  const testCases = [
    [0, 0],
    [0, 20],
    [20, 0],
    [3, 20],
    [20, 3],
    [10, 10],
    [1, 20],
    [20, 1],
    [12, 12],
    [0, 30],
    [30, 0],
    [7, 7],
    [8, 8],
    [14, 14],
  ];

  for (const [artistTotal, albumTotal] of testCases) {
    // Find final non-empty page by walking planSideColumn
    let expectedSidePages = 0;
    for (let page = 1; page <= artistTotal + albumTotal + 2; page += 1) {
      const slice = planSideColumn({ artistTotal, albumTotal, sideRows: SEARCH_SIDE_ROWS, page });
      if (slice.artistLimit > 0 || slice.albumLimit > 0) {
        expectedSidePages = page;
      } else {
        break;
      }
    }

    for (const trackTotal of [0, 1, 8, 9, 16, 24, 35, 100]) {
      const expectedTrackPages = Math.ceil(trackTotal / SEARCH_TRACK_ROWS);
      const expectedTotalPages = Math.max(1, expectedTrackPages, expectedSidePages);

      const actual = computeSearchTotalPages({
        filter: "all",
        trackTotal,
        artistTotal,
        albumTotal,
      });

      assert.equal(
        actual,
        expectedTotalPages,
        `Mismatch for artistTotal=${artistTotal}, albumTotal=${albumTotal}, trackTotal=${trackTotal}: expected ${expectedTotalPages}, got ${actual}`,
      );
    }
  }
});
