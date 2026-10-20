import { NextRequest, NextResponse } from "next/server";

export const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
} as const;

export function jsonNoCache(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: NO_CACHE_HEADERS,
  });
}

export function parseRequestTimezone(request: NextRequest): string | undefined {
  const { searchParams } = new URL(request.url);
  return (
    searchParams.get("tz") ||
    searchParams.get("timezone") ||
    request.headers.get("x-timezone") ||
    undefined
  );
}

export function handleApiError(endpoint: string, error: unknown): NextResponse {
  console.error(`[API ERROR · ${endpoint}]`, error);
  const message = error instanceof Error ? error.message : "Internal Server Error";
  return NextResponse.json({ error: message }, { status: 500 });
}
