import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAdminSpotifyMode } from "../src/components/AdminSpotifyModal";
import { calculateTokenExpiration } from "../src/lib/spotify-auth";

test("calculateTokenExpiration calculates remaining days and expiration threshold", () => {
  // Unconfigured / null updatedAt
  assert.deepEqual(calculateTokenExpiration(null), { daysRemaining: null, isExpiringSoon: false });

  // Freshly connected
  const freshStatus = calculateTokenExpiration(new Date().toISOString());
  assert.equal(freshStatus.daysRemaining, 180);
  assert.equal(freshStatus.isExpiringSoon, false);

  // Expiring (170 days elapsed -> 10 days remaining <= 14)
  const expiringDate = new Date(Date.now() - 170 * 24 * 60 * 60 * 1000).toISOString();
  const expiringStatus = calculateTokenExpiration(expiringDate);
  assert.equal(expiringStatus.daysRemaining, 10);
  assert.equal(expiringStatus.isExpiringSoon, true);
});

test("resolveAdminSpotifyMode resolves mode correctly across all edge cases", () => {
  // Null or unconnected -> onboarding
  assert.equal(resolveAdminSpotifyMode(null), "onboarding");
  assert.equal(resolveAdminSpotifyMode({ connected: false }), "onboarding");
  assert.equal(resolveAdminSpotifyMode({ connected: false, connectedAt: new Date().toISOString() }), "onboarding");

  // Explicit expiration flag or threshold -> expiring
  assert.equal(resolveAdminSpotifyMode({ connected: true, isExpiringSoon: true }), "expiring");
  assert.equal(resolveAdminSpotifyMode({ connected: true, daysRemaining: 5 }), "expiring");

  // Connected with healthy remaining days -> connected
  assert.equal(resolveAdminSpotifyMode({ connected: true, daysRemaining: 150 }), "connected");

  // Connected with timestamp calculation
  const recentDate = new Date().toISOString();
  assert.equal(resolveAdminSpotifyMode({ connected: true, connectedAt: recentDate }), "connected");

  const staleDate = new Date(Date.now() - 170 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(resolveAdminSpotifyMode({ connected: true, connectedAt: staleDate }), "expiring");

  // Mode overrides take absolute precedence
  assert.equal(resolveAdminSpotifyMode(null, "onboarding"), "onboarding");
  assert.equal(resolveAdminSpotifyMode({ connected: true, daysRemaining: 5 }, "connected"), "connected");
  assert.equal(resolveAdminSpotifyMode({ connected: true, daysRemaining: 150 }, "expiring"), "expiring");
  assert.equal(resolveAdminSpotifyMode({ connected: false }, "expiring"), "expiring");
});

test("resolveRedirectUriDisplay provides both production and local loopback URIs with active environment detection", async () => {
  const { resolveRedirectUriDisplay } = await import("../src/lib/spotify-auth");
  const fs = await import("node:fs");
  const path = await import("node:path");

  // 1. When running on local loopback, local is active and production shows template (or NEXT_PUBLIC_SITE_URL)
  const localDisplay = resolveRedirectUriDisplay("http://127.0.0.1:8888/callback");
  assert.equal(localDisplay.localUri, "http://127.0.0.1:8888/callback");
  assert.equal(localDisplay.productionUri, "https://<your-app>.vercel.app/callback");
  assert.equal(localDisplay.activeEnvironment, "local");

  // 2. When running on production HTTPS domain, production is active and reflects the live domain
  const prodDisplay = resolveRedirectUriDisplay("https://listening-index.vercel.app/callback");
  assert.equal(prodDisplay.productionUri, "https://listening-index.vercel.app/callback");
  assert.equal(prodDisplay.localUri, "http://127.0.0.1:8888/callback");
  assert.equal(prodDisplay.activeEnvironment, "production");

  // 3. AdminSpotifyModal.tsx must not use hardcoded "http://127.0.0.1:8888/callback" state fallbacks
  const modalSource = fs.readFileSync(
    path.resolve(__dirname, "../src/components/AdminSpotifyModal.tsx"),
    "utf-8"
  );
  assert.ok(
    !modalSource.includes('"http://127.0.0.1:8888/callback"'),
    "AdminSpotifyModal.tsx must not contain hardcoded http://127.0.0.1:8888/callback fallback strings"
  );
  assert.ok(
    modalSource.includes("resolveRedirectUriDisplay"),
    "AdminSpotifyModal.tsx must use resolveRedirectUriDisplay to render both production and local URIs"
  );
});

test("resolveSpotifyProfileUrl and profile link within AdminSpotifyModal", async () => {
  const { resolveSpotifyProfileUrl } = await import("../src/components/AdminSpotifyModal");
  const fs = await import("node:fs");
  const path = await import("node:path");

  // 1. Explicit profileUrl takes priority
  assert.equal(
    resolveSpotifyProfileUrl("Blair Qiao", "https://open.spotify.com/user/blair123"),
    "https://open.spotify.com/user/blair123"
  );

  // 2. Alphanumeric username without spaces constructs open.spotify.com/user/<username>
  assert.equal(
    resolveSpotifyProfileUrl("blairqiao", null),
    "https://open.spotify.com/user/blairqiao"
  );

  // 3. Fallbacks to open.spotify.com when empty or spaces without explicit URL
  assert.equal(resolveSpotifyProfileUrl(null, null), "https://open.spotify.com");
  assert.equal(resolveSpotifyProfileUrl("Blair Qiao", null), "https://open.spotify.com");

  // 4. AdminSpotifyModal.tsx source verifies clickable profile link with target="_blank"
  const modalSource = fs.readFileSync(
    path.resolve(__dirname, "../src/components/AdminSpotifyModal.tsx"),
    "utf-8"
  );
  assert.ok(
    modalSource.includes("resolveSpotifyProfileUrl"),
    "AdminSpotifyModal.tsx should use resolveSpotifyProfileUrl"
  );
  assert.ok(
    modalSource.includes('href={profileUrl}') || modalSource.includes("href={resolveSpotifyProfileUrl"),
    "AdminSpotifyModal.tsx must bind profile URL to an anchor link"
  );
  assert.ok(
    modalSource.includes('target="_blank"') && modalSource.includes('rel="noopener noreferrer"'),
    "AdminSpotifyModal.tsx must open external profile link in new tab with security attributes"
  );
});

test("AdminSpotifyModal visual design cohesion and removal of AI status dots", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const modalSource = fs.readFileSync(
    path.resolve(__dirname, "../src/components/AdminSpotifyModal.tsx"),
    "utf-8"
  );

  // 1. Must NOT contain generic glowing AI status dot pills
  assert.ok(
    !modalSource.includes("rounded-full bg-emerald-400"),
    "AdminSpotifyModal must not contain glowing emerald AI circular status dots"
  );
  assert.ok(
    !modalSource.includes("rounded-full bg-amber-400"),
    "AdminSpotifyModal must not contain glowing amber AI circular status dots"
  );
  assert.ok(
    !modalSource.includes("shadow-[0_0_8px"),
    "AdminSpotifyModal must not contain glow shadow blurs on status indicators"
  );

  // 2. Onboarding mode renders clear step-based setup flow without artificial status cards
  assert.ok(
    modalSource.includes("STEP 1: REGISTER REDIRECT URIS") &&
      modalSource.includes("STEP 2: CONNECT ACCOUNT"),
    "AdminSpotifyModal onboarding mode must render step-based setup workflow"
  );
  assert.ok(
    !modalSource.includes("[ UNCONNECTED ]"),
    "AdminSpotifyModal onboarding mode must not render redundant [ UNCONNECTED ] card"
  );

  // 3. Connected and expiring modes render status cards
  assert.ok(
    modalSource.includes("[ CONNECTED ]"),
    "AdminSpotifyModal connected mode must render monospace [ CONNECTED ] status tag"
  );
  assert.ok(
    modalSource.includes("[ EXPIRING IN"),
    "AdminSpotifyModal expiring mode must render monospace [ EXPIRING IN ] status tag"
  );
});


