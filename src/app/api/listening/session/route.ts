import { NextRequest } from "next/server";
import { getActiveSiteConfig, getCurrentSession } from "@/lib/db/queries";
import { getOrFetchSession } from "@/lib/db/server-cache";
import { isDbConfigured } from "@/lib/db";
import { MOCK_DATA } from "@/lib/mock-data";
import { jsonNoCache, effectiveRequestTimezone, handleApiError } from "@/lib/route-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {

    // Zero-config preview fallback when DATABASE_URL is not configured or FORCE_MOCK_DATA is enabled
    if (!isDbConfigured() || process.env.FORCE_MOCK_DATA === "true") {
      return jsonNoCache(MOCK_DATA.session);
    }

    const tzParam = effectiveRequestTimezone(request, (await getActiveSiteConfig()).timezone);

    const sessionData = await getOrFetchSession(tzParam || "", () =>
      getCurrentSession(tzParam)
    );

    return jsonNoCache(sessionData);
  } catch (error: unknown) {
    return handleApiError("/api/listening/session", error);
  }
}
