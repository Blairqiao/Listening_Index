import { NextRequest, NextResponse } from "next/server";
import {
  isAdminPasswordConfigured,
  verifyAdminPassword,
  createSessionToken,
  getSessionCookieHeader,
  isSameOriginRequest,
} from "@/lib/admin-auth";
import {
  checkLoginAttempt,
  clearLoginFailures,
  loginClientKey,
  recordLoginFailure,
} from "@/lib/login-rate-limit";

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

  const clientKey = loginClientKey(request.headers);
  const attempt = checkLoginAttempt(clientKey, Date.now());
  if (!attempt.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many login attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const password = typeof body?.password === "string" ? body.password : "";

    if (!verifyAdminPassword(password)) {
      recordLoginFailure(clientKey, Date.now());
      return NextResponse.json(
        { success: false, error: "Invalid admin password" },
        { status: 401 }
      );
    }

    clearLoginFailures(clientKey);
    const token = createSessionToken();
    const cookieHeader = getSessionCookieHeader(token);

    const response = NextResponse.json({ success: true, message: "Authorized successfully" });
    response.headers.set("Set-Cookie", cookieHeader);
    return response;
  } catch (err) {
    console.error("[API ERROR · /api/auth/login]", err);
    return NextResponse.json(
      { success: false, error: "Authentication failed unexpectedly" },
      { status: 500 }
    );
  }
}
