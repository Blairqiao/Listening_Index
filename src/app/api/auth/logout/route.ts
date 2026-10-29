import { NextRequest, NextResponse } from "next/server";
import { getClearSessionCookieHeader, isSameOriginRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Cross-origin request not permitted." },
      { status: 403 }
    );
  }
  const response = NextResponse.json({ success: true, message: "Logged out." });
  response.headers.set("Set-Cookie", getClearSessionCookieHeader());
  return response;
}
