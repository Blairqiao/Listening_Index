/** Strong ease-out, the same curve as --ease-out-strong in globals.css. */
export const EASE_OUT_STRONG = "cubic-bezier(0.23, 1, 0.32, 1)";

/** Indexes whose text differs between two renders of the same list. */
export function changedIndexes(prev: readonly string[], next: readonly string[]): number[] {
  const out: number[] = [];
  next.forEach((value, i) => {
    if (prev[i] !== undefined && prev[i] !== value) out.push(i);
  });
  return out;
}

/** A changed metric clears from a slight blur, so the eye catches which numbers moved. */
export const METRIC_SWAP_KEYFRAMES: Keyframe[] = [
  { opacity: 0, filter: "blur(2px)" },
  { opacity: 1, filter: "blur(0px)" },
];

export const METRIC_SWAP_TIMING: KeyframeAnimationOptions = {
  duration: 150,
  easing: EASE_OUT_STRONG,
};

/**
 * Delays from 0 to `spreadMs` with an ease-out spacing: the first items step
 * apart the most and later ones bunch up, which reads as a wave rather than a
 * metronome.
 */
export function staggerDelays(count: number, spreadMs: number): number[] {
  if (count <= 1) return count === 1 ? [0] : [];
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return Math.round(spreadMs * (1 - (1 - t) * (1 - t)));
  });
}

/** Cells of a picked range light up from the dimmed level (opacity-40) in date order. */
export const RANGE_SWEEP_SPREAD_MS = 200;

export const RANGE_SWEEP_KEYFRAMES: Keyframe[] = [{ opacity: 0.4 }, { opacity: 1 }];

export const RANGE_SWEEP_TIMING: KeyframeAnimationOptions = {
  duration: 160,
  easing: EASE_OUT_STRONG,
  fill: "backwards",
};
