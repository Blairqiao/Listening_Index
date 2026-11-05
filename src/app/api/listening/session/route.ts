import { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/db/queries";
import { getOrFetchSession } from "@/lib/db/server-cache";
import { isDbConfigured } from "@/lib/db";
import { MOCK_DATA } from "@/lib/mock/overview-data";
import { jsonNoCache, handleApiError } from "@/lib/route-utils";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {

    // Zero-config preview fallback when DATABASE_URL is not configured or FORCE_MOCK_DATA is enabled
    if (!isDbConfigured() || process.env.FORCE_MOCK_DATA === "true") {
      return jsonNoCache(MOCK_DATA.session);
    }

    const sessionData = await getOrFetchSession(() =>
      getCurrentSession()
    );

    return jsonNoCache(sessionData);
  } catch (error: unknown) {
    return handleApiError("/api/listening/session", error);
  }
}
