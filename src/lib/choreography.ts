import type { CSSProperties } from "react";

// First-load entrance. The page root arrives with data-intro="pending", which
// holds the intro elements hidden. Once the page has hydrated and its fonts
// are in, ListeningView switches it to "playing" for INTRO_MS. Components
// carry a role class (intro-rise, intro-row, intro-fade, intro-grow in
// globals.css) and an --intro-delay.

export type IntroPhase = "pending" | "playing" | "done";

/** When the last element settles: the last bar starts at 440ms and grows for 500ms. */
export const INTRO_SETTLE_MS = 940;

/** How long "playing" lasts, a little past the settle. */
export const INTRO_MS = 1050;

/** Matches drawer-enter in globals.css. */
export const MINI_PLAYER_ENTER_MS = 240;

/**
 * Delay before the mini player slides up during the first-load entrance, so
 * it lands as the rest settles. Zero once that moment has passed.
 */
export function miniPlayerIntroDelay(msSinceIntroStart: number): number {
  return Math.max(0, Math.round(INTRO_SETTLE_MS - MINI_PLAYER_ENTER_MS - msSinceIntroStart));
}

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
