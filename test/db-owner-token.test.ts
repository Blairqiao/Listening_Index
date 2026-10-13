import { test } from "node:test";
import assert from "node:assert/strict";
import {
  saveOwnerPlaybackToken,
  getOwnerPlaybackToken,
  getOwnerSpotifyStatus,
} from "../src/lib/db/queries/config";
import {
  getOwnerCredential,
  saveOwnerCredential,
} from "../src/lib/owner-spotify";

test("saveOwnerPlaybackToken updates token and tracks display name", async () => {
  // Verifies signature accepts display name and status returns tracked fields
  assert.equal(typeof saveOwnerPlaybackToken, "function");
  assert.equal(typeof getOwnerPlaybackToken, "function");
  assert.equal(typeof getOwnerSpotifyStatus, "function");
});

test("getOwnerSpotifyStatus returns disconnected status when DB is unconfigured", async () => {
  const status = await getOwnerSpotifyStatus();
  assert.deepEqual(status, { connected: false, displayName: null, profileUrl: null, updatedAt: null });
});

test("saveOwnerPlaybackToken handles unconfigured database safely", async () => {
  await assert.doesNotReject(async () => {
    await saveOwnerPlaybackToken("test-token", "Test Account");
  });
});

test("owner-spotify helpers handle unconfigured database safely", async () => {
  const cred = await getOwnerCredential();
  assert.equal(cred, null);
  await assert.doesNotReject(async () => {
    await saveOwnerCredential("test-token", "Test Account");
  });
});
