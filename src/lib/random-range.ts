import type { CalendarDay } from "@/lib/calendar";
import { exactUnitOf, unitBounds, unitWindow, type CalendarUnit, type RangeSelection } from "@/lib/range";

/** Overview's Random skips periods with fewer Plays than this, unless none have more. */
export const RANDOM_RANGE_MIN_PLAYS = 5;

/**
 * A random whole day, week, month, or year that holds Plays. Every qualifying
 * period is equally likely, so busy years don't crowd out quiet ones. The
 * current period is skipped while another candidate exists.
 */
export function pickRandomRange(
  days: readonly CalendarDay[],
  unit: CalendarUnit,
  opts: { minPlays?: number; current?: RangeSelection | null } = {},
  random: () => number = Math.random,
): RangeSelection | null {
  const minPlays = opts.minPlays ?? RANDOM_RANGE_MIN_PLAYS;
  const totals = new Map<string, number>();
  for (const day of days) {
    if (day.count <= 0) continue;
    const from = unitBounds(day.date, unit).from;
    totals.set(from, (totals.get(from) ?? 0) + day.count);
  }

  const withPlays = [...totals.keys()].sort();
  if (withPlays.length === 0) return null;
  const busy = withPlays.filter((from) => (totals.get(from) ?? 0) >= minPlays);
  let candidates = busy.length > 0 ? busy : withPlays;

  const current = opts.current ? exactUnitOf(opts.current) : null;
  if (current?.unit === unit && candidates.length > 1) {
    candidates = candidates.filter((from) => from !== current.from);
  }

  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return unitWindow(candidates[index], unit);
}
