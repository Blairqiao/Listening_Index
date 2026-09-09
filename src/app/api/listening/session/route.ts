import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/db/queries";
import { getCachedSession, setCachedSession } from "@/lib/db/server-cache";
import { MOCK_DATA } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Zero-config preview fallback when DATABASE_URL is not configured
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(MOCK_DATA.session, {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    }

    // Check server cache first
    let sessionData = getCachedSession();
    if (!sessionData) {
      sessionData = await getCurrentSession();
      setCachedSession(sessionData);
    }

    return NextResponse.json(sessionData, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error: unknown) {
    console.error("[API ERROR · /api/listening/session]", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
