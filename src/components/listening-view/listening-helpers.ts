import { RANGE_KEYS, type RangeKey } from "@/lib/types";

/** Every Overview range, active first so the visible view refreshes before the rest. */
export function overviewRefreshOrder(activeRange: RangeKey): RangeKey[] {
  return [activeRange, ...RANGE_KEYS.filter((range) => range !== activeRange)];
}
