import type { CSSProperties } from "react";
import type { Mode } from "@/lib/types";

// First-load entrance. The page root arrives with data-intro="pending", which
// holds the intro elements hidden. Once the page has hydrated and its fonts
// are in, ListeningView switches it to "playing" for INTRO_MS. Components
// carry a role class (intro-rise, intro-row, intro-fade, intro-grow in
// globals.css) and an --intro-delay.
//
// The detailed timeline below is Overview's. Other tabs share the header,
// tabs and ribbon beats, and their view body rises as one block after them.

export type IntroPhase = "pending" | "playing" | "done";

/** When the last element settles: the last bar starts at 440ms and grows for 500ms. */
export const INTRO_SETTLE_MS = 940;

/** How long "playing" lasts, a little past the settle. */
export const INTRO_MS = 1050;

/** Matches drawer-enter in globals.css. */
export const MINI_PLAYER_ENTER_MS = 240;

/** Matches intro-rise in globals.css. */
const RISE_MS = 450;

/** "playing" outlasts the settle by this much. */
const INTRO_TAIL_MS = INTRO_MS - INTRO_SETTLE_MS;

/**
 * When a non-Overview view body starts rising: after the ribbon on tabs that
 * have one, first on Search and profiles. Null for Overview, which staggers
 * its own parts.
 */
export function viewIntroDelay(mode: Mode): number | null {
  if (mode === 0) return null;
  return mode === 4 ? 0 : 200;
}

/**
 * When the open tab's entrance settles. Overview and profiles end with the
 * activity bars; the other tabs end when their body has risen.
 */
export function introSettleMs(mode: Mode, hasProfileTarget = false): number {
  const body = viewIntroDelay(mode);
  if (body === null || (mode === 4 && hasProfileTarget)) return INTRO_SETTLE_MS;
  return body + RISE_MS;
}

/** How long "playing" lasts, a little past the settle. */
export function introDurationMs(settleMs: number): number {
  return settleMs + INTRO_TAIL_MS;
}

/** Longest the entrance waits for a tab's own data (Calendar, a profile) before it plays anyway. */
export const VIEW_INTRO_WAIT_MS = 1200;

export interface IntroViewState {
  isCalendarLoading: boolean;
  hasProfileTarget: boolean;
  isProfileLoading: boolean;
}

/**
 * Whether the open tab has what it shows on first load. Overview, Stream log
 * and Sessions arrive with the server HTML; Calendar and profiles load after.
 */
export function isIntroViewReady(mode: Mode, state: IntroViewState): boolean {
  if (mode === 5) return !state.isCalendarLoading;
  if (mode === 4 && state.hasProfileTarget) return !state.isProfileLoading;
  return true;
}

/**
 * Delay before the mini player slides up during the first-load entrance, so
 * it lands as the rest settles. Zero once that moment has passed.
 */
export function miniPlayerIntroDelay(msSinceIntroStart: number, settleMs: number = INTRO_SETTLE_MS): number {
  return Math.max(0, Math.round(settleMs - MINI_PLAYER_ENTER_MS - msSinceIntroStart));
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
