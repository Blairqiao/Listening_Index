# Backend Primitives, Query Deduplication, Metric Toggles, and Activity Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate redundant listening telemetry displays, refactor the backend to return domain primitives rather than precomputed strings, deduplicate and parameterize SQL queries, implement client-side minutes/hours toggling in Overview, add unique tracks to Stream Log, and format activity chart tooltips with month-first dates and all-year histogram bars.

**Architecture:** Pure domain primitives (`rawMetrics`, `ActivityBucket` with ISO timestamps) are computed by parameterized, consolidated SQL queries in `overview.ts` and `stream-log.ts` and cached via reusable `getOrFetch*` methods in `server-cache.ts`. Client-side formatting helpers in `format-utils.ts` handle localized number formatting, unit conversion, and date rendering. `MetricRibbon.tsx` provides an interactive toggle between MINUTES and HOURS stored in `localStorage`, and `OverviewView.tsx` renders updated tooltips and ALL yearly histogram bars.

**Tech Stack:** Next.js 16 (Turbopack), React 19, TypeScript 5, Tailwind CSS v4, Neon Serverless PostgreSQL (`@neondatabase/serverless`), Node.js test runner (`node:test`).

**Spec:** [`docs/superpowers/specs/2026-09-18-metrics-and-activity-labels-design.md`](file:///Users/blair/Desktop/Projects/Listening_Index/.worktrees/feature-metrics-activity-labels/docs/superpowers/specs/2026-09-18-metrics-and-activity-labels-design.md)

## Global Constraints

- Backend must return raw numbers and ISO timestamps in `rawMetrics` and `activityCadence`.
- Precomputed string tuples in `metrics` must remain populated for backwards compatibility with any existing components during migration.
- Month-first date formatting with upper and lowercase (e.g. `Aug 24 – Aug 30, 2026`) for weekly and monthly tooltips.
- The unit toggle on Overview Tile 1 must persist in `localStorage` key `listening_overview_time_unit`.
- All SQL refactors must maintain sub-150ms concurrent execution via `Promise.all`.
- Every task must strictly practice TDD (test -> fail -> implement -> pass -> commit).

---

### Task 1: Shared Client-Side Formatting Helpers (`format-utils.ts`)

**Files:**
- Create: `src/lib/format-utils.ts`
- Create: `test/format-utils.test.ts`

**Interfaces:**
- Produces:
  - `formatOverviewMetrics(raw: OverviewMetricsRaw, unit: 'minutes' | 'hours', range: RangeKey): [string, string, string, string]`
  - `formatStreamLogMetrics(raw: StreamLogMetricsRaw): [string, string, string, string]`
  - `formatCadenceTooltip(bucket: { startTime: string; endTime: string; count: number }, range: RangeKey, tz?: string): string`

- [ ] **Step 1: Write the failing tests for format-utils**

Create `test/format-utils.test.ts`:
```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  formatOverviewMetrics,
  formatStreamLogMetrics,
  formatCadenceTooltip,
} from "../src/lib/format-utils";

test("formatOverviewMetrics formats minutes correctly with commas", () => {
  const raw = {
    totalMs: 7470000000, // 124,500 minutes
    trackCount: 8620,
    artistCount: 1310,
    elapsedDays: 730,
  };
  const [time, tracks, artists, dailyAvg] = formatOverviewMetrics(raw, "minutes", "all");
  assert.equal(time, "124,500");
  assert.equal(tracks, "8,620");
  assert.equal(artists, "1,310");
  assert.equal(dailyAvg, "2.8h");
});

test("formatOverviewMetrics formats hours with decimal for 1d and integer for all", () => {
  const rawShort = {
    totalMs: 12960000, // 3.6 hours
    trackCount: 42,
    artistCount: 20,
    elapsedDays: 1,
  };
  const [timeShort] = formatOverviewMetrics(rawShort, "hours", "1d");
  assert.equal(timeShort, "3.6");

  const rawLong = {
    totalMs: 7470000000, // 2,075 hours
    trackCount: 8620,
    artistCount: 1310,
    elapsedDays: 730,
  };
  const [timeLong] = formatOverviewMetrics(rawLong, "hours", "all");
  assert.equal(timeLong, "2,075");
});

test("formatStreamLogMetrics formats unique tracks and streak days", () => {
  const raw = {
    totalPlays: 15420,
    uniqueTracks: 4250,
    uniqueArtists: 740,
    streakDays: 14,
  };
  const [plays, tracks, artists, streak] = formatStreamLogMetrics(raw);
  assert.equal(plays, "15,420");
  assert.equal(tracks, "4,250");
  assert.equal(artists, "740");
  assert.equal(streak, "14 DAYS");

  const singleStreak = formatStreamLogMetrics({ ...raw, streakDays: 1 });
  assert.equal(singleStreak[3], "1 DAY");
});

test("formatCadenceTooltip formats dates month-first in upper and lowercase", () => {
  // 6M Weekly bucket within same month
  const weekSameMonth = {
    startTime: "2026-08-24T00:00:00.000Z",
    endTime: "2026-08-30T23:59:59.000Z",
    count: 85,
  };
  assert.equal(
    formatCadenceTooltip(weekSameMonth, "6m", "UTC"),
    "Aug 24 – Aug 30, 2026 — 85 plays"
  );

  // 6M Weekly bucket crossing month boundary
  const weekCrossMonth = {
    startTime: "2026-08-28T00:00:00.000Z",
    endTime: "2026-09-03T23:59:59.000Z",
    count: 92,
  };
  assert.equal(
    formatCadenceTooltip(weekCrossMonth, "6m", "UTC"),
    "Aug 28 – Sep 03, 2026 — 92 plays"
  );

  // 1Y Monthly bucket
  const monthBucket = {
    startTime: "2026-09-01T00:00:00.000Z",
    endTime: "2026-09-30T23:59:59.000Z",
    count: 95,
  };
  assert.equal(
    formatCadenceTooltip(monthBucket, "1y", "UTC"),
    "Sep 2026 — 95 plays"
  );

  // ALL Yearly bucket
  const yearBucket = {
    startTime: "2024-01-01T00:00:00.000Z",
    endTime: "2024-12-31T23:59:59.000Z",
    count: 12450,
  };
  assert.equal(
    formatCadenceTooltip(yearBucket, "all", "UTC"),
    "2024 — 12,450 plays"
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/format-utils.test.ts`
Expected: FAIL with module not found `../src/lib/format-utils`

- [ ] **Step 3: Implement format-utils.ts**

Create `src/lib/format-utils.ts`:
```ts
import type { RangeKey } from "./mock-listening-data";

export interface OverviewMetricsRaw {
  totalMs: number;
  trackCount: number;
  artistCount: number;
  elapsedDays: number;
}

export interface StreamLogMetricsRaw {
  totalPlays: number;
  uniqueTracks: number;
  uniqueArtists: number;
  streakDays: number;
}

export function formatOverviewMetrics(
  raw: OverviewMetricsRaw,
  unit: "minutes" | "hours",
  range: RangeKey
): [string, string, string, string] {
  let timeStr: string;
  if (unit === "hours") {
    const hours = raw.totalMs / 3600000.0;
    if (range === "1d" || range === "1w") {
      timeStr = hours.toFixed(1);
    } else {
      timeStr = Math.round(hours).toLocaleString();
    }
  } else {
    timeStr = Math.round(raw.totalMs / 60000.0).toLocaleString();
  }

  const tracksStr = raw.trackCount.toLocaleString();
  const artistsStr = raw.artistCount.toLocaleString();

  const totalHours = raw.totalMs / 3600000.0;
  const days = Math.max(1, raw.elapsedDays);
  const dailyAvgStr = `${(totalHours / days).toFixed(1)}h`;

  return [timeStr, tracksStr, artistsStr, dailyAvgStr];
}

export function formatStreamLogMetrics(
  raw: StreamLogMetricsRaw
): [string, string, string, string] {
  const playsStr = raw.totalPlays.toLocaleString();
  const tracksStr = raw.uniqueTracks.toLocaleString();
  const artistsStr = raw.uniqueArtists.toLocaleString();
  const streakStr = `${raw.streakDays} ${raw.streakDays === 1 ? "DAY" : "DAYS"}`;

  return [playsStr, tracksStr, artistsStr, streakStr];
}

export function formatCadenceTooltip(
  bucket: { startTime: string; endTime: string; count: number },
  range: RangeKey,
  tz = "UTC"
): string {
  const startDate = new Date(bucket.startTime);
  const endDate = new Date(bucket.endTime);
  const playsLabel = `${bucket.count.toLocaleString()} plays`;

  if (range === "all") {
    const year = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
    }).format(startDate);
    return `${year} — ${playsLabel}`;
  }

  if (range === "1y") {
    const month = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      month: "short",
    }).format(startDate);
    const year = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
    }).format(startDate);
    return `${month} ${year} — ${playsLabel}`;
  }

  if (range === "6m") {
    const startParts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).formatToParts(startDate);

    const endParts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).formatToParts(endDate);

    const sMonth = startParts.find((p) => p.type === "month")?.value || "";
    const sDay = startParts.find((p) => p.type === "day")?.value || "";
    const sYear = startParts.find((p) => p.type === "year")?.value || "";

    const eMonth = endParts.find((p) => p.type === "month")?.value || "";
    const eDay = endParts.find((p) => p.type === "day")?.value || "";
    const eYear = endParts.find((p) => p.type === "year")?.value || "";

    if (sMonth === eMonth && sYear === eYear) {
      return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${sYear} — ${playsLabel}`;
    }
    if (sYear === eYear) {
      return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${sYear} — ${playsLabel}`;
    }
    return `${sMonth} ${sDay}, ${sYear} – ${eMonth} ${eDay}, ${eYear} — ${playsLabel}`;
  }

  if (range === "1m") {
    const month = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      month: "short",
    }).format(startDate);
    const day = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      day: "2-digit",
    }).format(startDate);
    const year = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
    }).format(startDate);
    return `${month} ${day}, ${year} — ${playsLabel}`;
  }

  if (range === "1w") {
    const month = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      month: "short",
    }).format(startDate);
    const day = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      day: "2-digit",
    }).format(startDate);
    const startHour = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      hour12: false,
    }).format(startDate);
    const endHour = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      hour12: false,
    }).format(endDate);
    return `${month} ${day}, ${startHour}:00–${endHour}:00 — ${playsLabel}`;
  }

  // 1d
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(startDate);
  return `${hour} — ${playsLabel}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test test/format-utils.test.ts`
Expected: PASS with 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format-utils.ts test/format-utils.test.ts
git commit -m "feat: add pure client-side formatting utilities for metrics and tooltips"
```

---

### Task 2: Type Definitions & Server Cache Consolidation

**Files:**
- Modify: `src/lib/db/queries/types.ts:1-79`
- Modify: `src/lib/db/server-cache.ts:1-104`
- Modify: `test/verify-integrity.ts:269-317`

**Interfaces:**
- Consumes: `format-utils.ts` types
- Produces:
  - `OverviewMetricsRaw`, `StreamLogMetricsRaw`, `ActivityBucket` exported from `types.ts`
  - `getOrFetchOverview(range, tz, fetcher)`
  - `getOrFetchStreamLog(limit, tz, fetcher)`
  - `getOrFetchSession(tz, fetcher)`

- [ ] **Step 1: Write test for server cache getOrFetch helpers**

Add test in `test/verify-integrity.ts`:
```ts
test("Server Cache getOrFetch concurrent deduplication", async () => {
  const { getOrFetchOverview, clearServerCache } = await import("../src/lib/db/server-cache");
  clearServerCache();

  let calls = 0;
  const fetcher = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 20));
    return {
      logStartDate: "01 JAN 2026",
      rawMetrics: { totalMs: 60000, trackCount: 1, artistCount: 1, elapsedDays: 1 },
      metrics: ["1", "1", "1", "0.0h"],
      topTracks: [],
      topArtists: [],
      topAlbums: [],
      activityCadence: [],
    } as any;
  };

  const [d1, d2] = await Promise.all([
    getOrFetchOverview("1w", "UTC", fetcher),
    getOrFetchOverview("1w", "UTC", fetcher),
  ]);

  assert.equal(calls, 1, "Concurrent in-flight requests must share single fetcher call");
  assert.equal(d1.rawMetrics.totalMs, 60000);
  assert.equal(d2.rawMetrics.totalMs, 60000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/verify-integrity.ts`
Expected: FAIL with `getOrFetchOverview is not a function`

- [ ] **Step 3: Update types.ts and server-cache.ts**

1. In `src/lib/db/queries/types.ts`:
Add `OverviewMetricsRaw`, `StreamLogMetricsRaw`, and `ActivityBucket`, and update `OverviewData` and `StreamLogData` to include `rawMetrics` and `activityCadence: ActivityBucket[]`.
2. In `src/lib/db/server-cache.ts`:
Add `getOrFetchOverview`, `getOrFetchStreamLog`, and `getOrFetchSession`.

- [ ] **Step 4: Run tests to verify it passes**

Run: `npx tsx --test test/verify-integrity.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/queries/types.ts src/lib/db/server-cache.ts test/verify-integrity.ts
git commit -m "refactor: add raw primitive types and consolidated getOrFetch cache helpers"
```

---

### Task 3: Backend Overview Query Consolidation & Primitives

**Files:**
- Modify: `src/lib/db/queries/overview.ts:1-570`
- Modify: `src/lib/mock-listening-data.ts:660-840`
- Modify: `test/verify-integrity.ts:33-60`

**Interfaces:**
- Consumes: `OverviewMetricsRaw`, `ActivityBucket` from `types.ts`
- Produces: `getOverviewData(range, tz)` returning `rawMetrics` and ISO `activityCadence`

- [ ] **Step 1: Write test asserting rawMetrics and yearly ALL buckets**

Update `test/verify-integrity.ts` Overview test:
```ts
test("Overview Data across all ranges returns rawMetrics and valid activityCadence", async () => {
  const ranges = ["1d", "1w", "1m", "6m", "1y", "all"] as const;
  for (const range of ranges) {
    const data = await getOverviewData(range);
    assert.ok(data, `Data should exist for range ${range}`);
    assert.ok(data.rawMetrics, `rawMetrics must exist for ${range}`);
    assert.equal(typeof data.rawMetrics.totalMs, "number");
    assert.equal(typeof data.rawMetrics.trackCount, "number");
    assert.equal(typeof data.rawMetrics.artistCount, "number");
    assert.equal(typeof data.rawMetrics.elapsedDays, "number");

    assert.ok(Array.isArray(data.activityCadence), `activityCadence must be array for ${range}`);
    if (data.activityCadence.length > 0) {
      const bucket = data.activityCadence[0];
      assert.ok(bucket.startTime, "bucket must have startTime");
      assert.ok(bucket.endTime, "bucket must have endTime");
      assert.equal(typeof bucket.count, "number");
    }
    if (range === "all") {
      // In all range, each bucket represents a year
      const firstYear = new Date(data.activityCadence[0].startTime).getFullYear();
      const lastYear = new Date(data.activityCadence[data.activityCadence.length - 1].startTime).getFullYear();
      assert.ok(lastYear >= firstYear, "Yearly cadence must be chronological");
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/verify-integrity.ts`
Expected: FAIL with `data.rawMetrics` undefined

- [ ] **Step 3: Refactor overview.ts**

1. Parameterize `timeFilter` with `isAll ? sql\`TRUE\` : sql\`p.played_at >= NOW() - (\${OVERVIEW_INTERVAL_CONFIG[range].cur})::interval\``.
2. Unify `metricPromise` to single parameterized query.
3. Collapse `topArtistsPromise` and `topAlbumsPromise` from 4 nested queries to 1 parameterized query each.
4. Replace duplicate `all` cadence query with `EXTRACT(YEAR FROM p.played_at AT TIME ZONE \${tz})::int AS play_year` grouping.
5. Populate `rawMetrics: { totalMs, trackCount, artistCount, elapsedDays }`.
6. Return `activityCadence` with `startTime`, `endTime`, `count`, `isMarker`, `markerLabel`.
7. Update `MOCK_DATA.overview` in `mock-listening-data.ts` to include `rawMetrics` and ISO timestamps.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test test/verify-integrity.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/queries/overview.ts src/lib/mock-listening-data.ts test/verify-integrity.ts
git commit -m "refactor(overview): parameterize SQL queries and return raw domain primitives"
```

---

### Task 4: Backend Stream Log & Enrichment Query Consolidation

**Files:**
- Modify: `src/lib/db/queries/stream-log.ts:1-210`
- Modify: `src/lib/db/queries/enrichment.ts:111-154`
- Modify: `src/app/api/listening/overview/route.ts:1-61`
- Modify: `src/app/api/listening/stream-log/route.ts:1-69`
- Modify: `src/app/api/listening/session/route.ts:1-50`
- Modify: `src/lib/db/queries/initial-data.ts:1-72`
- Modify: `src/lib/mock-listening-data.ts:837-842`
- Modify: `test/verify-integrity.ts:61-80`

**Interfaces:**
- Consumes: `StreamLogMetricsRaw` from `types.ts`, `getOrFetch*` from `server-cache.ts`
- Produces: `getStreamLog()` returning `rawMetrics: { totalPlays, uniqueTracks, uniqueArtists, streakDays }`

- [ ] **Step 1: Write test for Stream Log rawMetrics and uniqueTracks**

Update `test/verify-integrity.ts` Stream Log test:
```ts
test("Stream Log Keyset Pagination & rawMetrics", async () => {
  const page1 = await getStreamLog(20);
  assert.ok(page1.rawMetrics, "page1 must have rawMetrics");
  assert.equal(typeof page1.rawMetrics.totalPlays, "number");
  assert.equal(typeof page1.rawMetrics.uniqueTracks, "number");
  assert.equal(typeof page1.rawMetrics.uniqueArtists, "number");
  assert.equal(typeof page1.rawMetrics.streakDays, "number");
  assert.equal(page1.entries.length, 20);
  assert.ok(page1.hasMore);
  assert.ok(page1.nextCursor);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/verify-integrity.ts`
Expected: FAIL with `page1.rawMetrics` undefined

- [ ] **Step 3: Implement Stream Log & Enrichment query consolidation**

1. In `src/lib/db/queries/stream-log.ts`:
   - In `totalsPromise`, replace `logged_hours` with `COUNT(DISTINCT p.track_id)::bigint AS unique_tracks`.
   - Parameterize keyset query WHERE clause with dynamic `cursorClause`.
   - Return `rawMetrics: { totalPlays, uniqueTracks, uniqueArtists, streakDays }`.
2. In `src/lib/db/queries/enrichment.ts`:
   - Parameterize `getPendingTracksForEnrichment`.
3. In `src/app/api/listening/overview/route.ts`, `stream-log/route.ts`, `session/route.ts`, and `initial-data.ts`:
   - Replace repetitive get/set cache code with `getOrFetchOverview`, `getOrFetchStreamLog`, and `getOrFetchSession`.
4. In `src/lib/mock-listening-data.ts`:
   - Update `MOCK_DATA.streamLog` to include `rawMetrics: { totalPlays: 150, uniqueTracks: 84, uniqueArtists: 34, streakDays: 14 }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test test/verify-integrity.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/queries/stream-log.ts src/lib/db/queries/enrichment.ts src/app/api/listening/ src/lib/db/queries/initial-data.ts src/lib/mock-listening-data.ts test/verify-integrity.ts
git commit -m "refactor(stream-log): add unique tracks metric, consolidate cursor queries, and simplify API caching"
```

---

### Task 5: Frontend Overview & Stream Log Metric Ribbon Interaction

**Files:**
- Modify: `src/components/MetricRibbon.tsx:1-44`
- Modify: `src/components/ListeningView.tsx:1-760`

**Interfaces:**
- Consumes: `formatOverviewMetrics`, `formatStreamLogMetrics` from `format-utils.ts`
- Produces: Interactive unit toggle on Overview Tile 1 with `localStorage` persistence and `UNIQUE TRACKS` tile in Stream Log.

- [ ] **Step 1: Update MetricRibbon props and labels**

In `src/components/MetricRibbon.tsx`:
- Accept props:
  ```ts
  interface MetricRibbonProps {
    mode: Mode;
    metrics: [string, string, string, string];
    overviewTimeUnit?: 'minutes' | 'hours';
    onToggleTimeUnit?: () => void;
  }
  ```
- Mode 1 label updated: `["TOTAL PLAYS", "UNIQUE TRACKS", "UNIQUE ARTISTS", "CURRENT STREAK"]`.
- Mode 0 label: `[overviewTimeUnit === "hours" ? "HOURS" : "MINUTES", "TRACKS", "ARTISTS", "DAILY AVG"]`.
- When `mode === 0 && onToggleTimeUnit`, the first tile has `cursor-pointer hover:bg-[#121210] transition-colors` and triggers `onToggleTimeUnit()`.

- [ ] **Step 2: Connect state and localStorage in ListeningView.tsx**

In `src/components/ListeningView.tsx`:
- Add state:
  ```ts
  const [overviewTimeUnit, setOverviewTimeUnit] = useState<'minutes' | 'hours'>(() => {
    if (typeof window === "undefined") return "minutes";
    try {
      const saved = localStorage.getItem("listening_overview_time_unit");
      return saved === "hours" ? "hours" : "minutes";
    } catch {
      return "minutes";
    }
  });

  const handleToggleTimeUnit = useCallback(() => {
    setOverviewTimeUnit((prev) => {
      const next = prev === "minutes" ? "hours" : "minutes";
      try {
        localStorage.setItem("listening_overview_time_unit", next);
      } catch {}
      return next;
    });
  }, []);
  ```
- Calculate displayed metrics using `formatOverviewMetrics(currentOverview.rawMetrics, overviewTimeUnit, displayedRange)` and `formatStreamLogMetrics(streamLogData.rawMetrics)`.
- Pass `overviewTimeUnit` and `onToggleTimeUnit={handleToggleTimeUnit}` to `<MetricRibbon />`.

- [ ] **Step 3: Verify TypeScript and compilation**

Run: `npm run build`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/MetricRibbon.tsx src/components/ListeningView.tsx
git commit -m "feat(ui): add interactive minutes/hours toggle in Overview and unique tracks metric in Stream Log"
```

---

### Task 6: Frontend Activity Chart Tooltips & ALL Yearly Histogram

**Files:**
- Modify: `src/components/OverviewView.tsx:330-460`

**Interfaces:**
- Consumes: `formatCadenceTooltip` from `format-utils.ts`, `ActivityBucket` from `types.ts`
- Produces: Standard date hover tooltips (month first, upper/lowercase), `[ ACTIVITY / ALL ]` header, and all-year markers.

- [ ] **Step 1: Update OverviewView.tsx activity rendering**

1. Section title:
   ```tsx
   <div className="font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] mb-2 select-none">
     [ ACTIVITY / {range === "all" ? "ALL" : range.toUpperCase()} ]
   </div>
   ```
2. Tooltip rendering on each cadence bar:
   ```tsx
   title={formatCadenceTooltip(item, range, "UTC")}
   ```
3. Bottom markers for `range === "all"`:
   Render all years evenly distributed:
   ```tsx
   {range === "all" && (
     <div className="flex justify-between mt-1.5 font-mono text-[10px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
       {activityCadence.map((item, i) => {
         const year = new Date(item.startTime).getFullYear();
         return (
           <span key={i} className="text-center flex-1">
             {year}
           </span>
         );
       })}
     </div>
   )}
   ```

- [ ] **Step 2: Verify TypeScript and compilation**

Run: `npm run build`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/OverviewView.tsx
git commit -m "feat(overview): add standard date tooltips and ALL yearly histogram with year axis"
```

---

### Task 7: End-to-End Build & Full Integrity Verification

**Files:**
- Test: `test/verify-integrity.ts`
- Test: `test/format-utils.test.ts`

- [ ] **Step 1: Run complete automated test suite**

Run: `npx tsx --test test/verify-integrity.ts`
Run: `npx tsx --test test/format-utils.test.ts`
Expected: ALL PASS with 0 failures.

- [ ] **Step 2: Run production Next.js build**

Run: `npm run build`
Expected: Turbopack compile successful, 0 errors, static and dynamic pages generated.

- [ ] **Step 3: Commit and report**

```bash
git add .
git commit -m "test: verify complete integrity of primitives refactor and UI updates"
```
