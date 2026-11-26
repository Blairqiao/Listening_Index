export interface PhaseScrollInput {
  /** Top and bottom of the highlighted range, relative to the viewport. */
  rangeTop: number;
  rangeBottom: number;
  viewportHeight: number;
  scrollY: number;
  /** Space covered at the top, such as a sticky bar. */
  topInset: number;
  /** Space covered at the bottom, such as a fixed player bar. */
  bottomInset: number;
}

/** Ranges this close to their resting spot stay put, so a re-pick doesn't jiggle. */
const SETTLE_TOLERANCE_PX = 24;

/**
 * Window scroll position that centers a highlighted range in the uncovered
 * band, or null when it already sits there. A taller range starts just under
 * the top inset.
 */
export function phaseScrollTarget({
  rangeTop,
  rangeBottom,
  viewportHeight,
  scrollY,
  topInset,
  bottomInset,
}: PhaseScrollInput): number | null {
  const bandTop = topInset;
  const bandHeight = viewportHeight - bottomInset - bandTop;
  const rangeHeight = rangeBottom - rangeTop;
  const offset = rangeHeight <= bandHeight ? (bandHeight - rangeHeight) / 2 : 0;
  const delta = rangeTop - bandTop - offset;
  if (Math.abs(delta) <= SETTLE_TOLERANCE_PX) return null;
  return Math.max(0, Math.round(scrollY + delta));
}
