import { NextRequest, NextResponse } from "next/server";
import {
  isAdminPasswordConfigured,
  verifyAdminPassword,
  createSessionToken,
  getSessionCookieHeader,
  isSameOriginRequest,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { success: false, error: "Cross-origin request not permitted." },
      { status: 403 }
    );
  }

  if (!isAdminPasswordConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: "ADMIN_PASSWORD is not configured in server environment variables",
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const password = typeof body?.password === "string" ? body.password : "";

    if (!verifyAdminPassword(password)) {
      return NextResponse.json(
        { success: false, error: "Invalid admin password" },
        { status: 401 }
      );
    }

    const token = createSessionToken();
    const cookieHeader = getSessionCookieHeader(token);

    const response = NextResponse.json({ success: true, message: "Authorized successfully" });
    response.headers.set("Set-Cookie", cookieHeader);
    return response;
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: "Authentication failed unexpectedly: " + error },
      { status: 500 }
    );
  }
}
