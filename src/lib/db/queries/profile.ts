import { getDb } from "../index";
import { isCatalogFullyEnriched } from "./enrichment";
import { sanitizeTimezone } from "./helpers";
import { OVERVIEW_INTERVAL_CONFIG } from "./overview";
import { buildCadenceQuery, buildProfileCadence, type CadenceScope } from "./cadence";
import { artistShare, computePeakDay, longestStreakRange } from "@/lib/profile-stats";
import type { RangeKey } from "@/lib/types";
import {
  PROFILE_ALBUM_PROFILE_TRACKS_LIMIT,
  PROFILE_ALBUM_TRACKS_LIMIT,
  PROFILE_MORE_ALBUMS_LIMIT,
  PROFILE_RECENT_PLAYS_LIMIT,
  PROFILE_RELATED_TRACKS_LIMIT,
  PROFILE_TOP_ALBUMS_LIMIT,
  PROFILE_TOP_TRACKS_LIMIT,
  type ProfileAlbumTrack,
  type ProfileData,
  type ProfilePlay,
  type ProfileRelatedTrack,
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
    msPlayed: Number(row.ms_played) || 0,
  }));
}

function toHourOfDay(rows: Record<string, unknown>[]): number[] {
  const counts = Array<number>(24).fill(0);
  for (const { hour, plays } of rows) counts[Number(hour)] = Number(plays);
  return counts;
}

function toDayOfWeek(rows: Record<string, unknown>[]): number[] {
  const counts = Array<number>(7).fill(0);
  for (const { iso_dow, plays } of rows) {
    const idx = Number(iso_dow) - 1;
    if (idx >= 0 && idx < 7) counts[idx] = Number(plays);
  }
  return counts;
}

function summarizeDailyCounts(rows: Record<string, unknown>[]) {
  const days = rows.map((row) => ({
    date: String(row.day),
    plays: Number(row.plays),
  }));
  const streak = longestStreakRange(days.map((d) => d.date));
  return {
    activeDays: days.filter((d) => d.plays > 0).length,
    longestStreakDays: streak.days,
    longestStreakStart: streak.start,
    longestStreakEnd: streak.end,
    peakDay: computePeakDay(days),
  };
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
    const albumFilter = isEnriched
      ? albumId != null
        ? sql`t.album_id = ${albumId}`
        : null
      : albumGroupKey != null
        ? sql`t.album_group_key = ${albumGroupKey}`
        : null;

    const [
      rankAndPlaysRows, rankedTotalRows, cadenceRows, recentPlayRows,
      hourRows, dayOfWeekRows, dailyCountRows, aggRows,
      artistPlayRows, albumPlayRows, albumRows, relatedTrackRows,
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
            p.ms_played,
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
          SELECT EXTRACT(ISODOW FROM p.played_at AT TIME ZONE ${safeTz})::int AS iso_dow, COUNT(*)::int AS plays
          FROM plays p WHERE p.track_id = ${trackId} AND ${timeFilter}
          GROUP BY 1;
        `,
        sql`
          SELECT (p.played_at AT TIME ZONE ${safeTz})::date::text AS day, COUNT(*)::int AS plays
          FROM plays p WHERE p.track_id = ${trackId} AND ${timeFilter}
          GROUP BY 1;
        `,
        sql`
          SELECT
            COALESCE(SUM(p.ms_played), 0)::bigint AS total_ms,
            AVG(LEAST(p.ms_played::float / NULLIF(t.duration_ms, 0), 1.0))
              FILTER (WHERE t.duration_ms > 0) AS completion_rate
          FROM plays p
          JOIN tracks t ON t.id = p.track_id
          WHERE p.track_id = ${trackId} AND ${timeFilter};
        `,
        activeArtistKey == null ? [] : sql`
          SELECT COUNT(*)::int AS plays
          FROM plays p JOIN tracks t ON t.id = p.track_id
          WHERE ${artistFilter} AND ${timeFilter};
        `,
        albumFilter === null ? [] : sql`
          SELECT COUNT(*)::int AS plays
          FROM plays p JOIN tracks t ON t.id = p.track_id
          WHERE ${albumFilter} AND ${timeFilter};
        `,
        albumFilter === null ? [] : sql`
          SELECT t.id, t.name, COUNT(p.id)::int AS plays
          FROM plays p JOIN tracks t ON t.id = p.track_id
          WHERE ${albumFilter} AND ${timeFilter}
          GROUP BY t.id, t.name
          ORDER BY plays DESC, t.name ASC, t.id ASC
          LIMIT ${PROFILE_ALBUM_TRACKS_LIMIT};
        `,
        sql`
          WITH ordered AS (
            SELECT
              p.track_id,
              p.played_at,
              p.id,
              LAG(p.track_id) OVER (ORDER BY p.played_at ASC, p.id ASC) AS prev_track_id,
              LAG(p.played_at) OVER (ORDER BY p.played_at ASC, p.id ASC) AS prev_played_at,
              LEAD(p.track_id) OVER (ORDER BY p.played_at ASC, p.id ASC) AS next_track_id,
              LEAD(p.played_at) OVER (ORDER BY p.played_at ASC, p.id ASC) AS next_played_at
            FROM plays p
            WHERE ${timeFilter}
          ),
          neighbors AS (
            SELECT prev_track_id AS other_id
            FROM ordered
            WHERE track_id = ${trackId}
              AND prev_track_id IS NOT NULL
              AND prev_track_id <> ${trackId}
              AND played_at - prev_played_at <= INTERVAL '30 minutes'
            UNION ALL
            SELECT next_track_id AS other_id
            FROM ordered
            WHERE track_id = ${trackId}
              AND next_track_id IS NOT NULL
              AND next_track_id <> ${trackId}
              AND next_played_at - played_at <= INTERVAL '30 minutes'
          )
          SELECT
            t.id,
            t.name,
            COALESCE(ar.name, t.artist_name, '') AS artist,
            al.image_url AS album_image_url,
            COUNT(*)::int AS co_plays
          FROM neighbors n
          JOIN tracks t ON t.id = n.other_id
          LEFT JOIN artists ar ON t.artist_id = ar.id
          LEFT JOIN albums al ON t.album_id = al.id
          GROUP BY t.id, t.name, ar.name, t.artist_name, al.image_url
          ORDER BY co_plays DESC, t.name ASC, t.id ASC
          LIMIT ${PROFILE_RELATED_TRACKS_LIMIT};
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

    const dailySummary = summarizeDailyCounts(
      dailyCountRows as Record<string, unknown>[],
    );
    const totalMs = Number(aggRows[0]?.total_ms ?? 0);
    const completionRate =
      aggRows[0]?.completion_rate != null ? Number(aggRows[0].completion_rate) : null;
    const artistPlays = Number(artistPlayRows[0]?.plays ?? 0);
    const albumPlays = Number(albumPlayRows[0]?.plays ?? 0);
    const albumTracks: ProfileAlbumTrack[] = albumRows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      plays: Number(row.plays),
      isCurrent: row.id === trackId,
    }));
    const relatedTracks: ProfileRelatedTrack[] = relatedTrackRows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      artist: String(row.artist),
      albumImageUrl: (row.album_image_url as string | null) ?? null,
      coPlays: Number(row.co_plays),
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
        longestStreakDays: dailySummary.longestStreakDays,
      },
      hourOfDay: toHourOfDay(hourRows),
      dayOfWeek: toDayOfWeek(dayOfWeekRows),
      stats: {
        totalMs,
        ...dailySummary,
        completionRate,
        artistPlays,
        artistShare: artistShare(plays, artistPlays),
        albumPlays,
        albumShare: artistShare(plays, albumPlays),
      },
      relatedTracks,
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
    dayOfWeekRows,
    dailyCountRows,
    aggRows,
    allPlayRows,
    lifetimeTrackRows,
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
        p.ms_played,
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
    sql`
      SELECT EXTRACT(ISODOW FROM p.played_at AT TIME ZONE ${safeTz})::int AS iso_dow, COUNT(*)::int AS plays
      FROM plays p JOIN tracks t ON p.track_id = t.id
      WHERE ${timeFilter} AND ${artistFilter}
      GROUP BY 1;
    `,
    sql`
      SELECT (p.played_at AT TIME ZONE ${safeTz})::date::text AS day, COUNT(*)::int AS plays
      FROM plays p JOIN tracks t ON p.track_id = t.id
      WHERE ${timeFilter} AND ${artistFilter}
      GROUP BY 1;
    `,
    sql`
      SELECT
        COALESCE(SUM(p.ms_played), 0)::bigint AS total_ms,
        COUNT(DISTINCT p.track_id)::int AS tracks_heard_in_range,
        AVG(LEAST(p.ms_played::float / NULLIF(t.duration_ms, 0), 1.0))
          FILTER (WHERE t.duration_ms > 0) AS completion_rate
      FROM plays p JOIN tracks t ON p.track_id = t.id
      WHERE ${timeFilter} AND ${artistFilter};
    `,
    sql`
      SELECT COUNT(*)::int AS plays
      FROM plays p
      WHERE ${timeFilter};
    `,
    sql`
      SELECT COUNT(DISTINCT p.track_id)::int AS tracks_heard_lifetime
      FROM plays p JOIN tracks t ON p.track_id = t.id
      WHERE ${artistFilter};
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

  const dailySummary = summarizeDailyCounts(
    dailyCountRows as Record<string, unknown>[],
  );
  const totalMs = Number(aggRows[0]?.total_ms ?? 0);
  const tracksHeardInRange = Number(aggRows[0]?.tracks_heard_in_range ?? 0);
  const completionRate =
    aggRows[0]?.completion_rate != null ? Number(aggRows[0].completion_rate) : null;
  const allPlays = Number(allPlayRows[0]?.plays ?? 0);
  const tracksHeardLifetime = Number(lifetimeTrackRows[0]?.tracks_heard_lifetime ?? 0);

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
    dayOfWeek: toDayOfWeek(dayOfWeekRows),
    stats: {
      totalMs,
      ...dailySummary,
      playShare: artistShare(plays, allPlays),
      completionRate,
      tracksHeardInRange,
      tracksHeardLifetime,
    },
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
      COUNT(p.id)::int AS lifetime_plays,
      COUNT(DISTINCT p.track_id)::int AS tracks_heard_lifetime
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

  const artistKey = lifetimeRow.artist_key ? String(lifetimeRow.artist_key) : undefined;
  const artistFilter = artistKey
    ? isEnriched
      ? sql`t.artist_id = ${artistKey}`
      : sql`t.artist_group_key = ${artistKey}`
    : null;

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
    dayOfWeekRows,
    dailyCountRows,
    aggRows,
    artistPlayRows,
    fullAlbumSessionRows,
    moreAlbumRows,
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
        p.ms_played,
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
    sql`
      SELECT EXTRACT(ISODOW FROM p.played_at AT TIME ZONE ${safeTz})::int AS iso_dow, COUNT(*)::int AS plays
      FROM plays p JOIN tracks t ON p.track_id = t.id
      WHERE ${timeFilter} AND ${albumFilter}
      GROUP BY 1;
    `,
    sql`
      SELECT (p.played_at AT TIME ZONE ${safeTz})::date::text AS day, COUNT(*)::int AS plays
      FROM plays p JOIN tracks t ON p.track_id = t.id
      WHERE ${timeFilter} AND ${albumFilter}
      GROUP BY 1;
    `,
    sql`
      SELECT
        COALESCE(SUM(p.ms_played), 0)::bigint AS total_ms,
        COUNT(DISTINCT p.track_id)::int AS tracks_heard_in_range,
        ${artistFilter === null ? sql`0::int` : sql`COUNT(*) FILTER (WHERE ${artistFilter})::int`} AS album_artist_plays
      FROM plays p JOIN tracks t ON p.track_id = t.id
      WHERE ${timeFilter} AND ${albumFilter};
    `,
    artistFilter === null ? [] : sql`
      SELECT COUNT(*)::int AS plays
      FROM plays p JOIN tracks t ON p.track_id = t.id
      WHERE ${timeFilter} AND ${artistFilter};
    `,
    sql`
      WITH ordered AS (
        SELECT
          p.track_id,
          p.played_at,
          p.id,
          CASE
            WHEN LAG(p.played_at) OVER (ORDER BY p.played_at ASC, p.id ASC) IS NULL
              OR p.played_at - LAG(p.played_at) OVER (ORDER BY p.played_at ASC, p.id ASC) > INTERVAL '30 minutes'
            THEN 1
            ELSE 0
          END AS is_new
        FROM plays p
        JOIN tracks t ON p.track_id = t.id
        WHERE ${timeFilter} AND ${albumFilter}
      ),
      sessions AS (
        SELECT
          track_id,
          SUM(is_new) OVER (ORDER BY played_at ASC, id ASC) AS session_id
        FROM ordered
      )
      SELECT COUNT(*)::int AS full_sessions
      FROM (
        SELECT session_id
        FROM sessions
        GROUP BY session_id
        HAVING COUNT(DISTINCT track_id) >= 3
      ) s;
    `,
    artistFilter === null ? [] : sql`
      SELECT
        ${isEnriched ? sql`t.album_id` : sql`MAX(t.album_id)`} AS id,
        ${albumGroupCol} AS key,
        COALESCE(MAX(al.name), MAX(t.album_name), '') AS name,
        COUNT(p.id)::int AS plays,
        MAX(al.image_url) AS image_url
      FROM plays p
      JOIN tracks t ON p.track_id = t.id
      LEFT JOIN albums al ON t.album_id = al.id
      WHERE ${timeFilter}
        AND ${artistFilter}
        AND ${albumFilterForRank}
        AND ${albumGroupCol} <> ${resolvedKey}
      GROUP BY ${albumGroupCol}
      ORDER BY plays DESC, name ASC, ${albumGroupCol} ASC
      LIMIT ${PROFILE_MORE_ALBUMS_LIMIT};
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

  const dailySummary = summarizeDailyCounts(
    dailyCountRows as Record<string, unknown>[],
  );
  const totalMs = Number(aggRows[0]?.total_ms ?? 0);
  const tracksHeardInRange = Number(aggRows[0]?.tracks_heard_in_range ?? 0);
  const albumArtistPlays = Number(aggRows[0]?.album_artist_plays ?? 0);
  const tracksHeardLifetime = Number(lifetimeRow.tracks_heard_lifetime ?? 0);
  const artistPlays = Number(artistPlayRows[0]?.plays ?? 0);
  const fullAlbumSessions = Number(fullAlbumSessionRows[0]?.full_sessions ?? 0);

  const topTracks: ProfileTopTrack[] = topTrackRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    plays: Number(row.plays),
    albumImageUrl: (row.album_image_url as string | null) ?? null,
  }));

  const moreAlbums: ProfileTopAlbum[] = moreAlbumRows.map((row) => ({
    id: row.id ? String(row.id) : undefined,
    key: row.key ? String(row.key) : undefined,
    name: String(row.name),
    plays: Number(row.plays),
    imageUrl: (row.image_url as string | null) ?? null,
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
    artistKey,
    hourOfDay: toHourOfDay(hourRows),
    dayOfWeek: toDayOfWeek(dayOfWeekRows),
    stats: {
      totalMs,
      ...dailySummary,
      artistPlays,
      artistShare: artistShare(albumArtistPlays, artistPlays),
      tracksHeardInRange,
      tracksHeardLifetime,
      fullAlbumSessions,
    },
    moreAlbums,
    topTracks,
    topAlbums: [],
    recentPlays: mapRecentPlays(recentPlayRows as Record<string, unknown>[]),
  };
}
