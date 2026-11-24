export const FRICTION_PER_16MS = 0.93;
export const RUBBER_BAND = 0.35;
export const SETTLE_RATE = 0.28;
export const MIN_VELOCITY = 0.02; // px per ms; below this momentum stops

/**
 * Binary search over sorted `centers` within `[lo, hi]`, returning the index
 * closest to `offset` (breaking exact ties toward the lower index).
 */
export function nearestIndex(
  centers: number[],
  offset: number,
  lo: number,
  hi: number,
): number {
  const loBound = Math.max(0, lo);
  const hiBound = Math.min(centers.length - 1, hi);
  if (loBound >= hiBound) return loBound;

  let low = loBound;
  let high = hiBound;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (centers[mid] < offset) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  let best = low;
  if (
    low > loBound &&
    centers[low] >= offset &&
    Math.abs(offset - centers[low - 1]) <= Math.abs(offset - centers[low])
  ) {
    best = low - 1;
  }

  const target = centers[best];
  let left = loBound;
  let right = best;
  while (left < right) {
    const mid = (left + right) >> 1;
    if (centers[mid] < target) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left;
}

/**
 * Keep `raw` inside `[min, max]` and map overshoot past either edge to 35%
 * (`RUBBER_BAND`) of the excess distance.
 */
export function dampOffset(raw: number, min: number, max: number): number {
  if (raw < min) {
    return min - (min - raw) * RUBBER_BAND;
  }
  if (raw > max) {
    return max + (raw - max) * RUBBER_BAND;
  }
  return raw;
}

/**
 * Advance one momentum frame over `dtMs` with exponential friction and
 * boundary clamping at `[min, max]`.
 */
export function momentumStep(
  s: { offset: number; velocity: number },
  dtMs: number,
  min: number,
  max: number,
): { offset: number; velocity: number; done: boolean; hitEdge: "min" | "max" | null } {
  const nextVelocity = s.velocity * FRICTION_PER_16MS ** (dtMs / 16);
  const nextOffset = s.offset + nextVelocity * dtMs;

  if (nextVelocity < 0 && nextOffset <= min) {
    return { offset: min, velocity: 0, done: true, hitEdge: "min" };
  }
  if (nextVelocity > 0 && nextOffset >= max) {
    return { offset: max, velocity: 0, done: true, hitEdge: "max" };
  }

  return {
    offset: nextOffset,
    velocity: nextVelocity,
    done: Math.abs(nextVelocity) < MIN_VELOCITY,
    hitEdge: null,
  };
}

/**
 * Advance one settle step toward `target` by 28% (`SETTLE_RATE`) of the
 * remaining distance, snapping to `target` once within 0.5px.
 */
export function settleStep(
  offset: number,
  target: number,
): { offset: number; done: boolean } {
  const diff = target - offset;
  if (Math.abs(diff) <= 0.5) {
    return { offset: target, done: true };
  }
  return { offset: offset + diff * SETTLE_RATE, done: false };
}
