# Design Spec: Backend Primitives, Query Deduplication, Metric Toggles, and Activity Labels

**Date**: 2026-09-18  
**Status**: Approved  
**Topic**: Data Redundancy Elimination, Full Backend Audit & SQL Parameterization, Architectural Primitives Migration, and Activity Cadence Labels

---

## 1. Overview & Problem Statement

A thorough audit across the codebase reveals redundant data displays, architectural coupling between database and presentation, repetitive SQL blocks, and missing chart granularity:

1. **Redundant Metrics**:
   - Overview displays total minutes played, while Stream Log displays total hours played. When Overview is set to "ALL", these represent identical data.
   - Stream Log lacks a unique tracks metric.
2. **Architectural Debt (Precomputed Strings)**:
   - Backend queries return precomputed display strings (e.g. `"1,520"`, `"3.6h"`, `"W1"`, `"14 DAYS"`, `"9h 45m"`) rather than pure domain primitives.
   - This prevents responsive client-side toggling (minutes vs. hours) without server calls, couples the database layer to presentation, and limits localization.
3. **SQL Query Redundancy & Copy-Paste**:
   - `overview.ts`: `isAll` bifurcates queries for metrics and top tracks; 4-way nested branching (`isAll ? (isEnriched ? ... : ...) : (isEnriched ? ... : ...)`) causes massive SQL duplication in `topArtists` and `topAlbums`.
   - `overview.ts`: The activity cadence for `all` was an exact copy-paste duplicate of `1y` (aggregating 12 months instead of years).
   - `stream-log.ts`: Keyset pagination duplicates a 30-line `SELECT` query based on whether `cursorId` is numeric.
   - `enrichment.ts`: `getPendingTracksForEnrichment` duplicates the track projection based on whether explicit `trackIds` are passed.
4. **Cache & Route Boilerplate**:
   - Every API route and `initial-data.ts` re-implements repetitive `getCached -> if miss -> fetch -> setCached` boilerplate.
5. **Activity Cadence Labels**:
   - 6M displays vague `"W1"` week indices instead of date ranges.
   - 1Y omits the calendar year.
   - ALL duplicates 1Y's monthly cadence instead of rendering each calendar year as a bar with year markers on the axis.

---

## 2. Architecture & Data Contracts

### 2.1 Backend Raw Primitives Contract

#### Overview (`src/lib/db/queries/types.ts`)
```ts
export interface OverviewMetricsRaw {
  totalMs: number;       // SUM(p.ms_played)
  trackCount: number;    // COUNT(DISTINCT p.track_id)
  artistCount: number;   // COUNT(DISTINCT t.artist_group_key)
  elapsedDays: number;   // Window day duration
}

export interface ActivityBucket {
  startTime: string;     // ISO 8601 string
  endTime: string;       // ISO 8601 string
  count: number;         // Qualified plays count
  isMarker?: boolean;
  markerLabel?: string;
}

export interface OverviewData {
  logStartDate: string;  // ISO timestamp or formatted log start
  rawMetrics: OverviewMetricsRaw;
  metrics: [string, string, string, string]; // Backward-compatible tuple
  topTracks: TrackSummary[];
  topArtists: Array<{ rank: string; name: string; count: number; id?: string }>;
  topAlbums: AlbumSummary[];
  clockBuckets?: number[];
  activityCadence: ActivityBucket[];
  lastSyncedAt?: string;
}
```

#### Stream Log (`src/lib/db/queries/types.ts`)
```ts
export interface StreamLogMetricsRaw {
  totalPlays: number;    // COUNT(*)
  uniqueTracks: number;  // COUNT(DISTINCT p.track_id)
  uniqueArtists: number; // COUNT(DISTINCT t.artist_group_key)
  streakDays: number;    // Consecutive active calendar days
}

export interface StreamLogData {
  rawMetrics: StreamLogMetricsRaw;
  metrics: [string, string, string, string]; // [Total Plays, Unique Tracks, Unique Artists, Current Streak]
  entries: StreamLogItem[];
  nextCursor?: string | null;
  nextCursorId?: string | null;
  hasMore?: boolean;
  lastSyncedAt?: string;
}
```

---

## 3. Database Query Consolidation & Parameterization

### 3.1 Overview Query Consolidation (`overview.ts`)
1. **Dynamic Time Window Condition**:
   ```ts
   const isAll = range === "all";
   const timeFilter = isAll
     ? sql`TRUE`
     : sql`p.played_at >= NOW() - (${OVERVIEW_INTERVAL_CONFIG[range].cur})::interval`;
   ```

2. **Unified Metrics Query**:
   Single parameterized query replacing the bifurcated `isAll ? ... : ...`:
   ```sql
   SELECT 
     COALESCE(SUM(p.ms_played), 0)::bigint AS total_ms,
     COUNT(DISTINCT p.track_id)::bigint AS tracks,
     COUNT(DISTINCT t.artist_group_key)::bigint AS artists,
     MIN(p.played_at) AS window_min_date
   FROM plays p
   JOIN tracks t ON p.track_id = t.id
   WHERE ${timeFilter};
   ```

3. **Top Artists & Albums (Collapsed from 4 queries to 1 each)**:
   ```ts
   const artistGroupCol = isEnriched ? sql`t.artist_id` : sql`t.artist_group_key`;
   const enrichedFilter = isEnriched ? sql`t.artist_id IS NOT NULL` : sql`TRUE`;

   const topArtistsPromise = sql`
     SELECT 
       ${isEnriched ? sql`t.artist_id` : sql`MAX(t.artist_id)`} AS id,
       COALESCE(MAX(ar.name), MAX(t.artist_name)) AS name,
       COUNT(p.id)::int AS count
     FROM plays p
     JOIN tracks t ON p.track_id = t.id
     LEFT JOIN artists ar ON t.artist_id = ar.id
     WHERE ${timeFilter} AND ${enrichedFilter}
     GROUP BY ${artistGroupCol}
     ORDER BY count DESC, name ASC
     LIMIT 5;
   `;
   ```

4. **Activity Cadence for ALL Range**:
   Replaces the 12-month copy-paste query with a dedicated yearly aggregation:
   ```sql
   SELECT 
     EXTRACT(YEAR FROM p.played_at AT TIME ZONE ${tz})::int AS play_year,
     COUNT(*)::int AS count
   FROM plays p
   GROUP BY play_year
   ORDER BY play_year ASC;
   ```
   Fills in all continuous years from minimum year to current year with zero-filled counts where no plays exist.

### 3.2 Stream Log Keyset Consolidation (`stream-log.ts`)
1. **Unique Tracks Metric**:
   ```sql
   SELECT 
     COUNT(*)::bigint AS total_plays,
     COUNT(DISTINCT p.track_id)::bigint AS unique_tracks,
     COUNT(DISTINCT t.artist_group_key)::bigint AS unique_artists
   FROM plays p
   JOIN tracks t ON p.track_id = t.id;
   ```
2. **Unified Keyset Pagination Query**:
   ```ts
   const cursorClause = !cursorTimestamp
     ? sql`TRUE`
     : isNumericCursorId
     ? sql`(p.played_at < ${cursorTimestamp}::timestamptz) OR (p.played_at = ${cursorTimestamp}::timestamptz AND p.id < ${cursorId}::bigint)`
     : sql`p.played_at < ${cursorTimestamp}::timestamptz`;
   ```
   A single canonical query executes with `WHERE ${cursorClause}`.

### 3.3 Enrichment Query Parameterization (`enrichment.ts`)
Parameterize `getPendingTracksForEnrichment`:
```ts
const trackFilter = (options.trackIds && options.trackIds.length > 0)
  ? sql`id = ANY(${options.trackIds}::text[])`
  : sql`TRUE`;
```

---

## 4. Server Cache Consolidation (`server-cache.ts`)

Introduce unified cached fetch wrappers in `server-cache.ts`:
- `getOrFetchOverview(range, tz, fetcher)`
- `getOrFetchStreamLog(limit, tz, fetcher)`
- `getOrFetchSession(tz, fetcher)`

This eliminates repetitive cache check/set boilerplate across API routes (`overview/route.ts`, `stream-log/route.ts`, `session/route.ts`) and `initial-data.ts`.

---

## 5. Client-Side Presentation & Formatting Engine

### 5.1 Pure Formatting Helpers (`src/lib/format-utils.ts`)
1. **`formatOverviewMetrics(raw: OverviewMetricsRaw, unit: 'minutes' | 'hours', range: RangeKey)`**:
   - **Tile 1 (Time)**:
     - In `minutes`: `Math.round(raw.totalMs / 60000).toLocaleString()`
     - In `hours`:
       - `1d` / `1w`: `(raw.totalMs / 3600000).toFixed(1)` (e.g. `3.6`)
       - `1m`, `6m`, `1y`, `all`: `Math.round(raw.totalMs / 3600000).toLocaleString()` (e.g. `2,075`)
   - **Tile 2 (Tracks)**: `raw.trackCount.toLocaleString()`
   - **Tile 3 (Artists)**: `raw.artistCount.toLocaleString()`
   - **Tile 4 (Daily Avg)**: `${((raw.totalMs / 3600000) / raw.elapsedDays).toFixed(1)}h`

2. **`formatStreamLogMetrics(raw: StreamLogMetricsRaw)`**:
   - `[raw.totalPlays.toLocaleString(), raw.uniqueTracks.toLocaleString(), raw.uniqueArtists.toLocaleString(), `${raw.streakDays} ${raw.streakDays === 1 ? 'DAY' : 'DAYS'}`]`

3. **`formatCadenceTooltip(bucket: ActivityBucket, range: RangeKey, tz: string)`**:
   - **1W**: `Sep 14, 00:00–06:00 — 8 plays`
   - **1M**: `Sep 14, 2026 — 42 plays`
   - **6M**: `Aug 24 – Aug 30, 2026 — 85 plays` (or `Aug 28 – Sep 03, 2026 — 85 plays`)
   - **1Y**: `Sep 2026 — 95 plays`
   - **ALL**: `2024 — 12,450 plays`

### 5.2 UI Interactions

#### Metric Ribbon (`src/components/MetricRibbon.tsx`)
- Tile 1 in Overview is interactive:
  - Cursor: `cursor-pointer hover:bg-[#121210] transition-colors`.
  - Label: `MINUTES` or `HOURS`.
  - State persisted in `localStorage` (`listening_overview_time_unit`).
- Mode 1 Labels: `["TOTAL PLAYS", "UNIQUE TRACKS", "UNIQUE ARTISTS", "CURRENT STREAK"]`.

#### Overview Activity View (`src/components/OverviewView.tsx`)
- Section Title: `[ ACTIVITY / {range === "all" ? "ALL" : range.toUpperCase()} ]`.
- Tooltip hover attributes dynamically computed via `formatCadenceTooltip`.
- Bottom Axis for `range === "all"`: Renders all years centered under their bars.

---

## 6. Verification Plan

### 6.1 Automated Tests (`test/verify-integrity.ts`)
1. **Query Consolidation & Primitives**:
   - Test `getOverviewData` for all ranges (`1d`, `1w`, `1m`, `6m`, `1y`, `all`), confirming `rawMetrics` contains numeric `totalMs`, `trackCount`, `artistCount`, and `elapsedDays`.
   - Test `activityCadence` buckets containing ISO timestamps and correct counts.
   - Verify `all` range returns yearly buckets from earliest record to current year.
   - Test `getStreamLog` returning numeric `rawMetrics` (`totalPlays`, `uniqueTracks`, `uniqueArtists`, `streakDays`).
   - Test keyset pagination with numeric and non-numeric cursors.
2. **Client Formatting Engine**:
   - Test `formatOverviewMetrics` (minutes vs. hours toggle, decimals for short ranges, comma separation).
   - Test `formatStreamLogMetrics` (comma formatting, singular/plural streak).
   - Test `formatCadenceTooltip` for weekly, monthly, and yearly date ranges.

### 6.2 Build & Integration
- Execute `npm run build` to confirm zero Next.js, React 19, and TypeScript compilation errors.
