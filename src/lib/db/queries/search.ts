import { getDb } from "../index";
import { isCatalogFullyEnriched } from "./enrichment";
import {
  DEFAULT_SEARCH_SORT,
  SEARCH_RESULT_LIMIT,
  type SearchSort,
  type SearchArtistResult,
  type SearchResponse,
  type SearchTrackResult,
} from "@/lib/search-types";

export async function searchCatalog(
  query: string,
  sort: SearchSort = DEFAULT_SEARCH_SORT,
  page = 1,
): Promise<SearchResponse> {
  const sql = getDb();
  const isEnriched = await isCatalogFullyEnriched();
  const offset = (page - 1) * SEARCH_RESULT_LIMIT;
  const limit = SEARCH_RESULT_LIMIT + 1;
  const order = {
    "most-plays": sql`plays DESC`,
    "least-plays": sql`plays ASC`,
    recent: sql`last_played_at DESC`,
    oldest: sql`last_played_at ASC`,
  }[sort];

  // Escape after NFKD because it turns full-width percent signs and underscores into LIKE wildcards.
  const pattern = sql`'%' || replace(replace(replace(
      lower(regexp_replace(normalize(${query}::text, NFKD), '[\u0300-\u036f]', '', 'g')),
      '!', '!!'), '%', '!%'), '_', '!_') || '%'`;

  const tracksPromise = sql`
    SELECT
      t.id,
      t.name,
      COALESCE(ar.name, t.artist_name, '') AS artist,
      COALESCE(al.name, t.album_name, '') AS album,
      al.image_url AS album_image_url,
      COUNT(p.id)::int AS plays,
      MAX(p.played_at) AS last_played_at
    FROM plays p
    JOIN tracks t ON p.track_id = t.id
    LEFT JOIN artists ar ON t.artist_id = ar.id
    LEFT JOIN albums al ON t.album_id = al.id
    WHERE ${query === ""} OR (
      t.name_search LIKE ${pattern} ESCAPE '!'
      OR t.artist_name_search LIKE ${pattern} ESCAPE '!'
      OR ar.name_search LIKE ${pattern} ESCAPE '!'
    )
    GROUP BY t.id, t.name, ar.name, t.artist_name, al.name, t.album_name, al.image_url
    ORDER BY ${order}, t.name ASC, t.id ASC
    LIMIT ${limit} OFFSET ${offset};
  `;

  const artistsPromise = isEnriched
    ? sql`
        WITH top_artists AS (
          SELECT
            t.artist_id AS key,
            COALESCE(MAX(ar.name), MAX(t.artist_name), '') AS name,
            COUNT(p.id)::int AS plays,
            MAX(p.played_at) AS last_played_at
          FROM plays p
          JOIN tracks t ON p.track_id = t.id
          LEFT JOIN artists ar ON t.artist_id = ar.id
          WHERE t.artist_id IS NOT NULL
            AND (${query === ""} OR ar.name_search LIKE ${pattern} ESCAPE '!')
          GROUP BY t.artist_id
          ORDER BY ${order}, name ASC, key ASC
          LIMIT ${limit} OFFSET ${offset}
        )
        SELECT
          ta.key,
          ta.name,
          ta.plays,
          img.image_url
        FROM top_artists ta
        LEFT JOIN LATERAL (
          SELECT MAX(al.image_url) AS image_url
          FROM plays p2
          JOIN tracks t2 ON p2.track_id = t2.id
          LEFT JOIN albums al ON t2.album_id = al.id
          WHERE t2.artist_id = ta.key
            AND t2.album_id IS NOT NULL
          GROUP BY t2.album_id
          ORDER BY COUNT(p2.id) DESC, COALESCE(MAX(al.name), MAX(t2.album_name)) ASC
          LIMIT 1
        ) img ON TRUE
        ORDER BY ${order}, ta.name ASC, ta.key ASC;
      `
    : sql`
        WITH top_artists AS (
          SELECT
            t.artist_group_key AS key,
            COALESCE(MAX(ar.name), MAX(t.artist_name), '') AS name,
            COUNT(p.id)::int AS plays,
            MAX(p.played_at) AS last_played_at
          FROM plays p
          JOIN tracks t ON p.track_id = t.id
          LEFT JOIN artists ar ON t.artist_id = ar.id
          WHERE t.artist_group_key IS NOT NULL
          GROUP BY t.artist_group_key
          HAVING ${query === ""} OR bool_or(t.artist_name_search LIKE ${pattern} ESCAPE '!')
          ORDER BY ${order}, name ASC, key ASC
          LIMIT ${limit} OFFSET ${offset}
        )
        SELECT
          ta.key,
          ta.name,
          ta.plays,
          img.image_url
        FROM top_artists ta
        LEFT JOIN LATERAL (
          SELECT MAX(al.image_url) AS image_url
          FROM plays p2
          JOIN tracks t2 ON p2.track_id = t2.id
          LEFT JOIN albums al ON t2.album_id = al.id
          WHERE t2.artist_group_key = ta.key
            AND t2.album_group_key IS NOT NULL
          GROUP BY t2.album_group_key
          ORDER BY COUNT(p2.id) DESC, COALESCE(MAX(al.name), MAX(t2.album_name)) ASC
          LIMIT 1
        ) img ON TRUE
        ORDER BY ${order}, ta.name ASC, ta.key ASC;
      `;

  const [trackRows, artistRows] = await Promise.all([tracksPromise, artistsPromise]);

  const artists: SearchArtistResult[] = artistRows.slice(0, SEARCH_RESULT_LIMIT).map((row) => ({
    key: String(row.key),
    name: String(row.name),
    plays: Number(row.plays),
    imageUrl: (row.image_url as string | null) ?? null,
  }));

  const tracks: SearchTrackResult[] = trackRows.slice(0, SEARCH_RESULT_LIMIT).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    artist: String(row.artist),
    album: String(row.album),
    plays: Number(row.plays),
    albumImageUrl: (row.album_image_url as string | null) ?? null,
  }));

  return {
    query,
    artists,
    tracks,
    hasMore: artistRows.length > SEARCH_RESULT_LIMIT || trackRows.length > SEARCH_RESULT_LIMIT,
  };
}
