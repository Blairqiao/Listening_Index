import { getDb } from '../index';

export interface SessionQueryRow {
  id: string; track_id: string; artist_id: string | null; album_id: string | null;
  played_at: string; title: string; artist: string; album: string;
  album_image_url: string | null; duration_ms: number; is_first_play: boolean;
}

/** Read only complete Sessions touching the requested page, or the latest 20 Sessions. */
export async function getCompleteSessionRows(bounds?: { newest: {id:string;played_at:string}; oldest: {id:string;played_at:string} }): Promise<SessionQueryRow[]> {
  const sql=getDb();
  const anchor=bounds
    ? sql`SELECT id, played_at FROM plays WHERE id = ${bounds.newest.id}::bigint`
    : sql`SELECT id, played_at FROM plays ORDER BY played_at DESC,id DESC LIMIT 1`;
  const stop=bounds
    ? sql`((older.played_at,older.id) >= (${bounds.oldest.played_at}::timestamptz,${bounds.oldest.id}::bigint) OR walk.played_at-older.played_at <= INTERVAL '30 minutes')`
    : sql`walk.session_index + CASE WHEN walk.played_at-older.played_at > INTERVAL '30 minutes' THEN 1 ELSE 0 END <= 20`;
  return await sql`
    WITH RECURSIVE anchor AS (${anchor}),
    upper_edge AS (
      SELECT * FROM anchor
      UNION ALL
      SELECT newer.id,newer.played_at FROM upper_edge edge
      CROSS JOIN LATERAL (
        SELECT id,played_at FROM plays
        WHERE (played_at,id)>(edge.played_at,edge.id)
        ORDER BY played_at,id LIMIT 1
      ) newer
      WHERE newer.played_at-edge.played_at <= INTERVAL '30 minutes'
    ), newest AS (SELECT * FROM upper_edge ORDER BY played_at DESC,id DESC LIMIT 1),
    walk AS (
      SELECT id,played_at,1 AS session_index FROM newest
      UNION ALL
      SELECT older.id,older.played_at,
        walk.session_index + CASE WHEN walk.played_at-older.played_at > INTERVAL '30 minutes' THEN 1 ELSE 0 END
      FROM walk CROSS JOIN LATERAL (
        SELECT id,played_at FROM plays WHERE (played_at,id)<(walk.played_at,walk.id)
        ORDER BY played_at DESC,id DESC LIMIT 1
      ) older WHERE ${stop}
    )
    SELECT p.id::text,p.played_at,p.track_id,t.artist_id,t.album_id,t.name AS title,
      COALESCE(ar.name,t.artist_name,'') AS artist,COALESCE(al.name,t.album_name,'') AS album,
      al.image_url AS album_image_url,t.duration_ms,
      NOT EXISTS(SELECT 1 FROM plays first_play WHERE first_play.track_id=p.track_id
        AND (first_play.played_at,first_play.id)<(p.played_at,p.id)) AS is_first_play
    FROM walk JOIN plays p ON p.id=walk.id JOIN tracks t ON t.id=p.track_id
    LEFT JOIN artists ar ON ar.id=t.artist_id LEFT JOIN albums al ON al.id=t.album_id
    ORDER BY p.played_at DESC,p.id DESC
  ` as SessionQueryRow[];
}
