import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadSpotifySdk } from "../src/context/player-context/useSpotifySdk";

test("F14: loadSpotifySdk cleans up failed script tag and allows retry after error", async () => {
  const appendedScripts: unknown[] = [];
  const removedScripts: unknown[] = [];

  const fakeScript = {
    src: "",
    async: false,
    onerror: null as ((ev: unknown) => unknown) | null,
    remove() {
      removedScripts.push(this);
    },
  };

  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  (globalThis as Record<string, unknown>).window = {
    onSpotifyWebPlaybackSDKReady: null,
  };

  (globalThis as Record<string, unknown>).document = {
    createElement: (tag: string) => {
      if (tag === "script") return fakeScript;
      return {};
    },
    body: {
      appendChild: (element: unknown) => {
        appendedScripts.push(element);
      },
    },
  };

  try {
    // First attempt: simulate error
    const promise1 = loadSpotifySdk();
    assert.equal(appendedScripts.length, 1);
    assert.ok(fakeScript.onerror, "script tag must have onerror handler");

    fakeScript.onerror(new Error("Network failed"));

    await assert.rejects(
      async () => await promise1,
      /Could not load the Spotify SDK script/
    );

    // Verify script tag was removed on failure
    assert.equal(removedScripts.length, 1, "Failed script tag should be removed on error");

    // Second attempt: retry should create a new script tag, not return cached rejected promise
    fakeScript.onerror = null;
    const promise2 = loadSpotifySdk();
    assert.equal(appendedScripts.length, 2, "Second attempt should create a fresh script tag");

    // Simulate success
    const win = globalThis.window as unknown as { Spotify?: { Player: unknown }; onSpotifyWebPlaybackSDKReady?: () => void };
    win.Spotify = { Player: class {} };
    win.onSpotifyWebPlaybackSDKReady?.();
    await promise2;
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});

test("F15: not_ready clears device id and readiness, and superseded connection attempts are ignored", () => {
  const playerContextSource = readFileSync(
    path.resolve(__dirname, "../src/context/PlayerContext.tsx"),
    "utf-8"
  );

  // Check that not_ready clears deviceId
  const notReadyListener = playerContextSource.match(/addListener\(\s*["']not_ready["'][\s\S]*?\);/);
  assert.ok(notReadyListener, "PlayerContext must have a not_ready listener");
  assert.ok(
    notReadyListener[0].includes("deviceIdRef.current = null") ||
      notReadyListener[0].includes("setDeviceId(null)"),
    "not_ready listener must clear device identity"
  );

  // Check that connection attempts track attempt or generation to ignore superseded attempts
  assert.ok(
    playerContextSource.includes("connectionAttemptRef") ||
      playerContextSource.includes("connectionGenRef") ||
      playerContextSource.includes("attemptRef"),
    "PlayerContext must track connection attempts to ignore superseded attempts"
  );
});

test("F16: playback PUT in selectContext checks status and handles 403, 404, 429 and network errors", () => {
  const playerContextSource = readFileSync(
    path.resolve(__dirname, "../src/context/PlayerContext.tsx"),
    "utf-8"
  );

  // Verify that selectContext inspects the response status
  const selectContextMatch = playerContextSource.match(/const selectContext = useCallback\([\s\S]*?^ {2}\);/m);
  assert.ok(selectContextMatch, "selectContext definition must exist");
  const selectContextBody = selectContextMatch[0];

  assert.ok(
    selectContextBody.includes("res.ok") || selectContextBody.includes("res.status === 204"),
    "selectContext must check response status of playback PUT"
  );
  assert.ok(
    selectContextBody.includes("403") && selectContextBody.includes("404"),
    "selectContext must handle 403 and 404 status codes"
  );
  assert.ok(
    selectContextBody.includes("429"),
    "selectContext must handle 429 rate limit status code"
  );
  assert.ok(
    selectContextBody.includes("armedContextRef.current = true"),
    "selectContext must retain pending context when playback fails"
  );
});
