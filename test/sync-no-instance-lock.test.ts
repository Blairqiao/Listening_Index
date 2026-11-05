import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { loadTs } from "./helpers/load-ts";

// The per-instance lock was removed: ingestion dedupes under advisory locks,
// so overlapping syncs are safe and the second one should not get a 429.
test("overlapping cron syncs both run instead of the second returning 429", async () => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;

  const syncRoute = loadTs("src/app/api/sync/route.ts", {
    "@/lib/spotify-sync": {
      syncSpotify: async () => {
        calls++;
        await gate;
        return { processed: 1, durationMs: 1 };
      },
    },
    "@/lib/db": { isDbConfigured: () => true },
    "@/lib/spotify": { isOwnerSpotifyConfigured: async () => true },
    "@/lib/cron-auth": { isAuthorizedCronRequest: async () => true },
    "@/lib/db/server-cache": { clearServerCache: () => undefined },
  });

  const req = () => new NextRequest("https://my-app.vercel.app/api/sync?key=k", { method: "GET" });
  const first = syncRoute.GET(req());
  const second = syncRoute.GET(req());
  await new Promise((r) => setTimeout(r, 10));
  release();

  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(calls, 2);
});
