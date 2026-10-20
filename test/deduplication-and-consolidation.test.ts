import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");

test("AC-1: async-utils provides shared createSingleFlight and server-cache uses consolidated cache", async () => {
  assert.ok(
    fs.existsSync(path.join(root, "src/lib/async-utils.ts")),
    "src/lib/async-utils.ts must exist"
  );
  const { createSingleFlight } = await import("../src/lib/async-utils");
  assert.equal(typeof createSingleFlight, "function");

  const singleFlight = createSingleFlight<number>();
  let runs = 0;
  const promise1 = singleFlight(async () => {
    runs++;
    return 42;
  });
  const promise2 = singleFlight(async () => {
    runs++;
    return 42;
  });
  const [res1, res2] = await Promise.all([promise1, promise2]);
  assert.equal(res1, 42);
  assert.equal(res2, 42);
  assert.equal(runs, 1, "createSingleFlight must coalesce concurrent executions");

  const playerConnContent = fs.readFileSync(path.join(root, "src/lib/player-connection.ts"), "utf-8");
  assert.ok(
    playerConnContent.includes("async-utils"),
    "player-connection.ts must import createSingleFlight from async-utils"
  );
});

test("AC-2: route-utils provides jsonNoCache, parseRequestTimezone, handleApiError and listening routes use them", async () => {
  assert.ok(
    fs.existsSync(path.join(root, "src/lib/route-utils.ts")),
    "src/lib/route-utils.ts must exist"
  );

  const routeUtilsContent = fs.readFileSync(path.join(root, "src/lib/route-utils.ts"), "utf-8");
  assert.ok(routeUtilsContent.includes("export function jsonNoCache"), "route-utils must export jsonNoCache");
  assert.ok(routeUtilsContent.includes("export function parseRequestTimezone"), "route-utils must export parseRequestTimezone");
  assert.ok(routeUtilsContent.includes("export function handleApiError"), "route-utils must export handleApiError");

  const overviewRoute = fs.readFileSync(path.join(root, "src/app/api/listening/overview/route.ts"), "utf-8");
  const sessionRoute = fs.readFileSync(path.join(root, "src/app/api/listening/session/route.ts"), "utf-8");
  const streamLogRoute = fs.readFileSync(path.join(root, "src/app/api/listening/stream-log/route.ts"), "utf-8");

  assert.ok(overviewRoute.includes("route-utils"), "overview/route.ts must import from route-utils");
  assert.ok(sessionRoute.includes("route-utils"), "session/route.ts must import from route-utils");
  assert.ok(streamLogRoute.includes("route-utils"), "stream-log/route.ts must import from route-utils");
});

test("AC-3: formatDurationMs in format-utils replaces msToClock in LivePlayerView and overview.ts uses formatOverviewMetrics", () => {
  const formatUtilsContent = fs.readFileSync(path.join(root, "src/lib/format-utils.ts"), "utf-8");
  assert.ok(
    formatUtilsContent.includes("export function formatDurationMs"),
    "src/lib/format-utils.ts must export formatDurationMs"
  );

  const livePlayerContent = fs.readFileSync(path.join(root, "src/components/LivePlayerView.tsx"), "utf-8");
  assert.ok(
    !livePlayerContent.includes("function msToClock"),
    "LivePlayerView.tsx must not declare msToClock"
  );
  assert.ok(
    livePlayerContent.includes("formatDurationMs"),
    "LivePlayerView.tsx must use formatDurationMs"
  );

  const overviewQueryContent = fs.readFileSync(path.join(root, "src/lib/db/queries/overview.ts"), "utf-8");
  assert.ok(
    overviewQueryContent.includes("formatOverviewMetrics"),
    "src/lib/db/queries/overview.ts must use formatOverviewMetrics"
  );
});

test("AC-4: spotify-sync.ts contains sync orchestration and no src/ file imports from scripts/", () => {
  assert.ok(
    fs.existsSync(path.join(root, "src/lib/spotify-sync.ts")),
    "src/lib/spotify-sync.ts must exist"
  );

  const syncRouteContent = fs.readFileSync(path.join(root, "src/app/api/sync/route.ts"), "utf-8");
  assert.ok(
    !syncRouteContent.includes("scripts/sync-spotify"),
    "src/app/api/sync/route.ts must not import from scripts/sync-spotify"
  );
  assert.ok(
    syncRouteContent.includes("@/lib/spotify-sync") || syncRouteContent.includes("lib/spotify-sync"),
    "src/app/api/sync/route.ts must import from spotify-sync"
  );

  const scriptsSyncContent = fs.readFileSync(path.join(root, "scripts/sync-spotify.ts"), "utf-8");
  assert.ok(
    scriptsSyncContent.includes("@/lib/spotify-sync") || scriptsSyncContent.includes("../src/lib/spotify-sync"),
    "scripts/sync-spotify.ts must import from spotify-sync"
  );
});

test("AC-5: spotify.ts centralizes exchangeAuthorizationCode and refreshAccessToken", async () => {
  const spotifyContent = fs.readFileSync(path.join(root, "src/lib/spotify.ts"), "utf-8");
  assert.ok(
    spotifyContent.includes("export async function exchangeAuthorizationCode"),
    "src/lib/spotify.ts must export exchangeAuthorizationCode"
  );
  assert.ok(
    spotifyContent.includes("export async function refreshAccessToken"),
    "src/lib/spotify.ts must export refreshAccessToken"
  );

  const playerTokenRoute = fs.readFileSync(path.join(root, "src/app/api/player/token/route.ts"), "utf-8");
  assert.ok(
    playerTokenRoute.includes("refreshAccessToken") || playerTokenRoute.includes("exchangeAuthorizationCode"),
    "player/token/route.ts must use centralized helpers from spotify.ts"
  );
});

test("AC-6: Canonical types and components use Session* and topTrack", () => {
  const typesContent = fs.readFileSync(path.join(root, "src/lib/types.ts"), "utf-8");
  assert.ok(typesContent.includes("SessionItem"), "src/lib/types.ts must export SessionItem");
  assert.ok(typesContent.includes("PreviousSession"), "src/lib/types.ts must export PreviousSession");
  assert.ok(typesContent.includes("SessionRecord") || typesContent.includes("SessionBlock"), "src/lib/types.ts must export SessionRecord or SessionBlock");
  assert.ok(typesContent.includes("SessionAnalysis"), "src/lib/types.ts must export SessionAnalysis");

  const sessionViewContent = fs.readFileSync(path.join(root, "src/components/SessionView.tsx"), "utf-8");
  assert.ok(
    !sessionViewContent.includes("// Top Song"),
    "SessionView.tsx must not contain '// Top Song' comment"
  );

  const sessionQueryContent = fs.readFileSync(path.join(root, "src/lib/db/queries/session.ts"), "utf-8");
  assert.ok(
    !sessionQueryContent.includes("formatSittingAge"),
    "session.ts must not call formatSittingAge"
  );
});
