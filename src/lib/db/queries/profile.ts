import { getDb } from "../index";
import { isCatalogFullyEnriched } from "./enrichment";
import { sanitizeTimezone } from "./helpers";
import { OVERVIEW_INTERVAL_CONFIG } from "./overview";
import { buildCadenceQuery, buildProfileCadence, type CadenceScope } from "./cadence";
import type { RangeKey } from "@/lib/types";
import {
  PROFILE_RECENT_PLAYS_LIMIT,
  PROFILE_TOP_ALBUMS_LIMIT,
  PROFILE_TOP_TRACKS_LIMIT,
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
        COALESCE(t.artist_id, t.artist_group_key) AS artist_key,
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
      GROUP BY t.id, t.name, ar.name, t.artist_name, al.name, t.album_name, al.image_url;
    `;
    const trackRow = trackRows[0];
    if (!trackRow || Number(trackRow.lifetime_plays) === 0) {
      return null;
    }

    const trackId = String(trackRow.id);

    const [rankAndPlaysRows, rankedTotalRows, cadenceRows, recentPlayRows] =
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
      artistKey: (trackRow.artist_key as string | null) ?? undefined,
      trackStats: { artistShare: null, bestMonth: null, longestStreakDays: 0 },
      hourOfDay: Array(24).fill(0),
      albumTracks: [],
      topTracks: [],
      topAlbums: [],
      recentPlays: mapRecentPlays(recentPlayRows as Record<string, unknown>[]),
    };
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
    topTracks,
    topAlbums,
    recentPlays: mapRecentPlays(recentPlayRows as Record<string, unknown>[]),
  };
}
