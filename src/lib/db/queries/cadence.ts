import { getDb } from "../index";
import {
  getLocalCalendarParts,
  type CadenceGranularity,
  type TimeWindow,
} from "@/lib/range";
import {
  buildActivityCadence,
  buildProfileCadence,
  cadenceBucketKey,
  cadenceRowGranularity,
  type CadenceRow,
} from "@/lib/cadence-buckets";

export {
  getLocalCalendarParts,
  buildActivityCadence,
  buildProfileCadence,
  cadenceBucketKey,
  cadenceRowGranularity,
  type CadenceRow,
};

export type CadenceScope =
  | { kind: "track"; trackId: string }
  | { kind: "artist"; column: "artist_id" | "artist_group_key"; value: string }
  | { kind: "album"; column: "album_id" | "album_group_key"; value: string };

export function buildCadenceQuery(
  window: TimeWindow,
  rowGranularity: CadenceGranularity,
  tz: string,
  scope?: CadenceScope,
) {
  const sql = getDb();

  const scopeJoin =
    scope?.kind === "artist" || scope?.kind === "album"
      ? sql`
      JOIN tracks t ON t.id = p.track_id`
      : sql``;

  const scopeFilter = !scope
    ? sql``
    : scope.kind === "track"
      ? sql`p.track_id = ${scope.trackId}`
      : scope.kind === "artist"
        ? scope.column === "artist_id"
          ? sql`t.artist_id = ${scope.value}`
          : sql`t.artist_group_key = ${scope.value}`
        : scope.column === "album_id"
          ? sql`t.album_id = ${scope.value}`
          : sql`t.album_group_key = ${scope.value}`;

  const scopeAnd = scope ? sql` AND ${scopeFilter}` : sql``;

  const bucketKeyExpr =
    rowGranularity === "hour"
      ? sql`TO_CHAR(DATE_TRUNC('hour', p.played_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:00:00"Z"')`
      : rowGranularity === "block6h"
        ? sql`(p.played_at AT TIME ZONE ${tz})::date::text || '#' || FLOOR(EXTRACT(HOUR FROM p.played_at AT TIME ZONE ${tz}) / 6)::int`
        : rowGranularity === "day" || rowGranularity === "week"
          ? sql`TO_CHAR(p.played_at AT TIME ZONE ${tz}, 'YYYY-MM-DD')`
          : rowGranularity === "month"
            ? sql`TO_CHAR(p.played_at AT TIME ZONE ${tz}, 'YYYY-MM')`
            : sql`TO_CHAR(p.played_at AT TIME ZONE ${tz}, 'YYYY')`;

  return sql`
    SELECT
        ${bucketKeyExpr} AS bucket_key,
        COUNT(*)::int AS count
    FROM plays p${scopeJoin}
    WHERE p.played_at >= ${window.from}::timestamptz AND p.played_at < ${window.to}::timestamptz${scopeAnd}
    GROUP BY bucket_key
    ORDER BY bucket_key ASC;
  `;
}
