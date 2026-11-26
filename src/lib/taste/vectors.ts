import { MIN_WEEK_PLAYS, MIN_PHASE_WEEKS, type SparseVector, type TasteGap, type WeekArtistRow } from "./types";

const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export interface AnalyzedWeek {
  week: string;
  timelineIdx: number;
  plays: number;
  counts: Map<string, number>;
  vector: SparseVector;
}

export interface WeekSeries {
  analyzed: AnalyzedWeek[];
  gaps: TasteGap[];
  artistNames: Map<string, string>;
}

export function parseDateUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function formatDateUtc(ms: number): string {
  const d = new Date(ms);
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysUtc(iso: string, days: number): string {
  return formatDateUtc(parseDateUtc(iso) + days * MS_PER_DAY);
}

export function weekSaturday(sunday: string): string {
  return addDaysUtc(sunday, 6);
}

export function prevDay(iso: string): string {
  return addDaysUtc(iso, -1);
}

export function normalizeVector(counts: ReadonlyMap<string, number>): SparseVector {
  let sumSq = 0;
  for (const x of counts.values()) sumSq += x * x;
  const norm = Math.sqrt(sumSq) || 1;
  const out: SparseVector = new Map();
  for (const [k, x] of counts) out.set(k, x / norm);
  return out;
}

export function dotProduct(a: SparseVector, b: SparseVector): number {
  let sum = 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const [k, v] of small) {
    const u = large.get(k);
    if (u !== undefined) sum += v * u;
  }
  return sum;
}

export function buildGramMatrix(vectors: readonly SparseVector[]): Float64Array[] {
  const n = vectors.length;
  const G = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    G[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const d = dotProduct(vectors[i], vectors[j]);
      G[i][j] = d;
      G[j][i] = d;
    }
  }
  return G;
}

/**
 * Expands raw weekly Artist counts into a contiguous Sunday timeline, filters
 * analyzed weeks (>= MIN_WEEK_PLAYS), normalizes Artist vectors, and collects
 * Taste Gaps of at least MIN_PHASE_WEEKS consecutive non-analyzed weeks.
 */
export function buildWeekSeries(rows: readonly WeekArtistRow[]): WeekSeries {
  const weekCounts = new Map<string, Map<string, number>>();
  const weekTotals = new Map<string, number>();
  const nameTotals = new Map<string, Map<string, number>>();

  let minWeek = "";
  let maxWeek = "";

  for (const row of rows) {
    if (row.plays <= 0) continue;

    if (minWeek === "" || row.week < minWeek) minWeek = row.week;
    if (maxWeek === "" || row.week > maxWeek) maxWeek = row.week;

    let artistMap = weekCounts.get(row.week);
    if (!artistMap) {
      artistMap = new Map();
      weekCounts.set(row.week, artistMap);
    }
    artistMap.set(row.artistKey, (artistMap.get(row.artistKey) ?? 0) + row.plays);
    weekTotals.set(row.week, (weekTotals.get(row.week) ?? 0) + row.plays);

    let names = nameTotals.get(row.artistKey);
    if (!names) {
      names = new Map();
      nameTotals.set(row.artistKey, names);
    }
    names.set(row.artistName, (names.get(row.artistName) ?? 0) + row.plays);
  }

  const artistNames = new Map<string, string>();
  for (const [artistKey, names] of nameTotals) {
    let bestName = "";
    let bestPlays = -1;
    for (const [name, plays] of names) {
      if (plays > bestPlays || (plays === bestPlays && name < bestName)) {
        bestPlays = plays;
        bestName = name;
      }
    }
    artistNames.set(artistKey, bestName);
  }

  if (minWeek === "" || maxWeek === "") {
    return { analyzed: [], gaps: [], artistNames };
  }

  const minMs = parseDateUtc(minWeek);
  const maxMs = parseDateUtc(maxWeek);

  interface TimelineWeek {
    week: string;
    timelineIdx: number;
    plays: number;
    counts?: Map<string, number>;
    isActive: boolean;
  }

  const timeline: TimelineWeek[] = [];
  for (let ms = minMs, timelineIdx = 0; ms <= maxMs; ms += MS_PER_WEEK, timelineIdx++) {
    const week = formatDateUtc(ms);
    const totalPlays = weekTotals.get(week) ?? 0;
    const isActive = totalPlays >= MIN_WEEK_PLAYS;
    timeline.push({
      week,
      timelineIdx,
      plays: totalPlays,
      counts: isActive ? weekCounts.get(week) : undefined,
      isActive,
    });
  }

  // Fold short active islands (< MIN_PHASE_WEEKS) sandwiched between two gaps
  // into the gap so flanking gaps merge into one continuous TasteGap.
  let folded = true;
  while (folded) {
    folded = false;
    const runs: Array<{ start: number; end: number; isActive: boolean }> = [];
    for (let i = 0; i < timeline.length; i++) {
      const last = runs[runs.length - 1];
      if (last && last.isActive === timeline[i].isActive) {
        last.end = i + 1;
      } else {
        runs.push({ start: i, end: i + 1, isActive: timeline[i].isActive });
      }
    }
    for (let r = 1; r < runs.length - 1; r++) {
      const prev = runs[r - 1];
      const cur = runs[r];
      const next = runs[r + 1];
      if (
        cur.isActive &&
        cur.end - cur.start < MIN_PHASE_WEEKS &&
        !prev.isActive &&
        prev.end - prev.start >= MIN_PHASE_WEEKS &&
        !next.isActive &&
        next.end - next.start >= MIN_PHASE_WEEKS
      ) {
        for (let i = cur.start; i < cur.end; i++) {
          timeline[i].isActive = false;
        }
        folded = true;
      }
    }
  }

  const analyzed: AnalyzedWeek[] = [];
  const gaps: TasteGap[] = [];

  let gapStart: string | null = null;
  let gapEnd: string | null = null;
  let gapLen = 0;
  let gapPlays = 0;

  const flushGap = () => {
    if (gapStart !== null && gapEnd !== null && gapLen >= MIN_PHASE_WEEKS) {
      gaps.push({ start: gapStart, end: weekSaturday(gapEnd), plays: gapPlays });
    }
    gapStart = null;
    gapEnd = null;
    gapLen = 0;
    gapPlays = 0;
  };

  for (const w of timeline) {
    if (w.isActive && w.counts) {
      flushGap();
      analyzed.push({
        week: w.week,
        timelineIdx: w.timelineIdx,
        plays: w.plays,
        counts: w.counts,
        vector: normalizeVector(w.counts),
      });
    } else {
      if (gapStart === null) gapStart = w.week;
      gapEnd = w.week;
      gapLen++;
      gapPlays += w.plays;
    }
  }
  flushGap();

  return { analyzed, gaps, artistNames };
}
