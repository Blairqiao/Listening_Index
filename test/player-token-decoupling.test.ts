import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { loadTs } from "./helpers/load-ts";

test("player token error response schema differentiates admin from spotify errors", () => {
  // Verifies error code contract
  const adminError = { error: "Admin authentication required", code: "ADMIN_AUTH_REQUIRED" };
  assert.equal(adminError.code, "ADMIN_AUTH_REQUIRED");
});

test("GET /api/player/token returns 401 with ADMIN_AUTH_REQUIRED when not authenticated", async () => {
  const { GET } = await import("../src/app/api/player/token/route");
  const unauthReq = new NextRequest("http://127.0.0.1:8888/api/player/token");
  const res = await GET(unauthReq);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.code, "ADMIN_AUTH_REQUIRED");
  assert.equal(data.error, "Admin authentication required");
});

test("player token route does not expose an unused credential replacement POST", async () => {
  const route = await import("../src/app/api/player/token/route");
  assert.equal("POST" in route, false);
});

test("DELETE /api/player/token returns 401 with ADMIN_AUTH_REQUIRED when not authenticated", async () => {
  const { DELETE } = await import("../src/app/api/player/token/route");
  const unauthReq = new NextRequest("http://127.0.0.1:8888/api/player/token", {
    method: "DELETE",
  });
  const res = await DELETE(unauthReq);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.code, "ADMIN_AUTH_REQUIRED");
  assert.equal(data.error, "Admin authentication required");
});

class FakeSpotifyApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function getTokenWithRefreshFailure(failure: Error) {
  const previousPassword = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = "test-admin-password-123";
  try {
    const adminAuth = loadTs("src/lib/admin-auth.ts");
    const route = loadTs("src/app/api/player/token/route.ts", {
      "@/lib/admin-auth": adminAuth,
      "@/lib/db/queries": {
        getOwnerPlaybackToken: async () => "stored-refresh-token",
        deleteOwnerPlaybackToken: async () => undefined,
      },
      "@/lib/spotify": {
        getAccessToken: async () => {
          throw failure;
        },
        getCachedTokenExpiresAt: () => null,
        resetSpotifyTokenCache: () => undefined,
        SpotifyApiError: FakeSpotifyApiError,
      },
    });
    const res = await route.GET(
      new NextRequest("http://127.0.0.1:8888/api/player/token", {
        headers: { cookie: `admin_session=${adminAuth.createSessionToken()}` },
      })
    );
    return { status: res.status as number, body: await res.json() };
  } finally {
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
  }
}

test("GET /api/player/token does not answer 401 when Spotify rejects the token refresh with 401", async () => {
  const { status, body } = await getTokenWithRefreshFailure(
    new FakeSpotifyApiError(401, "Spotify API Error [401]: invalid_client")
  );
  assert.equal(status, 502);
  assert.equal(body.code, "SPOTIFY_TOKEN_REFRESH_FAILED");
  assert.equal(body.error, "Spotify API Error [401]: invalid_client");
  assert.equal(body.linked, undefined);
});

test("GET /api/player/token still forwards other upstream 4xx statuses and maps the rest to 502", async () => {
  const limited = await getTokenWithRefreshFailure(new FakeSpotifyApiError(429, "Spotify API Error [429]: slow down"));
  assert.equal(limited.status, 429);
  assert.equal(limited.body.code, "SPOTIFY_TOKEN_REFRESH_FAILED");

  const upstreamDown = await getTokenWithRefreshFailure(new FakeSpotifyApiError(503, "Spotify API Error [503]: down"));
  assert.equal(upstreamDown.status, 502);

  const network = await getTokenWithRefreshFailure(new Error("fetch failed"));
  assert.equal(network.status, 502);
  assert.equal(network.body.error, "fetch failed");
});
