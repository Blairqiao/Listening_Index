import { NextRequest } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { searchCatalog } from "@/lib/db/queries";
import { getMockSearch } from "@/lib/mock/search-profile";
import { jsonNoCache, handleApiError } from "@/lib/route-utils";
import { checkSearchQuery } from "@/lib/search-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryCheck = checkSearchQuery(searchParams.get("q") ?? "");
    if (!queryCheck.ok) {
      return jsonNoCache({ error: `Invalid query: ${queryCheck.reason}` }, 400);
    }

    const mock = !isDbConfigured() || process.env.FORCE_MOCK_DATA === "true";
    if (mock) {
      return jsonNoCache(getMockSearch(queryCheck.query));
    }

    const data = await searchCatalog(queryCheck.query);
    return jsonNoCache(data);
  } catch (error: unknown) {
    return handleApiError("/api/listening/search", error);
  }
}
