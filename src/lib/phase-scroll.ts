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

/**
 * Window scroll position that brings a highlighted range into view, or null
 * when it is already fully visible. A range that fits is centered in the
 * uncovered band; a taller one starts just under the top inset.
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
  const bandBottom = viewportHeight - bottomInset;
  if (rangeTop >= bandTop && rangeBottom <= bandBottom) return null;

  const bandHeight = bandBottom - bandTop;
  const rangeHeight = rangeBottom - rangeTop;
  const offset = rangeHeight <= bandHeight ? (bandHeight - rangeHeight) / 2 : 0;
  return Math.max(0, Math.round(scrollY + rangeTop - bandTop - offset));
}
