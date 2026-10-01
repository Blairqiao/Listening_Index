import assert from "node:assert";
import test from "node:test";
import { resolveActiveDevice, cycleRepeatMode, getNextRepeatState } from "../src/context/PlayerContext";

test("resolveActiveDevice correctly identifies local vs remote devices", () => {
  const localId = "device_local_123";

  // When Spotify reports playing on the local Web Playback SDK device
  const localPlayback = {
    is_playing: true,
    device: { id: "device_local_123", name: "Listening Index" },
  };
  const localRes = resolveActiveDevice(localPlayback, localId);
  assert.ok(localRes);
  assert.strictEqual(localRes.isThisBrowser, true);
  assert.strictEqual(localRes.name, "Listening Index");

  // When Spotify reports playing on a remote device (e.g. iPhone)
  const remotePlayback = {
    is_playing: true,
    device: { id: "device_remote_456", name: "iPhone 15" },
  };
  const remoteRes = resolveActiveDevice(remotePlayback, localId);
  assert.ok(remoteRes);
  assert.strictEqual(remoteRes.isThisBrowser, false);
  assert.strictEqual(remoteRes.name, "iPhone 15");

  // When nothing is playing or payload is empty
  const idleRes = resolveActiveDevice(null, localId);
  assert.strictEqual(idleRes, null);
});

test("cycleRepeatMode and getNextRepeatState cycle repeat modes correctly", () => {
  // 0 = off, 1 = context, 2 = track
  assert.strictEqual(cycleRepeatMode(0), 1);
  assert.strictEqual(cycleRepeatMode(1), 2);
  assert.strictEqual(cycleRepeatMode(2), 0);

  assert.strictEqual(getNextRepeatState(0), "context");
  assert.strictEqual(getNextRepeatState(1), "track");
  assert.strictEqual(getNextRepeatState(2), "off");
});
