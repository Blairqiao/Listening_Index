import { NextRequest } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { getStreamLog } from "@/lib/db/queries";
import { getOrFetchStreamLog } from "@/lib/db/server-cache";
import { isDbConfigured } from "@/lib/db";
import { getMockStreamLog } from "@/lib/mock-listening-data";
import { jsonNoCache, effectiveRequestTimezone, handleApiError } from "@/lib/route-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    if (limitParam !== null && (!/^\d+$/.test(limitParam) || !Number.isSafeInteger(Number(limitParam)) || Number(limitParam) < 1)) {
      return jsonNoCache({ error: "Invalid limit. Use a positive integer." }, 400);
    }
    const requestedLimit = limitParam === null ? 50 : Number(limitParam);
    const limit = isAuthorizedAdminRequest(request) ? requestedLimit : Math.min(requestedLimit, 250);

    const rawCursor = searchParams.get("cursor");
    const rawCursorId = searchParams.get("cursorId");
    const rawPrevPlayedAt = searchParams.get("prevPlayedAt");

    const mock = !isDbConfigured() || process.env.FORCE_MOCK_DATA === "true";
    const validTimestamp = (value: string) => {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
      if (!match) return false;
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const hour = Number(match[4]);
      const minute = Number(match[5]);
      const second = Number(match[6]);
      if (hour >= 24 || minute >= 60 || second >= 60 || month < 1 || month > 12 || day < 1 || day > 31) return false;
      const d = new Date(Date.UTC(year, month - 1, day));
      if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return false;
      return Number.isFinite(Date.parse(value));
    };
    if (
      (rawCursor !== null && (!rawCursor || !validTimestamp(rawCursor))) ||
      (rawCursorId !== null && (
        !rawCursorId ||
        (!(mock && /^sl-\d+$/.test(rawCursorId)) && (!rawCursor || !/^\d+$/.test(rawCursorId) || BigInt(rawCursorId) > BigInt("9223372036854775807")))
      )) ||
      (rawPrevPlayedAt !== null && (!rawPrevPlayedAt || !validTimestamp(rawPrevPlayedAt)))
    ) {
      return jsonNoCache({ error: "Invalid pagination parameters." }, 400);
    }

    const cursor = rawCursor ?? undefined;
    const cursorId = rawCursorId ?? undefined;
    const prevPlayedAt = rawPrevPlayedAt ?? undefined;
    const tzParam = effectiveRequestTimezone(request);

    // Zero-config preview fallback when DATABASE_URL is not configured or FORCE_MOCK_DATA is enabled
    if (mock) {
      const mockData = getMockStreamLog(limit, cursor, cursorId, prevPlayedAt);
      return jsonNoCache(mockData);
    }

    const fetcher = () => getStreamLog(limit, tzParam, cursor, cursorId, prevPlayedAt);
    const data = limit > 250 ? await fetcher() : await getOrFetchStreamLog(limit, tzParam, fetcher, {
      cursor, cursorId, prevPlayedAt,
    });
    return jsonNoCache(data);
  } catch (error: unknown) {
    return handleApiError("/api/listening/stream-log", error);
  }
}
