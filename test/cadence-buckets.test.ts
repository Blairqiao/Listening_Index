import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildActivityCadence,
  buildProfileCadence,
  cadenceBucketKey,
  cadenceRowGranularity,
  type CadenceRow,
} from "../src/lib/cadence-buckets";
import {
  PRESET_GRANULARITY,
  getLocalCalendarParts,
  localDateKey,
  localDateToInstant,
  presetRange,
  rangeGranularity,
  resolveRangeWindow,
  type CadenceGranularity,
} from "../src/lib/range";
import { formatBucketTooltip } from "../src/lib/format-utils";
import type { RangeKey } from "../src/lib/types";

const FIXTURE_NOW = new Date("2026-11-22T15:30:00Z");
const FIXTURE_LOG_START = "2023-06-15T12:00:00Z";

const SAMPLE_PLAYS: Record<RangeKey, { at: string; count: number }[]> = {
  "1d": [
    { at: "2026-11-21T15:45:00Z", count: 2 },
    { at: "2026-11-22T03:15:00Z", count: 5 },
    { at: "2026-11-22T15:10:00Z", count: 3 },
  ],
  "1w": [
    { at: "2026-11-15T18:00:00Z", count: 4 },
    { at: "2026-11-19T06:30:00Z", count: 7 },
    { at: "2026-11-22T14:00:00Z", count: 2 },
  ],
  "1m": [
    { at: "2026-10-23T18:00:00Z", count: 3 },
    { at: "2026-11-05T12:00:00Z", count: 9 },
    { at: "2026-11-22T12:00:00Z", count: 1 },
  ],
  "6m": [
    { at: "2026-05-26T18:00:00Z", count: 6 },
    { at: "2026-08-15T10:00:00Z", count: 11 },
    { at: "2026-11-22T12:00:00Z", count: 4 },
  ],
  "1y": [
    { at: "2025-11-25T10:00:00Z", count: 8 },
    { at: "2026-04-10T10:00:00Z", count: 15 },
    { at: "2026-11-20T10:00:00Z", count: 5 },
  ],
  all: [
    { at: "2023-06-15T12:00:00Z", count: 12 },
    { at: "2024-09-01T12:00:00Z", count: 20 },
    { at: "2026-11-20T12:00:00Z", count: 9 },
  ],
};

// Literal outputs recorded from the pre-migration builder at FIXTURE_NOW.
const PARITY_FIXTURES = {
  "America/Chicago": {
    "1d": [
      {"date":"09:00","count":2},
      {"date":"10:00","count":0},
      {"date":"11:00","count":0},
      {"date":"12:00","count":0},
      {"date":"13:00","count":0},
      {"date":"14:00","count":0},
      {"date":"15:00","count":0},
      {"date":"16:00","count":0},
      {"date":"17:00","count":0},
      {"date":"18:00","count":0},
      {"date":"19:00","count":0},
      {"date":"20:00","count":0},
      {"date":"21:00","count":5},
      {"date":"22:00","count":0},
      {"date":"23:00","count":0},
      {"date":"00:00","count":0},
      {"date":"01:00","count":0},
      {"date":"02:00","count":0},
      {"date":"03:00","count":0},
      {"date":"04:00","count":0},
      {"date":"05:00","count":0},
      {"date":"06:00","count":0},
      {"date":"07:00","count":0},
      {"date":"08:00","count":0},
      {"date":"09:00","count":3},
    ],
    "1w": [
      {"date":"15 Nov 00:00–06:00","count":0,"isMarker":true,"markerLabel":"15"},
      {"date":"15 Nov 06:00–12:00","count":0,"isMarker":false},
      {"date":"15 Nov 12:00–18:00","count":4,"isMarker":false},
      {"date":"15 Nov 18:00–24:00","count":0,"isMarker":false},
      {"date":"16 Nov 00:00–06:00","count":0,"isMarker":true,"markerLabel":"16"},
      {"date":"16 Nov 06:00–12:00","count":0,"isMarker":false},
      {"date":"16 Nov 12:00–18:00","count":0,"isMarker":false},
      {"date":"16 Nov 18:00–24:00","count":0,"isMarker":false},
      {"date":"17 Nov 00:00–06:00","count":0,"isMarker":true,"markerLabel":"17"},
      {"date":"17 Nov 06:00–12:00","count":0,"isMarker":false},
      {"date":"17 Nov 12:00–18:00","count":0,"isMarker":false},
      {"date":"17 Nov 18:00–24:00","count":0,"isMarker":false},
      {"date":"18 Nov 00:00–06:00","count":0,"isMarker":true,"markerLabel":"18"},
      {"date":"18 Nov 06:00–12:00","count":0,"isMarker":false},
      {"date":"18 Nov 12:00–18:00","count":0,"isMarker":false},
      {"date":"18 Nov 18:00–24:00","count":0,"isMarker":false},
      {"date":"19 Nov 00:00–06:00","count":7,"isMarker":true,"markerLabel":"19"},
      {"date":"19 Nov 06:00–12:00","count":0,"isMarker":false},
      {"date":"19 Nov 12:00–18:00","count":0,"isMarker":false},
      {"date":"19 Nov 18:00–24:00","count":0,"isMarker":false},
      {"date":"20 Nov 00:00–06:00","count":0,"isMarker":true,"markerLabel":"20"},
      {"date":"20 Nov 06:00–12:00","count":0,"isMarker":false},
      {"date":"20 Nov 12:00–18:00","count":0,"isMarker":false},
      {"date":"20 Nov 18:00–24:00","count":0,"isMarker":false},
      {"date":"21 Nov 00:00–06:00","count":0,"isMarker":true,"markerLabel":"21"},
      {"date":"21 Nov 06:00–12:00","count":0,"isMarker":false},
      {"date":"21 Nov 12:00–18:00","count":0,"isMarker":false},
      {"date":"21 Nov 18:00–24:00","count":0,"isMarker":false},
      {"date":"22 Nov 00:00–06:00","count":0,"isMarker":true,"markerLabel":"22"},
      {"date":"22 Nov 06:00–12:00","count":2,"isMarker":false},
      {"date":"22 Nov 12:00–18:00","count":0,"isMarker":false},
      {"date":"22 Nov 18:00–24:00","count":0,"isMarker":false},
    ],
    "1m": [
      {"date":"23 Oct","count":3,"isMarker":true,"markerLabel":"23 Oct"},
      {"date":"24 Oct","count":0,"isMarker":false},
      {"date":"25 Oct","count":0,"isMarker":false},
      {"date":"26 Oct","count":0,"isMarker":false},
      {"date":"27 Oct","count":0,"isMarker":false},
      {"date":"28 Oct","count":0,"isMarker":false},
      {"date":"29 Oct","count":0,"isMarker":false},
      {"date":"30 Oct","count":0,"isMarker":true,"markerLabel":"30 Oct"},
      {"date":"31 Oct","count":0,"isMarker":false},
      {"date":"01 Nov","count":0,"isMarker":false},
      {"date":"02 Nov","count":0,"isMarker":false},
      {"date":"03 Nov","count":0,"isMarker":false},
      {"date":"04 Nov","count":0,"isMarker":false},
      {"date":"05 Nov","count":9,"isMarker":false},
      {"date":"06 Nov","count":0,"isMarker":true,"markerLabel":"06 Nov"},
      {"date":"07 Nov","count":0,"isMarker":false},
      {"date":"08 Nov","count":0,"isMarker":false},
      {"date":"09 Nov","count":0,"isMarker":false},
      {"date":"10 Nov","count":0,"isMarker":false},
      {"date":"11 Nov","count":0,"isMarker":false},
      {"date":"12 Nov","count":0,"isMarker":false},
      {"date":"13 Nov","count":0,"isMarker":true,"markerLabel":"13 Nov"},
      {"date":"14 Nov","count":0,"isMarker":false},
      {"date":"15 Nov","count":0,"isMarker":false},
      {"date":"16 Nov","count":0,"isMarker":false},
      {"date":"17 Nov","count":0,"isMarker":false},
      {"date":"18 Nov","count":0,"isMarker":false},
      {"date":"19 Nov","count":0,"isMarker":false},
      {"date":"20 Nov","count":0,"isMarker":false},
      {"date":"21 Nov","count":0,"isMarker":false},
      {"date":"22 Nov","count":1,"isMarker":true,"markerLabel":"22 Nov"},
    ],
    "6m": [
      {"date":"W1","count":6,"isMarker":true,"markerLabel":"May"},
      {"date":"W2","count":0,"isMarker":true,"markerLabel":"Jun"},
      {"date":"W3","count":0,"isMarker":false},
      {"date":"W4","count":0,"isMarker":false},
      {"date":"W5","count":0,"isMarker":false},
      {"date":"W6","count":0,"isMarker":false},
      {"date":"W7","count":0,"isMarker":true,"markerLabel":"Jul"},
      {"date":"W8","count":0,"isMarker":false},
      {"date":"W9","count":0,"isMarker":false},
      {"date":"W10","count":0,"isMarker":false},
      {"date":"W11","count":0,"isMarker":true,"markerLabel":"Aug"},
      {"date":"W12","count":11,"isMarker":false},
      {"date":"W13","count":0,"isMarker":false},
      {"date":"W14","count":0,"isMarker":false},
      {"date":"W15","count":0,"isMarker":false},
      {"date":"W16","count":0,"isMarker":true,"markerLabel":"Sep"},
      {"date":"W17","count":0,"isMarker":false},
      {"date":"W18","count":0,"isMarker":false},
      {"date":"W19","count":0,"isMarker":false},
      {"date":"W20","count":0,"isMarker":true,"markerLabel":"Oct"},
      {"date":"W21","count":0,"isMarker":false},
      {"date":"W22","count":0,"isMarker":false},
      {"date":"W23","count":0,"isMarker":false},
      {"date":"W24","count":0,"isMarker":true,"markerLabel":"Nov"},
      {"date":"W25","count":0,"isMarker":false},
      {"date":"W26","count":4,"isMarker":false},
    ],
    "1y": [
      {"date":"Nov","count":8},
      {"date":"Dec","count":0},
      {"date":"Jan","count":0},
      {"date":"Feb","count":0},
      {"date":"Mar","count":0},
      {"date":"Apr","count":15},
      {"date":"May","count":0},
      {"date":"Jun","count":0},
      {"date":"Jul","count":0},
      {"date":"Aug","count":0},
      {"date":"Sep","count":0},
      {"date":"Oct","count":0},
      {"date":"Nov","count":5},
    ],
    "all": [
      {"date":"2023","count":12},
      {"date":"2024","count":20},
      {"date":"2025","count":0},
      {"date":"2026","count":9},
    ],
  },
  "Asia/Kolkata": {
    "1d": [
      {"date":"20:00","count":2},
      {"date":"21:00","count":0},
      {"date":"22:00","count":0},
      {"date":"23:00","count":0},
      {"date":"00:00","count":0},
      {"date":"01:00","count":0},
      {"date":"02:00","count":0},
      {"date":"03:00","count":0},
      {"date":"04:00","count":0},
      {"date":"05:00","count":0},
      {"date":"06:00","count":0},
      {"date":"07:00","count":0},
      {"date":"08:00","count":5},
      {"date":"09:00","count":0},
      {"date":"10:00","count":0},
      {"date":"11:00","count":0},
      {"date":"12:00","count":0},
      {"date":"13:00","count":0},
      {"date":"14:00","count":0},
      {"date":"15:00","count":0},
      {"date":"16:00","count":0},
      {"date":"17:00","count":0},
      {"date":"18:00","count":0},
      {"date":"19:00","count":0},
      {"date":"20:00","count":3},
    ],
    "1w": [
      {"date":"15 Nov 00:00–06:00","count":0,"isMarker":true,"markerLabel":"15"},
      {"date":"15 Nov 06:00–12:00","count":0,"isMarker":false},
      {"date":"15 Nov 12:00–18:00","count":0,"isMarker":false},
      {"date":"15 Nov 18:00–24:00","count":4,"isMarker":false},
      {"date":"16 Nov 00:00–06:00","count":0,"isMarker":true,"markerLabel":"16"},
      {"date":"16 Nov 06:00–12:00","count":0,"isMarker":false},
      {"date":"16 Nov 12:00–18:00","count":0,"isMarker":false},
      {"date":"16 Nov 18:00–24:00","count":0,"isMarker":false},
      {"date":"17 Nov 00:00–06:00","count":0,"isMarker":true,"markerLabel":"17"},
      {"date":"17 Nov 06:00–12:00","count":0,"isMarker":false},
      {"date":"17 Nov 12:00–18:00","count":0,"isMarker":false},
      {"date":"17 Nov 18:00–24:00","count":0,"isMarker":false},
      {"date":"18 Nov 00:00–06:00","count":0,"isMarker":true,"markerLabel":"18"},
      {"date":"18 Nov 06:00–12:00","count":0,"isMarker":false},
      {"date":"18 Nov 12:00–18:00","count":0,"isMarker":false},
      {"date":"18 Nov 18:00–24:00","count":0,"isMarker":false},
      {"date":"19 Nov 00:00–06:00","count":0,"isMarker":true,"markerLabel":"19"},
      {"date":"19 Nov 06:00–12:00","count":0,"isMarker":false},
      {"date":"19 Nov 12:00–18:00","count":7,"isMarker":false},
      {"date":"19 Nov 18:00–24:00","count":0,"isMarker":false},
      {"date":"20 Nov 00:00–06:00","count":0,"isMarker":true,"markerLabel":"20"},
      {"date":"20 Nov 06:00–12:00","count":0,"isMarker":false},
      {"date":"20 Nov 12:00–18:00","count":0,"isMarker":false},
      {"date":"20 Nov 18:00–24:00","count":0,"isMarker":false},
      {"date":"21 Nov 00:00–06:00","count":0,"isMarker":true,"markerLabel":"21"},
      {"date":"21 Nov 06:00–12:00","count":0,"isMarker":false},
      {"date":"21 Nov 12:00–18:00","count":0,"isMarker":false},
      {"date":"21 Nov 18:00–24:00","count":0,"isMarker":false},
      {"date":"22 Nov 00:00–06:00","count":0,"isMarker":true,"markerLabel":"22"},
      {"date":"22 Nov 06:00–12:00","count":0,"isMarker":false},
      {"date":"22 Nov 12:00–18:00","count":0,"isMarker":false},
      {"date":"22 Nov 18:00–24:00","count":2,"isMarker":false},
    ],
    "1m": [
      {"date":"23 Oct","count":3,"isMarker":true,"markerLabel":"23 Oct"},
      {"date":"24 Oct","count":0,"isMarker":false},
      {"date":"25 Oct","count":0,"isMarker":false},
      {"date":"26 Oct","count":0,"isMarker":false},
      {"date":"27 Oct","count":0,"isMarker":false},
      {"date":"28 Oct","count":0,"isMarker":false},
      {"date":"29 Oct","count":0,"isMarker":false},
      {"date":"30 Oct","count":0,"isMarker":true,"markerLabel":"30 Oct"},
      {"date":"31 Oct","count":0,"isMarker":false},
      {"date":"01 Nov","count":0,"isMarker":false},
      {"date":"02 Nov","count":0,"isMarker":false},
      {"date":"03 Nov","count":0,"isMarker":false},
      {"date":"04 Nov","count":0,"isMarker":false},
      {"date":"05 Nov","count":9,"isMarker":false},
      {"date":"06 Nov","count":0,"isMarker":true,"markerLabel":"06 Nov"},
      {"date":"07 Nov","count":0,"isMarker":false},
      {"date":"08 Nov","count":0,"isMarker":false},
      {"date":"09 Nov","count":0,"isMarker":false},
      {"date":"10 Nov","count":0,"isMarker":false},
      {"date":"11 Nov","count":0,"isMarker":false},
      {"date":"12 Nov","count":0,"isMarker":false},
      {"date":"13 Nov","count":0,"isMarker":true,"markerLabel":"13 Nov"},
      {"date":"14 Nov","count":0,"isMarker":false},
      {"date":"15 Nov","count":0,"isMarker":false},
      {"date":"16 Nov","count":0,"isMarker":false},
      {"date":"17 Nov","count":0,"isMarker":false},
      {"date":"18 Nov","count":0,"isMarker":false},
      {"date":"19 Nov","count":0,"isMarker":false},
      {"date":"20 Nov","count":0,"isMarker":false},
      {"date":"21 Nov","count":0,"isMarker":false},
      {"date":"22 Nov","count":1,"isMarker":true,"markerLabel":"22 Nov"},
    ],
    "6m": [
      {"date":"W1","count":6,"isMarker":true,"markerLabel":"May"},
      {"date":"W2","count":0,"isMarker":true,"markerLabel":"Jun"},
      {"date":"W3","count":0,"isMarker":false},
      {"date":"W4","count":0,"isMarker":false},
      {"date":"W5","count":0,"isMarker":false},
      {"date":"W6","count":0,"isMarker":false},
      {"date":"W7","count":0,"isMarker":true,"markerLabel":"Jul"},
      {"date":"W8","count":0,"isMarker":false},
      {"date":"W9","count":0,"isMarker":false},
      {"date":"W10","count":0,"isMarker":false},
      {"date":"W11","count":0,"isMarker":true,"markerLabel":"Aug"},
      {"date":"W12","count":11,"isMarker":false},
      {"date":"W13","count":0,"isMarker":false},
      {"date":"W14","count":0,"isMarker":false},
      {"date":"W15","count":0,"isMarker":false},
      {"date":"W16","count":0,"isMarker":true,"markerLabel":"Sep"},
      {"date":"W17","count":0,"isMarker":false},
      {"date":"W18","count":0,"isMarker":false},
      {"date":"W19","count":0,"isMarker":false},
      {"date":"W20","count":0,"isMarker":true,"markerLabel":"Oct"},
      {"date":"W21","count":0,"isMarker":false},
      {"date":"W22","count":0,"isMarker":false},
      {"date":"W23","count":0,"isMarker":false},
      {"date":"W24","count":0,"isMarker":true,"markerLabel":"Nov"},
      {"date":"W25","count":0,"isMarker":false},
      {"date":"W26","count":4,"isMarker":false},
    ],
    "1y": [
      {"date":"Nov","count":8},
      {"date":"Dec","count":0},
      {"date":"Jan","count":0},
      {"date":"Feb","count":0},
      {"date":"Mar","count":0},
      {"date":"Apr","count":15},
      {"date":"May","count":0},
      {"date":"Jun","count":0},
      {"date":"Jul","count":0},
      {"date":"Aug","count":0},
      {"date":"Sep","count":0},
      {"date":"Oct","count":0},
      {"date":"Nov","count":5},
    ],
    "all": [
      {"date":"2023","count":12},
      {"date":"2024","count":20},
      {"date":"2025","count":0},
      {"date":"2026","count":9},
    ],
  },
} as const;

function rowsForPlays(
  plays: { at: string; count: number }[],
  granularity: CadenceGranularity,
  tz: string,
): CadenceRow[] {
  return plays.map(({ at, count }) => ({
    bucket_key: cadenceBucketKey(new Date(at), granularity, tz),
    count,
  }));
}

test("cadenceRowGranularity maps week to day and keeps all others", () => {
  assert.equal(cadenceRowGranularity("hour"), "hour");
  assert.equal(cadenceRowGranularity("block6h"), "block6h");
  assert.equal(cadenceRowGranularity("day"), "day");
  assert.equal(cadenceRowGranularity("week"), "day");
  assert.equal(cadenceRowGranularity("month"), "month");
  assert.equal(cadenceRowGranularity("year"), "year");
});

test("cadenceBucketKey matches SQL key formats across granularities", () => {
  const instant = new Date("2026-11-22T01:30:00Z"); // 2026-11-21 19:30 CST in America/Chicago
  assert.equal(cadenceBucketKey(instant, "hour", "America/Chicago"), "2026-11-22T01:00:00Z");
  assert.equal(cadenceBucketKey(instant, "block6h", "America/Chicago"), "2026-11-21#3");
  assert.equal(cadenceBucketKey(instant, "day", "America/Chicago"), "2026-11-21");
  assert.equal(cadenceBucketKey(instant, "week", "America/Chicago"), "2026-11-21");
  assert.equal(cadenceBucketKey(instant, "month", "America/Chicago"), "2026-11");
  assert.equal(cadenceBucketKey(instant, "year", "America/Chicago"), "2026");

  // Asia/Kolkata (UTC+05:30): 2026-11-22T01:30:00Z is 2026-11-22 07:00 IST -> block 1
  assert.equal(cadenceBucketKey(instant, "block6h", "Asia/Kolkata"), "2026-11-22#1");
  assert.equal(cadenceBucketKey(instant, "day", "Asia/Kolkata"), "2026-11-22");
});

for (const tz of ["America/Chicago", "Asia/Kolkata"] as const) {
  for (const range of ["1d", "1w", "1m", "6m", "1y", "all"] as const) {
    test(`preset parity at fixture now (${tz}, ${range})`, () => {
      const sel = presetRange(range);
      const window = resolveRangeWindow(sel, {
        now: FIXTURE_NOW,
        tz,
        logStart: FIXTURE_LOG_START,
      });
      const granularity = PRESET_GRANULARITY[range];
      const cadenceRows = rowsForPlays(SAMPLE_PLAYS[range], granularity, tz);

      const { activityCadence } = buildActivityCadence({
        window,
        granularity,
        tz,
        now: FIXTURE_NOW,
        cadenceRows,
      });

      const projected = activityCadence.map((b) => ({
        date: b.date,
        count: b.count,
        ...(b.isMarker !== undefined ? { isMarker: b.isMarker } : {}),
        ...(b.markerLabel !== undefined ? { markerLabel: b.markerLabel } : {}),
      }));

      assert.deepEqual(projected, PARITY_FIXTURES[tz][range]);

      // Every bucket has real contiguous UTC instant bounds (endTime = next startTime - 1 ms).
      for (let i = 0; i < activityCadence.length; i++) {
        const startMs = Date.parse(activityCadence[i].startTime);
        const endMs = Date.parse(activityCadence[i].endTime);
        assert.ok(endMs >= startMs, `bucket ${i} endTime must be >= startTime`);
        if (i > 0) {
          const prevEndMs = Date.parse(activityCadence[i - 1].endTime);
          assert.equal(prevEndMs, startMs - 1, `bucket ${i - 1} endTime must be next startTime - 1ms`);
        }
      }
    });
  }
}

test("block6h resolves real wall-clock bounds across DST spring-forward and fall-back", () => {
  const tz = "America/Chicago";

  // Spring forward: 2026-03-08 (clocks skip 02:00->03:00 CST->CDT)
  const springSel = { kind: "window" as const, from: "2026-03-08", to: "2026-03-08" };
  const springWindow = resolveRangeWindow(springSel, { now: FIXTURE_NOW, tz, logStart: null });
  const { activityCadence: springBlocks } = buildActivityCadence({
    window: springWindow,
    granularity: "block6h",
    tz,
    now: FIXTURE_NOW,
    cadenceRows: [{ bucket_key: "2026-03-08#0", count: 2 }, { bucket_key: "2026-03-08#1", count: 3 }],
  });

  assert.equal(springBlocks.length, 4);
  assert.equal(springBlocks[0].startTime, "2026-03-08T06:00:00.000Z"); // 00:00 CST
  assert.equal(springBlocks[0].endTime, "2026-03-08T10:59:59.999Z");   // 05:59:59.999 CDT (5h block)
  assert.equal(springBlocks[1].startTime, "2026-03-08T11:00:00.000Z"); // 06:00 CDT
  assert.equal(springBlocks[1].endTime, "2026-03-08T16:59:59.999Z");   // 11:59:59.999 CDT
  assert.equal(springBlocks[2].startTime, "2026-03-08T17:00:00.000Z"); // 12:00 CDT
  assert.equal(springBlocks[2].endTime, "2026-03-08T22:59:59.999Z");   // 17:59:59.999 CDT
  assert.equal(springBlocks[3].startTime, "2026-03-08T23:00:00.000Z"); // 18:00 CDT
  assert.equal(springBlocks[3].endTime, "2026-03-09T04:59:59.999Z");   // 23:59:59.999 CDT

  // Fall back: 2026-11-01 (clocks repeat 01:00 CDT->CST)
  const fallSel = { kind: "window" as const, from: "2026-11-01", to: "2026-11-01" };
  const fallWindow = resolveRangeWindow(fallSel, { now: FIXTURE_NOW, tz, logStart: null });
  const { activityCadence: fallBlocks } = buildActivityCadence({
    window: fallWindow,
    granularity: "block6h",
    tz,
    now: FIXTURE_NOW,
    cadenceRows: [{ bucket_key: "2026-11-01#0", count: 4 }],
  });

  assert.equal(fallBlocks.length, 4);
  assert.equal(fallBlocks[0].startTime, "2026-11-01T05:00:00.000Z"); // 00:00 CDT
  assert.equal(fallBlocks[0].endTime, "2026-11-01T11:59:59.999Z");   // 05:59:59.999 CST (7h block)
  assert.equal(fallBlocks[1].startTime, "2026-11-01T12:00:00.000Z"); // 06:00 CST
  assert.equal(fallBlocks[1].endTime, "2026-11-01T17:59:59.999Z");   // 11:59:59.999 CST
  assert.equal(fallBlocks[2].startTime, "2026-11-01T18:00:00.000Z"); // 12:00 CST
  assert.equal(fallBlocks[2].endTime, "2026-11-01T23:59:59.999Z");   // 17:59:59.999 CST
  assert.equal(fallBlocks[3].startTime, "2026-11-02T00:00:00.000Z"); // 18:00 CST
  assert.equal(fallBlocks[3].endTime, "2026-11-02T05:59:59.999Z");   // 23:59:59.999 CST
});

test("fixed window: Nov 2025 produces 30 day buckets with exact local midnight bounds", () => {
  const tz = "America/Chicago";
  const sel = { kind: "window" as const, from: "2025-11-01", to: "2025-11-30" };
  const window = resolveRangeWindow(sel, { now: FIXTURE_NOW, tz, logStart: null });
  const granularity = rangeGranularity(sel, window);
  assert.equal(granularity, "day");

  const { activityCadence } = buildActivityCadence({
    window,
    granularity,
    tz,
    now: FIXTURE_NOW,
    cadenceRows: [{ bucket_key: "2025-11-01", count: 5 }, { bucket_key: "2025-11-30", count: 2 }],
  });

  assert.equal(activityCadence.length, 30);
  assert.equal(activityCadence[0].date, "01 Nov");
  assert.equal(activityCadence[0].startTime, localDateToInstant("2025-11-01", tz).toISOString());
  assert.equal(activityCadence[0].count, 5);
  assert.equal(activityCadence[29].date, "30 Nov");
  assert.equal(
    activityCadence[29].endTime,
    new Date(localDateToInstant("2025-12-01", tz).getTime() - 1).toISOString(),
  );
  assert.equal(activityCadence[29].count, 2);
});

test("fixed window: year 2024 produces 12 month buckets with exact local bounds", () => {
  const tz = "America/Chicago";
  const sel = { kind: "window" as const, from: "2024-01-01", to: "2024-12-31" };
  const window = resolveRangeWindow(sel, { now: FIXTURE_NOW, tz, logStart: null });
  const granularity = rangeGranularity(sel, window);
  assert.equal(granularity, "month");

  const { activityCadence } = buildActivityCadence({
    window,
    granularity,
    tz,
    now: FIXTURE_NOW,
    cadenceRows: [{ bucket_key: "2024-01", count: 10 }, { bucket_key: "2024-12", count: 4 }],
  });

  assert.equal(activityCadence.length, 12);
  assert.deepEqual(
    activityCadence.map((b) => b.date),
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  );
  assert.equal(activityCadence[0].startTime, localDateToInstant("2024-01-01", tz).toISOString());
  assert.equal(
    activityCadence[11].endTime,
    new Date(localDateToInstant("2025-01-01", tz).getTime() - 1).toISOString(),
  );
  assert.equal(activityCadence[0].count, 10);
  assert.equal(activityCadence[11].count, 4);
});

test("fixed window: single day produces 24 hour buckets", () => {
  const tz = "America/Chicago";
  const sel = { kind: "window" as const, from: "2025-11-15", to: "2025-11-15" };
  const window = resolveRangeWindow(sel, { now: FIXTURE_NOW, tz, logStart: null });
  const granularity = rangeGranularity(sel, window);
  assert.equal(granularity, "hour");

  const { activityCadence } = buildActivityCadence({
    window,
    granularity,
    tz,
    now: FIXTURE_NOW,
    cadenceRows: [{ bucket_key: "2025-11-15T06:00:00Z", count: 3 }],
  });

  assert.equal(activityCadence.length, 24);
  assert.equal(activityCadence[0].date, "00:00");
  assert.equal(activityCadence[0].count, 3);
  assert.equal(activityCadence[23].date, "23:00");
  assert.equal(
    activityCadence[23].endTime,
    new Date(localDateToInstant("2025-11-16", tz).getTime() - 1).toISOString(),
  );
});

test("fixed window: current month ending after now stops at today", () => {
  const tz = "America/Chicago";
  const sel = { kind: "window" as const, from: "2026-11-01", to: "2026-11-30" };
  const window = resolveRangeWindow(sel, { now: FIXTURE_NOW, tz, logStart: null });
  const granularity = rangeGranularity(sel, window);
  assert.equal(granularity, "day");

  const { activityCadence } = buildActivityCadence({
    window,
    granularity,
    tz,
    now: FIXTURE_NOW,
    cadenceRows: [{ bucket_key: "2026-11-22", count: 6 }],
  });

  assert.equal(activityCadence.length, 22);
  assert.equal(activityCadence[0].date, "01 Nov");
  assert.equal(activityCadence[21].date, "22 Nov");
  assert.equal(activityCadence[21].count, 6);
  assert.equal(localDateKey(new Date(activityCadence[21].startTime), tz), "2026-11-22");
});

test("buildProfileCadence rolls up month rows for year granularity and delegates otherwise", () => {
  const tz = "America/Chicago";
  const window = resolveRangeWindow(presetRange("all"), {
    now: FIXTURE_NOW,
    tz,
    logStart: "2025-09-10T12:00:00Z",
  });

  const profileAll = buildProfileCadence({
    window,
    granularity: "year",
    tz,
    now: FIXTURE_NOW,
    cadenceRows: [
      { bucket_key: "2025-09", count: 4 },
      { bucket_key: "2025-12", count: 6 },
      { bucket_key: "2026-02", count: 5 },
    ],
  });

  assert.deepEqual(
    profileAll.activityCadence.map((b) => ({ date: b.date, count: b.count })),
    [
      { date: "2025", count: 10 },
      { date: "2026", count: 5 },
    ],
  );
  assert.ok(profileAll.monthlyCadence, "monthlyCadence must be built for year granularity");
  assert.equal(profileAll.monthlyCadence.length, 15); // 2025-09 through 2026-11
  assert.equal(profileAll.monthlyCadence[0].date, "Sep 2025");
  assert.equal(profileAll.monthlyCadence[0].count, 4);
  assert.equal(profileAll.monthlyCadence[3].date, "Dec 2025");
  assert.equal(profileAll.monthlyCadence[3].count, 6);
  assert.equal(profileAll.monthlyCadence[5].date, "Feb 2026");
  assert.equal(profileAll.monthlyCadence[5].count, 5);
  assert.equal(profileAll.monthlyCadence[14].date, "Nov 2026");
  assert.equal(getLocalCalendarParts(new Date(profileAll.monthlyCadence[14].startTime), tz).year, 2026);

  const nonYearWindow = resolveRangeWindow(presetRange("1m"), {
    now: FIXTURE_NOW,
    tz,
    logStart: null,
  });
  const profileMonth = buildProfileCadence({
    window: nonYearWindow,
    granularity: "day",
    tz,
    now: FIXTURE_NOW,
    cadenceRows: [{ bucket_key: "2026-11-22", count: 3 }],
  });
  assert.equal(profileMonth.monthlyCadence, undefined);
  assert.equal(profileMonth.activityCadence.length, 31);
});

test("formatBucketTooltip formats real-instant buckets in visitor timezone matching preset strings", () => {
  const tz = "America/Chicago";

  assert.equal(
    formatBucketTooltip(
      {
        startTime: localDateToInstant("2025-01-01", tz).toISOString(),
        endTime: new Date(localDateToInstant("2026-01-01", tz).getTime() - 1).toISOString(),
        count: 1,
      },
      "year",
      tz,
    ),
    "2025 — 1 play",
  );

  assert.equal(
    formatBucketTooltip(
      {
        startTime: localDateToInstant("2025-11-01", tz).toISOString(),
        endTime: new Date(localDateToInstant("2025-12-01", tz).getTime() - 1).toISOString(),
        count: 8,
      },
      "month",
      tz,
    ),
    "Nov 2025 — 8 plays",
  );

  // Same-year week
  assert.equal(
    formatBucketTooltip(
      {
        startTime: localDateToInstant("2026-05-26", tz).toISOString(),
        endTime: new Date(localDateToInstant("2026-06-01", tz).getTime() - 1).toISOString(),
        count: 6,
      },
      "week",
      tz,
    ),
    "May 26 – May 31, 2026 — 6 plays",
  );

  // Cross-year week
  assert.equal(
    formatBucketTooltip(
      {
        startTime: localDateToInstant("2025-12-29", tz).toISOString(),
        endTime: new Date(localDateToInstant("2026-01-05", tz).getTime() - 1).toISOString(),
        count: 2,
      },
      "week",
      tz,
    ),
    "Dec 29, 2025 – Jan 04, 2026 — 2 plays",
  );

  assert.equal(
    formatBucketTooltip(
      {
        startTime: localDateToInstant("2026-10-23", tz).toISOString(),
        endTime: new Date(localDateToInstant("2026-10-24", tz).getTime() - 1).toISOString(),
        count: 3,
      },
      "day",
      tz,
    ),
    "Oct 23, 2026 — 3 plays",
  );

  // block6h including midnight block, last block (18:00-24:00), and DST spring-forward 5h block
  assert.equal(
    formatBucketTooltip(
      {
        startTime: "2026-11-15T06:00:00.000Z", // 00:00 CST
        endTime: "2026-11-15T11:59:59.999Z",   // 05:59:59.999 CST
        count: 1,
      },
      "block6h",
      tz,
    ),
    "Nov 15, 00:00–06:00 — 1 play",
  );
  assert.equal(
    formatBucketTooltip(
      {
        startTime: "2026-11-23T00:00:00.000Z", // Nov 22 18:00 CST
        endTime: "2026-11-23T05:59:59.999Z",   // Nov 22 23:59:59.999 CST
        count: 4,
      },
      "block6h",
      tz,
    ),
    "Nov 22, 18:00–24:00 — 4 plays",
  );
  assert.equal(
    formatBucketTooltip(
      {
        startTime: "2026-03-08T06:00:00.000Z", // 00:00 CST
        endTime: "2026-03-08T10:59:59.999Z",   // 05:59:59.999 CDT (5h spring-forward block)
        count: 2,
      },
      "block6h",
      tz,
    ),
    "Mar 08, 00:00–06:00 — 2 plays",
  );

  // hour in Chicago and Kolkata
  assert.equal(
    formatBucketTooltip(
      {
        startTime: "2026-11-22T15:00:00.000Z",
        endTime: "2026-11-22T15:59:59.999Z",
        count: 3,
      },
      "hour",
      tz,
    ),
    "09:00 — 3 plays",
  );
  assert.equal(
    formatBucketTooltip(
      {
        startTime: "2026-11-22T15:00:00.000Z",
        endTime: "2026-11-22T15:59:59.999Z",
        count: 3,
      },
      "hour",
      "Asia/Kolkata",
    ),
    "20:30 — 3 plays",
  );
});

test("fully skipped local day (Pacific/Apia 2011-12-30) skips zero-length day and block6h frames", () => {
  const tz = "Pacific/Apia";
  const sel = { kind: "window" as const, from: "2011-12-28", to: "2012-01-03" };
  const window = resolveRangeWindow(sel, { now: FIXTURE_NOW, tz, logStart: null });

  const { activityCadence: blocks } = buildActivityCadence({
    window,
    granularity: "block6h",
    tz,
    now: FIXTURE_NOW,
    cadenceRows: [
      { bucket_key: "2011-12-29#3", count: 2 },
      { bucket_key: "2011-12-31#0", count: 3 },
    ],
  });

  // 7 calendar dates minus skipped Dec 30 = 6 real days -> 24 blocks.
  assert.equal(blocks.length, 24);
  assert.equal(blocks.some((b) => b.date.startsWith("30 Dec")), false);
  assert.equal(blocks.reduce((sum, b) => sum + b.count, 0), 5);
  for (let i = 0; i < blocks.length; i++) {
    const startMs = Date.parse(blocks[i].startTime);
    const endMs = Date.parse(blocks[i].endTime);
    assert.ok(endMs >= startMs, `block ${i} (${blocks[i].date}) must not have inverted bounds`);
    if (i > 0) {
      assert.equal(Date.parse(blocks[i - 1].endTime), startMs - 1, `block ${i - 1} must be contiguous`);
    }
  }

  const { activityCadence: days } = buildActivityCadence({
    window,
    granularity: "day",
    tz,
    now: FIXTURE_NOW,
    cadenceRows: [
      { bucket_key: "2011-12-29", count: 2 },
      { bucket_key: "2011-12-31", count: 3 },
    ],
  });

  assert.equal(days.length, 6);
  assert.deepEqual(
    days.map((d) => d.date),
    ["28 Dec", "29 Dec", "31 Dec", "01 Jan", "02 Jan", "03 Jan"],
  );
  for (let i = 0; i < days.length; i++) {
    const startMs = Date.parse(days[i].startTime);
    const endMs = Date.parse(days[i].endTime);
    assert.ok(endMs >= startMs, `day ${i} (${days[i].date}) must not have inverted bounds`);
    if (i > 0) {
      assert.equal(Date.parse(days[i - 1].endTime), startMs - 1, `day ${i - 1} must be contiguous`);
    }
  }
});

test("buildProfileCadence bounds monthlyCadence to fixed multi-year window instead of extending to now", () => {
  const tz = "America/Chicago";
  const sel = { kind: "window" as const, from: "2023-01-01", to: "2024-12-31" };
  const window = resolveRangeWindow(sel, { now: FIXTURE_NOW, tz, logStart: null });

  const result = buildProfileCadence({
    window,
    granularity: "year",
    tz,
    now: FIXTURE_NOW,
    cadenceRows: [
      { bucket_key: "2023-06", count: 4 },
      { bucket_key: "2024-03", count: 6 },
    ],
  });

  assert.deepEqual(
    result.activityCadence.map((b) => ({ date: b.date, count: b.count })),
    [
      { date: "2023", count: 4 },
      { date: "2024", count: 6 },
    ],
  );
  assert.ok(result.monthlyCadence);
  // 2023-06 through 2024-12 inclusive = 19 months (must not extend to Nov 2026).
  assert.equal(result.monthlyCadence.length, 19);
  assert.equal(result.monthlyCadence[0].date, "Jun 2023");
  assert.equal(result.monthlyCadence[0].count, 4);
  assert.equal(result.monthlyCadence[9].date, "Mar 2024");
  assert.equal(result.monthlyCadence[9].count, 6);
  assert.equal(result.monthlyCadence[18].date, "Dec 2024");
  assert.equal(
    result.monthlyCadence[18].endTime,
    new Date(localDateToInstant("2025-01-01", tz).getTime() - 1).toISOString(),
  );
});

test("formatBucketTooltip uses scheduled wall-clock block hours when midnight is skipped (America/Santiago)", () => {
  const tz = "America/Santiago";
  const sel = { kind: "window" as const, from: "2026-09-05", to: "2026-09-06" };
  const window = resolveRangeWindow(sel, { now: FIXTURE_NOW, tz, logStart: null });
  const { activityCadence: blocks } = buildActivityCadence({
    window,
    granularity: "block6h",
    tz,
    now: FIXTURE_NOW,
    cadenceRows: [
      { bucket_key: "2026-09-05#3", count: 2 },
      { bucket_key: "2026-09-06#0", count: 5 },
    ],
  });

  const sep05Last = blocks[3];
  const sep06First = blocks[4];
  assert.equal(sep06First.startTime, "2026-09-06T04:00:00.000Z"); // 01:00 CLST (00:00 skipped)
  assert.equal(formatBucketTooltip(sep06First, "block6h", tz), "Sep 06, 00:00–06:00 — 5 plays");
  assert.equal(formatBucketTooltip(sep05Last, "block6h", tz), "Sep 05, 18:00–24:00 — 2 plays");
});
