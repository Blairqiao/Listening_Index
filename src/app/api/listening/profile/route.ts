import { NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { getProfile } from "@/lib/db/queries";
import { getMockProfile } from "@/lib/mock/search-profile";
import { parseRangeParam, type RangeSelection } from "@/lib/range";
import { jsonNoCache, effectiveRequestTimezone, handleApiError } from "@/lib/route-utils";
import { parseProfileTarget } from "@/lib/search-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const target = parseProfileTarget(searchParams);
    if (!target) {
      return jsonNoCache({ error: "Missing track, artist, or album." }, 400);
    }

    const rawRange = searchParams.get("prange");
    let range: RangeSelection;
    if (rawRange === null) {
      range = { kind: "preset", key: "all" };
    } else {
      const parsedRange = parseRangeParam(rawRange);
      if (parsedRange === null) {
        return jsonNoCache({ error: "Invalid prange." }, 400);
      }
      range = parsedRange;
    }

    const tz = effectiveRequestTimezone(request);
    const mock = !isDbConfigured() || process.env.FORCE_MOCK_DATA === "true";
    const profile = mock
      ? getMockProfile(target, range, tz)
      : await getProfile(target, range, tz);

    if (!profile) {
      return jsonNoCache({ error: "Not found" }, 404);
    }

    return jsonNoCache(profile);
  } catch (error: unknown) {
    return handleApiError("/api/listening/profile", error);
  }
}
