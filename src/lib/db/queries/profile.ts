import { getDb } from "../index";
import { isCatalogFullyEnriched } from "./enrichment";
import { sanitizeTimezone } from "./helpers";
import { OVERVIEW_INTERVAL_CONFIG } from "./overview";
import { buildCadenceQuery, buildProfileCadence, type CadenceScope } from "./cadence";
import { artistShare } from "@/lib/profile-stats";
import type { RangeKey } from "@/lib/types";
import {
  PROFILE_ALBUM_PROFILE_TRACKS_LIMIT,
  PROFILE_ALBUM_TRACKS_LIMIT,
  PROFILE_RECENT_PLAYS_LIMIT,
  PROFILE_TOP_ALBUMS_LIMIT,
  PROFILE_TOP_TRACKS_LIMIT,
  type ProfileAlbumTrack,
  type ProfileData,
  type ProfilePlay,
  type ProfileTarget,
  type ProfileTopAlbum,
  type ProfileTopTrack,
} from "@/lib/search-types";

function toIso(value: unknown): string {
  return new Date(value as string | Date).toISOString();
}

function mapRecentPlays(rows: Record<string, unknown>[]): ProfilePlay[] {
  return rows.map((row) => ({
    id: String(row.id),
    trackId: String(row.track_id),
    playedAt: toIso(row.played_at),
    title: String(row.title),
    artist: String(row.artist),
    album: String(row.album),
    durationMs: Number(row.duration_ms) || 0,
    albumImageUrl: (row.album_image_url as string | null) ?? null,
  }));
}

function toHourOfDay(rows: Record<string, unknown>[]): number[] {
  const counts = Array<number>(24).fill(0);
  for (const { hour, plays } of rows) counts[Number(hour)] = Number(plays);
  return counts;
}

export async function getProfile(
  target: ProfileTarget,
  range: RangeKey,
  tz: string
): Promise<ProfileData | null> {
  const sql = getDb();
  const safeTz = sanitizeTimezone(tz);
  const isAll = range === "all";
  const timeFilter = isAll
    ? sql`TRUE`
    : sql`p.played_at >= NOW() - (${OVERVIEW_INTERVAL_CONFIG[range].cur})::interval`;

  if (target.kind === "track") {
    const trackRows = await sql`
      SELECT
        t.id,
        t.name,
        t.artist_id,
        t.artist_group_key,
        t.album_id,
        t.album_group_key,
        COALESCE(ar.name, t.artist_name) AS artist_name,
        COALESCE(al.name, t.album_name) AS album_name,
        al.image_url,
        MIN(p.played_at) AS first_played_at,
        MAX(p.played_at) AS last_played_at,
        COUNT(p.id)::int AS lifetime_plays
      FROM tracks t
      JOIN plays p ON p.track_id = t.id
      LEFT JOIN artists ar ON t.artist_id = ar.id
      LEFT JOIN albums al ON t.album_id = al.id
      WHERE t.id = ${target.key}
      GROUP BY t.id, t.name, t.artist_id, t.artist_group_key, t.album_id, t.album_group_key, ar.name, t.artist_name, al.name, t.album_name, al.image_url;
    `;
    const trackRow = trackRows[0];
    if (!trackRow || Number(trackRow.lifetime_plays) === 0) {
      return null;
    }

    const trackId = String(trackRow.id);

    const isEnriched = await isCatalogFullyEnriched();
    const { artist_id: artistId, artist_group_key: artistGroupKey,
      album_id: albumId, album_group_key: albumGroupKey } = trackRow;
    const activeArtistKey = isEnriched ? artistId : artistGroupKey;
    const activeAlbumKey = isEnriched ? albumId : albumGroupKey;
    const artistFilter = isEnriched
      ? sql`t.artist_id = ${activeArtistKey}`
      : sql`t.artist_group_key = ${activeArtistKey}`;
    const albumFilter = albumId != null
      ? sql`t.album_id = ${albumId}`
      : albumGroupKey != null && artistGroupKey != null
        ? sql`t.album_id IS NULL AND t.album_group_key = ${albumGroupKey} AND t.artist_group_key = ${artistGroupKey}`
        : null;

    const [
      rankAndPlaysRows, rankedTotalRows, cadenceRows, recentPlayRows,
      hourRows, streakRows, artistPlayRows, albumRows,
    ] =
      await Promise.all([
        sql`
          SELECT plays::int, rank::int FROM (
            SELECT
              p.track_id,
              COUNT(*) AS plays,
              DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS rank
            FROM plays p
            WHERE ${timeFilter}
            GROUP BY p.track_id
          ) r
          WHERE r.track_id = ${trackId};
        `,
        sql`
          SELECT COUNT(DISTINCT p.track_id)::int AS total
          FROM plays p
          WHERE ${timeFilter};
        `,
        buildCadenceQuery(range, safeTz, { kind: "track", trackId }),
        sql`
          SELECT
            p.id::text,
            p.played_at,
            p.track_id,
            al.image_url AS album_image_url,
            t.name AS title,
            COALESCE(ar.name, t.artist_name, '') AS artist,
            COALESCE(al.name, t.album_name, '') AS album,
            t.duration_ms
          FROM plays p
          JOIN tracks t ON p.track_id = t.id
          LEFT JOIN albums al ON t.album_id = al.id
          LEFT JOIN artists ar ON t.artist_id = ar.id
          WHERE p.track_id = ${trackId} AND ${timeFilter}
          ORDER BY p.played_at DESC, p.id DESC
          LIMIT ${PROFILE_RECENT_PLAYS_LIMIT};
        `,
        sql`
          SELECT EXTRACT(HOUR FROM p.played_at AT TIME ZONE ${safeTz})::int AS hour, COUNT(*)::int AS plays
          FROM plays p WHERE p.track_id = ${trackId} AND ${timeFilter}
          GROUP BY 1;
        `,
        sql`
          WITH distinct_days AS (
            SELECT DISTINCT (p.played_at AT TIME ZONE ${safeTz})::date AS day
            FROM plays p WHERE p.track_id = ${trackId} AND ${timeFilter}
          ), streak_groups AS (
            SELECT day - (ROW_NUMBER() OVER (ORDER BY day))::int AS streak_start FROM distinct_days
          )
          SELECT COALESCE(MAX(days), 0)::int AS streak
          FROM (SELECT COUNT(*) AS days FROM streak_groups GROUP BY streak_start) streaks;
        `,
        activeArtistKey == null ? [] : sql`
          SELECT COUNT(*)::int AS plays
          FROM plays p JOIN tracks t ON t.id = p.track_id
          WHERE ${artistFilter} AND ${timeFilter};
        `,
        albumFilter === null ? [] : sql`
          SELECT t.id, t.name, COUNT(p.id)::int AS plays
          FROM plays p JOIN tracks t ON t.id = p.track_id
          WHERE ${albumFilter} AND ${timeFilter}
          GROUP BY t.id, t.name
          ORDER BY plays DESC, t.name ASC, t.id ASC
          LIMIT ${PROFILE_ALBUM_TRACKS_LIMIT};
        `,
      ]);

    const plays = Number(rankAndPlaysRows[0]?.plays ?? 0);
    const rank =
      plays > 0 && rankAndPlaysRows[0]?.rank != null
        ? Number(rankAndPlaysRows[0].rank)
        : null;
    const rankedTotal = Number(rankedTotalRows[0]?.total ?? 0);

    const cadence = buildProfileCadence({
      range,
      tz: safeTz,
      cadenceRows: cadenceRows as Record<string, unknown>[],
      minDateRow: { log_start_date: toIso(trackRow.first_played_at) },
    });

    const artistPlays = Number(artistPlayRows[0]?.plays ?? 0);
    const albumTracks: ProfileAlbumTrack[] = albumRows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      plays: Number(row.plays),
      isCurrent: row.id === trackId,
    }));

    return {
      kind: "track",
      key: trackId,
      name: String(trackRow.name),
      artistName: (trackRow.artist_name as string | null) ?? null,
      albumName: (trackRow.album_name as string | null) ?? null,
      imageUrl: (trackRow.image_url as string | null) ?? null,
      range,
      firstPlayedAt: trackRow.first_played_at ? toIso(trackRow.first_played_at) : null,
      lastPlayedAt: trackRow.last_played_at ? toIso(trackRow.last_played_at) : null,
      plays,
      rank,
      rankedTotal,
      ...cadence,
      artistKey: (activeArtistKey ?? artistId ?? artistGroupKey ?? undefined) as string | undefined,
      albumKey: (activeAlbumKey ?? albumId ?? albumGroupKey ?? undefined) as string | undefined,
      trackStats: {
        artistShare: artistShare(plays, artistPlays),
        artistPlays,
        longestStreakDays: Number(streakRows[0]?.streak ?? 0),
      },
      hourOfDay: toHourOfDay(hourRows),
      albumTracks,
      topTracks: [],
      topAlbums: [],
      recentPlays: mapRecentPlays(recentPlayRows as Record<string, unknown>[]),
    };
  }

  if (target.kind === "album") {
    return getAlbumProfile(target, range, safeTz, timeFilter);
  }

  // Artist profile: resolve either key form with active identity form taking precedence.
  const isEnriched = await isCatalogFullyEnriched();
  const resolveRows = isEnriched
    ? await sql`
        SELECT COALESCE(
          (SELECT id FROM artists WHERE id = ${target.key} LIMIT 1),
          (SELECT MAX(t.artist_id) FROM tracks t WHERE t.artist_group_key = ${target.key} AND t.artist_id IS NOT NULL)
        ) AS resolved_key;
      `
    : await sql`
        SELECT COALESCE(
          (SELECT t.artist_group_key FROM tracks t WHERE t.artist_group_key = ${target.key} LIMIT 1),
          (SELECT MAX(t.artist_group_key) FROM tracks t WHERE t.artist_id = ${target.key} AND t.artist_group_key IS NOT NULL)
        ) AS resolved_key;
      `;

  const resolvedKey = resolveRows[0]?.resolved_key ? String(resolveRows[0].resolved_key) : null;
  if (!resolvedKey) {
    return null;
  }

  const artistFilter = isEnriched
    ? sql`t.artist_id = ${resolvedKey}`
    : sql`t.artist_group_key = ${resolvedKey}`;
  const artistGroupCol = isEnriched ? sql`t.artist_id` : sql`t.artist_group_key`;
  const artistFilterForRank = isEnriched ? sql`t.artist_id IS NOT NULL` : sql`TRUE`;
  const albumGroupCol = isEnriched ? sql`t.album_id` : sql`t.album_group_key`;
  const albumFilterForRanking = isEnriched ? sql`t.album_id IS NOT NULL` : sql`TRUE`;

  const lifetimeRows = await sql`
    SELECT
      COALESCE(MAX(ar.name), MAX(t.artist_name), '') AS name,
      MIN(p.played_at) AS first_played_at,
      MAX(p.played_at) AS last_played_at,
      COUNT(p.id)::int AS lifetime_plays
    FROM plays p
    JOIN tracks t ON p.track_id = t.id
    LEFT JOIN artists ar ON t.artist_id = ar.id
    WHERE ${artistFilter};
  `;
  const lifetimeRow = lifetimeRows[0];
  if (!lifetimeRow || Number(lifetimeRow.lifetime_plays) === 0) {
    return null;
  }

  const scope: CadenceScope = {
    kind: "artist",
    column: isEnriched ? "artist_id" : "artist_group_key",
    value: resolvedKey,
  };

  const [
    rankAndPlaysRows,
    rankedTotalRows,
    imageRows,
    cadenceRows,
    topTrackRows,
    topAlbumRows,
    recentPlayRows,
    hourRows,
  ] = await Promise.all([
    sql`
      SELECT plays::int, rank::int FROM (
        SELECT
          ${artistGroupCol} AS artist_key,
          COUNT(p.id) AS plays,
          ROW_NUMBER() OVER (
            ORDER BY COUNT(p.id) DESC, COALESCE(MAX(ar.name), MAX(t.artist_name)) ASC
          ) AS rank
        FROM plays p
        JOIN tracks t ON p.track_id = t.id
        LEFT JOIN artists ar ON t.artist_id = ar.id
        WHERE ${timeFilter} AND ${artistFilterForRank}
        GROUP BY ${artistGroupCol}
      ) r
      WHERE r.artist_key = ${resolvedKey};
    `,
    sql`
      SELECT ${isEnriched ? sql`COUNT(DISTINCT t.artist_id)::int` : sql`COUNT(DISTINCT t.artist_group_key)::int`} AS total
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      WHERE ${timeFilter} AND ${artistFilterForRank};
    `,
    sql`
      SELECT MAX(al.image_url) AS image_url
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      LEFT JOIN albums al ON t.album_id = al.id
      WHERE ${artistFilter} AND ${albumGroupCol} IS NOT NULL
      GROUP BY ${albumGroupCol}
      ORDER BY COUNT(p.id) DESC, COALESCE(MAX(al.name), MAX(t.album_name)) ASC
      LIMIT 1;
    `,
    buildCadenceQuery(range, safeTz, scope),
    sql`
      SELECT
        t.id,
        t.name,
        COUNT(p.id)::int AS plays,
        al.image_url AS album_image_url
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      LEFT JOIN albums al ON t.album_id = al.id
      WHERE ${timeFilter} AND ${artistFilter}
      GROUP BY t.id, t.name, al.image_url
      ORDER BY plays DESC, t.name ASC
      LIMIT ${PROFILE_TOP_TRACKS_LIMIT};
    `,
    sql`
      SELECT
        ${isEnriched ? sql`t.album_id` : sql`MAX(t.album_id)`} AS id,
        ${albumGroupCol} AS key,
        COALESCE(MAX(al.name), MAX(t.album_name), '') AS name,
        COUNT(p.id)::int AS plays,
        MAX(al.image_url) AS image_url
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      LEFT JOIN albums al ON t.album_id = al.id
      WHERE ${timeFilter} AND ${artistFilter} AND ${albumFilterForRanking}
      GROUP BY ${albumGroupCol}
      ORDER BY plays DESC, name ASC
      LIMIT ${PROFILE_TOP_ALBUMS_LIMIT};
    `,
    sql`
      SELECT
        p.id::text,
        p.played_at,
        p.track_id,
        al.image_url AS album_image_url,
        t.name AS title,
        COALESCE(ar.name, t.artist_name, '') AS artist,
        COALESCE(al.name, t.album_name, '') AS album,
        t.duration_ms
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      LEFT JOIN albums al ON t.album_id = al.id
      LEFT JOIN artists ar ON t.artist_id = ar.id
      WHERE ${timeFilter} AND ${artistFilter}
      ORDER BY p.played_at DESC, p.id DESC
      LIMIT ${PROFILE_RECENT_PLAYS_LIMIT};
    `,
    sql`
      SELECT EXTRACT(HOUR FROM p.played_at AT TIME ZONE ${safeTz})::int AS hour, COUNT(*)::int AS plays
      FROM plays p JOIN tracks t ON p.track_id = t.id
      WHERE ${timeFilter} AND ${artistFilter}
      GROUP BY 1;
    `,
  ]);

  const plays = Number(rankAndPlaysRows[0]?.plays ?? 0);
  const rank =
    plays > 0 && rankAndPlaysRows[0]?.rank != null
      ? Number(rankAndPlaysRows[0].rank)
      : null;
  const rankedTotal = Number(rankedTotalRows[0]?.total ?? 0);

  const cadence = buildProfileCadence({
    range,
    tz: safeTz,
    cadenceRows: cadenceRows as Record<string, unknown>[],
    minDateRow: { log_start_date: toIso(lifetimeRow.first_played_at) },
  });

  const topTracks: ProfileTopTrack[] = topTrackRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    plays: Number(row.plays),
    albumImageUrl: (row.album_image_url as string | null) ?? null,
  }));

  const topAlbums: ProfileTopAlbum[] = topAlbumRows.map((row) => ({
    id: row.id ? String(row.id) : undefined,
    key: row.key ? String(row.key) : undefined,
    name: String(row.name),
    plays: Number(row.plays),
    imageUrl: (row.image_url as string | null) ?? null,
  }));

  return {
    kind: "artist",
    key: resolvedKey,
    name: String(lifetimeRow.name),
    artistName: null,
    albumName: null,
    imageUrl: (imageRows[0]?.image_url as string | null) ?? null,
    range,
    firstPlayedAt: lifetimeRow.first_played_at ? toIso(lifetimeRow.first_played_at) : null,
    lastPlayedAt: lifetimeRow.last_played_at ? toIso(lifetimeRow.last_played_at) : null,
    plays,
    rank,
    rankedTotal,
    ...cadence,
    hourOfDay: toHourOfDay(hourRows),
    topTracks,
    topAlbums,
    recentPlays: mapRecentPlays(recentPlayRows as Record<string, unknown>[]),
  };
}

async function getAlbumProfile(
  target: ProfileTarget,
  range: RangeKey,
  safeTz: string,
  timeFilter: ReturnType<ReturnType<typeof getDb>>
): Promise<ProfileData | null> {
  const sql = getDb();
  const isEnriched = await isCatalogFullyEnriched();
  const resolveRows = isEnriched
    ? await sql`
        SELECT COALESCE(
          (SELECT id FROM albums WHERE id = ${target.key} LIMIT 1),
          (SELECT MAX(t.album_id) FROM tracks t WHERE t.album_group_key = ${target.key} AND t.album_id IS NOT NULL)
        ) AS resolved_key;
      `
    : await sql`
        SELECT COALESCE(
          (SELECT t.album_group_key FROM tracks t WHERE t.album_group_key = ${target.key} LIMIT 1),
          (SELECT MAX(t.album_group_key) FROM tracks t WHERE t.album_id = ${target.key} AND t.album_group_key IS NOT NULL)
        ) AS resolved_key;
      `;

  const resolvedKey = resolveRows[0]?.resolved_key ? String(resolveRows[0].resolved_key) : null;
  if (!resolvedKey) {
    return null;
  }

  const albumFilter = isEnriched
    ? sql`t.album_id = ${resolvedKey}`
    : sql`t.album_group_key = ${resolvedKey}`;
  const albumGroupCol = isEnriched ? sql`t.album_id` : sql`t.album_group_key`;
  const albumFilterForRank = isEnriched
    ? sql`t.album_id IS NOT NULL`
    : sql`t.album_group_key IS NOT NULL`;
  const artistKeyCol = isEnriched ? sql`t.artist_id` : sql`t.artist_group_key`;

  const lifetimeRows = await sql`
    SELECT
      COALESCE(MAX(al.name), MAX(t.album_name), '') AS name,
      COALESCE(MAX(ar.name), MAX(t.artist_name)) AS artist_name,
      MAX(${artistKeyCol}) AS artist_key,
      MAX(al.image_url) AS image_url,
      MIN(p.played_at) AS first_played_at,
      MAX(p.played_at) AS last_played_at,
      COUNT(p.id)::int AS lifetime_plays
    FROM plays p
    JOIN tracks t ON p.track_id = t.id
    LEFT JOIN albums al ON t.album_id = al.id
    LEFT JOIN artists ar ON t.artist_id = ar.id
    WHERE ${albumFilter};
  `;
  const lifetimeRow = lifetimeRows[0];
  if (!lifetimeRow || Number(lifetimeRow.lifetime_plays) === 0) {
    return null;
  }

  const scope: CadenceScope = {
    kind: "album",
    column: isEnriched ? "album_id" : "album_group_key",
    value: resolvedKey,
  };

  const [
    rankAndPlaysRows,
    rankedTotalRows,
    cadenceRows,
    topTrackRows,
    recentPlayRows,
    hourRows,
  ] = await Promise.all([
    sql`
      SELECT plays::int, rank::int FROM (
        SELECT
          ${albumGroupCol} AS album_key,
          COUNT(p.id) AS plays,
          ROW_NUMBER() OVER (
            ORDER BY COUNT(p.id) DESC, COALESCE(MAX(al.name), MAX(t.album_name), '') ASC, ${albumGroupCol} ASC
          ) AS rank
        FROM plays p
        JOIN tracks t ON p.track_id = t.id
        LEFT JOIN albums al ON t.album_id = al.id
        WHERE ${timeFilter} AND ${albumFilterForRank}
        GROUP BY ${albumGroupCol}
      ) r
      WHERE r.album_key = ${resolvedKey};
    `,
    sql`
      SELECT ${isEnriched ? sql`COUNT(DISTINCT t.album_id)::int` : sql`COUNT(DISTINCT t.album_group_key)::int`} AS total
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      WHERE ${timeFilter} AND ${albumFilterForRank};
    `,
    buildCadenceQuery(range, safeTz, scope),
    sql`
      SELECT
        t.id,
        t.name,
        COUNT(p.id)::int AS plays,
        al.image_url AS album_image_url
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      LEFT JOIN albums al ON t.album_id = al.id
      WHERE ${timeFilter} AND ${albumFilter}
      GROUP BY t.id, t.name, al.image_url
      ORDER BY plays DESC, t.name ASC, t.id ASC
      LIMIT ${PROFILE_ALBUM_PROFILE_TRACKS_LIMIT};
    `,
    sql`
      SELECT
        p.id::text,
        p.played_at,
        p.track_id,
        al.image_url AS album_image_url,
        t.name AS title,
        COALESCE(ar.name, t.artist_name, '') AS artist,
        COALESCE(al.name, t.album_name, '') AS album,
        t.duration_ms
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      LEFT JOIN albums al ON t.album_id = al.id
      LEFT JOIN artists ar ON t.artist_id = ar.id
      WHERE ${timeFilter} AND ${albumFilter}
      ORDER BY p.played_at DESC, p.id DESC
      LIMIT ${PROFILE_RECENT_PLAYS_LIMIT};
    `,
    sql`
      SELECT EXTRACT(HOUR FROM p.played_at AT TIME ZONE ${safeTz})::int AS hour, COUNT(*)::int AS plays
      FROM plays p JOIN tracks t ON p.track_id = t.id
      WHERE ${timeFilter} AND ${albumFilter}
      GROUP BY 1;
    `,
  ]);

  const plays = Number(rankAndPlaysRows[0]?.plays ?? 0);
  const rank =
    plays > 0 && rankAndPlaysRows[0]?.rank != null
      ? Number(rankAndPlaysRows[0].rank)
      : null;
  const rankedTotal = Number(rankedTotalRows[0]?.total ?? 0);

  const cadence = buildProfileCadence({
    range,
    tz: safeTz,
    cadenceRows: cadenceRows as Record<string, unknown>[],
    minDateRow: { log_start_date: toIso(lifetimeRow.first_played_at) },
  });

  const topTracks: ProfileTopTrack[] = topTrackRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    plays: Number(row.plays),
    albumImageUrl: (row.album_image_url as string | null) ?? null,
  }));

  return {
    kind: "album",
    key: resolvedKey,
    name: String(lifetimeRow.name),
    artistName: (lifetimeRow.artist_name as string | null) ?? null,
    albumName: null,
    imageUrl: (lifetimeRow.image_url as string | null) ?? null,
    range,
    firstPlayedAt: lifetimeRow.first_played_at ? toIso(lifetimeRow.first_played_at) : null,
    lastPlayedAt: lifetimeRow.last_played_at ? toIso(lifetimeRow.last_played_at) : null,
    plays,
    rank,
    rankedTotal,
    ...cadence,
    artistKey: lifetimeRow.artist_key ? String(lifetimeRow.artist_key) : undefined,
    hourOfDay: toHourOfDay(hourRows),
    topTracks,
    topAlbums: [],
    recentPlays: mapRecentPlays(recentPlayRows as Record<string, unknown>[]),
  };
}
