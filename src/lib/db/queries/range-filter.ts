import { getDb } from "../index";
import {
  rangeGranularity,
  resolveRangeWindow,
  type CadenceGranularity,
  type RangeSelection,
  type TimeWindow,
} from "@/lib/range";

export interface ResolvedServerRange {
  sel: RangeSelection;
  window: TimeWindow;
  granularity: CadenceGranularity;
  logStart: string | null;
}

export async function resolveServerRange(
  sel: RangeSelection,
  tz: string,
  now = new Date(),
): Promise<ResolvedServerRange> {
  let logStart: string | null = null;
  if (sel.kind === "preset" && sel.key === "all") {
    const sql = getDb();
    const [row] = await sql`
      SELECT MIN(played_at) AS log_start_date FROM plays;
    `;
    if (row?.log_start_date) {
      logStart = new Date(row.log_start_date as string | Date).toISOString();
    }
  }

  const window = resolveRangeWindow(sel, { now, tz, logStart });
  const granularity = rangeGranularity(sel, window);
  return { sel, window, granularity, logStart };
}

export function buildTimeFilter(sel: RangeSelection, window: TimeWindow) {
  const sql = getDb();
  if (sel.kind === "preset") {
    if (sel.key === "all") {
      return sql`TRUE`;
    }
    // Keep non-all presets open-ended so Plays slightly ahead of the server clock stay included.
    return sql`p.played_at >= ${window.from}::timestamptz`;
  }
  return sql`p.played_at >= ${window.from}::timestamptz AND p.played_at < ${window.to}::timestamptz`;
}
