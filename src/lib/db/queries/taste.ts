import { getDb } from "../index";
import { computeTastePhases } from "@/lib/taste";
import type { TastePhasesData, WeekArtistRow } from "@/lib/taste/types";
import { sanitizeTimezone } from "./helpers";

export async function getWeeklyArtistCounts(tz: string): Promise<WeekArtistRow[]> {
  const sql = getDb();
  const safeTz = sanitizeTimezone(tz);
  const rows = (await sql`
    WITH p AS (
      SELECT (pl.played_at AT TIME ZONE ${safeTz})::date AS d,
             COALESCE(t.artist_group_key, lower(trim(t.artist_name)), t.id) AS artist_key,
             COALESCE(t.artist_name, t.name) AS artist_name
      FROM plays pl
      JOIN tracks t ON t.id = pl.track_id
    )
    SELECT TO_CHAR(d - EXTRACT(DOW FROM d)::int, 'YYYY-MM-DD') AS week,
           artist_key,
           artist_name,
           COUNT(*)::int AS plays
    FROM p
    GROUP BY 1, 2, 3
    ORDER BY 1 ASC;
  `) as Array<{
    week: string;
    artist_key: string;
    artist_name: string;
    plays: number;
  }>;

  return rows.map((r) => ({
    week: r.week,
    artistKey: r.artist_key,
    artistName: r.artist_name,
    plays: Number(r.plays),
  }));
}

export async function getTastePhasesData(tz: string): Promise<TastePhasesData> {
  const safeTz = sanitizeTimezone(tz);
  const rows = await getWeeklyArtistCounts(safeTz);
  return computeTastePhases(rows, safeTz);
}
