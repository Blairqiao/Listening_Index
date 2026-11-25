import { daysBetween, unitBounds, type CalendarUnit } from "@/lib/range";
import { LEVELS, type RulerLevel, type RulerUnit } from "@/lib/ruler/units";

/** Fixed pixels-per-day scale for each calendar zoom level. */
export const FIXED_PPD: Record<CalendarUnit, number> = {
  day: 12,
  week: 3,
  month: 1,
  year: 0.18,
};

const ALL_FILL_RATIO = 0.7;

/**
 * Target pixels-per-day when snapped to `level`. For `"all"`, fits the archive
 * into 70% of `rulerWidth` (falling back to a 1-day span when `archiveDays <= 0`).
 */
export function snapPpd(
  level: RulerLevel,
  rulerWidth: number,
  archiveDays: number,
): number {
  if (level === "all") {
    const span = archiveDays > 0 ? archiveDays : 1;
    return (rulerWidth * ALL_FILL_RATIO) / span;
  }
  return FIXED_PPD[level];
}

/** Closest zoom level to `ppd` by log-distance. */
export function nearestLevel(
  ppd: number,
  rulerWidth: number,
  archiveDays: number,
): RulerLevel {
  const logP = Math.log(ppd);
  let best: RulerLevel = LEVELS[0];
  let bestDist = Infinity;
  for (const lvl of LEVELS) {
    const d = Math.abs(logP - Math.log(snapPpd(lvl, rulerWidth, archiveDays)));
    if (d < bestDist) {
      bestDist = d;
      best = lvl;
    }
  }
  return best;
}

/** Blend factor in `[0, 1]`: 0 at the Year level and closer in, 1 at All. */
export function allBlend(
  ppd: number,
  rulerWidth: number,
  archiveDays: number,
): number {
  const hi = Math.log(snapPpd("year", rulerWidth, archiveDays));
  const lo = Math.log(snapPpd("all", rulerWidth, archiveDays));
  if (hi <= lo) return 0;
  return Math.max(0, Math.min(1, (hi - Math.log(ppd)) / (hi - lo)));
}

function centerDayFromBounds(
  from: string,
  to: string,
  firstKey: string,
): number {
  const startDay = daysBetween(firstKey, from);
  const spanDays = daysBetween(from, to);
  return startDay + spanDays / 2;
}

/** Full-bounds midpoint of `u` in days counted from `firstKey`. */
export function unitCenterDay(u: RulerUnit, firstKey: string): number {
  return centerDayFromBounds(u.from, u.to, firstKey);
}

/**
 * Resting day offset from `firstKey` for `level`: archive midpoint for `"all"`,
 * otherwise the full-bounds midpoint of the calendar unit holding `anchorKey`.
 */
export function restDay(
  level: RulerLevel,
  anchorKey: string,
  firstKey: string,
  todayKey: string,
): number {
  if (level === "all") {
    return daysBetween(firstKey, todayKey) / 2;
  }
  const { from, to } = unitBounds(anchorKey, level);
  return centerDayFromBounds(from, to, firstKey);
}
