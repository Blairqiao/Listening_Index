import { NextRequest, NextResponse } from "next/server";
import { getStreamLog } from "@/lib/db/queries";
import { getCachedStreamLog, setCachedStreamLog } from "@/lib/db/server-cache";
import { isDbConfigured } from "@/lib/db";
import { MOCK_DATA } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 50), 100) : 50;
    const tzParam = searchParams.get("tz") || searchParams.get("timezone") || request.headers.get("x-timezone") || undefined;

    // Zero-config preview fallback when DATABASE_URL is not configured or set to "todo"
    if (!isDbConfigured()) {
      return NextResponse.json(MOCK_DATA.streamLog, {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    }

    // Check server cache first
    let data = getCachedStreamLog(limit, tzParam || "");
    if (!data) {
      data = await getStreamLog(limit, tzParam);
      setCachedStreamLog(limit, data, tzParam || "");
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error: unknown) {
    console.error("[API ERROR · /api/listening/stream-log]", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
