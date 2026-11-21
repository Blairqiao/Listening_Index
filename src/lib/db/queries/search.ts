import { getDb } from "../index";
import { isCatalogFullyEnriched } from "./enrichment";
import { computeSearchTotalPages, planSideColumn } from "@/lib/search-layout";
import {
  DEFAULT_SEARCH_FILTER,
  DEFAULT_SEARCH_SORT,
  SEARCH_SIDE_ROWS,
  SEARCH_SINGLE_TYPE_ROWS,
  SEARCH_TRACK_ROWS,
  type ProfileKind,
  type ProfileTarget,
  type SearchAlbumResult,
  type SearchArtistResult,
  type SearchFilter,
  type SearchResponse,
  type SearchSort,
  type SearchTrackResult,
} from "@/lib/search-types";

function toIsoOrNull(value: unknown): string | null {
  return value ? new Date(value as string | Date).toISOString() : null;
}

export async function searchCatalog(
  query: string,
  sort: SearchSort = DEFAULT_SEARCH_SORT,
  page = 1,
  filter: SearchFilter = DEFAULT_SEARCH_FILTER,
): Promise<SearchResponse> {
  const sql = getDb();
  const isEnriched = await isCatalogFullyEnriched();
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

  const trackCountPromise = sql`
    SELECT COUNT(DISTINCT t.id) AS total
    FROM plays p
    JOIN tracks t ON p.track_id = t.id
    LEFT JOIN artists ar ON t.artist_id = ar.id
    LEFT JOIN albums al ON t.album_id = al.id
    WHERE ${query === ""} OR (
      t.name_search LIKE ${pattern} ESCAPE '!'
      OR t.artist_name_search LIKE ${pattern} ESCAPE '!'
      OR ar.name_search LIKE ${pattern} ESCAPE '!'
      OR t.album_name_search LIKE ${pattern} ESCAPE '!'
      OR al.name_search LIKE ${pattern} ESCAPE '!'
    );
  `;

  const artistCountPromise = isEnriched
    ? sql`
        SELECT COUNT(*) AS total
        FROM (
          SELECT 1
          FROM plays p
          JOIN tracks t ON p.track_id = t.id
          LEFT JOIN artists ar ON t.artist_id = ar.id
          WHERE t.artist_id IS NOT NULL
            AND (${query === ""} OR ar.name_search LIKE ${pattern} ESCAPE '!')
          GROUP BY t.artist_id
        ) matched_artists;
      `
    : sql`
        SELECT COUNT(*) AS total
        FROM (
          SELECT 1
          FROM plays p
          JOIN tracks t ON p.track_id = t.id
          LEFT JOIN artists ar ON t.artist_id = ar.id
          WHERE t.artist_group_key IS NOT NULL
          GROUP BY t.artist_group_key
          HAVING ${query === ""} OR bool_or(
            t.artist_name_search LIKE ${pattern} ESCAPE '!'
            OR ar.name_search LIKE ${pattern} ESCAPE '!'
          )
        ) matched_artists;
      `;

  const albumCountPromise = isEnriched
    ? sql`
        SELECT COUNT(*) AS total
        FROM (
          SELECT 1
          FROM plays p
          JOIN tracks t ON p.track_id = t.id
          LEFT JOIN albums al ON t.album_id = al.id
          LEFT JOIN artists ar ON t.artist_id = ar.id
          WHERE t.album_id IS NOT NULL
          GROUP BY t.album_id
          HAVING ${query === ""} OR bool_or(
            al.name_search LIKE ${pattern} ESCAPE '!'
            OR ar.name_search LIKE ${pattern} ESCAPE '!'
            OR t.artist_name_search LIKE ${pattern} ESCAPE '!'
          )
        ) matched_albums;
      `
    : sql`
        SELECT COUNT(*) AS total
        FROM (
          SELECT 1
          FROM plays p
          JOIN tracks t ON p.track_id = t.id
          LEFT JOIN albums al ON t.album_id = al.id
          LEFT JOIN artists ar ON t.artist_id = ar.id
          WHERE t.album_group_key IS NOT NULL
          GROUP BY t.album_group_key
          HAVING ${query === ""} OR bool_or(
            t.album_name_search LIKE ${pattern} ESCAPE '!'
            OR al.name_search LIKE ${pattern} ESCAPE '!'
            OR t.artist_name_search LIKE ${pattern} ESCAPE '!'
            OR ar.name_search LIKE ${pattern} ESCAPE '!'
          )
        ) matched_albums;
      `;

  const [trackCountRows, artistCountRows, albumCountRows] = await Promise.all([
    trackCountPromise,
    artistCountPromise,
    albumCountPromise,
  ]);

  const trackTotal = Number(trackCountRows[0]?.total ?? 0);
  const artistTotal = Number(artistCountRows[0]?.total ?? 0);
  const albumTotal = Number(albumCountRows[0]?.total ?? 0);

  let trackOffset = 0;
  let trackLimit = 0;
  let artistOffset = 0;
  let artistLimit = 0;
  let albumOffset = 0;
  let albumLimit = 0;

  if (filter === "all") {
    trackOffset = (page - 1) * SEARCH_TRACK_ROWS;
    trackLimit = SEARCH_TRACK_ROWS;
    const side = planSideColumn({
      artistTotal,
      albumTotal,
      sideRows: SEARCH_SIDE_ROWS,
      page,
    });
    artistOffset = side.artistOffset;
    artistLimit = side.artistLimit;
    albumOffset = side.albumOffset;
    albumLimit = side.albumLimit;
  } else if (filter === "tracks") {
    trackOffset = (page - 1) * SEARCH_SINGLE_TYPE_ROWS;
    trackLimit = SEARCH_SINGLE_TYPE_ROWS;
  } else if (filter === "artists") {
    artistOffset = (page - 1) * SEARCH_SINGLE_TYPE_ROWS;
    artistLimit = SEARCH_SINGLE_TYPE_ROWS;
  } else {
    albumOffset = (page - 1) * SEARCH_SINGLE_TYPE_ROWS;
    albumLimit = SEARCH_SINGLE_TYPE_ROWS;
  }

  const tracksPromise =
    trackLimit === 0
      ? Promise.resolve<Record<string, unknown>[]>([])
      : sql`
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
            OR t.album_name_search LIKE ${pattern} ESCAPE '!'
            OR al.name_search LIKE ${pattern} ESCAPE '!'
          )
          GROUP BY t.id, t.name, ar.name, t.artist_name, al.name, t.album_name, al.image_url
          ORDER BY ${order}, t.name ASC, t.id ASC
          LIMIT ${trackLimit} OFFSET ${trackOffset};
        `;

  const artistsPromise =
    artistLimit === 0
      ? Promise.resolve<Record<string, unknown>[]>([])
      : isEnriched
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
              LIMIT ${artistLimit} OFFSET ${artistOffset}
            )
            SELECT
              ta.key,
              ta.name,
              ta.plays,
              ta.last_played_at,
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
              HAVING ${query === ""} OR bool_or(
                t.artist_name_search LIKE ${pattern} ESCAPE '!'
                OR ar.name_search LIKE ${pattern} ESCAPE '!'
              )
              ORDER BY ${order}, name ASC, key ASC
              LIMIT ${artistLimit} OFFSET ${artistOffset}
            )
            SELECT
              ta.key,
              ta.name,
              ta.plays,
              ta.last_played_at,
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

  const albumsPromise =
    albumLimit === 0
      ? Promise.resolve<Record<string, unknown>[]>([])
      : isEnriched
        ? sql`
            SELECT
              t.album_id AS key,
              COALESCE(MAX(al.name), MAX(t.album_name), '') AS name,
              COALESCE(MAX(ar.name), MAX(t.artist_name), '') AS artist,
              MAX(al.image_url) AS image_url,
              COUNT(p.id)::int AS plays,
              MAX(p.played_at) AS last_played_at
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            LEFT JOIN albums al ON t.album_id = al.id
            LEFT JOIN artists ar ON t.artist_id = ar.id
            WHERE t.album_id IS NOT NULL
            GROUP BY t.album_id
            HAVING ${query === ""} OR bool_or(
              al.name_search LIKE ${pattern} ESCAPE '!'
              OR ar.name_search LIKE ${pattern} ESCAPE '!'
              OR t.artist_name_search LIKE ${pattern} ESCAPE '!'
            )
            ORDER BY ${order}, name ASC, key ASC
            LIMIT ${albumLimit} OFFSET ${albumOffset};
          `
        : sql`
            SELECT
              t.album_group_key AS key,
              COALESCE(MAX(al.name), MAX(t.album_name), '') AS name,
              COALESCE(MAX(ar.name), MAX(t.artist_name), '') AS artist,
              MAX(al.image_url) AS image_url,
              COUNT(p.id)::int AS plays,
              MAX(p.played_at) AS last_played_at
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            LEFT JOIN albums al ON t.album_id = al.id
            LEFT JOIN artists ar ON t.artist_id = ar.id
            WHERE t.album_group_key IS NOT NULL
            GROUP BY t.album_group_key
            HAVING ${query === ""} OR bool_or(
              t.album_name_search LIKE ${pattern} ESCAPE '!'
              OR al.name_search LIKE ${pattern} ESCAPE '!'
              OR t.artist_name_search LIKE ${pattern} ESCAPE '!'
              OR ar.name_search LIKE ${pattern} ESCAPE '!'
            )
            ORDER BY ${order}, name ASC, key ASC
            LIMIT ${albumLimit} OFFSET ${albumOffset};
          `;

  const [trackRows, artistRows, albumRows] = await Promise.all([
    tracksPromise,
    artistsPromise,
    albumsPromise,
  ]);

  const artists: SearchArtistResult[] = artistRows.map((row) => ({
    key: String(row.key),
    name: String(row.name),
    plays: Number(row.plays),
    imageUrl: (row.image_url as string | null) ?? null,
    lastPlayedAt: toIsoOrNull(row.last_played_at),
  }));

  const albums: SearchAlbumResult[] = albumRows.map((row) => ({
    key: String(row.key),
    name: String(row.name),
    artist: String(row.artist),
    plays: Number(row.plays),
    imageUrl: (row.image_url as string | null) ?? null,
    lastPlayedAt: toIsoOrNull(row.last_played_at),
  }));

  const tracks: SearchTrackResult[] = trackRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    artist: String(row.artist),
    album: String(row.album),
    plays: Number(row.plays),
    albumImageUrl: (row.album_image_url as string | null) ?? null,
    lastPlayedAt: toIsoOrNull(row.last_played_at),
  }));

  const totalPages = computeSearchTotalPages({
    filter,
    trackTotal,
    artistTotal,
    albumTotal,
  });

  return {
    query,
    artists,
    albums,
    tracks,
    totals: {
      tracks: trackTotal,
      artists: artistTotal,
      albums: albumTotal,
    },
    totalPages,
    hasMore: page < totalPages,
  };
}

async function queryRandomPlayedKey(
  kind: ProfileKind,
  isEnriched: boolean,
): Promise<string | null> {
  const sql = getDb();

  const rows =
    kind === "track"
      ? await sql`
          SELECT key
          FROM (
            SELECT DISTINCT t.id AS key
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
          ) played_tracks
          ORDER BY RANDOM()
          LIMIT 1;
        `
      : kind === "artist"
        ? isEnriched
          ? await sql`
              SELECT key
              FROM (
                SELECT DISTINCT t.artist_id AS key
                FROM plays p
                JOIN tracks t ON p.track_id = t.id
                WHERE t.artist_id IS NOT NULL
              ) played_artists
              ORDER BY RANDOM()
              LIMIT 1;
            `
          : await sql`
              SELECT key
              FROM (
                SELECT DISTINCT t.artist_group_key AS key
                FROM plays p
                JOIN tracks t ON p.track_id = t.id
                WHERE t.artist_group_key IS NOT NULL
              ) played_artists
              ORDER BY RANDOM()
              LIMIT 1;
            `
        : isEnriched
          ? await sql`
              SELECT key
              FROM (
                SELECT DISTINCT t.album_id AS key
                FROM plays p
                JOIN tracks t ON p.track_id = t.id
                WHERE t.album_id IS NOT NULL
              ) played_albums
              ORDER BY RANDOM()
              LIMIT 1;
            `
          : await sql`
              SELECT key
              FROM (
                SELECT DISTINCT t.album_group_key AS key
                FROM plays p
                JOIN tracks t ON p.track_id = t.id
                WHERE t.album_group_key IS NOT NULL
              ) played_albums
              ORDER BY RANDOM()
              LIMIT 1;
            `;

  const key = rows[0]?.key;
  return key != null ? String(key) : null;
}

const ALL_PROFILE_KINDS: readonly ProfileKind[] = ["track", "artist", "album"];

export async function getRandomProfileTarget(
  filter: SearchFilter = DEFAULT_SEARCH_FILTER,
): Promise<ProfileTarget | null> {
  const isEnriched = await isCatalogFullyEnriched();
  const kind: ProfileKind =
    filter === "tracks"
      ? "track"
      : filter === "artists"
        ? "artist"
        : filter === "albums"
          ? "album"
          : ALL_PROFILE_KINDS[Math.floor(Math.random() * ALL_PROFILE_KINDS.length)];

  const key = await queryRandomPlayedKey(kind, isEnriched);
  if (key !== null) {
    return { kind, key };
  }

  if (filter === "all" && kind !== "track") {
    const fallbackKey = await queryRandomPlayedKey("track", isEnriched);
    if (fallbackKey !== null) {
      return { kind: "track", key: fallbackKey };
    }
  }

  return null;
}
