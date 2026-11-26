import {
  MIN_PHASE_WEEKS,
  RAMP_CENTER_RADIUS,
  RAMP_MAX_WIDTH,
  RAMP_WINDOW,
  type SparseVector,
  type TasteShift,
  type TasteShiftAtLevel,
} from "./types";
import { dotProduct, weekSaturday, type AnalyzedWeek } from "./vectors";

export interface GradualSpan {
  k: number;
  lo: number; // inclusive analyzed-week index (unclamped)
  hi: number; // exclusive analyzed-week index (unclamped)
}

export interface RampFit {
  widthWeeks: number;
  center: number;
}

export function centroid(
  vectors: readonly SparseVector[],
  a: number,
  b: number
): SparseVector {
  const len = b - a;
  const out: SparseVector = new Map();
  for (let i = a; i < b; i++) {
    for (const [k, x] of vectors[i]) {
      out.set(k, (out.get(k) ?? 0) + x / len);
    }
  }
  return out;
}

/**
 * Projects weeks in [max(a, m - RAMP_WINDOW), min(b, m + RAMP_WINDOW)) onto
 * the baseline-normalized line from segment A to segment B and fits a linear ramp.
 */
export function fitTransitionRamp(
  vectors: readonly SparseVector[],
  a: number,
  m: number,
  b: number
): RampFit {
  const cA = centroid(vectors, a, m);
  const cB = centroid(vectors, m, b);

  const d: SparseVector = new Map(cB);
  for (const [k, x] of cA) {
    d.set(k, (d.get(k) ?? 0) - x);
  }

  const dd = dotProduct(d, d);
  if (dd <= 1e-12) {
    return { widthWeeks: 1, center: m };
  }

  const base = dotProduct(cA, d);
  const lo = Math.max(a, m - RAMP_WINDOW);
  const hi = Math.min(b, m + RAMP_WINDOW);
  const t: number[] = [];
  for (let i = lo; i < hi; i++) {
    t.push((dotProduct(vectors[i], d) - base) / dd);
  }

  const sse = (center: number, width: number): number => {
    let err = 0;
    for (let j = 0; j < t.length; j++) {
      const i = lo + j;
      const f = Math.min(1, Math.max(0, (i + 0.5 - center) / width + 0.5));
      const diff = t[j] - f;
      err += diff * diff;
    }
    return err;
  };

  const fits: Array<{ w: number; s: number; c: number }> = [];
  let minSse = Infinity;
  const maxHalfSteps = RAMP_CENTER_RADIUS * 2;
  for (let w = 1; w <= RAMP_MAX_WIDTH; w++) {
    let bestS = Infinity;
    let bestC = m;
    for (let step = -maxHalfSteps; step <= maxHalfSteps; step++) {
      const c = m + step * 0.5;
      const s = sse(c, w);
      if (s < bestS) {
        bestS = s;
        bestC = c;
      }
    }
    fits.push({ w, s: bestS, c: bestC });
    if (bestS < minSse) minSse = bestS;
  }

  const sigma2 = minSse / Math.max(1, t.length - 3);
  const threshold = minSse + 2 * sigma2;
  const pick = fits.find((f) => f.s <= threshold) ?? fits[0];
  return { widthWeeks: pick.w, center: pick.c };
}

export function computeShiftsAndGradualSpans(
  analyzed: readonly AnalyzedWeek[],
  levels: ReadonlyMap<number, number[]>,
  boundaryMinK: ReadonlyMap<number, number>,
  kFine: number,
  gapSplitIndices: ReadonlySet<number> = new Set()
): { shifts: TasteShift[]; gradualSpans: GradualSpan[] } {
  const n = analyzed.length;
  const vectors = analyzed.map((w) => w.vector);
  const rampCache = new Map<string, RampFit>();
  const levelsByBoundary = new Map<number, TasteShiftAtLevel[]>();
  const gradualSpans: GradualSpan[] = [];

  for (let k = 2; k <= kFine; k++) {
    const bounds = levels.get(k);
    if (!bounds) continue;

    for (let i = 1; i < bounds.length - 1; i++) {
      const a = bounds[i - 1];
      const m = bounds[i];
      const b = bounds[i + 1];

      let entry: TasteShiftAtLevel;
      if (gapSplitIndices.has(m)) {
        entry = {
          k,
          kind: "sharp",
          widthWeeks: 1,
          rampStart: analyzed[m].week,
          rampEnd: weekSaturday(analyzed[m].week),
        };
      } else {
        const cacheKey = `${a}:${m}:${b}`;
        let fit = rampCache.get(cacheKey);
        if (!fit) {
          fit = fitTransitionRamp(vectors, a, m, b);
          rampCache.set(cacheKey, fit);
        }

        const kind = fit.widthWeeks >= MIN_PHASE_WEEKS ? "gradual" : "sharp";
        const loRaw = Math.round(fit.center - fit.widthWeeks / 2);
        const hiRaw = Math.round(fit.center + fit.widthWeeks / 2);
        const startIdx = Math.max(0, Math.min(n - 1, loRaw));
        const endIdx = Math.max(startIdx, Math.min(n - 1, hiRaw - 1));

        entry = {
          k,
          kind,
          widthWeeks: fit.widthWeeks,
          rampStart: analyzed[startIdx].week,
          rampEnd: weekSaturday(analyzed[endIdx].week),
        };

        if (kind === "gradual") {
          gradualSpans.push({ k, lo: loRaw, hi: hiRaw });
        }
      }

      let list = levelsByBoundary.get(m);
      if (!list) {
        list = [];
        levelsByBoundary.set(m, list);
      }
      list.push(entry);
    }
  }

  const shifts: TasteShift[] = [...levelsByBoundary.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([m, levelEntries]) => ({
      week: analyzed[m].week,
      minK: boundaryMinK.get(m)!,
      levels: levelEntries,
    }));

  return { shifts, gradualSpans };
}

export function isPhaseInShift(
  startIdx: number,
  endIdx: number,
  minK: number,
  gradualSpans: readonly GradualSpan[]
): boolean {
  return gradualSpans.some(
    (s) => s.k < minK && startIdx >= s.lo - 1 && endIdx <= s.hi + 1
  );
}
