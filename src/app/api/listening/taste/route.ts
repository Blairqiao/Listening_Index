import { NextRequest } from "next/server";
import { getTastePhasesData } from "@/lib/db/queries";
import { getOrFetchTaste } from "@/lib/db/server-cache";
import { isDbConfigured } from "@/lib/db";
import { getMockTaste } from "@/lib/mock/taste-data";
import {
  effectiveRequestTimezone,
  handleApiError,
  jsonNoCache,
} from "@/lib/route-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tz = effectiveRequestTimezone(request);

    if (!isDbConfigured() || process.env.FORCE_MOCK_DATA === "true") {
      return jsonNoCache(getMockTaste(tz));
    }

    const data = await getOrFetchTaste(tz, () => getTastePhasesData(tz));
    return jsonNoCache(data);
  } catch (error: unknown) {
    return handleApiError("/api/listening/taste", error);
  }
}
