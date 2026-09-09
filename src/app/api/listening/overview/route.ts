import { NextRequest, NextResponse } from "next/server";
import { getOverviewData, RangeKey } from "@/lib/db/queries";
import { getCachedOverview, setCachedOverview } from "@/lib/db/server-cache";
import { MOCK_DATA } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

const VALID_RANGES: RangeKey[] = ["1d", "1w", "1m", "6m", "1y", "all"];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rangeParam = searchParams.get("range") || "1w";

    if (!VALID_RANGES.includes(rangeParam as RangeKey)) {
      return NextResponse.json(
        {
          error: `Invalid range parameter: '${rangeParam}'. Must be one of: ${VALID_RANGES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const range = rangeParam as RangeKey;
    
    // Zero-config preview fallback when DATABASE_URL is not configured
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(MOCK_DATA.overview[range], {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    }

    // Check server cache first
    let overviewData = getCachedOverview(range);
    if (!overviewData) {
      overviewData = await getOverviewData(range);
      setCachedOverview(range, overviewData);
    }

    return NextResponse.json(overviewData, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error: unknown) {
    console.error("[API ERROR · /api/listening/overview]", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
