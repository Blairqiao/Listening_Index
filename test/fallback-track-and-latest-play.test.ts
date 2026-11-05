import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("DEFAULT_FALLBACK_TRACK is in src/lib/fallback-track.ts and used without importing client component", async () => {
  const fallbackTrackModule = await import("../src/lib/fallback-track");
  assert.equal(typeof fallbackTrackModule.DEFAULT_FALLBACK_TRACK, "object");
  assert.equal(fallbackTrackModule.DEFAULT_FALLBACK_TRACK.name, "Weird Fishes / Arpeggi");

  const routeSource = fs.readFileSync(
    path.resolve(__dirname, "../src/app/api/player/current-context/route.ts"),
    "utf-8"
  );
  assert.ok(
    !routeSource.includes("LivePlayerView"),
    "current-context route must not import from LivePlayerView component"
  );
  assert.ok(
    routeSource.includes("@/lib/fallback-track"),
    "current-context route must import from @/lib/fallback-track"
  );
  assert.ok(
    !routeSource.includes("getStreamLog(1)"),
    "current-context route must not call getStreamLog(1)"
  );
});

test("getLatestPlay helper is exported from stream-log queries", async () => {
  const streamLogQueries = await import("../src/lib/db/queries/stream-log");
  assert.equal(typeof (streamLogQueries as Record<string, unknown>).getLatestPlay, "function");
});
