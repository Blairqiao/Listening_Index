import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("PlayerContext exports selectedContext, selectContext, contextName, and userPlaylists", () => {
  const playerContextPath = path.resolve(__dirname, "../src/context/PlayerContext.tsx");
  const content = fs.readFileSync(playerContextPath, "utf-8");

  assert.ok(
    content.includes("selectedContext"),
    "PlayerContext must expose selectedContext"
  );
  assert.ok(
    content.includes("selectContext"),
    "PlayerContext must expose selectContext handler"
  );
  assert.ok(
    content.includes("contextName"),
    "PlayerContext must expose contextName"
  );
  assert.ok(
    content.includes("userPlaylists"),
    "PlayerContext must expose userPlaylists"
  );
});

test("LivePlayerView renders the context selector with Auto Play, user playlists, and contextName", () => {
  const livePlayerPath = path.resolve(__dirname, "../src/components/LivePlayerView.tsx");
  const content = fs.readFileSync(livePlayerPath, "utf-8");

  assert.ok(
    content.includes("AUTO PLAY") || content.includes("Auto Play") || content.includes("RECENT FAVORITES"),
    "LivePlayerView must display AUTO PLAY / Recent Favorites option"
  );
  assert.ok(
    content.includes("contextName"),
    "LivePlayerView must render contextName"
  );
  assert.ok(
    content.includes("userPlaylists"),
    "LivePlayerView must render userPlaylists options"
  );
  assert.ok(
    content.includes("NO SPOTIFY PLAYLISTS LOADED") || content.includes("No Spotify playlists loaded"),
    "LivePlayerView must render empty state when userPlaylists is empty"
  );
  assert.ok(
    content.includes("selectContext"),
    "LivePlayerView must connect selector to selectContext"
  );
});

test("ListeningView and LivePlayerView prevent stacked view controls from getting pushed out of bounds", () => {
  const listeningViewPath = path.resolve(__dirname, "../src/components/ListeningView.tsx");
  const listeningViewContent = fs.readFileSync(listeningViewPath, "utf-8");

  assert.ok(
    listeningViewContent.includes("activeMode === 3") &&
      (listeningViewContent.includes("md:min-h-[584px]") || listeningViewContent.includes("md:h-auto")),
    "ListeningView must adapt container height for LivePlayerView to prevent bounds clipping on desktop"
  );

  const livePlayerPath = path.resolve(__dirname, "../src/components/LivePlayerView.tsx");
  const livePlayerContent = fs.readFileSync(livePlayerPath, "utf-8");

  assert.ok(
    livePlayerContent.includes("md:h-[220px]") ||
      livePlayerContent.includes("md:h-[180px]") ||
      livePlayerContent.includes("md:h-[160px]") ||
      livePlayerContent.includes("h-[140px]"),
    "LivePlayerView stacked visualizer must use compact height to preserve deck bounds"
  );
});

test("AC-1: LivePlayerView renders device status and context selector on a unified row", () => {
  const livePlayerPath = path.resolve(__dirname, "../src/components/LivePlayerView.tsx");
  const content = fs.readFileSync(livePlayerPath, "utf-8");

  // Must not have a separate dedicated border-b row for CONTEXT:
  assert.ok(
    !content.includes('border-b border-[#161614] relative font-mono">\n        <span className="text-[#6A6A64] uppercase font-bold shrink-0">\n          CONTEXT:'),
    "LivePlayerView must not render CONTEXT on a separate dedicated border-b row"
  );
});

test("AC-2: LivePlayerView playlist selector dropdown uses scrollbar-hidden", () => {
  const livePlayerPath = path.resolve(__dirname, "../src/components/LivePlayerView.tsx");
  const content = fs.readFileSync(livePlayerPath, "utf-8");

  assert.ok(
    content.includes("scrollbar-hidden"),
    "LivePlayerView playlist selector dropdown must include scrollbar-hidden class"
  );
});

test("AC-3: globals.css enforces universal scrollbar suppression", () => {
  const cssPath = path.resolve(__dirname, "../src/app/globals.css");
  const content = fs.readFileSync(cssPath, "utf-8");

  assert.ok(
    content.includes("*::-webkit-scrollbar"),
    "globals.css must suppress scrollbars on *::-webkit-scrollbar"
  );
});

