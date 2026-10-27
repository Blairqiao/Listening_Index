import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  TOKEN_SCOPES,
  calculateTokenExpiration,
} from "../src/lib/spotify-auth";
import { createSessionToken, ADMIN_COOKIE_NAME } from "../src/lib/admin-auth";
import { PLAYER_VERIFIER_COOKIE } from "../src/lib/user-auth";

process.env.ADMIN_PASSWORD = "test-admin-secret-password-123";

test("TOKEN_SCOPES includes the required unified scopes", () => {
  const requiredScopes = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-recently-played",
    "user-read-currently-playing",
  ];
  for (const scope of requiredScopes) {
    assert.ok(TOKEN_SCOPES.includes(scope), `Missing scope: ${scope}`);
  }
});

test("calculateTokenExpiration calculates daysRemaining and isExpiringSoon accurately", () => {
  // Freshly updated (0 days elapsed)
  const fresh = calculateTokenExpiration(new Date().toISOString());
  assert.equal(fresh.daysRemaining, 180);
  assert.equal(fresh.isExpiringSoon, false);

  // 30 days elapsed
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const monthOld = calculateTokenExpiration(thirtyDaysAgo);
  assert.equal(monthOld.daysRemaining, 150);
  assert.equal(monthOld.isExpiringSoon, false);

  // 170 days elapsed (10 days remaining -> expiring soon)
  const oneSeventyDaysAgo = new Date(Date.now() - 170 * 24 * 60 * 60 * 1000).toISOString();
  const expiring = calculateTokenExpiration(oneSeventyDaysAgo);
  assert.equal(expiring.daysRemaining, 10);
  assert.equal(expiring.isExpiringSoon, true);

  // 185 days elapsed (expired -> clamped to 0)
  const oneEightyFiveDaysAgo = new Date(Date.now() - 185 * 24 * 60 * 60 * 1000).toISOString();
  const expired = calculateTokenExpiration(oneEightyFiveDaysAgo);
  assert.equal(expired.daysRemaining, 0);
  assert.equal(expired.isExpiringSoon, true);

  // No token saved (null)
  const unconfigured = calculateTokenExpiration(null);
  assert.equal(unconfigured.daysRemaining, null);
  assert.equal(unconfigured.isExpiringSoon, false);
});

test("GET /api/owner/spotify requires admin authentication", async () => {
  const { GET } = await import("../src/app/api/owner/spotify/route");
  const unauthReq = new NextRequest("http://127.0.0.1:8888/api/owner/spotify");
  const res = await GET(unauthReq);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error, "Admin sign-in required.");
});

test("GET /api/owner/spotify returns enriched status for authenticated admin", async () => {
  const { GET } = await import("../src/app/api/owner/spotify/route");
  const adminToken = createSessionToken();
  const authReq = new NextRequest("http://127.0.0.1:8888/api/owner/spotify", {
    headers: {
      cookie: `${ADMIN_COOKIE_NAME}=${adminToken}`,
    },
  });
  const res = await GET(authReq);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(typeof data.connected, "boolean");
  assert.ok("source" in data);
  assert.ok("displayName" in data);
  assert.ok("connectedAt" in data);
  assert.ok("daysRemaining" in data);
  assert.ok("isExpiringSoon" in data);
  assert.ok(data.redirectUri.endsWith("/callback"));
});

test("GET /api/owner/spotify and resolveCredentials ignore deprecated SPOTIFY_REFRESH_TOKEN", async () => {
  const prevEnvToken = process.env.SPOTIFY_REFRESH_TOKEN;
  process.env.SPOTIFY_REFRESH_TOKEN = "test-env-refresh-token";

  try {
    const { GET } = await import("../src/app/api/owner/spotify/route");
    const adminToken = createSessionToken();
    const authReq = new NextRequest("http://127.0.0.1:8888/api/owner/spotify", {
      headers: {
        cookie: `${ADMIN_COOKIE_NAME}=${adminToken}`,
      },
    });
    const res = await GET(authReq);
    assert.equal(res.status, 200);
    const data = await res.json();

    // Deprecated SPOTIFY_REFRESH_TOKEN is ignored; without a DB token, status is unconnected
    assert.equal(data.connected, false);
    assert.equal(data.source, null);
    assert.equal(data.displayName, null);
    assert.equal(data.connectedAt, null);
    assert.equal(data.daysRemaining, null);
    assert.equal(data.isExpiringSoon, false);

    // resolveCredentials also ignores SPOTIFY_REFRESH_TOKEN when DB credential is absent
    const { resolveCredentials } = await import("../src/lib/spotify");
    const creds = await resolveCredentials();
    assert.equal(creds, null);
  } finally {
    if (prevEnvToken !== undefined) {
      process.env.SPOTIFY_REFRESH_TOKEN = prevEnvToken;
    } else {
      delete process.env.SPOTIFY_REFRESH_TOKEN;
    }
  }
});

test("GET /callback rejects with 'Admin sign-in required.' when admin cookie is missing", async () => {
  const { GET: callbackGet } = await import("../src/app/callback/route");
  const req = new NextRequest("http://127.0.0.1:8888/callback?code=mock-auth-code");
  const res = await callbackGet(req);

  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes("Admin sign-in required."), "Response HTML must contain admin required message");
  assert.ok(html.includes("window.close()"), "Must close popup window cleanly");
  const setCookie = res.headers.get("set-cookie") || "";
  assert.ok(setCookie.includes(PLAYER_VERIFIER_COOKIE), "Must clear player verifier cookie");
});

test("GET /callback rejects with 'Connection expired. Try again.' when verifier cookie is missing", async () => {
  const { GET: callbackGet } = await import("../src/app/callback/route");
  const adminToken = createSessionToken();
  const req = new NextRequest("http://127.0.0.1:8888/callback?code=mock-auth-code", {
    headers: {
      cookie: `${ADMIN_COOKIE_NAME}=${adminToken}`,
    },
  });
  const res = await callbackGet(req);

  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes("Connection expired. Try again."), "Response HTML must contain verifier expired message");
  assert.ok(html.includes("window.close()"), "Must close popup window cleanly");
  const setCookie = res.headers.get("set-cookie") || "";
  assert.ok(setCookie.includes(PLAYER_VERIFIER_COOKIE), "Must clear player verifier cookie");
});

test("isOwnerSpotifyConfigured and resolveCredentials support database tokens with SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET", async () => {
  const prevId = process.env.SPOTIFY_CLIENT_ID;
  const prevSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const prevToken = process.env.SPOTIFY_REFRESH_TOKEN;
  const prevPublicId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;

  process.env.SPOTIFY_CLIENT_ID = "test-client-id";
  process.env.SPOTIFY_CLIENT_SECRET = "test-client-secret";
  delete process.env.SPOTIFY_REFRESH_TOKEN;
  delete process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;

  const { __setMockOwnerCredentialForTesting } = await import("../src/lib/owner-spotify");
  __setMockOwnerCredentialForTesting({
    refreshToken: "mock-db-refresh-token",
    displayName: "Test Owner",
  });

  try {
    const { isOwnerSpotifyConfigured, resolveCredentials } = await import("../src/lib/spotify");
    const configured = await isOwnerSpotifyConfigured();
    assert.equal(configured, true);

    const creds = await resolveCredentials();
    assert.deepEqual(creds, {
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      refreshToken: "mock-db-refresh-token",
      fromDatabase: true,
      displayName: "Test Owner",
      revision: "0",
    });
  } finally {
    __setMockOwnerCredentialForTesting(undefined);
    if (prevId !== undefined) process.env.SPOTIFY_CLIENT_ID = prevId; else delete process.env.SPOTIFY_CLIENT_ID;
    if (prevSecret !== undefined) process.env.SPOTIFY_CLIENT_SECRET = prevSecret; else delete process.env.SPOTIFY_CLIENT_SECRET;
    if (prevToken !== undefined) process.env.SPOTIFY_REFRESH_TOKEN = prevToken; else delete process.env.SPOTIFY_REFRESH_TOKEN;
    if (prevPublicId !== undefined) process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID = prevPublicId; else delete process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  }
});

test("getRedirectUri resolves production HTTPS origins, loopback origins, and avoids hardcoded 127.0.0.1 placeholder when unhydrated", async () => {
  const { getRedirectUri } = await import("../src/lib/spotify-auth");
  const fs = await import("node:fs");
  const path = await import("node:path");

  const prevRedirect = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
  const prevSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const prevVercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const prevVercelUrl = process.env.VERCEL_URL;

  delete process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.VERCEL_URL;

  try {
    // 1. Without request or window or env vars, returns empty string rather than hardcoded 127.0.0.1:8888 placeholder
    assert.equal(getRedirectUri(), "");

    // 2. With VERCEL_PROJECT_PRODUCTION_URL set on server, resolves production HTTPS callback
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "listening-index.vercel.app";
    assert.equal(getRedirectUri(), "https://listening-index.vercel.app/callback");
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

    // 3. With request on production domain, resolves production HTTPS callback
    const prodReq = new NextRequest("https://listening-index.vercel.app/api/owner/spotify");
    assert.equal(getRedirectUri(prodReq), "https://listening-index.vercel.app/callback");

    // 4. With request behind reverse proxy (x-forwarded-host + x-forwarded-proto)
    const proxyReq = new NextRequest("http://127.0.0.1:3000/api/owner/spotify", {
      headers: {
        "x-forwarded-host": "music.example.com",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(getRedirectUri(proxyReq), "https://music.example.com/callback");

    // 5. With request on localhost:8888, rewrites localhost to 127.0.0.1:8888
    const localReq = new NextRequest("http://localhost:8888/api/owner/spotify");
    assert.equal(getRedirectUri(localReq), "http://127.0.0.1:8888/callback");

    // Authorization initiation uses the shared redirect helper.
    const tokenRouteSource = fs.readFileSync(
      path.resolve(__dirname, "../src/app/api/player/login/route.ts"),
      "utf-8"
    );
    assert.ok(
      !tokenRouteSource.includes('"http://127.0.0.1:8888/callback"'),
      "src/app/api/player/login/route.ts must not hardcode http://127.0.0.1:8888/callback"
    );
    assert.ok(
      tokenRouteSource.includes("getRedirectUri(request)"),
      "src/app/api/player/login/route.ts must fall back to getRedirectUri(request)"
    );
  } finally {
    if (prevRedirect !== undefined) process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI = prevRedirect;
    if (prevSiteUrl !== undefined) process.env.NEXT_PUBLIC_SITE_URL = prevSiteUrl;
    if (prevVercelProd !== undefined) process.env.VERCEL_PROJECT_PRODUCTION_URL = prevVercelProd;
    if (prevVercelUrl !== undefined) process.env.VERCEL_URL = prevVercelUrl;
  }
});

