import { NextRequest } from "next/server";
import { getCalendarData } from "@/lib/db/queries";
import { getOrFetchCalendar } from "@/lib/db/server-cache";
import { isDbConfigured } from "@/lib/db";
import { getMockCalendar } from "@/lib/mock/calendar-data";
import { jsonNoCache, effectiveRequestTimezone, handleApiError } from "@/lib/route-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tz = effectiveRequestTimezone(request);

    if (!isDbConfigured() || process.env.FORCE_MOCK_DATA === "true") {
      return jsonNoCache(getMockCalendar(tz));
    }

    const data = await getOrFetchCalendar(tz, () => getCalendarData(tz));
    return jsonNoCache(data);
  } catch (error: unknown) {
    return handleApiError("/api/listening/calendar", error);
  }
}
