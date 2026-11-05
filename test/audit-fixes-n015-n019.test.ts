import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { loadTs } from "./helpers/load-ts";

// ---------------------------------------------------------------------------
// Fix 7 (N019): regenerateCronKey without database & /api/player/token real lifetime
// ---------------------------------------------------------------------------

process.env.ADMIN_PASSWORD = "test-admin-password-123";
(process.env as Record<string, string | undefined>).NODE_ENV = "production";

test("N019: regenerateCronKey throws when isDbConfigured is false", async () => {
  const configModule = loadTs("src/lib/db/queries/config.ts", {
    "@/lib/db": {
      isDbConfigured: () => false,
      getDb: () => { throw new Error("Should not connect to DB"); },
    },
    "@/lib/db/queries/schema": {
      ensureTablesExist: async () => undefined,
    },
  });

  await assert.rejects(
    async () => {
      await configModule.regenerateCronKey();
    },
    /database is required/
  );
});

test("N019: POST /api/owner/sync-key returns 503 when DB is not configured", async () => {
  const adminAuth = loadTs("src/lib/admin-auth.ts");
  const token = adminAuth.createSessionToken();

  const syncKeyRoute = loadTs("src/app/api/owner/sync-key/route.ts", {
    "@/lib/admin-auth": adminAuth,
    "@/lib/db/queries": {
      getCronKey: async () => null,
      regenerateCronKey: async () => {
        throw new Error("A database is required to rotate the sync key.");
      },
    },
    "@/lib/request-origin": {
      requestOrigin: () => "http://127.0.0.1:8888",
    },
  });

  const req = new NextRequest("http://127.0.0.1:8888/api/owner/sync-key", {
    method: "POST",
    headers: {
      cookie: `admin_session=${token}`,
      "sec-fetch-site": "same-origin",
      origin: "http://127.0.0.1:8888",
    },
  });

  const res = await syncKeyRoute.POST(req);
  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.error, "A database is required to rotate the sync key.");
});

test("N019: GET /api/player/token returns real remaining expiresIn instead of hard-coded 3600", async () => {
  const adminAuth = loadTs("src/lib/admin-auth.ts");
  const token = adminAuth.createSessionToken();

  const expectedRemainingSec = 300; // 5 minutes left
  const fakeExpiresAt = Date.now() + expectedRemainingSec * 1000;

  const playerTokenRoute = loadTs("src/app/api/player/token/route.ts", {
    "@/lib/admin-auth": adminAuth,
    "@/lib/db/queries": {
      getOwnerPlaybackToken: async () => "mock-refresh-token",
      deleteOwnerPlaybackToken: async () => undefined,
    },
    "@/lib/spotify": {
      getAccessToken: async () => "mock-access-token",
      getCachedTokenExpiresAt: () => fakeExpiresAt,
      resetSpotifyTokenCache: () => undefined,
      SpotifyApiError: class extends Error {},
    },
  });

  const req = new NextRequest("http://127.0.0.1:8888/api/player/token", {
    headers: {
      cookie: `admin_session=${token}`,
    },
  });

  const res = await playerTokenRoute.GET(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.linked, true);
  assert.equal(data.accessToken, "mock-access-token");
  assert.ok(
    data.expiresIn >= 298 && data.expiresIn <= 300,
    `expiresIn should be around ${expectedRemainingSec}, got ${data.expiresIn}`
  );
});

// ---------------------------------------------------------------------------
// Fix 6 (N016): fetchRecentlyPlayed options, after cursor, and fromDatabase removal
// ---------------------------------------------------------------------------

test("N016: fetchRecentlyPlayed supports { limit, after } options", async () => {
  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    capturedUrl = String(url);
    return new Response(JSON.stringify({ items: [], next: null, cursors: null, limit: 20, href: "" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const spotifyModule = loadTs("src/lib/spotify.ts", {
      "@/lib/db": { isConfigured: () => true },
      "@/lib/owner-spotify": {
        getOwnerCredential: async () => ({ refreshToken: "r", displayName: "d", revision: "0" }),
        rotateOwnerCredential: async () => "0",
      },
    });

    // Mock getAccessToken by injecting tokenCache or mocking refresh
    process.env.SPOTIFY_CLIENT_ID = "test-id";
    // Call fetchRecentlyPlayed with options object
    await spotifyModule.fetchRecentlyPlayed({ limit: 25, after: 1730000000000 });
    assert.ok(capturedUrl.includes("limit=25"), `URL should contain limit=25: ${capturedUrl}`);
    assert.ok(capturedUrl.includes("after=1730000000000"), `URL should contain after=1730000000000: ${capturedUrl}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("N016: resolveCredentials omits fromDatabase field", async () => {
  process.env.SPOTIFY_CLIENT_ID = "client-123";
  process.env.SPOTIFY_CLIENT_SECRET = "secret-123";

  const spotifyModule = loadTs("src/lib/spotify.ts", {
    "@/lib/db": { isConfigured: () => true },
    "@/lib/owner-spotify": {
      getOwnerCredential: async () => ({ refreshToken: "ref-tok", displayName: "Owner", revision: "1" }),
    },
  });

  const creds = await spotifyModule.resolveCredentials();
  assert.ok(creds);
  assert.equal("fromDatabase" in creds, false, "fromDatabase must be removed from resolveCredentials");
});

test("N016: syncSpotify does not skip Plays that end during a run (no last-sync after cursor)", async () => {
  let passedOptions: unknown = null;
  const mockLastSyncTimestamp = "2026-11-03T09:00:00.000Z";
  const expectedAfterMs = new Date(mockLastSyncTimestamp).getTime();

  const syncModule = loadTs("src/lib/spotify-sync.ts", {
    "@/lib/spotify": {
      fetchRecentlyPlayed: async (opts: unknown) => {
        passedOptions = opts;
        return { items: [] };
      },
    },
    "@/lib/db/queries": {
      ensureTablesExist: async () => undefined,
      getLastSync: async () => mockLastSyncTimestamp,
      recordLastSync: async () => new Date(),
      bulkUpsertArtists: async () => undefined,
      bulkUpsertAlbums: async () => undefined,
      bulkUpsertTracks: async () => undefined,
      bulkInsertPlays: async () => ({ insertedCount: 0 }),
      getExistingEntityIds: async () => ({
        existingArtistIds: new Set(),
        existingAlbumIds: new Set(),
        existingTrackIds: new Set(),
      }),
    },
    "@/lib/history-parser": {
      debouncePlays: () => ({ debounced: [], droppedCount: 0 }),
    },
    "@/lib/enrichment": {
      runEnrichmentBatch: async () => ({ enrichedCount: 0, delistedCount: 0, progress: { pending: 0 } }),
    },
  });

  await syncModule.syncSpotify();
  // last_synced_at is written after the fetch, so using it as an after cursor would
  // drop Plays that finish mid-run. Recently-played only returns the latest 50 anyway.
  const after = typeof passedOptions === "object" && passedOptions !== null
    ? (passedOptions as { after?: number }).after
    : undefined;
  assert.notEqual(after, expectedAfterMs, "sync must not use the last sync time as an after cursor");
  assert.equal(after, undefined, "sync fetches the latest 50 without a cursor");
});

// ---------------------------------------------------------------------------
// Fix 5: PlayerContext helpers and device_id encoding
// ---------------------------------------------------------------------------

test("PlayerContext: formatPlayErrorMessage formats 403, 404, 429, and other errors", () => {
  const playbackModule = loadTs("src/lib/player-playback.ts");
  assert.equal(typeof playbackModule.formatPlayErrorMessage, "function");

  assert.equal(
    playbackModule.formatPlayErrorMessage(403),
    "Spotify Premium is required for Web Playback."
  );
  assert.equal(
    playbackModule.formatPlayErrorMessage(404),
    "No track queued to play. Select a track or enter Spotify URL."
  );
  assert.equal(
    playbackModule.formatPlayErrorMessage(429),
    "Spotify rate limit reached. Try again shortly."
  );
  assert.equal(
    playbackModule.formatPlayErrorMessage(500, null, "Playback"),
    "Playback failed (500)."
  );
  assert.equal(
    playbackModule.formatPlayErrorMessage(500, { error: { message: "Server busy" } }),
    "Server busy"
  );
});

test("PlayerContext: fetchPlayerAccessToken extracts token or returns null on failure", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const stubs = {
      "@/context/ConfigContext": { useConfig: () => ({ isAuthenticated: false, openModal: () => {} }) },
      "./player-context/usePlayerPlaylists": { usePlayerPlaylists: () => ({ userPlaylists: [], loadPlaylists: async () => {} }) },
      "./player-context/usePlayerInitialContext": { usePlayerInitialContext: () => ({ track: null }) },
      "./player-context/useSpotifySdk": { loadSpotifySdk: async () => {} },
    };

    // 1. Success returns accessToken string
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ accessToken: "test-token-123" }), { status: 200 });
    }) as typeof fetch;
    const { fetchPlayerAccessToken } = loadTs("src/context/PlayerContext.tsx", stubs);
    const token = await fetchPlayerAccessToken();
    assert.equal(token, "test-token-123");

    // 2. 401 returns null
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }) as typeof fetch;
    const nullToken = await fetchPlayerAccessToken();
    assert.equal(nullToken, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("PlayerContext: fetchAutoQueueUris returns uris or null on failure", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const stubs = {
      "@/context/ConfigContext": { useConfig: () => ({ isAuthenticated: false, openModal: () => {} }) },
      "./player-context/usePlayerPlaylists": { usePlayerPlaylists: () => ({ userPlaylists: [], loadPlaylists: async () => {} }) },
      "./player-context/usePlayerInitialContext": { usePlayerInitialContext: () => ({ track: null }) },
      "./player-context/useSpotifySdk": { loadSpotifySdk: async () => {} },
    };

    // 1. Success
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ uris: ["spotify:track:abc", "spotify:track:xyz"] }), { status: 200 });
    }) as typeof fetch;
    const { fetchAutoQueueUris } = loadTs("src/context/PlayerContext.tsx", stubs);
    const uris = await fetchAutoQueueUris();
    assert.deepEqual(uris, ["spotify:track:abc", "spotify:track:xyz"]);

    // 2. Error status
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ error: "Internal" }), { status: 500 });
    }) as typeof fetch;
    const failUris = await fetchAutoQueueUris();
    assert.equal(failUris, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("PlayerContext: device_id is encoded with encodeURIComponent in play calls", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/context/PlayerContext.tsx"), "utf-8");

  assert.ok(
    source.includes("device_id=${encodeURIComponent(targetDeviceId)}"),
    "PlayerContext must encode device_id with encodeURIComponent"
  );
  assert.ok(
    !source.includes("device_id=${targetDeviceId}"),
    "PlayerContext must not interpolate unencoded targetDeviceId into play url"
  );
});

// ---------------------------------------------------------------------------
// Fix 3 (N018): handleToggleLayout rollback on failure
// ---------------------------------------------------------------------------

test("N018: handleToggleLayout marks as deployed only after POST succeeds and rolls back on failure", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/components/ListeningView.tsx"), "utf-8");

  // Extract handleToggleLayout block
  const layoutIdx = source.indexOf("const handleToggleLayout =");
  assert.ok(layoutIdx > 0, "handleToggleLayout must exist in ListeningView.tsx");
  const layoutFn = source.slice(layoutIdx, layoutIdx + 800);

  // markAsDeployed must only be called inside then(res => if (res.ok))
  assert.ok(
    !layoutFn.includes("updateConfig({ livePlayerLayout: next });\n    markAsDeployed("),
    "markAsDeployed must not be called synchronously before POST completes"
  );
  assert.ok(
    layoutFn.includes("updateConfig({ livePlayerLayout: prevLayout })"),
    "handleToggleLayout must roll back layout on failure or network error"
  );
});

// ---------------------------------------------------------------------------
// Fix 1 & 2 (N015): handleTriggerSync ok && success checks and active range overview preservation
// ---------------------------------------------------------------------------

test("N015: handleTriggerSync checks res.ok and body.success and keeps patched overview for active range", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/components/ListeningView.tsx"), "utf-8");

  const syncIdx = source.indexOf("const handleTriggerSync =");
  assert.ok(syncIdx > 0, "handleTriggerSync must exist in ListeningView.tsx");
  const syncFn = source.slice(syncIdx, syncIdx + 1600);

  // Must check res.ok && syncData?.success === true
  assert.ok(
    syncFn.includes("res.ok && syncData?.success === true") ||
    syncFn.includes("res.ok && syncData.success === true"),
    "handleTriggerSync must check res.ok AND syncData.success === true"
  );

  // Must not blindly overwrite overviewCache with { [range]: newOverview }
  assert.ok(
    !syncFn.includes("setOverviewCache({ [range]: newOverview })"),
    "handleTriggerSync must not overwrite enrichment-patched overview with unpatched newOverview"
  );

  // Must preserve patched cache for active range
  assert.ok(
    syncFn.includes("prev[range]"),
    "handleTriggerSync must preserve prev[range] for the active range"
  );

  // Must handle 409 and 429
  assert.ok(
    syncFn.includes("409") && syncFn.includes("429"),
    "handleTriggerSync must handle 409 conflict and 429 rate limit statuses"
  );
});

