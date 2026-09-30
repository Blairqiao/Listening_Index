import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { createSessionToken, ADMIN_COOKIE_NAME } from "../src/lib/admin-auth";
import { PLAYER_VERIFIER_COOKIE, createVerifier, playerVerifierCookie } from "../src/lib/user-auth";
import { getOwnerPlaybackToken, deleteOwnerPlaybackToken } from "../src/lib/db/queries";

// Set required env vars for tests
process.env.ADMIN_PASSWORD = "test-admin-secret-key-12345";
process.env.SPOTIFY_CLIENT_ID = "test-spotify-client-id";
process.env.SPOTIFY_CLIENT_SECRET = "test-spotify-client-secret";

test("Player OAuth Flow - Red/Green TDD Verification", async (t) => {
  const adminToken = createSessionToken();

  await t.test("GET /api/player/login requires admin authorization", async () => {
    // Import dynamically so it evaluates with current environment
    const { GET: loginGet } = await import("../src/app/api/player/login/route");
    const unauthReq = new NextRequest("http://127.0.0.1:8888/api/player/login");
    const res = await loginGet(unauthReq);
    assert.equal(res.status, 401);
  });

  await t.test("GET /api/player/login sets PKCE cookie and redirects to Spotify", async () => {
    const { GET: loginGet } = await import("../src/app/api/player/login/route");
    const req = new NextRequest("http://127.0.0.1:8888/api/player/login", {
      headers: {
        cookie: `${ADMIN_COOKIE_NAME}=${adminToken}`,
      },
    });
    const res = await loginGet(req);
    assert.equal(res.status >= 300 && res.status < 400, true);

    const location = res.headers.get("location");
    assert.ok(location, "Redirect location header must be present");
    assert.ok(location.startsWith("https://accounts.spotify.com/authorize"), "Must redirect to Spotify authorize");

    const url = new URL(location);
    assert.equal(url.searchParams.get("client_id"), "test-spotify-client-id");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("redirect_uri"), "http://127.0.0.1:8888/callback");
    assert.ok(url.searchParams.get("scope")?.includes("streaming"), "Scope must include streaming");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.ok(url.searchParams.get("code_challenge"), "code_challenge must be present");

    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie, "Set-Cookie header must be present");
    assert.ok(setCookie.includes(PLAYER_VERIFIER_COOKIE), "Must set player_spotify_pkce cookie");
  });

  await t.test("GET /callback handles OAuth denial gracefully", async () => {
    const { GET: callbackGet } = await import("../src/app/callback/route");
    const req = new NextRequest("http://127.0.0.1:8888/callback?error=access_denied");
    const res = await callbackGet(req);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Authorization was declined") || html.includes("spotify-player-auth"));
  });

  await t.test("GET /callback exchanges code and persists owner playback token", async () => {
    await deleteOwnerPlaybackToken();

    const verifier = createVerifier();
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("accounts.spotify.com/api/token")) {
        const bodyStr = init?.body?.toString() || "";
        assert.ok(bodyStr.includes("grant_type=authorization_code"));
        assert.ok(bodyStr.includes("code=test-auth-code"));
        assert.ok(bodyStr.includes(`code_verifier=${verifier}`));

        return new Response(
          JSON.stringify({
            access_token: "test-playback-access-token",
            expires_in: 3600,
            refresh_token: "test-playback-saved-refresh-token",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, init);
    }) as typeof fetch;

    try {
      const { GET: callbackGet } = await import("../src/app/callback/route");
      const req = new NextRequest("http://127.0.0.1:8888/callback?code=test-auth-code", {
        headers: {
          cookie: `${PLAYER_VERIFIER_COOKIE}=${verifier}`,
        },
      });

      const res = await callbackGet(req);
      assert.equal(res.status, 200);

      const html = await res.text();
      assert.ok(html.includes("spotify-player-auth"), "Response must emit spotify-player-auth");

      const savedToken = await getOwnerPlaybackToken();
      assert.equal(savedToken, "test-playback-saved-refresh-token", "Token must be saved in database");
    } finally {
      globalThis.fetch = originalFetch;
      await deleteOwnerPlaybackToken();
    }
  });

  await t.test("proxy redirects localhost to 127.0.0.1 in development", async () => {
    const prevEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    try {
      const { proxy } = await import("../src/proxy");
      const req = new NextRequest("http://localhost:8888/live?tab=4", {
        headers: { host: "localhost:8888" },
      });
      const res = proxy(req);
      assert.equal(res.status, 307);
      assert.equal(res.headers.get("location"), "http://127.0.0.1:8888/live?tab=4");

      const loopbackReq = new NextRequest("http://127.0.0.1:8888/live?tab=4", {
        headers: { host: "127.0.0.1:8888" },
      });
      const loopbackRes = proxy(loopbackReq);
      assert.equal(loopbackRes.status, 200);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
    }
  });
});
