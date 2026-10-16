import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("PlayerContext disconnects SDK and pauses playback when unauthenticated / logging out", () => {
  const playerContextPath = path.resolve(__dirname, "../src/context/PlayerContext.tsx");
  const content = fs.readFileSync(playerContextPath, "utf-8");

  // When isAuthenticated becomes false, playerRef.current must be paused and disconnected
  assert.ok(
    content.includes("playerRef.current.pause") || content.includes("playerRef.current?.pause") || content.includes("player.pause"),
    "PlayerContext must pause playerRef when disconnecting / unauthenticated"
  );
  assert.ok(
    content.includes("playerRef.current?.disconnect") || content.includes("player.disconnect"),
    "PlayerContext must call disconnect on playerRef when unauthenticated"
  );

  // Must ensure player references and device ID are reset to null upon logout
  const hasDisconnectOnUnauth =
    content.includes("!isAuthenticated") &&
    (content.includes("playerRef.current = null") || content.includes("setDeviceId(null)")) &&
    content.includes("disconnect");

  assert.ok(
    hasDisconnectOnUnauth,
    "PlayerContext must reset playerRef, deviceId, and disconnect SDK when !isAuthenticated"
  );
});
