import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("AC-1: config queries deprecate DB spotify_client_id and clear owner_spotify_url on delete", () => {
  const configQueryPath = path.resolve(__dirname, "../src/lib/db/queries/config.ts");
  const content = fs.readFileSync(configQueryPath, "utf-8");

  // In deleteOwnerPlaybackToken, owner_spotify_url must be cleared to NULL
  assert.ok(
    content.includes("owner_spotify_url = NULL"),
    "deleteOwnerPlaybackToken must set owner_spotify_url = NULL"
  );

  // In saveOwnerPlaybackToken, spotify_client_id must not be hardcoded as empty string in INSERT
  const saveOwnerFnMatch = content.match(/export async function saveOwnerPlaybackToken[\s\S]*?^}/m);
  assert.ok(saveOwnerFnMatch, "saveOwnerPlaybackToken function must exist");
  const saveOwnerFn = saveOwnerFnMatch[0];
  assert.ok(
    !saveOwnerFn.includes("spotify_client_id"),
    "saveOwnerPlaybackToken should deprecate spotify_client_id from site_settings INSERT"
  );
});

test("AC-2: dev script binds to 127.0.0.1 and layout includes loopback normalizer", () => {
  const packageJsonPath = path.resolve(__dirname, "../package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  assert.ok(
    packageJson.scripts?.dev?.includes("-H 127.0.0.1"),
    "package.json dev script must include -H 127.0.0.1"
  );

  const layoutPath = path.resolve(__dirname, "../src/app/layout.tsx");
  const layoutContent = fs.readFileSync(layoutPath, "utf-8");
  assert.ok(
    layoutContent.includes("127.0.0.1") && layoutContent.includes("localhost"),
    "layout.tsx must include loopback hostname normalization for localhost to 127.0.0.1"
  );
});

test("AC-3: PlayerContext implements idempotent connectPlayer and non-blocking active playback probe", () => {
  const playerContextPath = path.resolve(__dirname, "../src/context/PlayerContext.tsx");
  const content = fs.readFileSync(playerContextPath, "utf-8");

  // connectPlayer must check if playerRef.current and deviceIdRef.current are already connected
  assert.ok(
    content.includes("playerRef.current && deviceIdRef.current"),
    "connectPlayer must be idempotent and check existing connection before tearing down playerRef"
  );

  // Connection timeout protection
  assert.ok(
    content.includes("connectionTimeout") || content.includes("SDK_CONNECT_TIMEOUT") || content.includes("CONNECTING_TIMEOUT"),
    "PlayerContext must handle SDK connection timeout to prevent hanging in connecting status indefinitely"
  );
});

test("AC-4: LivePlayerView has no link button and notifies user to link Spotify ID via Spotify modal (S)", () => {
  const livePlayerPath = path.resolve(__dirname, "../src/components/LivePlayerView.tsx");
  const content = fs.readFileSync(livePlayerPath, "utf-8");

  // Must not render a [ LINK SPOTIFY ] or [ LINK ] button
  assert.ok(
    !content.includes("[ LINK SPOTIFY ]"),
    "LivePlayerView must not render a [ LINK SPOTIFY ] button"
  );
  assert.ok(
    !content.includes("[ LINK ]"),
    "LivePlayerView must not render a [ LINK ] button"
  );

  // playerStatus === "unlinked" must notify user to link via Spotify modal
  assert.ok(
    content.includes("SPOTIFY NOT LINKED") || content.includes("LINK YOUR SPOTIFY"),
    "LivePlayerView unlinked status must notify user to link Spotify ID"
  );
  assert.ok(
    content.includes("SPOTIFY MODAL") || content.includes("MODAL (S)"),
    "LivePlayerView unlinked status must instruct user to use Spotify modal (S)"
  );
});

test("AC-5: handleTogglePlay supports API fallback with track URI when SDK state is empty", () => {
  const playerContextPath = path.resolve(__dirname, "../src/context/PlayerContext.tsx");
  const content = fs.readFileSync(playerContextPath, "utf-8");

  // handleTogglePlay must support trackId/URI and call Spotify Web API play endpoint
  assert.ok(
    content.includes("https://api.spotify.com/v1/me/player/play"),
    "handleTogglePlay must call Spotify play endpoint when player buffer is empty"
  );

  const livePlayerPath = path.resolve(__dirname, "../src/components/LivePlayerView.tsx");
  const liveContent = fs.readFileSync(livePlayerPath, "utf-8");
  assert.ok(
    liveContent.includes("handleTogglePlay(displayTrack.trackId"),
    "LivePlayerView must pass displayTrack.trackId to handleTogglePlay"
  );
});

test("AC-6: src/app/page.tsx passes initialIsAuthenticated for zero-latency auto-connection", () => {
  const pagePath = path.resolve(__dirname, "../src/app/page.tsx");
  const pageContent = fs.readFileSync(pagePath, "utf-8");
  assert.ok(
    pageContent.includes("initialIsAuthenticated"),
    "src/app/page.tsx must pass initialIsAuthenticated to ListeningView"
  );

  const listeningViewPath = path.resolve(__dirname, "../src/components/ListeningView.tsx");
  const lvContent = fs.readFileSync(listeningViewPath, "utf-8");
  assert.ok(
    lvContent.includes("initialIsAuthenticated"),
    "ListeningView must accept and pass initialIsAuthenticated to ConfigProvider"
  );
});

