import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

const root = path.resolve(__dirname, "..");

test("AC-1: schema.ts eliminates pre-v1 migration blocks while preserving core schema & cron_key", () => {
  const schemaPath = path.join(root, "src/lib/db/queries/schema.ts");
  const schemaSource = fs.readFileSync(schemaPath, "utf-8");

  // Legacy conditionals and table drops should be removed
  assert.ok(
    !schemaSource.includes("api_duration_ms"),
    "schema.ts must not contain legacy api_duration_ms migration conditionals"
  );
  assert.ok(
    !schemaSource.includes("leased_until"),
    "schema.ts must not contain legacy leasing lock column drops"
  );
  assert.ok(
    !schemaSource.includes("player_users"),
    "schema.ts must not contain dropped player_users table query"
  );
  assert.ok(
    !schemaSource.includes("api_cooldowns"),
    "schema.ts must not contain legacy api_cooldowns table migration query"
  );
  assert.ok(
    !schemaSource.includes("sync_state"),
    "schema.ts must not contain legacy sync_state table migration query"
  );

  // Critical v1 schema components and cron_key must remain intact
  assert.ok(
    schemaSource.includes("cron_key TEXT"),
    "schema.ts must define cron_key TEXT on site_settings"
  );
  assert.ok(
    schemaSource.includes("ADD COLUMN IF NOT EXISTS cron_key TEXT"),
    "schema.ts must idempotently add cron_key TEXT column via ALTER TABLE"
  );
  assert.ok(
    schemaSource.includes("CREATE TABLE IF NOT EXISTS plays"),
    "schema.ts must create plays table"
  );
  assert.ok(
    schemaSource.includes("CREATE TABLE IF NOT EXISTS schema_migrations"),
    "schema.ts must create schema_migrations table"
  );
});

test("AC-1b: schema.ts drops timezone column from site_settings entirely and excludes it from table definition", () => {
  const schemaSource = fs.readFileSync(
    path.join(root, "src/lib/db/queries/schema.ts"),
    "utf-8"
  );
  assert.equal(
    schemaSource.includes("timezone TEXT"),
    false,
    "schema.ts must not define timezone column in site_settings table definition"
  );
  assert.ok(
    schemaSource.includes("DROP COLUMN IF EXISTS timezone"),
    "schema.ts must drop timezone column via ALTER TABLE site_settings DROP COLUMN IF EXISTS timezone"
  );
});

test("AC-2: CustomizationModal omits manual timezone selection in favor of automated background detection", () => {
  const modalSource = fs.readFileSync(
    path.join(root, "src/components/modals/customization-modal/CustomizationModal.tsx"),
    "utf-8"
  );
  assert.equal(
    modalSource.includes("TimezoneSelect"),
    false,
    "CustomizationModal must not reference TimezoneSelect"
  );
  assert.equal(
    modalSource.includes("<TimezoneSelect"),
    false,
    "CustomizationModal must not render <TimezoneSelect"
  );
});

test("AC-3: SessionView decomposes SessionHistogram and SessionAnalysisPanel into src/components/views/session-view/", () => {
  const histPath = path.join(
    root,
    "src/components/views/session-view/SessionHistogram.tsx"
  );
  const analysisPath = path.join(
    root,
    "src/components/views/session-view/SessionAnalysisPanel.tsx"
  );

  assert.ok(
    fs.existsSync(histPath),
    "SessionHistogram.tsx must exist in src/components/views/session-view/"
  );
  assert.ok(
    fs.existsSync(analysisPath),
    "SessionAnalysisPanel.tsx must exist in src/components/views/session-view/"
  );

  const sessionViewSource = fs.readFileSync(
    path.join(root, "src/components/views/session-view/SessionView.tsx"),
    "utf-8"
  );
  assert.ok(
    sessionViewSource.includes("SessionHistogram"),
    "SessionView must import SessionHistogram"
  );
  assert.ok(
    sessionViewSource.includes("SessionAnalysisPanel"),
    "SessionView must import SessionAnalysisPanel"
  );
  assert.ok(
    sessionViewSource.includes("<SessionHistogram"),
    "SessionView must render <SessionHistogram"
  );
  assert.ok(
    sessionViewSource.includes("<SessionAnalysisPanel"),
    "SessionView must render <SessionAnalysisPanel"
  );
});

test("AC-4: UploadModal decomposes HistoryDropzone and CatalogEnrichmentCard into src/components/modals/upload-modal/", () => {
  const dropzonePath = path.join(
    root,
    "src/components/modals/upload-modal/HistoryDropzone.tsx"
  );
  const enrichmentCardPath = path.join(
    root,
    "src/components/modals/upload-modal/CatalogEnrichmentCard.tsx"
  );

  assert.ok(
    fs.existsSync(dropzonePath),
    "HistoryDropzone.tsx must exist in src/components/modals/upload-modal/"
  );
  assert.ok(
    fs.existsSync(enrichmentCardPath),
    "CatalogEnrichmentCard.tsx must exist in src/components/modals/upload-modal/"
  );

  const uploadModalSource = fs.readFileSync(
    path.join(root, "src/components/modals/upload-modal/UploadModal.tsx"),
    "utf-8"
  );
  assert.ok(
    uploadModalSource.includes("HistoryDropzone"),
    "UploadModal must import HistoryDropzone"
  );
  assert.ok(
    uploadModalSource.includes("CatalogEnrichmentCard"),
    "UploadModal must import CatalogEnrichmentCard"
  );
  assert.ok(
    uploadModalSource.includes("<HistoryDropzone"),
    "UploadModal must render <HistoryDropzone"
  );
  assert.ok(
    uploadModalSource.includes("<CatalogEnrichmentCard"),
    "UploadModal must render <CatalogEnrichmentCard"
  );
});

test("AC-5: PlayerContext delegates SDK script and lifecycle to src/context/player-context/useSpotifySdk.ts", () => {
  const sdkHookPath = path.join(
    root,
    "src/context/player-context/useSpotifySdk.ts"
  );
  assert.ok(
    fs.existsSync(sdkHookPath),
    "useSpotifySdk.ts must exist in src/context/player-context/"
  );

  const playerContextSource = fs.readFileSync(
    path.join(root, "src/context/PlayerContext.tsx"),
    "utf-8"
  );
  assert.ok(
    playerContextSource.includes("useSpotifySdk") || playerContextSource.includes("loadSpotifySdk"),
    "PlayerContext must import and use useSpotifySdk or loadSpotifySdk from player-context/"
  );
});

test("AC-6: isAuthorizedAdminRequest and isSameOriginRequest are consolidated into admin-auth.ts and re-exported by auth-utils.ts", async () => {
  const adminAuth = await import("../src/lib/admin-auth");
  const authUtils = await import("../src/lib/auth-utils");

  assert.equal(
    typeof adminAuth.isAuthorizedAdminRequest,
    "function",
    "admin-auth must export isAuthorizedAdminRequest"
  );
  assert.equal(
    typeof adminAuth.isSameOriginRequest,
    "function",
    "admin-auth must export isSameOriginRequest"
  );

  assert.equal(
    authUtils.isAuthorizedAdminRequest,
    adminAuth.isAuthorizedAdminRequest,
    "auth-utils must re-export isAuthorizedAdminRequest from admin-auth"
  );
  assert.equal(
    authUtils.isSameOriginRequest,
    adminAuth.isSameOriginRequest,
    "auth-utils must re-export isSameOriginRequest from admin-auth"
  );

  // Test isSameOriginRequest logic
  const localReq = new NextRequest("http://127.0.0.1:8888/api/test", {
    headers: { host: "127.0.0.1:8888", origin: "http://127.0.0.1:8888" },
  });
  assert.equal(adminAuth.isSameOriginRequest(localReq), true);

  const foreignReq = new NextRequest("https://my-app.vercel.app/api/test", {
    headers: { host: "my-app.vercel.app", origin: "https://evil.attacker.com" },
  });
  // In non-dev, origin mismatch returns false
  const origEnv = process.env.NODE_ENV;
  try {
    (process.env as Record<string, string>).NODE_ENV = "production";
    assert.equal(adminAuth.isSameOriginRequest(foreignReq), false);
  } finally {
    (process.env as Record<string, string>).NODE_ENV = origEnv;
  }
});

test("AC-7: CONTEXT.md and README.md reflect current quotas and interface state", () => {
  const contextPath = fs.existsSync(path.join(root, ".agent-docs/CONTEXT.md"))
    ? path.join(root, ".agent-docs/CONTEXT.md")
    : path.join(root, "..", "..", ".agent-docs/CONTEXT.md");
  const contextDoc = fs.readFileSync(contextPath, "utf-8");
  assert.ok(
    !contextDoc.includes("1,200 total"),
    "CONTEXT.md must not reference obsolete 1,200 total quota"
  );
  assert.ok(
    !contextDoc.includes("800 calls/day"),
    "CONTEXT.md must not reference obsolete 800 cron quota"
  );
  assert.ok(
    contextDoc.includes("900") && contextDoc.includes("700") && contextDoc.includes("200"),
    "CONTEXT.md must state 900 total, 700 cron, and 200 dynamic quota limits"
  );

  const readme = fs.readFileSync(path.join(root, "README.md"), "utf-8");
  assert.ok(
    !readme.includes("npm run auth:spotify"),
    "README.md must not reference removed npm run auth:spotify script"
  );
  assert.ok(
    !readme.includes("SETUP SPOTIFY ] indicator in the footer"),
    "README.md must not reference Spotify setup button in footer"
  );
});
