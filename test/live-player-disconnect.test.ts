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

test("AC-4: PlayerContext omits deprecated keyboard shortcuts and dispatches spotify-status-changed on unlink", () => {
  const playerContextPath = path.resolve(__dirname, "../src/context/PlayerContext.tsx");
  const content = fs.readFileSync(playerContextPath, "utf-8");

  // No deprecated keyboard shortcut hints
  assert.ok(!content.includes("Press 'L'"), "PlayerContext must not mention 'Press L'");
  assert.ok(!content.includes("modal (S)"), "PlayerContext must not mention 'modal (S)'");

  // handleUnlink must call teardownPlayer and dispatch spotify-status-changed
  const handleUnlinkMatch = content.match(/handleUnlink\s*=\s*useCallback\(async\s*\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[/);
  assert.ok(handleUnlinkMatch, "handleUnlink must be defined");
  const handleUnlinkBody = handleUnlinkMatch[1];
  assert.ok(handleUnlinkBody.includes("teardownPlayer()"), "handleUnlink must invoke teardownPlayer()");
  assert.ok(
    handleUnlinkBody.includes("spotify-status-changed") && handleUnlinkBody.includes("connected: false"),
    "handleUnlink must dispatch spotify-status-changed event with connected: false"
  );
});

test("AC-4b: CustomizationModal and page.tsx omit unitless mb-[-10] and hardcoded #1DB954 defaults", () => {
  const modalPath = path.resolve(__dirname, "../src/components/modals/customization-modal/CustomizationModal.tsx");
  const modalContent = fs.readFileSync(modalPath, "utf-8");
  assert.ok(!modalContent.includes("mb-[-10]"), "CustomizationModal must not contain unitless mb-[-10]");
  assert.ok(!modalContent.includes("#1DB954"), "CustomizationModal must not contain stale #1DB954");

  const pagePath = path.resolve(__dirname, "../src/app/page.tsx");
  const pageContent = fs.readFileSync(pagePath, "utf-8");
  assert.ok(!pageContent.includes('"#1DB954"'), "page.tsx must not hardcode #1DB954 accentColor");
});

