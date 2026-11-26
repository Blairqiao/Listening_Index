import type { CSSProperties } from "react";

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

// First-load entrance. ListeningView sets data-intro on the page root for
// INTRO_MS once data is ready; components carry a role class (intro-rise,
// intro-row, intro-fade, intro-grow in globals.css) and an --intro-delay.

/** How long data-intro stays on: past the last bar settling (220ms + 280ms). */
export const INTRO_MS = 600;

const METRIC_INTRO_DELAYS_MS = [0, 40, 70, 90];
const TRACK_ROW_INTRO_DELAYS_MS = [100, 130, 155, 175, 190, 200];

/** The four metric cells lead the entrance. */
export function metricIntroDelay(index: number): number {
  return METRIC_INTRO_DELAYS_MS[Math.min(index, METRIC_INTRO_DELAYS_MS.length - 1)];
}

/** The first six track rows step in; the rest arrive with the sixth. */
export function trackRowIntroDelay(index: number): number {
  return TRACK_ROW_INTRO_DELAYS_MS[Math.min(index, TRACK_ROW_INTRO_DELAYS_MS.length - 1)];
}

/** Artist and album indexes fade in as one beat. */
export const INDEX_INTRO_DELAY_MS = 140;

/** Activity bars grow left to right over 100ms, starting at 120ms. */
export function barIntroDelay(index: number, count: number): number {
  const t = count <= 1 ? 0 : index / (count - 1);
  return 120 + Math.round(100 * (1 - (1 - t) * (1 - t)));
}

export function introDelayStyle(ms: number): CSSProperties {
  return { "--intro-delay": `${ms}ms` } as CSSProperties;
}
