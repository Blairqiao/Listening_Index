import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "../src/app/api/player/token/route";
import { ADMIN_COOKIE_NAME, createSessionToken } from "../src/lib/admin-auth";
import {
  getOwnerPlaybackToken,
  saveOwnerPlaybackToken,
  deleteOwnerPlaybackToken,
  ensureTablesExist,
} from "../src/lib/db/queries";

test("Player Token API - /api/player/token", async (t) => {
  await ensureTablesExist();

  // Clean initial state
  await deleteOwnerPlaybackToken();

  const originalFetch = globalThis.fetch;
  let lastSpotifyRequestBody: string | null = null;
  let lastSpotifyAuthHeader: string | null = null;

  // Mock Spotify accounts token endpoint
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url === "https://accounts.spotify.com/api/token") {
      lastSpotifyRequestBody = init?.body ? String(init.body) : null;
      lastSpotifyAuthHeader = (init?.headers as Record<string, string>)?.["Authorization"] || null;

      const params = new URLSearchParams(lastSpotifyRequestBody || "");
      const grantType = params.get("grant_type");

      if (grantType === "authorization_code") {
        return new Response(
          JSON.stringify({
            access_token: "mock_access_token_auth_code",
            token_type: "Bearer",
            scope: "streaming user-read-email user-read-private",
            expires_in: 3600,
            refresh_token: "mock_refresh_token_from_spotify",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (grantType === "refresh_token") {
        const refreshToken = params.get("refresh_token");
        if (refreshToken === "invalid_token") {
          return new Response(
            JSON.stringify({
              error: "invalid_grant",
              error_description: "Invalid refresh token",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({
            access_token: `mock_access_token_for_${refreshToken}`,
            token_type: "Bearer",
            scope: "streaming user-read-email user-read-private",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "unsupported_grant_type" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return originalFetch(input, init);
  }) as typeof fetch;

  t.after(async () => {
    globalThis.fetch = originalFetch;
    await deleteOwnerPlaybackToken();
  });

  await t.test("Unauthorized requests return 401", async () => {
    const unauthReq = new NextRequest("http://localhost:3000/api/player/token");

    const getRes = await GET(unauthReq);
    assert.strictEqual(getRes.status, 401);

    const postReq = new NextRequest("http://localhost:3000/api/player/token", {
      method: "POST",
      body: JSON.stringify({ code: "xyz", redirectUri: "http://localhost:3000/callback" }),
      headers: { "Content-Type": "application/json" },
    });
    const postRes = await POST(postReq);
    assert.strictEqual(postRes.status, 401);

    const deleteReq = new NextRequest("http://localhost:3000/api/player/token", {
      method: "DELETE",
    });
    const deleteRes = await DELETE(deleteReq);
    assert.strictEqual(deleteRes.status, 401);
  });

  await t.test("Authenticated GET when no token is linked returns { linked: false }", async () => {
    const sessionToken = createSessionToken();
    const req = new NextRequest("http://localhost:3000/api/player/token", {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${sessionToken}` },
    });

    const res = await GET(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.deepStrictEqual(data, { linked: false });
  });

  await t.test("Authenticated POST with code & redirectUri exchanges code and saves refresh token", async () => {
    const sessionToken = createSessionToken();
    const req = new NextRequest("http://localhost:3000/api/player/token", {
      method: "POST",
      headers: {
        cookie: `${ADMIN_COOKIE_NAME}=${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: "test_auth_code_123",
        redirectUri: "http://localhost:3000/api/owner/spotify/callback",
      }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.linked, true);
    assert.strictEqual(data.accessToken, "mock_access_token_auth_code");
    assert.strictEqual(data.expiresIn, 3600);

    // Verify token was saved to database
    const savedToken = await getOwnerPlaybackToken();
    assert.strictEqual(savedToken, "mock_refresh_token_from_spotify");
  });

  await t.test("Authenticated GET when token is linked refreshes access token", async () => {
    const sessionToken = createSessionToken();
    const req = new NextRequest("http://localhost:3000/api/player/token", {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${sessionToken}` },
    });

    const res = await GET(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.linked, true);
    assert.strictEqual(data.accessToken, "mock_access_token_for_mock_refresh_token_from_spotify");
    assert.strictEqual(data.expiresIn, 3600);
  });

  await t.test("Authenticated POST with refreshToken saves token and refreshes access token", async () => {
    const sessionToken = createSessionToken();
    const req = new NextRequest("http://localhost:3000/api/player/token", {
      method: "POST",
      headers: {
        cookie: `${ADMIN_COOKIE_NAME}=${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refreshToken: "direct_custom_refresh_token",
      }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.linked, true);
    assert.strictEqual(data.accessToken, "mock_access_token_for_direct_custom_refresh_token");
    assert.strictEqual(data.expiresIn, 3600);

    // Verify DB update
    const saved = await getOwnerPlaybackToken();
    assert.strictEqual(saved, "direct_custom_refresh_token");
  });

  await t.test("Authenticated requests via Authorization: Bearer header work", async () => {
    const sessionToken = createSessionToken();
    const req = new NextRequest("http://localhost:3000/api/player/token", {
      headers: { authorization: `Bearer ${sessionToken}` },
    });

    const res = await GET(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.linked, true);
    assert.strictEqual(data.accessToken, "mock_access_token_for_direct_custom_refresh_token");
  });

  await t.test("Authenticated DELETE unlinks player token", async () => {
    const sessionToken = createSessionToken();
    const deleteReq = new NextRequest("http://localhost:3000/api/player/token", {
      method: "DELETE",
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${sessionToken}` },
    });

    const deleteRes = await DELETE(deleteReq);
    assert.strictEqual(deleteRes.status, 200);
    const deleteData = await deleteRes.json();
    assert.deepStrictEqual(deleteData, { success: true });

    // Verify DB token is null
    const remaining = await getOwnerPlaybackToken();
    assert.strictEqual(remaining, null);

    // Subsequent GET returns { linked: false }
    const getReq = new NextRequest("http://localhost:3000/api/player/token", {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${sessionToken}` },
    });
    const getRes = await GET(getReq);
    assert.strictEqual(getRes.status, 200);
    const getData = await getRes.json();
    assert.deepStrictEqual(getData, { linked: false });
  });
});
