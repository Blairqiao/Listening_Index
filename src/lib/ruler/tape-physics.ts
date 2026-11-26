export const RUBBER_BAND = 0.35;

export const RULER_MOTION = {
  frictionPer16ms: 0.952, // was 0.93: decay ~220ms -> ~325ms
  maxReleaseVelocity: 3, // px/ms cap on fling speed
  staleReleaseMs: 60, // let go this long after the last move: no fling
  snapMs: 180, // release snap, wheel settle, tap on a unit
  keyStepMs: 140, // ArrowLeft / ArrowRight
  jumpMinMs: 320, // Today, Home/End, external goTo
  jumpMaxMs: 900,
  flingMinMs: 220,
  flingMaxMs: 1000,
  zoomMs: 280, // was 200
} as const;

export const easeOutCubic: (t: number) => number = (t) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.pow(1 - t, 3);
};

export const easeInOutCubic: (t: number) => number = (t) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/** Offset at `elapsedMs` of a tween from `from` to `to`; equals `to` once elapsed >= durationMs. */
export function tweenOffset(
  from: number,
  to: number,
  elapsedMs: number,
  durationMs: number,
  ease: (t: number) => number,
): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) return to;
  if (elapsedMs <= 0) return from;
  return from + (to - from) * ease(elapsedMs / durationMs);
}

/** Long-jump duration: clamp(jumpMinMs + 110 * log2(1 + distancePx / 80), jumpMinMs, jumpMaxMs). */
export function jumpDuration(distancePx: number): number {
  const dist = Math.max(0, Math.abs(distancePx));
  const raw = RULER_MOTION.jumpMinMs + 110 * Math.log2(1 + dist / 80);
  return Math.max(RULER_MOTION.jumpMinMs, Math.min(RULER_MOTION.jumpMaxMs, raw));
}

/**
 * Project a release fling to the nearest real unit center and compute the
 * ease-out cubic duration that matches the finger's release velocity.
 */
export function projectFling(
  centers: number[],
  offset: number,
  velocity: number,
  realFirst: number,
  realLast: number,
): { targetIdx: number; targetOffset: number; durationMs: number } {
  const tau = -16 / Math.log(RULER_MOTION.frictionPer16ms);
  const projectedOffset = offset + velocity * tau;
  const targetIdx = nearestIndex(centers, projectedOffset, realFirst, realLast);
  const targetOffset = centers[targetIdx];
  const speed = Math.abs(velocity);
  const distance = Math.abs(targetOffset - offset);
  const rawDuration =
    speed > 0 ? (3 * distance) / speed : RULER_MOTION.flingMinMs;
  const durationMs = Math.max(
    RULER_MOTION.flingMinMs,
    Math.min(RULER_MOTION.flingMaxMs, rawDuration),
  );
  return { targetIdx, targetOffset, durationMs };
}

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
