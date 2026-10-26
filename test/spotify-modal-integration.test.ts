import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getSpotifyTabState } from "../src/components/ModeTabs";

test("ModeTabs is sole AdminSpotifyModal trigger while ListeningFooter is dedicated strictly to telemetry and CustomizationModal omits Spotify section", () => {
  const root = path.resolve(__dirname, "..");
  const modeTabsContent = fs.readFileSync(path.join(root, "src/components/ModeTabs.tsx"), "utf-8");
  const footerContent = fs.readFileSync(path.join(root, "src/components/ListeningFooter.tsx"), "utf-8");
  const customizationContent = fs.readFileSync(path.join(root, "src/components/CustomizationModal.tsx"), "utf-8");
  const listeningViewContent = fs.readFileSync(path.join(root, "src/components/ListeningView.tsx"), "utf-8");

  // ModeTabs checks
  assert.ok(
    modeTabsContent.includes("onOpenSpotifyModal") && modeTabsContent.includes("spotifyStatus"),
    "ModeTabs must accept onOpenSpotifyModal and spotifyStatus props"
  );
  assert.ok(
    modeTabsContent.includes("Music2"),
    "ModeTabs must render the Spotify modal icon button"
  );

  // ListeningFooter checks: must NOT have Spotify prompt/modal triggers
  assert.ok(
    !footerContent.includes("onOpenSpotifyModal") && !footerContent.includes("spotifyStatus"),
    "ListeningFooter must not accept onOpenSpotifyModal or spotifyStatus props"
  );
  assert.ok(
    !footerContent.includes("[ ! SETUP SPOTIFY ]") && !footerContent.includes("SETUP SPOTIFY"),
    "ListeningFooter must not contain Spotify setup badge text"
  );
  assert.ok(
    !footerContent.includes("TOKEN EXPIRING"),
    "ListeningFooter must not contain TOKEN EXPIRING badge text"
  );
  assert.ok(
    !footerContent.includes("getSpotifyPromptState"),
    "ListeningFooter must not declare or use getSpotifyPromptState"
  );

  // CustomizationModal must no longer contain the Spotify Account section
  assert.ok(
    !customizationContent.includes("[ SPOTIFY ACCOUNT ]") &&
      !customizationContent.includes("[ MANAGE SPOTIFY ]"),
    "CustomizationModal must not render the Spotify Account section"
  );

  // ListeningView checks
  assert.ok(
    listeningViewContent.includes("AdminSpotifyModal"),
    "ListeningView must mount AdminSpotifyModal"
  );
  assert.ok(
    listeningViewContent.includes("/api/owner/spotify"),
    "ListeningView must fetch /api/owner/spotify when authenticated"
  );
  assert.ok(
    listeningViewContent.includes("onOpenSpotifyModal={openAdminSpotifyModal}") &&
      listeningViewContent.includes("spotifyStatus={spotifyStatus}"),
    "ListeningView must pass onOpenSpotifyModal and spotifyStatus to ModeTabs"
  );
  assert.ok(
    !listeningViewContent.includes("spotifyStatus={spotifyStatus}\n          onOpenSpotifyModal={openAdminSpotifyModal}"),
    "ListeningView must not pass spotifyStatus or onOpenSpotifyModal to ListeningFooter"
  );
  assert.ok(
    !listeningViewContent.includes("http://127.0.0.1:8888/callback"),
    "ListeningView must not hardcode http://127.0.0.1:8888/callback placeholders"
  );
  assert.ok(
    !listeningViewContent.includes("isAdminSpotifyModalOpen && e.key === \"Escape\""),
    "ListeningView must delegate Escape key handling to AdminSpotifyModal to preserve !isBusy guard"
  );
});

test("getSpotifyTabState gates ModeTabs trigger strictly behind isAuthenticated and reflects status", () => {
  // 1. Unauthenticated visitors must never see the ModeTabs Spotify button
  assert.equal(getSpotifyTabState(false, null), null);
  assert.equal(
    getSpotifyTabState(false, { connected: false, isExpiringSoon: false }),
    null
  );
  assert.equal(
    getSpotifyTabState(false, { connected: true, isExpiringSoon: true, daysRemaining: 5 }),
    null
  );

  // 2. Authenticated while status is still loading -> visible in default connected/neutral style
  assert.deepEqual(getSpotifyTabState(true, null), {
    visible: true,
    variant: "connected",
    title: "Manage Spotify connection & refresh token",
  });

  // 3. Authenticated and unconnected -> setup variant
  assert.deepEqual(
    getSpotifyTabState(true, { connected: false, isExpiringSoon: false }),
    {
      visible: true,
      variant: "setup",
      title: "Setup Spotify connection & refresh token",
    }
  );

  // 4. Authenticated and expiring soon -> expiring variant
  assert.deepEqual(
    getSpotifyTabState(true, { connected: true, isExpiringSoon: true, daysRemaining: 6 }),
    {
      visible: true,
      variant: "expiring",
      title: "Spotify token expiring in 6d · click to renew",
    }
  );

  // 5. Authenticated and connected healthy -> connected variant
  assert.deepEqual(
    getSpotifyTabState(true, { connected: true, isExpiringSoon: false, daysRemaining: 173 }),
    {
      visible: true,
      variant: "connected",
      title: "Manage Spotify connection & refresh token",
    }
  );
});

test("ListeningFooter maintains clean system telemetry without prompt notification buttons", () => {
  const root = path.resolve(__dirname, "..");
  const footerSource = fs.readFileSync(
    path.join(root, "src/components/ListeningFooter.tsx"),
    "utf-8"
  );

  // Telemetry indicators present
  assert.ok(
    footerSource.includes("[ SYNCING... ]") &&
      footerSource.includes("[ ▪ LIVE ]") &&
      footerSource.includes("[ SYNCED"),
    "ListeningFooter must render standard sync and live telemetry indicators"
  );

  // Cleanliness: no prompt buttons or extra buttons
  const buttonMatches = footerSource.match(/<button/g) || [];
  assert.equal(
    buttonMatches.length,
    1,
    "ListeningFooter must contain only 1 button (the manual sync telemetry trigger)"
  );
});

test("Spotify modal icon in ModeTabs and AdminSpotifyModal has slow blinking animation during setup/onboarding and expiring modes", () => {
  const root = path.resolve(__dirname, "..");
  const modeTabsContent = fs.readFileSync(path.join(root, "src/components/ModeTabs.tsx"), "utf-8");
  const modalContent = fs.readFileSync(path.join(root, "src/components/AdminSpotifyModal.tsx"), "utf-8");
  const cssContent = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf-8");

  // globals.css must define @keyframes slow-blink and .animate-slow-blink with slower duration (>= 3s)
  assert.ok(
    cssContent.includes("@keyframes slow-blink") && cssContent.includes("animate-slow-blink"),
    "globals.css must define @keyframes slow-blink and .animate-slow-blink class"
  );
  assert.ok(
    !cssContent.includes("slow-blink 2s"),
    "globals.css slow-blink must be slower than 2s"
  );
  assert.ok(
    cssContent.includes("slow-blink 3s") || cssContent.includes("slow-blink 3.5s") || cssContent.includes("slow-blink 4s"),
    "globals.css slow-blink must have a relaxed, slower cycle (>= 3s)"
  );

  // ModeTabs applies animate-slow-blink to the entire button container enclosing [ icon ]
  assert.ok(
    modeTabsContent.includes('spotifyTab.variant === "setup"') &&
      modeTabsContent.includes("animate-slow-blink"),
    "ModeTabs must include animate-slow-blink"
  );
  assert.ok(
    modeTabsContent.includes('text-music-accent hover:text-[#EDEDE8] animate-slow-blink') &&
      modeTabsContent.includes('text-amber-400 hover:text-amber-300 animate-slow-blink'),
    "ModeTabs must apply animate-slow-blink to the button element so the entire [ icon ] blinks"
  );
  assert.ok(
    !modeTabsContent.includes('<Music2\n              className={`w-3 h-3 ${'),
    "Music2 inside ModeTabs should not isolate animation away from the brackets"
  );

  // AdminSpotifyModal applies animate-slow-blink in onboarding and expiring modes
  assert.ok(
    modalContent.includes("animate-slow-blink"),
    "AdminSpotifyModal must apply animate-slow-blink to header Spotify icon in onboarding/expiring modes"
  );
});


