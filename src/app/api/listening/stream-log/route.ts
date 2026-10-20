import { NextRequest } from "next/server";
import { getStreamLog } from "@/lib/db/queries";
import { getOrFetchStreamLog } from "@/lib/db/server-cache";
import { isDbConfigured } from "@/lib/db";
import { getMockStreamLog } from "@/lib/mock-data";
import { jsonNoCache, parseRequestTimezone, handleApiError } from "@/lib/route-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10) || 50) : 50;
    const tzParam = parseRequestTimezone(request);

    const cursor = searchParams.get("cursor") || undefined;
    const cursorId = searchParams.get("cursorId") || undefined;
    const prevDayGroup = searchParams.get("prevDayGroup") || undefined;
    const prevPlayedAt = searchParams.get("prevPlayedAt") || undefined;

    // Zero-config preview fallback when DATABASE_URL is not configured or FORCE_MOCK_DATA is enabled
    if (!isDbConfigured() || process.env.FORCE_MOCK_DATA === "true") {
      const mockData = getMockStreamLog(limit, cursor, cursorId, prevDayGroup, prevPlayedAt);
      return jsonNoCache(mockData);
    }

    // Check server cache first (only for initial page without cursor)
    if (!cursor) {
      const data = await getOrFetchStreamLog(limit, tzParam || "", () =>
        getStreamLog(limit, tzParam)
      );
      return jsonNoCache(data);
    }

    // Dynamic fetch for pagination slices
    const data = await getStreamLog(limit, tzParam, cursor, cursorId, prevDayGroup, prevPlayedAt);
    return jsonNoCache(data);
  } catch (error: unknown) {
    return handleApiError("/api/listening/stream-log", error);
  }
}
