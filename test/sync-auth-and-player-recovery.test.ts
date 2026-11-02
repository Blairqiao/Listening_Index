import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { loadTs } from "./helpers/load-ts";

// ---------------------------------------------------------------------------
// N005: /api/sync Cross-Origin / Cross-Site Authorization Guard Tests
// ---------------------------------------------------------------------------

function setupSyncRouteHarness() {
  process.env.ADMIN_PASSWORD = "test-admin-password-123";
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";

  const adminAuth = loadTs("src/lib/admin-auth.ts");
  const validAdminToken = adminAuth.createSessionToken();

  let syncCalled = false;
  const syncRoute = loadTs("src/app/api/sync/route.ts", {
    "@/lib/spotify-sync": {
      syncSpotify: async () => {
        syncCalled = true;
        return { processed: 5, durationMs: 120 };
      },
    },
    "@/lib/db": {
      isDbConfigured: () => true,
    },
    "@/lib/spotify": {
      isOwnerSpotifyConfigured: async () => true,
    },
    "@/lib/cron-auth": {
      isAuthorizedCronRequest: async (req: NextRequest) => {
        const url = new URL(req.url);
        return url.searchParams.get("key") === "valid-cron-key";
      },
    },
    "@/lib/db/server-cache": {
      clearServerCache: () => undefined,
    },
  });

  return {
    validAdminToken,
    syncRoute,
    get syncCalled() {
      return syncCalled;
    },
  };
}

test("N005: cross-site top-level GET /api/sync with admin session cookie must return 401 Unauthorized", async () => {
  const { validAdminToken, syncRoute } = setupSyncRouteHarness();

  // Simulate cross-site top-level GET navigation where browser sends Lax cookie
  const req = new NextRequest("https://my-app.vercel.app/api/sync", {
    method: "GET",
    headers: {
      cookie: `admin_session=${validAdminToken}`,
      "sec-fetch-site": "cross-site",
      referer: "https://evil-site.com/malicious-link",
      host: "my-app.vercel.app",
    },
  });

  const res = await syncRoute.GET(req);
  assert.equal(res.status, 401, "Cross-site GET with admin cookie must be rejected with 401");
  const data = await res.json();
  assert.ok(data.error, "Should return unauthorized error");
});

test("N005: cross-origin POST /api/sync with admin session cookie must return 403 Forbidden", async () => {
  const { validAdminToken, syncRoute } = setupSyncRouteHarness();

  const req = new NextRequest("https://my-app.vercel.app/api/sync", {
    method: "POST",
    headers: {
      cookie: `admin_session=${validAdminToken}`,
      "sec-fetch-site": "cross-site",
      origin: "https://evil-site.com",
      host: "my-app.vercel.app",
    },
  });

  const res = await syncRoute.POST(req);
  assert.equal(res.status, 403, "Cross-origin POST with admin cookie must be rejected with 403 Forbidden");
  const data = await res.json();
  assert.match(data.error, /cross-origin/i);
});

test("N005: same-origin POST /api/sync with admin session cookie succeeds", async () => {
  const { validAdminToken, syncRoute } = setupSyncRouteHarness();

  const req = new NextRequest("https://my-app.vercel.app/api/sync", {
    method: "POST",
    headers: {
      cookie: `admin_session=${validAdminToken}`,
      "sec-fetch-site": "same-origin",
      origin: "https://my-app.vercel.app",
      host: "my-app.vercel.app",
    },
  });

  const res = await syncRoute.POST(req);
  assert.equal(res.status, 200, "Same-origin admin POST must succeed");
  const data = await res.json();
  assert.equal(data.success, true);
});

test("N005: GET /api/sync with valid cron key query param succeeds", async () => {
  const { syncRoute } = setupSyncRouteHarness();

  const req = new NextRequest("https://my-app.vercel.app/api/sync?key=valid-cron-key", {
    method: "GET",
    headers: {
      host: "my-app.vercel.app",
    },
  });

  const res = await syncRoute.GET(req);
  assert.equal(res.status, 200, "Cron GET with valid key must succeed");
  const data = await res.json();
  assert.equal(data.success, true);
});

// ---------------------------------------------------------------------------
// N006: PlayerContext Teardown Connection Lock Tests
// ---------------------------------------------------------------------------

test("N006: teardownPlayer releases connectingRef lock so subsequent connectPlayer succeeds", async () => {
  let capturedValue: {
    connectPlayer: (force?: boolean) => Promise<void>;
    handleUnlink: () => void;
  } | null = null;

  let connectCallCount = 0;
  let sdkLoadDeferredResolve: (() => void) | null = null;

  const reactStub = {
    createElement: (type: unknown, props: unknown, ...children: unknown[]) => {
      if (typeof type === "function") {
        return (type as (p: unknown) => unknown)({ ...(props || {}), children });
      }
      return { type, props, children };
    },
    createContext: () => ({ Provider: ({ value, children }: { value: unknown; children: unknown }) => {
      capturedValue = value as typeof capturedValue;
      return children;
    }}),
    useContext: () => null,
    useState: (init: unknown) => {
      let val = typeof init === "function" ? (init as () => unknown)() : init;
      return [val, (newVal: unknown) => {
        val = typeof newVal === "function" ? (newVal as (p: unknown) => unknown)(val) : newVal;
      }];
    },
    useRef: (init: unknown) => ({ current: init }),
    useCallback: (fn: (...args: unknown[]) => unknown) => fn,
    useMemo: (fn: () => unknown) => fn(),
    useEffect: () => undefined,
  };

  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ success: true })) as typeof fetch;

  (globalThis as unknown as { window: unknown }).window = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  };

  try {
    const playerContextModule = loadTs("src/context/PlayerContext.tsx", {
    react: reactStub,
    "@/context/ConfigContext": {
      useConfig: () => ({ isAuthenticated: true }),
    },
    "@/lib/volume-utils": {
      sliderToVolume: () => 1,
      volumeToSlider: () => 100,
      VOLUME_CURVE_EXPONENT: 2,
      getStoredVolume: () => 100,
      setStoredVolume: () => undefined,
    },
    "./player-context/useSpotifySdk": {
      loadSpotifySdk: () => {
        connectCallCount++;
        return new Promise<void>((resolve) => {
          sdkLoadDeferredResolve = resolve;
        });
      },
    },
    "./player-context/usePlayerPlaylists": {
      usePlayerPlaylists: () => ({ userPlaylists: [], loadPlaylists: async () => undefined }),
    },
    "./player-context/usePlayerInitialContext": {
      usePlayerInitialContext: () => ({ initialContext: { track: null, context: null }, loadInitialContext: async () => undefined }),
    },
    "@/lib/async-utils": {
      createSingleFlight: () => (fn: () => Promise<unknown>) => fn(),
    },
    "@/lib/spotify": {
      getAccessToken: async () => "token",
    },
  });

  // Render Provider to extract handlers
  playerContextModule.PlayerProvider({ children: null });

  assert.ok(capturedValue, "PlayerProvider must provide context value");
  const { connectPlayer, handleUnlink } = capturedValue as {
    connectPlayer: (force?: boolean) => Promise<void>;
    handleUnlink: () => void;
  };

  // 1. Start connection attempt (which hangs on loadSpotifySdk)
  const firstConnectPromise = connectPlayer();
  assert.equal(connectCallCount, 1, "First connectPlayer must invoke SDK loader");

  // 2. While first attempt is in flight, trigger teardown (e.g. user unlinks or logs out)
  handleUnlink();

  // 3. First attempt resolves afterward
  const resolveFirst = sdkLoadDeferredResolve as (() => void) | null;
  resolveFirst?.();
  await firstConnectPromise;

  // 4. Try connecting again (e.g. user re-links or logs back in)
  const secondConnectPromise = connectPlayer();
  assert.equal(
    connectCallCount,
    2,
    "Second connectPlayer must not be blocked by lingering connectingRef lock"
  );
  const resolveSecond = sdkLoadDeferredResolve as (() => void) | null;
  resolveSecond?.();
  await secondConnectPromise;
} finally {
  globalThis.fetch = previousFetch;
}
});
