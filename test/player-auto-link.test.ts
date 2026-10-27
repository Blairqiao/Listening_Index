import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("ControlRow Mode 3 removes manual link and unlink buttons", () => {
  const controlRowPath = path.resolve(__dirname, "../src/components/listening-view/ControlRow.tsx");
  const content = fs.readFileSync(controlRowPath, "utf-8");

  // Mode 3 in ControlRow must not render manual link/unlink buttons
  assert.ok(
    !content.includes('[ LINK ]'),
    "ControlRow must not render [ LINK ] button in Mode 3"
  );
  assert.ok(
    !content.includes('[ UNLINK ]'),
    "ControlRow must not render [ UNLINK ] button in Mode 3"
  );
  assert.ok(
    !content.includes('onLinkSpotify'),
    "ControlRow must not require onLinkSpotify prop"
  );
  assert.ok(
    !content.includes('onUnlinkSpotify'),
    "ControlRow must not require onUnlinkSpotify prop"
  );
});

test("PlayerContext synchronizes token status through trusted status events and popup completion", () => {
  const playerContextPath = path.resolve(__dirname, "../src/context/PlayerContext.tsx");
  const content = fs.readFileSync(playerContextPath, "utf-8");

  // Must listen to spotify-status-changed event
  assert.ok(
    content.includes("spotify-status-changed"),
    "PlayerContext must listen to spotify-status-changed custom event"
  );

  // The popup helper validates the browser message before returning.
  assert.ok(
    content.includes("beginLoginPopup"),
    "PlayerContext must use validated popup completion"
  );
});

test("AdminSpotifyModal dispatches spotify-status-changed on connect and disconnect", () => {
  const modalPath = path.resolve(__dirname, "../src/components/modals/admin-spotify-modal/AdminSpotifyModal.tsx");
  const content = fs.readFileSync(modalPath, "utf-8");

  assert.ok(
    content.includes('spotify-status-changed'),
    "AdminSpotifyModal must dispatch spotify-status-changed event on connection changes"
  );
});

test("ListeningView re-probes token status on Mode 3 entry", () => {
  const listeningViewPath = path.resolve(__dirname, "../src/components/ListeningView.tsx");
  const content = fs.readFileSync(listeningViewPath, "utf-8");

  assert.ok(
    content.includes("checkTokenStatus"),
    "ListeningView must invoke checkTokenStatus when entering Mode 3"
  );
});
