import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { msToClock, gradientStops, LivePlayerView } from "../src/components/LivePlayerView";
import { getRibbonLabels } from "../src/components/MetricRibbon";

test("LivePlayerView - msToClock helper formatting", () => {
  assert.equal(msToClock(0), "0:00");
  assert.equal(msToClock(5000), "0:05");
  assert.equal(msToClock(65000), "1:05");
  assert.equal(msToClock(738000), "12:18");
  assert.equal(msToClock(-1000), "0:00");
});

test("LivePlayerView - gradientStops generates 3 distinct color stops from accent", () => {
  const stops = gradientStops("#22C55E");
  assert.equal(stops.length, 3);
  assert.ok(stops[0].startsWith("#"), "Stop 0 must be a valid hex color");
  assert.ok(stops[1].startsWith("#"), "Stop 1 must be a valid hex color");
  assert.ok(stops[2].startsWith("#"), "Stop 2 must be a valid hex color");
});

test("LivePlayerView - presenter component contract & layout architecture", () => {
  assert.equal(typeof LivePlayerView, "function", "LivePlayerView must be a React functional component");

  const componentPath = path.resolve(__dirname, "../src/components/LivePlayerView.tsx");
  const source = fs.readFileSync(componentPath, "utf-8");

  // 1. Dual layout support: Split Console (Variant B) and Stacked Stage (Variant A)
  assert.match(source, /Variant B: Split Console/, "Must support Variant B: Split Console");
  assert.match(source, /Variant A: Stacked Stage/, "Must support Variant A: Stacked Stage");
  assert.match(source, /grid\s+grid-cols-1\s+md:grid-cols-12/, "Split layout must use 12-column responsive grid");
  assert.match(source, /md:col-span-5/, "Split layout deck must span 5 columns on desktop");
  
  // 2. Mobile viewport isolation: Spectrum MUST be hidden on mobile (< 768px) on both layouts
  assert.match(source, /hidden\s+md:flex\s+md:col-span-7/, "Split layout spectrum must be hidden on mobile");
  assert.match(source, /hidden\s+md:block\s+border/, "Stacked layout spectrum stage must be hidden on mobile");

  // 3. Decoupled Context Architecture
  assert.match(source, /usePlayer\(\)/, "Must consume usePlayer from PlayerContext");
  assert.match(source, /useConfig\(\)/, "Must consume useConfig from ConfigContext");

  // 4. Dual Layout Selection
  assert.match(source, /config\.livePlayerLayout === "split"/, "Must select layout based on config.livePlayerLayout");
  assert.match(source, /handleToggleLayout/, "Must support layout toggle handler");

  // 5. In-player controls (Transport, Shuffle, Repeat, Volume)
  assert.match(source, /handleTogglePlay/, "Must support togglePlay transport control");
  assert.match(source, /handlePrevious/, "Must support previousTrack transport control");
  assert.match(source, /handleNext/, "Must support nextTrack transport control");
  assert.match(source, /handleToggleShuffle/, "Must support shuffle toggle");
  assert.match(source, /handleCycleRepeat/, "Must support repeat cycle");
  assert.match(source, /handleVolume/, "Must support volume control");
  assert.match(source, /handleSeek/, "Must support scrubber seek control");

  // 6. External device takeover
  assert.match(source, /TRANSFER HERE/, "Must support transfer playback when active on remote device");

  // 7. Spectrum visualizer integration
  assert.match(source, /SyntheticSpectrumSource/, "Must support synthetic spectrum source");
  assert.match(source, /LiveAudioSpectrumSource/, "Must support live audio hardware capture");
  assert.match(source, /BAND_COUNT/, "Must use 32-band spectrum layout");

  // 8. Control row placement: Layout, Link/Unlink, and Synthetic/Real audio buttons in control area
  assert.doesNotMatch(
    source,
    /NOW STREAMING[\s\S]*?<button[\s\S]*?<\/div>\s*<div className="text-[^"]*">\s*\{displayTrack\.name\}/,
    "Layout and unlink buttons must not be placed in top deck title header"
  );
  assert.doesNotMatch(
    source,
    /<canvas ref=\{canvasRef\}[\s\S]*?<button[\s\S]*?<\/div>\s*\);\s*};/,
    "Synthetic/real audio toggle button must not be overlaid inside canvas"
  );
  assert.match(
    source,
    /toggleSourceMode/,
    "Synthetic/real audio toggle must be wired to toggleSourceMode in controls"
  );
});

test("PlayerContext - Web Playback SDK & connection lifecycle contract", () => {
  const contextPath = path.resolve(__dirname, "../src/context/PlayerContext.tsx");
  const source = fs.readFileSync(contextPath, "utf-8");

  // 1. Web Playback SDK & Token endpoint contract
  assert.match(source, /\/api\/player\/token/, "Must call /api/player/token for token lifecycle");
  assert.match(source, /new\s+window\.Spotify\.Player/, "Must instantiate Spotify Player SDK in PlayerContext");
  assert.match(source, /getOAuthToken/, "Must supply getOAuthToken callback to player");
  assert.match(source, /Listening Index/, "Must register device name as 'Listening Index'");

  // 2. Token error handling
  assert.match(source, /if \(r\.status === 401\)/, "getOAuthToken must explicitly handle 401 unauthorized status");

  // 3. Audio volume taper integration
  assert.match(source, /sliderToVolume/, "PlayerContext must map volume using sliderToVolume taper");
  assert.match(source, /setStoredVolume/, "PlayerContext must persist volume using setStoredVolume");
});

test("MetricRibbon - Mode 3 archive telemetry labels", () => {
  const labels = getRibbonLabels(3);
  assert.deepEqual(labels, ["TRACK RANK", "TRACK PLAYS", "ARTIST RANK", "ARTIST PLAYS"]);
});

test("LivePlayerView - Uniform text transport buttons and dynamic play highlight", () => {
  const componentPath = path.resolve(__dirname, "../src/components/LivePlayerView.tsx");
  const source = fs.readFileSync(componentPath, "utf-8");

  // Text labels used for transport buttons
  assert.match(source, /\[PREV\]/, "Must render [PREV] text button");
  assert.match(source, /\[PLAY\]/, "Must render [PLAY] text button when paused");
  assert.match(source, /\[PAUSE\]/, "Must render [PAUSE] text button when playing");
  assert.match(source, /\[NEXT\]/, "Must render [NEXT] text button");
  assert.match(source, /\[SHUF\]/, "Must render [SHUF] text button");
  assert.match(source, /\[REP:\s*OFF\]/, "Must support [REP: OFF] text label");
  assert.match(source, /\[REP:\s*ALL\]/, "Must support [REP: ALL] text label");
  assert.match(source, /\[REP:\s*1\]/, "Must support [REP: 1] text label");

  // Uniform padding across transport controls (px-2 py-0.5)
  assert.doesNotMatch(source, /px-2\.5/, "Should not use non-uniform px-2.5 padding");
  assert.doesNotMatch(source, /px-1\.5/, "Should not use non-uniform px-1.5 padding");

  // Dynamic play highlight (neutral when paused, accent when playing)
  assert.match(
    source,
    /isPlaying\s*\?\s*["'][^"']*border-music-accent\s+text-music-accent[^"']*["']\s*:\s*["'][^"']*border-\[#22221E\][^"']*text-\[#8A8A82\]/,
    "Play button must be neutral when paused and highlighted with accent when playing"
  );
  assert.doesNotMatch(
    source,
    /className="px-2\.5 py-0\.5 border border-music-accent text-music-accent/,
    "Play button must not be statically hardcoded with permanent accent highlight"
  );
});

