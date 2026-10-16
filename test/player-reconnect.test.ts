import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("PlayerContext supports in-place SDK reconnect on token update", () => {
  const playerContextPath = path.resolve(__dirname, "../src/context/PlayerContext.tsx");
  const content = fs.readFileSync(playerContextPath, "utf-8");

  // connectPlayer must support forced/in-place reconnect when playerRef already exists
  assert.ok(
    content.includes("forceReconnect") || content.includes("force: boolean") || content.includes("force?: boolean") || content.includes("force = false"),
    "connectPlayer must accept a force reconnect option"
  );

  // When force reconnecting an existing player, it must disconnect and re-call connect on the same player instance
  assert.ok(
    content.includes("playerRef.current.connect()") || content.includes("playerRef.current?.connect()"),
    "PlayerContext must re-connect existing playerRef instance in place"
  );

  // onStatusChanged and onAuthMessage must trigger forced reconnect so the SDK re-reads getOAuthToken from the database
  const handlesStatusChange =
    content.includes("checkTokenStatus(true)") ||
    content.includes("connectPlayer(true)");

  assert.ok(
    handlesStatusChange,
    "Token status changes and auth messages must trigger forced in-place reconnect"
  );
});

test("teardownPlayer preserves Spotify SDK iframe environment and uses safe timeout", () => {
  const playerContextPath = path.resolve(__dirname, "../src/context/PlayerContext.tsx");
  const content = fs.readFileSync(playerContextPath, "utf-8");

  assert.ok(
    !content.includes("querySelectorAll('iframe"),
    "PlayerContext must preserve Spotify SDK iframes so subsequent reconnections retain message dispatch"
  );
  assert.ok(
    content.includes("20000") || content.includes("20_000"),
    "Connection timeout should be at least 20 seconds to prevent premature timeouts during WebSocket negotiation"
  );
});
