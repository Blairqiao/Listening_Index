import { NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { getRandomProfileTarget } from "@/lib/db/queries";
import { getMockRandomProfileTarget } from "@/lib/mock/search-profile";
import { jsonNoCache, handleApiError } from "@/lib/route-utils";
import { parseSearchFilter } from "@/lib/search-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = parseSearchFilter(searchParams.get("type"));
    const mock = !isDbConfigured() || process.env.FORCE_MOCK_DATA === "true";

    const target = mock
      ? getMockRandomProfileTarget(filter)
      : await getRandomProfileTarget(filter);

    if (!target) {
      return jsonNoCache({ error: "Archive is empty." }, 404);
    }

    return jsonNoCache(target);
  } catch (error: unknown) {
    return handleApiError("/api/listening/random", error);
  }
}
