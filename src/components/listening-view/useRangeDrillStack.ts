import { useCallback, useState } from "react";
import { isSameRange, zoomOutRange, type RangeSelection } from "@/lib/range";

/**
 * Keeps the drill stack in step with a range change that was not a drill:
 * a preset clears it, a range already on the stack trims it back to that
 * point, and anything else (a deeper window) leaves it alone.
 */
export function syncDrillStack(stack: RangeSelection[], next: RangeSelection): RangeSelection[] {
  if (next.kind === "preset") return stack.length ? [] : stack;
  const index = stack.findIndex((entry) => isSameRange(entry, next));
  return index === -1 ? stack : stack.slice(0, index);
}

/** Where the back button goes: the range drilled from, else one calendar unit up. */
export function rangeBackTarget(stack: RangeSelection[], current: RangeSelection): RangeSelection | null {
  if (current.kind === "preset") return null;
  return stack.length ? stack[stack.length - 1] : zoomOutRange(current);
}

/**
 * Remembers which ranges a histogram drill came from, so a back button can
 * return to them. `resetKey` clears the stack, e.g. when a different profile opens.
 */
export function useRangeDrillStack(range: RangeSelection, resetKey = "") {
  const [stack, setStack] = useState<RangeSelection[]>([]);
  const [seen, setSeen] = useState({ range, resetKey });

  if (seen.range !== range || seen.resetKey !== resetKey) {
    setSeen({ range, resetKey });
    setStack((s) => (seen.resetKey !== resetKey ? [] : syncDrillStack(s, range)));
  }

  const recordDrill = useCallback((from: RangeSelection) => {
    setStack((s) => [...s, from]);
  }, []);

  return { backTarget: rangeBackTarget(stack, range), recordDrill };
}
