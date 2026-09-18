import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  isAdminPasswordConfigured,
  verifySessionToken,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const isConfigured = isAdminPasswordConfigured();
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const isAuthenticated = isConfigured && verifySessionToken(cookie);

  return NextResponse.json({
    isAuthenticated,
    isConfigured,
  });
}
