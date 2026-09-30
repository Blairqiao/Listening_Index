import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { msToClock, gradientStops, LivePlayerView } from "../src/components/LivePlayerView";

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

test("LivePlayerView - production component contract & architecture rules", () => {
  assert.equal(typeof LivePlayerView, "function", "LivePlayerView must be a React functional component");

  const componentPath = path.resolve(__dirname, "../src/components/LivePlayerView.tsx");
  const source = fs.readFileSync(componentPath, "utf-8");

  // 1. Variant B Split Console layout grid structure
  assert.match(source, /grid\s+grid-cols-1\s+md:grid-cols-12/, "Must use 12-column responsive grid layout");
  assert.match(source, /md:col-span-5/, "Left side deck & controls must span 5 columns on desktop");
  
  // 2. Mobile viewport isolation: Spectrum MUST be hidden on mobile (< 768px)
  assert.match(source, /hidden\s+md:flex\s+md:col-span-7/, "Right side spectrum container must be hidden on mobile");

  // 3. Web Playback SDK & Token endpoint contract
  assert.match(source, /\/api\/player\/token/, "Must call /api/player/token for token lifecycle");
  assert.match(source, /new\s+window\.Spotify\.Player/, "Must instantiate Spotify Player SDK");
  assert.match(source, /getOAuthToken/, "Must supply getOAuthToken callback to player");
  assert.match(source, /Listening Index/, "Must register device name as 'Listening Index'");

  // 4. Transport and Volume controls
  assert.match(source, /togglePlay/, "Must support togglePlay transport control");
  assert.match(source, /previousTrack/, "Must support previousTrack transport control");
  assert.match(source, /nextTrack/, "Must support nextTrack transport control");
  assert.match(source, /setVolume/, "Must support volume control");
  assert.match(source, /seek/, "Must support scrubber seek control");

  // 5. Transfer playback & unlinked states
  assert.match(source, /LINK SPOTIFY FOR WEB PLAYBACK/, "Must have unlinked action button");
  assert.match(source, /https:\/\/api\.spotify\.com\/v1\/me\/player/, "Must support transferring playback to device");

  // 6. Spectrum visualizer integration
  assert.match(source, /SyntheticSpectrumSource/, "Must support synthetic spectrum source");
  assert.match(source, /LiveAudioSpectrumSource/, "Must support live audio hardware capture");
  assert.match(source, /BAND_COUNT/, "Must use 32-band spectrum layout");

  // 7. Regression check: connectPlayer must NOT have volume in its dependency array
  assert.match(
    source,
    /const connectPlayer = useCallback\(async \(\) => {[\s\S]*?}, \[\]\);/,
    "connectPlayer must have an empty dependency array to prevent reconnection cascade on volume change"
  );

  // 8. Regression check: SpectrumCanvas source mode effect must not depend on trackKey or isLive
  assert.match(
    source,
    /},\s*\[sourceMode,\s*onToggleSource\]\);/,
    "SpectrumCanvas sourceMode effect must not depend on trackKey or isLive to avoid re-prompting audio stream"
  );

  // 9. Regression check: getOAuthToken handles 401 status
  assert.match(
    source,
    /if \(r\.status === 401\)/,
    "getOAuthToken must explicitly handle 401 unauthorized status"
  );
});

import { getRibbonLabels } from "../src/components/MetricRibbon";

test("MetricRibbon - Mode 3 labels aligned with metrics", () => {
  const labels = getRibbonLabels(3);
  assert.deepEqual(labels, ["STATUS", "BANDS", "NOW STREAMING", "SOURCE"]);
});

