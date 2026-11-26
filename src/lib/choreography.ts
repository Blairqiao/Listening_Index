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
