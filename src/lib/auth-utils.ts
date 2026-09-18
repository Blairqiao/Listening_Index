import { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";

/**
 * Validates whether an incoming HTTP request originated from the same host,
 * preventing cross-origin invocation of sensitive endpoints.
 */
export function isSameOriginRequest(request: NextRequest): boolean {
  if (process.env.NODE_ENV === "development") return true;

  const secFetchSite = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host") || request.nextUrl.host;

  return (
    secFetchSite === "same-origin" ||
    Boolean(origin && host && origin.includes(host)) ||
    Boolean(referer && host && referer.includes(host))
  );
}

export function isAuthorizedAdminRequest(request: NextRequest): boolean {
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return verifySessionToken(cookie);
}
