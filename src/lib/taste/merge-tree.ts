import { MIN_PHASE_WEEKS, POLISH_RADIUS } from "./types";
import type { SegmentCostFn } from "./segment";

export interface TreeSegment {
  startIdx: number;
  endIdx: number;
  minK: number;
  maxK: number;
}

export interface MergeTreeResult {
  levels: Map<number, number[]>;
  boundaryMinK: Map<number, number>;
  segments: TreeSegment[];
}

/**
 * Polishes kFine boundaries once within ±POLISH_RADIUS, then greedily merges
 * adjacent segments down to K=1 so every slider level nests cleanly.
 */
export function buildMergeTree(
  cost: SegmentCostFn,
  n: number,
  fineBounds: readonly number[]
): MergeTreeResult {
  const b = [0, ...fineBounds, n];

  // Polish kFine boundaries once (up to 5 coordinate-descent sweeps)
  if (b.length > 2) {
    for (let sweep = 0; sweep < 5; sweep++) {
      let moved = false;
      for (let i = 1; i < b.length - 1; i++) {
        const minX = Math.max(b[i - 1] + MIN_PHASE_WEEKS, b[i] - POLISH_RADIUS);
        const maxX = Math.min(b[i + 1] - MIN_PHASE_WEEKS, b[i] + POLISH_RADIUS);
        let bestX = b[i];
        let bestCost = Infinity;
        for (let x = minX; x <= maxX; x++) {
          const c = cost(b[i - 1], x) + cost(x, b[i + 1]);
          if (c < bestCost) {
            bestCost = c;
            bestX = x;
          }
        }
        if (bestX !== b[i]) {
          b[i] = bestX;
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  const levels = new Map<number, number[]>();
  const boundaryMinK = new Map<number, number>();
  levels.set(b.length - 1, [...b]);

  while (b.length > 2) {
    const curK = b.length - 1;
    let bestIdx = 1;
    let minDelta = Infinity;
    for (let i = 1; i < b.length - 1; i++) {
      const delta =
        cost(b[i - 1], b[i + 1]) - cost(b[i - 1], b[i]) - cost(b[i], b[i + 1]);
      if (delta < minDelta) {
        minDelta = delta;
        bestIdx = i;
      }
    }
    boundaryMinK.set(b[bestIdx], curK);
    b.splice(bestIdx, 1);
    levels.set(b.length - 1, [...b]);
  }

  const segmentMap = new Map<string, TreeSegment>();
  for (const [k, bounds] of levels) {
    for (let i = 0; i < bounds.length - 1; i++) {
      const startIdx = bounds[i];
      const endIdx = bounds[i + 1];
      const key = `${startIdx}:${endIdx}`;
      const existing = segmentMap.get(key);
      if (existing) {
        if (k < existing.minK) existing.minK = k;
        if (k > existing.maxK) existing.maxK = k;
      } else {
        segmentMap.set(key, { startIdx, endIdx, minK: k, maxK: k });
      }
    }
  }

  const segments = [...segmentMap.values()].sort((a, b) =>
    a.startIdx !== b.startIdx ? a.startIdx - b.startIdx : a.minK - b.minK
  );

  return { levels, boundaryMinK, segments };
}
