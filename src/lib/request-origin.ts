import type { NextRequest } from "next/server";

/**
 * The origin the browser actually used for this request.
 *
 * request.nextUrl.origin is not reliable for this: the Next dev server
 * reports "localhost" even when the page was opened at 127.0.0.1. Spotify
 * rejects "localhost" redirect URIs and matches them exactly, so an OAuth
 * redirect built from nextUrl would point somewhere Spotify refuses, or
 * mismatch between the login and callback steps. The Host header (or the
 * proxy's forwarded host, on Vercel) carries what the browser sent.
 *
 * A spoofed Host only affects the request that spoofs it: Spotify still
 * refuses any redirect URI the owner did not register.
 */
export function requestOrigin(request: NextRequest): string {
  let host =
    request.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
    request.headers.get("host") ||
    request.nextUrl.host;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    request.nextUrl.protocol.replace(/:$/, "");

  // Spotify strictly rejects "localhost" redirect URIs and requires 127.0.0.1
  if (host.startsWith("localhost")) {
    host = host.replace("localhost", "127.0.0.1");
  }

  return `${proto}://${host}`;
}
