import test from "node:test";
import assert from "node:assert/strict";
import { planSideColumn } from "../src/lib/search-layout";

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
