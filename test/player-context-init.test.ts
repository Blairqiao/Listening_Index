import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/player/current-context/route";
import { ADMIN_COOKIE_NAME, createSessionToken } from "../src/lib/admin-auth";

process.env.ADMIN_PASSWORD = "test-admin-secret-password-123";

test("GET /api/player/current-context requires admin authentication", async () => {
  const req = new NextRequest("http://127.0.0.1:8888/api/player/current-context");
  const res = await GET(req);
  assert.equal(res.status, 401);
  const json = await res.json();
  assert.equal(json.error, "Admin authentication required");
});

test("GET /api/player/current-context returns last played track and auto-play context for admin", async () => {
  const adminToken = createSessionToken();
  const req = new NextRequest("http://127.0.0.1:8888/api/player/current-context", {
    headers: {
      cookie: `${ADMIN_COOKIE_NAME}=${adminToken}`,
    },
  });
  const res = await GET(req);
  assert.equal(res.status, 200);
  const json = await res.json();

  assert.ok(json.track, "Must return track information");
  assert.ok(json.track.name, "Track must have a name");
  assert.ok(json.track.artist, "Track must have an artist");
  assert.ok(json.context, "Must return context information");
  assert.equal(json.context.type, "auto");
  assert.equal(json.context.name, "Recent Favorites");
});

test("PlayerContext integrates /api/player/current-context on initialization", () => {
  const playerContextPath = path.resolve(__dirname, "../src/context/PlayerContext.tsx");
  const hookPath = path.resolve(__dirname, "../src/context/player-context/usePlayerInitialContext.ts");
  const content = fs.readFileSync(playerContextPath, "utf-8") +
    (fs.existsSync(hookPath) ? fs.readFileSync(hookPath, "utf-8") : "");

  assert.ok(
    content.includes("/api/player/current-context"),
    "PlayerContext must fetch /api/player/current-context to initialize context and last-played track"
  );
});
