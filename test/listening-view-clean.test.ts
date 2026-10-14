import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("ListeningView does not contain demo mode variables, query params, or mock props", () => {
  const filePath = path.resolve(__dirname, "../src/components/ListeningView.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  // Must not have demo state variables
  assert.ok(
    !content.includes("demoSpotifyModalMode"),
    "ListeningView must not contain demoSpotifyModalMode state"
  );
  assert.ok(
    !content.includes("isDemoAdmin"),
    "ListeningView must not contain isDemoAdmin state"
  );

  // Must not parse demo query parameters
  assert.ok(
    !content.includes("demo_spotify_modal"),
    "ListeningView must not parse demo_spotify_modal query parameter"
  );
  assert.ok(
    !content.includes("demo_admin"),
    "ListeningView must not parse demo_admin query parameter"
  );
  assert.ok(
    !content.includes("demo_spotify"),
    "ListeningView must not parse demo_spotify query parameter"
  );

  // Header must bind directly to isAuthenticated
  assert.ok(
    !content.includes("isAuthenticated || isDemoAdmin"),
    "Header must receive isAuthenticated directly, without isDemoAdmin fallback"
  );

  // AdminSpotifyModal must not receive mock props
  assert.ok(
    !content.includes("initialModeOverride={demoSpotifyModalMode}"),
    "AdminSpotifyModal must not receive demo initialModeOverride"
  );
});
