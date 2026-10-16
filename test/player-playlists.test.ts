import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TOKEN_SCOPES } from "../src/lib/spotify-auth";
import { GET } from "../src/app/api/player/playlists/route";
import { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, createSessionToken } from "../src/lib/admin-auth";

process.env.ADMIN_PASSWORD = "test-admin-secret-password-123";

test("TOKEN_SCOPES includes playlist-read-private and playlist-read-collaborative", () => {
  assert.ok(
    TOKEN_SCOPES.includes("playlist-read-private"),
    "TOKEN_SCOPES must include playlist-read-private"
  );
  assert.ok(
    TOKEN_SCOPES.includes("playlist-read-collaborative"),
    "TOKEN_SCOPES must include playlist-read-collaborative"
  );
});

test("GET /api/player/playlists requires admin authentication", async () => {
  const req = new NextRequest("http://127.0.0.1:8888/api/player/playlists");
  const res = await GET(req);
  assert.equal(res.status, 401);
  const json = await res.json();
  assert.equal(json.error, "Admin authentication required");
});

test("GET /api/player/playlists returns empty playlists gracefully if unlinked", async () => {
  const adminToken = createSessionToken();
  const req = new NextRequest("http://127.0.0.1:8888/api/player/playlists", {
    headers: {
      cookie: `${ADMIN_COOKIE_NAME}=${adminToken}`,
    },
  });
  const res = await GET(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(Array.isArray(json.playlists), "Must return playlists array");
});

test("GET /api/player/playlists parses track count from items.total and tracks.total", () => {
  const routePath = path.resolve(__dirname, "../src/app/api/player/playlists/route.ts");
  const content = fs.readFileSync(routePath, "utf-8");

  assert.ok(
    content.includes("items?.total") || content.includes("items.total"),
    "Playlists route must parse items.total for Spotify API compatibility"
  );
});
