import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, createSessionToken } from "../src/lib/admin-auth";

const root = path.resolve(__dirname, "..");

const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

test("AC-1: site_settings schema contains cron_key TEXT column", async () => {
  const schemaSource = fs.readFileSync(
    path.join(root, "src/lib/db/queries/schema.ts"),
    "utf-8"
  );
  assert.ok(
    schemaSource.includes("cron_key TEXT"),
    "schema.ts must define cron_key TEXT on site_settings"
  );
  assert.ok(
    schemaSource.includes("ADD COLUMN IF NOT EXISTS cron_key TEXT"),
    "schema.ts must idempotently add cron_key TEXT column via ALTER TABLE"
  );
});

test("AC-2: getCronKey auto-generates 32-character hex key and regenerateCronKey rotates it", async () => {
  const { getCronKey, regenerateCronKey } = await import("../src/lib/db/queries");

  assert.equal(typeof getCronKey, "function", "getCronKey must be exported from queries");
  assert.equal(typeof regenerateCronKey, "function", "regenerateCronKey must be exported from queries");

  const key1 = await getCronKey();
  assert.ok(key1, "getCronKey must return a non-empty string");
  assert.equal(key1.length, 32, "getCronKey must return 32-character string");
  assert.match(key1, /^[0-9a-f]{32}$/, "getCronKey must be a 32-character hex string");

  // Idempotent: repeated getCronKey returns the same key
  const key2 = await getCronKey();
  assert.equal(key2, key1, "getCronKey must return the existing key when already seeded");

  // Rotate key
  const newKey = await regenerateCronKey();
  assert.notEqual(newKey, key1, "regenerateCronKey must generate a distinct key");
  assert.equal(newKey.length, 32, "regenerateCronKey must return a 32-character hex string");
  assert.match(newKey, /^[0-9a-f]{32}$/, "regenerated key must be 32 hex chars");

  const keyAfterRotate = await getCronKey();
  assert.equal(keyAfterRotate, newKey, "getCronKey must return the newly rotated key");
});

test("AC-3 & AC-4: /api/owner/sync-key GET and POST enforce admin authorization and rotate sync key", async () => {
  const syncKeyRoute = await import("../src/app/api/owner/sync-key/route");
  const { GET, POST } = syncKeyRoute;

  assert.equal(typeof GET, "function", "GET /api/owner/sync-key must exist");
  assert.equal(typeof POST, "function", "POST /api/owner/sync-key must exist");

  // 1. Unauthenticated GET returns 401
  const unauthGet = new NextRequest("http://127.0.0.1:8888/api/owner/sync-key");
  const unauthGetRes = await GET(unauthGet);
  assert.equal(unauthGetRes.status, 401, "Unauthenticated GET /api/owner/sync-key must return 401");

  // 2. Authenticated GET returns cronKey and syncUrl
  const validAdminToken = createSessionToken();
  const authGet = new NextRequest("http://127.0.0.1:8888/api/owner/sync-key", {
    headers: {
      cookie: `${ADMIN_COOKIE_NAME}=${validAdminToken}`,
    },
  });
  const authGetRes = await GET(authGet);
  assert.equal(authGetRes.status, 200, "Authenticated GET /api/owner/sync-key must return 200");
  const getData = await authGetRes.json();
  assert.ok(getData.cronKey, "GET must return cronKey");
  assert.ok(getData.syncUrl, "GET must return syncUrl");
  assert.ok(getData.syncUrl.includes(`/api/sync?key=${getData.cronKey}`), "syncUrl must point to /api/sync with key param");

  // 3. Unauthenticated POST returns 401
  const unauthPost = new NextRequest("http://127.0.0.1:8888/api/owner/sync-key", {
    method: "POST",
  });
  const unauthPostRes = await POST(unauthPost);
  assert.equal(unauthPostRes.status, 401, "Unauthenticated POST /api/owner/sync-key must return 401");

  // 4. Authenticated POST rotates key and returns success
  const authPost = new NextRequest("http://127.0.0.1:8888/api/owner/sync-key", {
    method: "POST",
    headers: {
      cookie: `${ADMIN_COOKIE_NAME}=${validAdminToken}`,
      "sec-fetch-site": "same-origin",
      origin: "http://127.0.0.1:8888",
    },
  });
  const authPostRes = await POST(authPost);
  assert.equal(authPostRes.status, 200, "Authenticated POST /api/owner/sync-key must return 200");
  const postData = await authPostRes.json();
  assert.equal(postData.success, true, "POST /api/owner/sync-key must return success: true");
  assert.notEqual(postData.cronKey, getData.cronKey, "POST /api/owner/sync-key must generate new cronKey");
  assert.ok(postData.syncUrl.includes(postData.cronKey), "syncUrl must include new cronKey");
});

test("AC-5 & AC-6: /api/sync accepts database cron_key and rejects invalid/rotated keys", async () => {
  const { getCronKey, regenerateCronKey } = await import("../src/lib/db/queries");
  const { POST } = await import("../src/app/api/sync/route");

  const currentKey = await getCronKey();
  assert.ok(currentKey, "Database cronKey must exist");

  // 1. Valid Bearer auth with db cron_key
  const bearerReq = new NextRequest("http://127.0.0.1:8888/api/sync", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${currentKey}`,
    },
  });
  const bearerRes = await POST(bearerReq);
  assert.notEqual(bearerRes.status, 401, "Bearer auth with database cron_key must be authorized");

  // 2. Valid ?key= query parameter with db cron_key
  const keyReq = new NextRequest(`http://127.0.0.1:8888/api/sync?key=${currentKey}`, {
    method: "POST",
  });
  const keyRes = await POST(keyReq);
  assert.notEqual(keyRes.status, 401, "?key= query param with database cron_key must be authorized");

  // 3. Invalid key returns 401
  const invalidReq = new NextRequest("http://127.0.0.1:8888/api/sync?key=invalid_bad_key_1234567890", {
    method: "POST",
  });
  const invalidRes = await POST(invalidReq);
  assert.equal(invalidRes.status, 401, "Invalid key must return 401");

  // 4. Rotate key and verify old key is revoked
  const rotatedKey = await regenerateCronKey();
  const oldKeyReq = new NextRequest(`http://127.0.0.1:8888/api/sync?key=${currentKey}`, {
    method: "POST",
  });
  const oldKeyRes = await POST(oldKeyReq);
  assert.equal(oldKeyRes.status, 401, "Old rotated key must now return 401");

  // 5. New rotated key succeeds
  const newKeyReq = new NextRequest(`http://127.0.0.1:8888/api/sync?key=${rotatedKey}`, {
    method: "POST",
  });
  const newKeyRes = await POST(newKeyReq);
  assert.notEqual(newKeyRes.status, 401, "New rotated key must be authorized");
});

test("AC-7: AdminSpotifyModal renders Scheduled Sync section with Copy URL and Regenerate actions", () => {
  const modalSource = fs.readFileSync(
    path.join(root, "src/components/AdminSpotifyModal.tsx"),
    "utf-8"
  );
  const syncCardSource = fs.existsSync(path.join(root, "src/components/admin/ScheduledSyncCard.tsx"))
    ? fs.readFileSync(path.join(root, "src/components/admin/ScheduledSyncCard.tsx"), "utf-8")
    : "";
  const combined = modalSource + syncCardSource;

  assert.ok(
    combined.includes("SCHEDULED SYNC (CRON)") || combined.includes("SCHEDULED SYNC"),
    "AdminSpotifyModal must render Scheduled Sync section"
  );
  assert.ok(
    combined.includes("COPY URL") || combined.includes("COPY"),
    "AdminSpotifyModal must include Copy URL action"
  );
  assert.ok(
    combined.includes("REGENERATE"),
    "AdminSpotifyModal must include Regenerate action"
  );
});

test("AC-9: README.md documents zero-env-variable scheduled sync setup", () => {
  const readmeSource = fs.readFileSync(path.join(root, "README.md"), "utf-8");

  assert.ok(
    !readmeSource.includes("Add `CRON_SECRET` to your Vercel environment variables"),
    "README.md must not instruct user to manually add CRON_SECRET to Vercel"
  );
  assert.ok(
    readmeSource.includes("SCHEDULED SYNC") || readmeSource.includes("Scheduled Sync") || readmeSource.includes("sync key"),
    "README.md must document scheduled sync key setup"
  );
});

test("AC-2b: saveActiveSiteConfig preserves cron_key in site_settings", async () => {
  const { getCronKey, saveActiveSiteConfig, getActiveSiteConfig } = await import(
    "../src/lib/db/queries"
  );

  const existingKey = await getCronKey();
  assert.ok(existingKey, "Existing cronKey must be present before saving config");

  const currentConfig = await getActiveSiteConfig();
  const updatedConfig = {
    ...currentConfig,
    title: `Title Preservation Check ${Date.now()}`,
  };

  const saveSuccess = await saveActiveSiteConfig(updatedConfig);
  assert.equal(saveSuccess, true, "saveActiveSiteConfig must succeed");

  const keyAfterSave = await getCronKey();
  assert.equal(
    keyAfterSave,
    existingKey,
    "saveActiveSiteConfig must preserve the existing cron_key"
  );
});

test("AC-7b: AdminSpotifyModal guards Copy URL button when sync key is not yet loaded", () => {
  const modalSource = fs.readFileSync(
    path.join(root, "src/components/AdminSpotifyModal.tsx"),
    "utf-8"
  );
  const syncCardSource = fs.existsSync(path.join(root, "src/components/admin/ScheduledSyncCard.tsx"))
    ? fs.readFileSync(path.join(root, "src/components/admin/ScheduledSyncCard.tsx"), "utf-8")
    : "";
  const combined = modalSource + syncCardSource;

  assert.ok(
    modalSource.includes("hasValidSyncKey") || combined.includes("hasValidSyncKey"),
    "AdminSpotifyModal must track whether a valid sync key exists"
  );
  assert.ok(
    combined.includes("disabled={!hasValidSyncKey"),
    "Copy URL button must be disabled when no valid sync key is loaded"
  );
  assert.ok(
    modalSource.includes("setCopiedSyncUrl(false)"),
    "Regenerating key must reset copied state"
  );
});

