import type { CSSProperties } from "react";

// First-load entrance. The page root arrives with data-intro="pending", which
// holds the intro elements hidden. Once the page has hydrated and its fonts
// are in, ListeningView switches it to "playing" for INTRO_MS. Components
// carry a role class (intro-rise, intro-row, intro-fade, intro-grow in
// globals.css) and an --intro-delay.

export type IntroPhase = "pending" | "playing" | "done";

/** How long "playing" lasts: past the last bar settling (440ms + 500ms). */
export const INTRO_MS = 1050;

const METRIC_INTRO_DELAYS_MS = [0, 70, 120, 160];
const TRACK_ROW_INTRO_DELAYS_MS = [200, 250, 290, 320, 345, 365];

/** The four metric cells lead the entrance. */
export function metricIntroDelay(index: number): number {
  return METRIC_INTRO_DELAYS_MS[Math.min(index, METRIC_INTRO_DELAYS_MS.length - 1)];
}

/** The first six track rows step in; the rest arrive with the sixth. */
export function trackRowIntroDelay(index: number): number {
  return TRACK_ROW_INTRO_DELAYS_MS[Math.min(index, TRACK_ROW_INTRO_DELAYS_MS.length - 1)];
}

/** Artist and album indexes fade in as one beat. */
export const INDEX_INTRO_DELAY_MS = 260;

/** Activity bars grow left to right over 200ms, starting at 240ms. */
export function barIntroDelay(index: number, count: number): number {
  const t = count <= 1 ? 0 : index / (count - 1);
  return 240 + Math.round(200 * (1 - (1 - t) * (1 - t)));
}

export function introDelayStyle(ms: number): CSSProperties {
  return { "--intro-delay": `${ms}ms` } as CSSProperties;
}
