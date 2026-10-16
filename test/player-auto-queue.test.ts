import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/player/auto-queue/route";
import { ADMIN_COOKIE_NAME, createSessionToken } from "../src/lib/admin-auth";

process.env.ADMIN_PASSWORD = "test-admin-secret-password-123";

test("GET /api/player/auto-queue requires admin authentication", async () => {
  const req = new NextRequest("http://127.0.0.1:8888/api/player/auto-queue");
  const res = await GET(req);
  assert.equal(res.status, 401);
  const json = await res.json();
  assert.equal(json.error, "Admin authentication required");
});

test("GET /api/player/auto-queue returns top tracks batch of uris for admin", async () => {
  const adminToken = createSessionToken();
  const req = new NextRequest("http://127.0.0.1:8888/api/player/auto-queue", {
    headers: {
      cookie: `${ADMIN_COOKIE_NAME}=${adminToken}`,
    },
  });
  const res = await GET(req);
  assert.equal(res.status, 200);
  const json = await res.json();

  assert.ok(Array.isArray(json.uris), "Must return uris array");
  assert.ok(json.uris.length > 0, "Must return at least 1 track URI");
  assert.ok(
    json.uris[0].startsWith("spotify:track:"),
    "Track URI must be in spotify:track:<id> format"
  );
  assert.ok(Array.isArray(json.tracks), "Must return tracks array metadata");
});

test("auto-queue SQL query adheres to schema with t.name and t.artist_name (no t.title/t.artist)", () => {
  const routePath = path.resolve(__dirname, "../src/app/api/player/auto-queue/route.ts");
  const content = fs.readFileSync(routePath, "utf-8");

  assert.ok(!content.includes("t.title"), "SQL query must not reference non-existent t.title");
  assert.ok(!content.includes("t.artist,"), "SQL query must not reference non-existent t.artist");
  assert.ok(content.includes("t.name"), "SQL query must select t.name");
  assert.ok(content.includes("artist_name"), "SQL query must select artist_name");
  assert.ok(content.includes("synthetic:"), "SQL query must exclude synthetic non-Spotify track IDs");
});

test("PlayerContext starts Auto Play when selectedContext is auto", () => {
  const contextPath = path.resolve(__dirname, "../src/context/PlayerContext.tsx");
  const content = fs.readFileSync(contextPath, "utf-8");

  assert.ok(
    content.includes("/api/player/auto-queue"),
    "PlayerContext must fetch auto-queue"
  );
  assert.ok(
    content.includes("selectedContext.type === \"auto\"") || content.includes("selectedContext.type === 'auto'"),
    "PlayerContext must check if selectedContext is auto before playing"
  );
});
