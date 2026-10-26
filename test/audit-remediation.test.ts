import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";

const root = path.resolve(__dirname, "..");

test("TASK-1: Tooling and git configuration (F4, F13, F14)", () => {
  const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf-8");
  assert.ok(!gitignore.includes("/test/"), ".gitignore must not ignore /test/");
  assert.ok(!gitignore.includes("/coverage"), ".gitignore must not ignore /coverage");

  const tsconfig = JSON.parse(fs.readFileSync(path.join(root, "tsconfig.json"), "utf-8"));
  assert.ok(
    tsconfig.exclude?.includes(".worktrees") || tsconfig.exclude?.includes(".worktrees/**"),
    "tsconfig.json must exclude .worktrees"
  );

  const eslintConfig = fs.readFileSync(path.join(root, "eslint.config.js"), "utf-8");
  assert.ok(eslintConfig.includes(".worktrees/**"), "eslint.config.js must ignore .worktrees/**");
  assert.ok(eslintConfig.includes(".agent-docs/**"), "eslint.config.js must ignore .agent-docs/**");
});

test("TASK-2: POST /api/sync authorization accepts CRON_SECRET or admin auth, rejects public visitors", async () => {
  const { POST } = await import("../src/app/api/sync/route");
  const originalSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-cron-secret-123456";

  try {
    // 1. Unauthenticated request -> 401
    const unauthReq = new NextRequest("http://127.0.0.1:8888/api/sync", {
      method: "POST",
    });
    const unauthRes = await POST(unauthReq);
    assert.equal(unauthRes.status, 401, "Unauthenticated /api/sync must return 401");

    // 2. Machine Bearer token auth -> 200 (or non-401 DB fallback)
    const bearerReq = new NextRequest("http://127.0.0.1:8888/api/sync", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-cron-secret-123456",
      },
    });
    const bearerRes = await POST(bearerReq);
    assert.notEqual(bearerRes.status, 401, "Valid Bearer CRON_SECRET must not return 401");

    // 3. Query param ?key= secret -> 200 (or non-401 DB fallback)
    const keyReq = new NextRequest("http://127.0.0.1:8888/api/sync?key=test-cron-secret-123456", {
      method: "POST",
    });
    const keyRes = await POST(keyReq);
    assert.notEqual(keyRes.status, 401, "Valid ?key= query secret must not return 401");
  } finally {
    process.env.CRON_SECRET = originalSecret;
  }
});

test("TASK-2: POST /api/upload/enrich does not require admin authorization (F8)", async () => {
  const { POST } = await import("../src/app/api/upload/enrich/route");
  const routeSource = fs.readFileSync(path.join(root, "src/app/api/upload/enrich/route.ts"), "utf-8");

  // Verify source code removes isAuthorizedAdminRequest
  assert.ok(
    !routeSource.includes("isAuthorizedAdminRequest"),
    "src/app/api/upload/enrich/route.ts must not require isAuthorizedAdminRequest"
  );

  // Invoke POST without admin session cookies -> must not return 401
  const req = new NextRequest("http://127.0.0.1:8888/api/upload/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackIds: ["track-1"], source: "dynamic" }),
  });
  const res = await POST(req);
  assert.notEqual(res.status, 401, "POST /api/upload/enrich must not return 401 for public visitors");
});

test("TASK-2: Manual sync UI button is admin-locked in ListeningView, ListeningFooter, and ControlRow (F11)", () => {
  const listeningView = fs.readFileSync(path.join(root, "src/components/ListeningView.tsx"), "utf-8");
  const listeningFooter = fs.readFileSync(path.join(root, "src/components/ListeningFooter.tsx"), "utf-8");
  const controlRow = fs.readFileSync(path.join(root, "src/components/ControlRow.tsx"), "utf-8");

  // ListeningView passes isAuthenticated to ControlRow and ListeningFooter
  assert.ok(
    listeningView.includes("isAuthenticated={isAuthenticated}"),
    "ListeningView must pass isAuthenticated"
  );
  assert.ok(
    listeningView.includes("if (!isAuthenticated"),
    "ListeningView handleTriggerSync must guard against unauthenticated invocations"
  );

  // ListeningFooter accepts isAuthenticated and locks button
  assert.ok(
    listeningFooter.includes("isAuthenticated"),
    "ListeningFooter must declare and use isAuthenticated prop"
  );

  // ControlRow accepts isAuthenticated and locks Mode 2 sync trigger
  assert.ok(
    controlRow.includes("isAuthenticated"),
    "ControlRow must declare and use isAuthenticated prop"
  );
});

test("TASK-3: Streak query uses recursive index-probed CTE without 120-day cutoff and with correct timezone casting (F6)", async () => {
  const streamLogSource = fs.readFileSync(path.join(root, "src/lib/db/queries/stream-log.ts"), "utf-8");

  assert.ok(
    !streamLogSource.includes("INTERVAL '120 days'"),
    "stream-log.ts must not contain 120 days cutoff"
  );
  assert.ok(
    streamLogSource.includes("WITH RECURSIVE streak_days AS"),
    "stream-log.ts must use recursive streak_days CTE"
  );
  // Ensure date is explicitly cast to timestamp before AT TIME ZONE to avoid Postgres 8h timezone offset bug
  assert.ok(
    !streamLogSource.includes("::date AT TIME ZONE"),
    "stream-log.ts must not use ::date AT TIME ZONE without explicit ::timestamp cast"
  );

  // If local .env.local exists, run deep behavioral verification against live Postgres
  const envPath = path.join(root, ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/DATABASE_URL=([^\r\n]+)/);
    if (match && match[1]) {
      process.env.DATABASE_URL = match[1].trim();
      const { getStreamLog } = await import("../src/lib/db/queries/stream-log");
      const result = await getStreamLog(10, "America/New_York");
      assert.ok(typeof result.rawMetrics.streakDays === "number", "streakDays must be a number");
      assert.ok(result.rawMetrics.streakDays >= 0, "streakDays must be non-negative");
      assert.ok(Array.isArray(result.entries), "entries must be an array");
      assert.ok(result.metrics.length === 4, "metrics must have 4 entries");
    }
  }
});

test("TASK-3: Ribbon artist queries align with isCatalogFullyEnriched() (F5)", async () => {
  const overviewSource = fs.readFileSync(path.join(root, "src/lib/db/queries/overview.ts"), "utf-8");
  const streamLogSource = fs.readFileSync(path.join(root, "src/lib/db/queries/stream-log.ts"), "utf-8");
  const trackStatsSource = fs.readFileSync(path.join(root, "src/lib/db/queries/track-stats.ts"), "utf-8");

  assert.ok(
    overviewSource.includes("t.artist_id") && overviewSource.includes("isCatalogFullyEnriched"),
    "overview.ts must check isCatalogFullyEnriched and count distinct t.artist_id"
  );
  assert.ok(
    streamLogSource.includes("t.artist_id") && streamLogSource.includes("isCatalogFullyEnriched"),
    "stream-log.ts must check isCatalogFullyEnriched and count distinct t.artist_id"
  );
  assert.ok(
    trackStatsSource.includes("t.artist_id") && trackStatsSource.includes("isCatalogFullyEnriched"),
    "track-stats.ts must check isCatalogFullyEnriched and count distinct t.artist_id"
  );

  // If local database is configured, verify runtime execution of overview query
  if (process.env.DATABASE_URL) {
    const { getOverviewData } = await import("../src/lib/db/queries/overview");
    const overviewData = await getOverviewData("1d");
    assert.ok(overviewData.metrics, "overviewData must return metrics");
    assert.equal(overviewData.metrics.length, 4, "overview metrics must contain 4 items");
  }
});

test("TASK-4: Obsolete files deleted and types.ts deduplicated (F9)", () => {
  assert.equal(
    fs.existsSync(path.join(root, "src/lib/spotify-session.ts")),
    false,
    "spotify-session.ts must be deleted"
  );
  assert.equal(
    fs.existsSync(path.join(root, "src/lib/hooks/useNowPlaying.ts")),
    false,
    "useNowPlaying.ts must be deleted"
  );
  assert.equal(
    fs.existsSync(path.join(root, "src/components/OwnerSpotifyConnect.tsx")),
    false,
    "OwnerSpotifyConnect.tsx must be deleted"
  );

  const typesSource = fs.readFileSync(path.join(root, "src/lib/types.ts"), "utf-8");
  assert.ok(
    !typesSource.includes("radiohead_weird_fishes"),
    "types.ts must not contain duplicated mock catalog objects"
  );
  assert.ok(
    !typesSource.includes("TOP_TRACKS_1D"),
    "types.ts must not contain duplicate mock top track arrays"
  );
});

test("TASK-5: Duplicate query param useEffect consolidated, labels updated, hint preserved (F15)", () => {
  const listeningView = fs.readFileSync(path.join(root, "src/components/ListeningView.tsx"), "utf-8");
  const urlSyncHook = fs.existsSync(path.join(root, "src/components/listening-view/useListeningUrlSync.ts"))
    ? fs.readFileSync(path.join(root, "src/components/listening-view/useListeningUrlSync.ts"), "utf-8")
    : "";
  const combined = listeningView + urlSyncHook;
  const searchMatches = combined.match(/window\.location\.search/g) || [];
  assert.equal(
    searchMatches.length,
    1,
    "ListeningView must have exactly 1 window.location.search reader effect"
  );

  const sessionView = fs.readFileSync(path.join(root, "src/components/SessionView.tsx"), "utf-8");
  const analysisPanel = fs.existsSync(path.join(root, "src/components/session-view/SessionAnalysisPanel.tsx"))
    ? fs.readFileSync(path.join(root, "src/components/session-view/SessionAnalysisPanel.tsx"), "utf-8")
    : "";
  const combinedSession = sessionView + analysisPanel;
  assert.ok(
    sessionView.includes("[ CURRENT SESSION ]") && sessionView.includes("[ LAST SESSION ]"),
    "SessionView must render [ CURRENT SESSION ] / [ LAST SESSION ]"
  );
  assert.ok(
    !combinedSession.includes("[ CURRENT SITTING ]") && !combinedSession.includes("[ LAST SITTING ]"),
    "SessionView must not render obsolete sitting labels"
  );
  assert.ok(
    combinedSession.includes("TOP TRACK"),
    "SessionView must render TOP TRACK label"
  );

  const footer = fs.readFileSync(path.join(root, "src/components/ListeningFooter.tsx"), "utf-8");
  assert.ok(
    !footer.includes("KEYS [1-4] VIEW"),
    "ListeningFooter must omit deprecated keyboard shortcuts hint"
  );
});
