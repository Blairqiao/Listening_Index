/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts";

const ADMIN_EXPIRED = /Admin session expired/;
const SDK_TIMEOUT = /connection timed out/;

class FakePlayer {
  static instances: FakePlayer[] = [];
  listeners: Record<string, (payload?: any) => void> = {};
  connectCalls = 0;
  disconnectCalls = 0;
  pauseCalls = 0;
  connectResult: boolean | Promise<boolean> = true;
  getOAuthToken: (cb: (token: string) => void) => void;

  constructor(options: { getOAuthToken: (cb: (token: string) => void) => void }) {
    this.getOAuthToken = options.getOAuthToken;
    FakePlayer.instances.push(this);
  }
  addListener(event: string, cb: (payload?: any) => void) {
    this.listeners[event] = cb;
    return true;
  }
  connect() {
    this.connectCalls++;
    return Promise.resolve(this.connectResult);
  }
  disconnect() {
    this.disconnectCalls++;
  }
  pause() {
    this.pauseCalls++;
    return Promise.resolve();
  }
  emit(event: string, payload?: any) {
    this.listeners[event]?.(payload);
  }
}

type TokenReply = () => Response | Promise<Response>;

const linkedReply: TokenReply = () => Response.json({ linked: true, accessToken: "token-1", expiresIn: 3600 });

/** Lets pending promise callbacks run. setImmediate is not one of the mocked timers. */
async function flush() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
}

/**
 * Runs the real usePlayerConnection hook on a minimal hook runtime. State and refs
 * live in slots, so calling `render()` again returns the current state.
 */
function setup(t: TestContext) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  FakePlayer.instances = [];

  const slots: any[] = [];
  let cursor = 0;
  const react = {
    useState(init: unknown) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { value: typeof init === "function" ? (init as () => unknown)() : init };
      const slot = slots[i];
      const set = (next: unknown) => {
        slot.value = typeof next === "function" ? (next as (prev: unknown) => unknown)(slot.value) : next;
      };
      return [slot.value, set];
    },
    useRef(init: unknown) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: init };
      return slots[i];
    },
    useCallback: (fn: unknown) => fn,
    useEffect: () => undefined,
  };

  const harness = { tokenReply: linkedReply };
  const previous = {
    fetch: globalThis.fetch,
    window: (globalThis as any).window,
    warn: console.warn,
    error: console.error,
  };
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url === "/api/player/token") return harness.tokenReply();
    if (url.startsWith("https://api.spotify.com/v1/me/player")) return new Response(null, { status: 204 });
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  (globalThis as any).window = {
    Spotify: { Player: FakePlayer },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  };
  console.warn = () => undefined;
  console.error = () => undefined;
  t.after(() => {
    globalThis.fetch = previous.fetch;
    (globalThis as any).window = previous.window;
    console.warn = previous.warn;
    console.error = previous.error;
  });

  const hookModule = loadTs("src/context/player-context/usePlayerConnection.ts", {
    react,
    "@/lib/spotify-auth": { beginLogin: async () => undefined, beginLoginPopup: async () => true },
    "./useSpotifySdk": { loadSpotifySdk: async () => undefined },
  });

  const params = {
    isAuthenticated: true,
    openModal: () => undefined,
    volumeRef: { current: 0.35 },
    userPlaylistsRef: { current: [] },
    setSelectedContext: () => undefined,
    loadInitialContext: async () => undefined,
    loadPlaylists: async () => undefined,
  };
  const render = () => {
    cursor = 0;
    return hookModule.usePlayerConnection(params) as unknown as {
      playerStatus: string;
      errorMessage: string | null;
      deviceId: string | null;
      isLinked: boolean | null;
      connectPlayer: (force?: boolean) => Promise<void>;
      checkTokenStatus: (force?: boolean) => Promise<void>;
      handleUnlink: () => Promise<void>;
    };
  };

  return { harness, render, hook: render(), tick: (ms: number) => t.mock.timers.tick(ms) };
}

/** Links, connects and reports ready, as on a healthy page load. */
async function setupReadyPlayer(t: TestContext) {
  const env = setup(t);
  await env.hook.checkTokenStatus();
  const player = FakePlayer.instances[0];
  player.emit("ready", { device_id: "device-1" });
  await flush();
  assert.equal(env.render().playerStatus, "ready");
  assert.equal(env.render().isLinked, true);
  return { ...env, player };
}

// ---------------------------------------------------------------------------
// ready / not_ready after later connectPlayer calls
// ---------------------------------------------------------------------------

test("ready after a forced reconnect of the same player sets the new device id and status", async (t) => {
  const { hook, render, tick } = setup(t);

  await hook.connectPlayer();
  const player = FakePlayer.instances[0];
  player.emit("ready", { device_id: "device-1" });
  assert.equal(render().deviceId, "device-1");
  assert.equal(render().playerStatus, "ready");

  await hook.connectPlayer();
  await hook.connectPlayer(true);
  assert.equal(FakePlayer.instances.length, 1, "the reconnect reuses the player");
  assert.equal(player.connectCalls, 2);
  assert.equal(render().deviceId, null, "the old device id is cleared until ready arrives");
  assert.equal(render().playerStatus, "connecting");

  player.emit("ready", { device_id: "device-2" });
  assert.equal(render().deviceId, "device-2");
  assert.equal(render().playerStatus, "ready");

  tick(20000);
  assert.equal(render().playerStatus, "ready");
  assert.equal(render().errorMessage, null);
});

test("Retry after an SDK connection timeout recovers once the player reports ready", async (t) => {
  const { hook, render, tick } = setup(t);

  await hook.connectPlayer();
  const player = FakePlayer.instances[0];
  tick(20000);
  assert.equal(render().playerStatus, "error");
  assert.match(render().errorMessage ?? "", SDK_TIMEOUT);

  await hook.connectPlayer();
  assert.equal(FakePlayer.instances.length, 1);
  player.emit("ready", { device_id: "device-1" });
  assert.equal(render().playerStatus, "ready");
  assert.equal(render().deviceId, "device-1");

  tick(20000);
  assert.equal(render().playerStatus, "ready", "the timeout must not fire after ready");
});

test("not_ready after a second connectPlayer call clears the device id", async (t) => {
  const { hook, render } = setup(t);

  await hook.connectPlayer();
  const player = FakePlayer.instances[0];
  player.emit("ready", { device_id: "device-1" });
  await hook.connectPlayer();
  assert.equal(render().deviceId, "device-1");

  player.emit("not_ready", { device_id: "device-1" });
  assert.equal(render().deviceId, null);
  assert.equal(render().playerStatus, "connecting");
});

test("ready that arrives before connect() resolves is accepted", async (t) => {
  const { hook, render } = setup(t);
  let resolveConnect: (ok: boolean) => void = () => undefined;
  const original = FakePlayer.prototype.connect;
  FakePlayer.prototype.connect = function (this: FakePlayer) {
    this.connectCalls++;
    return new Promise<boolean>((resolve) => {
      resolveConnect = resolve;
    });
  };
  t.after(() => {
    FakePlayer.prototype.connect = original;
  });

  const connecting = hook.connectPlayer();
  await flush();
  FakePlayer.instances[0].emit("ready", { device_id: "device-1" });
  assert.equal(render().deviceId, "device-1");
  resolveConnect(true);
  await connecting;
  assert.equal(render().playerStatus, "ready");
});

test("ready from a player superseded by a teardown is ignored and the player is disconnected", async (t) => {
  const { hook, render } = setup(t);
  let resolveConnect: (ok: boolean) => void = () => undefined;
  const original = FakePlayer.prototype.connect;
  FakePlayer.prototype.connect = function (this: FakePlayer) {
    this.connectCalls++;
    return new Promise<boolean>((resolve) => {
      resolveConnect = resolve;
    });
  };
  t.after(() => {
    FakePlayer.prototype.connect = original;
  });

  const connecting = hook.connectPlayer();
  await flush();
  const player = FakePlayer.instances[0];
  await hook.handleUnlink();
  resolveConnect(true);
  await connecting;

  player.emit("ready", { device_id: "device-1" });
  assert.equal(render().deviceId, null);
  assert.equal(render().playerStatus, "unlinked");
  assert.ok(player.disconnectCalls >= 1);
});

test("a player whose connect() fails does not stay registered", async (t) => {
  const { hook, render } = setup(t);
  const original = FakePlayer.prototype.connect;
  FakePlayer.prototype.connect = function (this: FakePlayer) {
    this.connectCalls++;
    return Promise.resolve(FakePlayer.instances.length > 1);
  };
  t.after(() => {
    FakePlayer.prototype.connect = original;
  });

  await hook.connectPlayer();
  assert.equal(render().playerStatus, "error");

  // The next attempt builds a fresh player; the failed one must not answer for it.
  await hook.connectPlayer();
  assert.equal(FakePlayer.instances.length, 2);
  FakePlayer.instances[0].emit("ready", { device_id: "stale-device" });
  assert.equal(render().deviceId, null);
  FakePlayer.instances[1].emit("ready", { device_id: "device-2" });
  assert.equal(render().deviceId, "device-2");
});

// ---------------------------------------------------------------------------
// Token failures that are not an unlink
// ---------------------------------------------------------------------------

test("a 502 from the token endpoint keeps the player and reports an error with the server text", async (t) => {
  const { harness, hook, render, player } = await setupReadyPlayer(t);

  harness.tokenReply = () => Response.json({ error: "Spotify API Error [503]: upstream unavailable" }, { status: 502 });
  await hook.checkTokenStatus();

  assert.equal(player.pauseCalls, 0);
  assert.equal(player.disconnectCalls, 0);
  assert.equal(render().playerStatus, "error");
  assert.equal(render().errorMessage, "Spotify API Error [503]: upstream unavailable");
  assert.equal(render().deviceId, "device-1");
  assert.equal(render().isLinked, true);
});

test("a network failure on the token check keeps the player and reports an error", async (t) => {
  const { harness, hook, render, player } = await setupReadyPlayer(t);

  harness.tokenReply = () => {
    throw new TypeError("fetch failed");
  };
  await hook.checkTokenStatus();

  assert.equal(player.pauseCalls, 0);
  assert.equal(player.disconnectCalls, 0);
  assert.equal(render().playerStatus, "error");
  assert.ok(render().errorMessage);
  assert.equal(render().isLinked, true);
});

test("Retry after a transient token failure returns a kept player to ready", async (t) => {
  const { harness, hook, render, player } = await setupReadyPlayer(t);

  harness.tokenReply = () => Response.json({ error: "boom" }, { status: 502 });
  await hook.checkTokenStatus();
  assert.equal(render().playerStatus, "error");

  harness.tokenReply = linkedReply;
  await hook.checkTokenStatus();
  assert.equal(render().playerStatus, "ready");
  assert.equal(render().errorMessage, null);
  assert.equal(player.disconnectCalls, 0);
});

test("a 200 with linked false tears the player down", async (t) => {
  const { harness, hook, render, player } = await setupReadyPlayer(t);

  harness.tokenReply = () => Response.json({ linked: false });
  await hook.checkTokenStatus();

  assert.equal(player.pauseCalls, 1);
  assert.equal(player.disconnectCalls, 1);
  assert.equal(render().playerStatus, "unlinked");
  assert.equal(render().isLinked, false);
  assert.equal(render().deviceId, null);
});

test("a 401 carrying ADMIN_AUTH_REQUIRED tears the player down and asks the owner to log in", async (t) => {
  const { harness, hook, render, player } = await setupReadyPlayer(t);

  harness.tokenReply = () =>
    Response.json({ error: "Admin authentication required", code: "ADMIN_AUTH_REQUIRED" }, { status: 401 });
  await hook.checkTokenStatus();

  assert.equal(player.disconnectCalls, 1);
  assert.equal(render().playerStatus, "error");
  assert.match(render().errorMessage ?? "", ADMIN_EXPIRED);
});

test("a 401 without the admin code is not treated as an expired admin session", async (t) => {
  const { harness, hook, render, player } = await setupReadyPlayer(t);

  harness.tokenReply = () => Response.json({ error: "Spotify API Error [401]: invalid_client" }, { status: 401 });
  await hook.checkTokenStatus();

  assert.equal(player.disconnectCalls, 0);
  assert.equal(render().playerStatus, "error");
  assert.equal(render().errorMessage, "Spotify API Error [401]: invalid_client");
});

test("getOAuthToken hands the SDK a fresh token", async (t) => {
  const { player } = await setupReadyPlayer(t);
  const tokens: string[] = [];
  player.getOAuthToken((token) => tokens.push(token));
  await flush();
  assert.deepEqual(tokens, ["token-1"]);
});

test("getOAuthToken reports a failed refresh as an error and leaves the link state alone", async (t) => {
  const { harness, render, player } = await setupReadyPlayer(t);
  const tokens: string[] = [];

  harness.tokenReply = () => Response.json({ error: "Spotify API Error [500]: server error" }, { status: 502 });
  player.getOAuthToken((token) => tokens.push(token));
  await flush();
  assert.equal(tokens.length, 0);
  assert.equal(render().playerStatus, "error");
  assert.equal(render().errorMessage, "Spotify API Error [500]: server error");
  assert.equal(render().isLinked, true);

  harness.tokenReply = () => {
    throw new TypeError("fetch failed");
  };
  player.getOAuthToken((token) => tokens.push(token));
  await flush();
  assert.equal(render().playerStatus, "error");
  assert.ok(render().errorMessage);
  assert.equal(render().isLinked, true);
});

test("getOAuthToken reports an expired admin session only for the admin code", async (t) => {
  const { harness, render, player } = await setupReadyPlayer(t);

  harness.tokenReply = () => Response.json({ error: "Spotify API Error [401]: bad token" }, { status: 401 });
  player.getOAuthToken(() => undefined);
  await flush();
  assert.equal(render().playerStatus, "error");
  assert.equal(render().errorMessage, "Spotify API Error [401]: bad token");

  harness.tokenReply = () =>
    Response.json({ error: "Admin authentication required", code: "ADMIN_AUTH_REQUIRED" }, { status: 401 });
  player.getOAuthToken(() => undefined);
  await flush();
  assert.match(render().errorMessage ?? "", ADMIN_EXPIRED);
});

test("getOAuthToken marks the player unlinked when the server says the credential is gone", async (t) => {
  const { harness, render, player } = await setupReadyPlayer(t);

  harness.tokenReply = () => Response.json({ linked: false });
  player.getOAuthToken(() => undefined);
  await flush();
  assert.equal(render().playerStatus, "unlinked");
  assert.equal(render().isLinked, false);
});
