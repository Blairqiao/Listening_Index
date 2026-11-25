import { getDb } from "../index";
import type { CalendarData, CalendarDay } from "@/lib/calendar";
import { localDateKey } from "@/lib/range";
import { sanitizeTimezone } from "./helpers";

export async function getCalendarData(
  tz: string,
  now = new Date()
): Promise<CalendarData> {
  const sql = getDb();
  const safeTz = sanitizeTimezone(tz);
  const rows = (await sql`
    SELECT TO_CHAR(p.played_at AT TIME ZONE ${safeTz}, 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
    FROM plays p
    GROUP BY 1
    ORDER BY 1 ASC;
  `) as Array<{ date: string; count: number }>;

  const days: CalendarDay[] = rows.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));

  return {
    days,
    firstDate: days[0]?.date ?? null,
    today: localDateKey(now, tz),
    timezone: tz,
  };
}
