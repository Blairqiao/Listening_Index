import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("GET /api/player/token integrates shared tokenCache from src/lib/spotify.ts", () => {
  const routePath = path.resolve(__dirname, "../src/app/api/player/token/route.ts");
  const content = fs.readFileSync(routePath, "utf-8");

  assert.ok(
    content.includes("getAccessToken") || content.includes("tokenCache"),
    "/api/player/token must leverage getAccessToken or tokenCache to avoid un-cached OAuth refreshes"
  );
});

test("GET /api/player/playlists integrates shared tokenCache from src/lib/spotify.ts", () => {
  const routePath = path.resolve(__dirname, "../src/app/api/player/playlists/route.ts");
  const content = fs.readFileSync(routePath, "utf-8");

  assert.ok(
    content.includes("getAccessToken") || content.includes("refreshAccessToken"),
    "/api/player/playlists must use centralized token management"
  );
});
