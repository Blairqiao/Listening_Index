import {
  MIN_PHASE_WEEKS,
  NOISE_TAIL,
  NOISE_TAIL_MINLEN,
  PEN_C2,
} from "./types";

export type SegmentCostFn = (a: number, b: number) => number;

export interface DpResult {
  costs: number[];
  maxK: number;
  bounds: (k: number) => number[];
}

export interface SegmentationResult {
  kFine: number;
  kEra: number;
  fineBounds: number[];
  cost: SegmentCostFn;
}

export function buildPrefixSums(G: readonly Float64Array[]): Float64Array[] {
  const n = G.length;
  const P = Array.from({ length: n + 1 }, () => new Float64Array(n + 1));
  for (let i = 0; i < n; i++) {
    const gRow = G[i];
    const pRow = P[i];
    const pNext = P[i + 1];
    for (let j = 0; j < n; j++) {
      pNext[j + 1] = gRow[j] + pRow[j + 1] + pNext[j] - pRow[j];
    }
  }
  return P;
}

export function makeSegmentCost(P: readonly Float64Array[]): SegmentCostFn {
  return (a: number, b: number): number => {
    const len = b - a;
    const gramSum = P[b][b] - P[a][b] - P[b][a] + P[a][a];
    return Math.max(0, len - gramSum / len);
  };
}

export function logBinom(n: number, k: number): number {
  if (k <= 0 || k >= n) return 0;
  const r = Math.min(k, n - k);
  let s = 0;
  for (let i = 1; i <= r; i++) {
    s += Math.log((n - r + i) / i);
  }
  return s;
}

export function penalty(n: number, k: number): number {
  return logBinom(n - 1, k - 1) + PEN_C2 * (k - 1);
}

export function solveDP(
  P: readonly Float64Array[],
  n: number,
  kmax: number,
  minlen: number
): DpResult {
  const maxK = Math.min(kmax, Math.floor(n / minlen));
  const best = Array.from({ length: maxK + 1 }, () =>
    new Float64Array(n + 1).fill(Infinity)
  );
  const arg = Array.from({ length: maxK + 1 }, () => new Int32Array(n + 1));
  best[0][0] = 0;

  for (let k = 1; k <= maxK; k++) {
    const prevBest = best[k - 1];
    const curBest = best[k];
    const curArg = arg[k];
    const sStart = (k - 1) * minlen;

    for (let e = k * minlen; e <= n; e++) {
      const pEnd = P[e];
      const pEndSelf = pEnd[e];
      const sEnd = e - minlen;
      let bestCost = Infinity;
      let bestStart = 0;

      for (let s = sStart; s <= sEnd; s++) {
        const len = e - s;
        const gramSum = pEndSelf - P[s][e] - pEnd[s] + P[s][s];
        const segCost = len - gramSum / len;
        const total = prevBest[s] + (segCost > 0 ? segCost : 0);
        if (total < bestCost) {
          bestCost = total;
          bestStart = s;
        }
      }
      curBest[e] = bestCost;
      curArg[e] = bestStart;
    }
  }

  const bounds = (k: number): number[] => {
    const b = [n];
    for (let j = k, e = n; j > 0; j--) {
      e = arg[j][e];
      b.unshift(e);
    }
    return b;
  };

  const costs = Array.from({ length: maxK + 1 }, (_, k) => best[k][n]);
  return { costs, maxK, bounds };
}

function selectKEraFromHull(costs: readonly number[], n: number, kFine: number): number {
  if (kFine <= 1) return 1;

  const hull: number[] = [];
  for (let k = 1; k <= kFine; k++) {
    while (hull.length >= 2) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      const s1 = (costs[b] - costs[a]) / (penalty(n, b) - penalty(n, a));
      const s2 = (costs[k] - costs[b]) / (penalty(n, k) - penalty(n, b));
      if (s2 <= s1) hull.pop();
      else break;
    }
    hull.push(k);
  }

  const slope = (i: number) =>
    -(costs[hull[i + 1]] - costs[hull[i]]) /
    (penalty(n, hull[i + 1]) - penalty(n, hull[i]));

  let kEra = 1;
  let widestInterval = -1;
  for (let i = 1; i < hull.length; i++) {
    if (hull[i] < 2) continue;
    const hi = slope(i - 1);
    const lo = i < hull.length - 1 ? slope(i) : 0;
    const width = hi - lo;
    if (width > widestInterval) {
      widestInterval = width;
      kEra = hull[i];
    }
  }
  return kEra;
}

/**
 * Segments analyzed weeks with kernel change-point DP, estimating the noise
 * slope from a MINLEN=2 tail for kFine and choosing kEra from the lower convex hull.
 */
export function segmentAnalyzedWeeks(G: readonly Float64Array[]): SegmentationResult {
  const n = G.length;
  const P = buildPrefixSums(G);
  const cost = makeSegmentCost(P);

  if (n < 2 * MIN_PHASE_WEEKS) {
    return { kFine: 1, kEra: 1, fineBounds: [], cost };
  }

  const kLo = Math.ceil((NOISE_TAIL[0] * n) / NOISE_TAIL_MINLEN);
  const kHi = Math.floor((NOISE_TAIL[1] * n) / NOISE_TAIL_MINLEN);
  if (kHi - kLo + 1 < 3) {
    return { kFine: 1, kEra: 1, fineBounds: [], cost };
  }

  const dpTail = solveDP(P, n, kHi, NOISE_TAIL_MINLEN);
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let m = 0;
  for (let k = kLo; k <= kHi; k++) {
    const x = penalty(n, k);
    const y = dpTail.costs[k];
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
    m++;
  }
  const denom = m * sxx - sx * sx;
  const kappa = denom === 0 ? NaN : -(m * sxy - sx * sy) / denom;
  if (!Number.isFinite(kappa)) {
    return { kFine: 1, kEra: 1, fineBounds: [], cost };
  }

  const maxKFine = Math.floor(n / MIN_PHASE_WEEKS);
  const dpFine = solveDP(P, n, maxKFine, MIN_PHASE_WEEKS);
  const alpha = Math.max(0, 2 * kappa);

  let kFine = 1;
  let bestObj = Infinity;
  for (let k = 1; k <= dpFine.maxK; k++) {
    const obj = dpFine.costs[k] + alpha * penalty(n, k);
    if (obj < bestObj) {
      bestObj = obj;
      kFine = k;
    }
  }

  const kEra = selectKEraFromHull(dpFine.costs, n, kFine);
  const fineBounds = kFine > 1 ? dpFine.bounds(kFine).slice(1, -1) : [];
  return { kFine, kEra, fineBounds, cost };
}
