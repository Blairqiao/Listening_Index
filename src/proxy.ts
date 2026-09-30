import { NextRequest, NextResponse } from "next/server";

/**
 * In development, canonicalize localhost to 127.0.0.1.
 * Spotify rejects "localhost" redirect URIs and requires http://127.0.0.1:8888/callback.
 * Ensuring a single origin prevents cookie partitioning, localStorage segregation,
 * and cross-origin postMessage drops between popup and opener.
 */
export default function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === "development") {
    const host = request.headers.get("host") || "";
    if (host.startsWith("localhost")) {
      const port = host.split(":")[1] || "8888";
      const targetUrl = `http://127.0.0.1:${port}${request.nextUrl.pathname}${request.nextUrl.search}`;
      return new NextResponse(null, {
        status: 307,
        headers: {
          Location: targetUrl,
        },
      });
    }
  }

  return NextResponse.next();
}

export { proxy, proxy as middleware };

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
