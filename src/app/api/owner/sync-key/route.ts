import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest, isSameOriginRequest } from "@/lib/auth-utils";
import { getCronKey, regenerateCronKey } from "@/lib/db/queries";
import { requestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

/**
 * GET /api/owner/sync-key
 * Admin-only: Returns the scheduled sync key and ready-to-use sync URL.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }

  const cronKey = await getCronKey();
  const origin = requestOrigin(request);
  const syncUrl = `${origin}/api/sync?key=${cronKey || ""}`;

  return NextResponse.json({
    cronKey,
    syncUrl,
  });
}

/**
 * POST /api/owner/sync-key
 * Admin-only + same-origin: Rotates the scheduled sync key.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request not permitted." }, { status: 403 });
  }

  const cronKey = await regenerateCronKey();
  const origin = requestOrigin(request);
  const syncUrl = `${origin}/api/sync?key=${cronKey}`;

  return NextResponse.json({
    success: true,
    cronKey,
    syncUrl,
  });
}
