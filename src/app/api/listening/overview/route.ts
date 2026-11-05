import { NextRequest, NextResponse } from "next/server";
import { getOverviewData, RangeKey } from "@/lib/db/queries";
import { RANGE_KEYS } from "@/lib/types";
import { getOrFetchOverview } from "@/lib/db/server-cache";
import { isDbConfigured } from "@/lib/db";
import { MOCK_DATA } from "@/lib/mock/overview-data";
import { jsonNoCache, effectiveRequestTimezone, handleApiError } from "@/lib/route-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rangeParam = searchParams.get("range") || "1w";

    if (!RANGE_KEYS.includes(rangeParam as RangeKey)) {
      return NextResponse.json(
        {
          error: `Invalid range parameter: '${rangeParam}'. Must be one of: ${RANGE_KEYS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const range = rangeParam as RangeKey;

    // Zero-config preview fallback when DATABASE_URL is not configured or FORCE_MOCK_DATA is enabled
    if (!isDbConfigured() || process.env.FORCE_MOCK_DATA === "true") {
      return jsonNoCache(MOCK_DATA.overview[range]);
    }

    const tzParam = effectiveRequestTimezone(request);

    const overviewData = await getOrFetchOverview(range, tzParam || "", () =>
      getOverviewData(range, tzParam)
    );

    return jsonNoCache(overviewData);
  } catch (error: unknown) {
    return handleApiError("/api/listening/overview", error);
  }
}
