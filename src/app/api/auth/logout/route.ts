import { NextRequest, NextResponse } from "next/server";
import { getClearSessionCookieHeader } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ success: true, message: "Logged out." });
  response.headers.set("Set-Cookie", getClearSessionCookieHeader());
  return response;
}
