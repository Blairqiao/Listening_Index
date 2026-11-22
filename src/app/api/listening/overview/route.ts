import { NextRequest, NextResponse } from "next/server";
import { getOverviewData } from "@/lib/db/queries";
import { getOrFetchOverview } from "@/lib/db/server-cache";
import { isDbConfigured } from "@/lib/db";
import { getMockOverview } from "@/lib/mock/overview-data";
import { parseRangeParam } from "@/lib/range";
import { jsonNoCache, effectiveRequestTimezone, handleApiError } from "@/lib/route-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawRange = searchParams.get("range") ?? "1w";
    const sel = parseRangeParam(rawRange);

    if (!sel) {
      return NextResponse.json(
        {
          error: `Invalid range parameter: '${rawRange}'. Use a preset (1d, 1w, 1m, 6m, 1y, all) or YYYY-MM-DD..YYYY-MM-DD.`,
        },
        { status: 400 }
      );
    }

    const tz = effectiveRequestTimezone(request);

    // Zero-config preview fallback when DATABASE_URL is not configured or FORCE_MOCK_DATA is enabled
    if (!isDbConfigured() || process.env.FORCE_MOCK_DATA === "true") {
      return jsonNoCache(getMockOverview(sel, tz));
    }

    const overviewData = await getOrFetchOverview(sel, tz || "", () =>
      getOverviewData(sel, tz)
    );

    return jsonNoCache(overviewData);
  } catch (error: unknown) {
    return handleApiError("/api/listening/overview", error);
  }
}
