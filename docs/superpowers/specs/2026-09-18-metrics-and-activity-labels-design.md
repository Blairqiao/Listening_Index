# Design Spec: Backend Primitives, SQL Parameterization, Metric Toggles, and Activity Labels

**Date**: 2026-09-18  
**Status**: Approved  
**Topic**: Data Redundancy Elimination, Architectural Primitives Migration, Query Deduplication, and Activity Cadence Labels

---

## 1. Overview & Problem Statement

Currently, the application displays redundant metrics and precomputed strings:
- **Redundant Information**: Overview displays total minutes played, while Stream Log displays total hours played. When Overview is set to "ALL", these represent identical data.
- **Architectural Debt (Precomputed Strings)**: The backend queries return precomputed display strings (e.g. `"1,520"`, `"3.6h"`, `"W1"`, `"14 DAYS"`) rather than pure domain primitives. This couples the database layer to presentation, prevents responsive user toggling, and creates rounding and timezone display discrepancies.
- **SQL Redundancy**: Database queries in `overview.ts` and `stream-log.ts` contain repetitive queries branched over `range === 'all'`, `isEnriched`, and cursor types.
- **Activity Cadence Tooltips**: 6M displays vague `"W1"` week labels, 1Y omits the calendar year, and ALL duplicates the 12-month format of 1Y instead of showing historical years.

### Solutions
1. **Architectural Primitives**: Transition Overview and Stream Log API contracts from formatted string tuples to structured domain primitives (raw numbers and ISO timestamp boundaries).
2. **SQL Deduplication & Parameterization**: Consolidate repetitive SQL blocks across Overview and Stream Log into unified, parameterized queries.
3. **Overview Toggle**: Allow toggling between MINUTES and HOURS on Overview Tile 1, persisted in `localStorage`.
4. **Stream Log Unique Tracks**: Replace `LOGGED TIME` in Stream Log with `UNIQUE TRACKS` (`COUNT(DISTINCT p.track_id)`).
5. **Activity Cadence Labels**: Format tooltips with standard dates (month first, upper/lowercase, e.g. `Aug 24 – Aug 30, 2026`, `Sep 2026`, `2024`), and upgrade ALL to display yearly bars with all year markers on the bottom axis.

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
  metrics: [string, string, string, string]; // Client-compatible tuple
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

### 3.1 Overview Window Filtering (`overview.ts`)
Define dynamic interval condition:
```ts
const isAll = range === "all";
const timeFilter = isAll
  ? sql`TRUE`
  : sql`p.played_at >= NOW() - (${OVERVIEW_INTERVAL_CONFIG[range].cur})::interval`;
```

- **Metrics Query**: Single parameterized query replaces the bifurcated `isAll ? ... : ...`:
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

- **Top Artists Query**: Consolidates 4 separate queries into 1:
```sql
SELECT 
  ${isEnriched ? sql`t.artist_id` : sql`MAX(t.artist_id)`} AS id,
  COALESCE(MAX(ar.name), MAX(t.artist_name)) AS name,
  COUNT(p.id)::int AS count
FROM plays p
JOIN tracks t ON p.track_id = t.id
LEFT JOIN artists ar ON t.artist_id = ar.id
WHERE ${timeFilter} AND ${isEnriched ? sql`t.artist_id IS NOT NULL` : sql`TRUE`}
GROUP BY ${isEnriched ? sql`t.artist_id` : sql`t.artist_group_key`}
ORDER BY count DESC, name ASC
LIMIT 5;
```

- **Top Albums Query**: Consolidates 4 separate queries into 1 with equivalent parameterization.

- **Activity Cadence for ALL Range**:
```sql
SELECT 
  EXTRACT(YEAR FROM p.played_at AT TIME ZONE ${tz})::int AS play_year,
  COUNT(*)::int AS count
FROM plays p
GROUP BY play_year
ORDER BY play_year ASC;
```
Fills continuous years between the minimum play year and current year.

### 3.2 Stream Log Deduplication (`stream-log.ts`)
- Replace `logged_hours` with `COUNT(DISTINCT p.track_id)::bigint AS unique_tracks`.
- Consolidate keyset query `WHERE` condition via dynamic SQL fragment:
```ts
const cursorClause = !cursorTimestamp
  ? sql`TRUE`
  : isNumericCursorId
  ? sql`(p.played_at < ${cursorTimestamp}::timestamptz) OR (p.played_at = ${cursorTimestamp}::timestamptz AND p.id < ${cursorId}::bigint)`
  : sql`p.played_at < ${cursorTimestamp}::timestamptz`;
```

---

## 4. Client-Side Presentation & Formatting Engine

### 4.1 Formatting Helpers (`src/lib/format-utils.ts`)
Create pure formatting utilities:
1. `formatOverviewMetrics(raw: OverviewMetricsRaw, unit: 'minutes' | 'hours', range: RangeKey): [string, string, string, string]`
   - **Time**:
     - `unit === 'minutes'`: `Math.round(raw.totalMs / 60000).toLocaleString()`
     - `unit === 'hours'`:
       - `1d` / `1w`: `(raw.totalMs / 3600000).toFixed(1)`
       - `1m` / `6m` / `1y` / `all`: `Math.round(raw.totalMs / 3600000).toLocaleString()`
   - **Tracks**: `raw.trackCount.toLocaleString()`
   - **Artists**: `raw.artistCount.toLocaleString()`
   - **Daily Avg**: `${((raw.totalMs / 3600000) / raw.elapsedDays).toFixed(1)}h`
2. `formatStreamLogMetrics(raw: StreamLogMetricsRaw): [string, string, string, string]`
   - `[raw.totalPlays.toLocaleString(), raw.uniqueTracks.toLocaleString(), raw.uniqueArtists.toLocaleString(), `${raw.streakDays} ${raw.streakDays === 1 ? 'DAY' : 'DAYS'}`]`
3. `formatCadenceTooltip(bucket: ActivityBucket, range: RangeKey, tz: string): string`
   - **6M**: `Aug 24 – Aug 30, 2026 — 85 plays` (or cross-month `Aug 28 – Sep 03, 2026 — 85 plays`)
   - **1Y**: `Sep 2026 — 95 plays`
   - **ALL**: `2024 — 12,450 plays`

### 4.2 UI Interactions

#### Metric Ribbon (`src/components/MetricRibbon.tsx`)
- Tile 1 in Overview is interactive when `onToggleTimeUnit` is provided:
  - Cursor: `cursor-pointer hover:bg-[#121210]`
  - Label: `MINUTES` or `HOURS` based on current active unit.
- Mode 1 Labels: `["TOTAL PLAYS", "UNIQUE TRACKS", "UNIQUE ARTISTS", "CURRENT STREAK"]`.

#### Overview Activity View (`src/components/OverviewView.tsx`)
- Title: `[ ACTIVITY / {range === "all" ? "ALL" : range.toUpperCase()} ]`.
- Tooltip hover attributes dynamically computed via `formatCadenceTooltip`.
- Bottom Axis for `range === "all"`: Renders all years centered under their bars.

---

## 5. Verification Plan

### 5.1 Automated Tests
- Extend `test/verify-integrity.ts`:
  - Verify `rawMetrics` presence and numeric validity across all ranges in `getOverviewData`.
  - Verify `uniqueTracks` calculation in `getStreamLog`.
  - Unit tests for `formatOverviewMetrics`, `formatStreamLogMetrics`, and date tooltip formatting.
- Execution: `npx tsx --test test/verify-integrity.ts`.

### 5.2 Build Verification
- Execute `npm run build` to confirm zero Next.js and TypeScript build errors.
