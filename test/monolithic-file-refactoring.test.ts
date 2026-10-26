import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");

test("AC-1: types.ts is authoritative and mock fixtures live in src/lib/mock/", async () => {
  const typesContent = fs.readFileSync(path.join(root, "src/lib/types.ts"), "utf-8");
  assert.ok(
    typesContent.includes("export interface TrackSummary"),
    "src/lib/types.ts must define TrackSummary"
  );
  assert.ok(
    typesContent.includes("export interface SessionItem"),
    "src/lib/types.ts must define SessionItem"
  );
  assert.ok(
    typesContent.includes("export interface OverviewData"),
    "src/lib/types.ts must define OverviewData"
  );

  assert.ok(
    fs.existsSync(path.join(root, "src/lib/mock/catalog.ts")),
    "src/lib/mock/catalog.ts must exist"
  );
  assert.ok(
    fs.existsSync(path.join(root, "src/lib/mock/overview-data.ts")),
    "src/lib/mock/overview-data.ts must exist"
  );

  const mockAggregator = fs.readFileSync(path.join(root, "src/lib/mock-listening-data.ts"), "utf-8");
  assert.ok(
    mockAggregator.includes("CATALOG"),
    "src/lib/mock-listening-data.ts must re-export CATALOG"
  );
  assert.ok(
    mockAggregator.includes("MOCK_DATA"),
    "src/lib/mock-listening-data.ts must re-export MOCK_DATA"
  );
  const mockLines = mockAggregator.split("\n").length;
  assert.ok(
    mockLines < 200,
    `src/lib/mock-listening-data.ts should be a concise re-export module (< 200 lines, was ${mockLines})`
  );
});

test("AC-2: cadence query and bucket builder are extracted to src/lib/db/queries/cadence.ts", async () => {
  const cadenceFile = path.join(root, "src/lib/db/queries/cadence.ts");
  assert.ok(fs.existsSync(cadenceFile), "src/lib/db/queries/cadence.ts must exist");

  const cadenceContent = fs.readFileSync(cadenceFile, "utf-8");
  assert.ok(
    cadenceContent.includes("buildCadenceQuery") || cadenceContent.includes("getCadenceQuery"),
    "cadence.ts must export cadence query builder"
  );
  assert.ok(
    cadenceContent.includes("buildActivityCadence"),
    "cadence.ts must export buildActivityCadence"
  );

  const overviewContent = fs.readFileSync(path.join(root, "src/lib/db/queries/overview.ts"), "utf-8");
  assert.ok(
    overviewContent.includes("./cadence") || overviewContent.includes("@/lib/db/queries/cadence"),
    "overview.ts must import from cadence.ts"
  );
  const overviewLines = overviewContent.split("\n").length;
  assert.ok(
    overviewLines < 360,
    `overview.ts line count should be reduced (< 360 lines, was ${overviewLines})`
  );
});

test("AC-3: SpectrumCanvas is extracted to src/components/live-player-view/SpectrumCanvas.tsx", async () => {
  const spectrumFile = path.join(root, "src/components/live-player-view/SpectrumCanvas.tsx");
  assert.ok(fs.existsSync(spectrumFile), "src/components/live-player-view/SpectrumCanvas.tsx must exist");

  const spectrumContent = fs.readFileSync(spectrumFile, "utf-8");
  assert.ok(
    spectrumContent.includes("export const SpectrumCanvas") || spectrumContent.includes("export function SpectrumCanvas"),
    "SpectrumCanvas.tsx must export SpectrumCanvas"
  );

  const livePlayerContent = fs.readFileSync(path.join(root, "src/components/LivePlayerView.tsx"), "utf-8");
  assert.ok(
    livePlayerContent.includes("SpectrumCanvas"),
    "LivePlayerView.tsx must import SpectrumCanvas"
  );
  assert.ok(
    livePlayerContent.includes("./live-player-view/SpectrumCanvas") || livePlayerContent.includes("@/components/live-player-view/SpectrumCanvas"),
    "LivePlayerView.tsx must import SpectrumCanvas from dedicated component file"
  );
});

test("AC-4: ScheduledSyncCard is extracted to src/components/admin-spotify-modal/ScheduledSyncCard.tsx", async () => {
  const syncCardFile = path.join(root, "src/components/admin-spotify-modal/ScheduledSyncCard.tsx");
  assert.ok(fs.existsSync(syncCardFile), "src/components/admin-spotify-modal/ScheduledSyncCard.tsx must exist");

  const syncCardContent = fs.readFileSync(syncCardFile, "utf-8");
  assert.ok(
    syncCardContent.includes("export const ScheduledSyncCard") || syncCardContent.includes("export function ScheduledSyncCard"),
    "ScheduledSyncCard.tsx must export ScheduledSyncCard"
  );

  const modalContent = fs.readFileSync(path.join(root, "src/components/AdminSpotifyModal.tsx"), "utf-8");
  assert.ok(
    modalContent.includes("ScheduledSyncCard"),
    "AdminSpotifyModal.tsx must use ScheduledSyncCard"
  );
});

test("AC-5: usePlayerPlaylists and usePlayerInitialContext are extracted to src/context/player-context/", async () => {
  const playlistsHookFile = path.join(root, "src/context/player-context/usePlayerPlaylists.ts");
  const initialContextHookFile = path.join(root, "src/context/player-context/usePlayerInitialContext.ts");

  assert.ok(fs.existsSync(playlistsHookFile), "usePlayerPlaylists.ts must exist");
  assert.ok(fs.existsSync(initialContextHookFile), "usePlayerInitialContext.ts must exist");

  const playerContextContent = fs.readFileSync(path.join(root, "src/context/PlayerContext.tsx"), "utf-8");
  assert.ok(
    playerContextContent.includes("usePlayerPlaylists"),
    "PlayerContext.tsx must import usePlayerPlaylists"
  );
  assert.ok(
    playerContextContent.includes("usePlayerInitialContext"),
    "PlayerContext.tsx must import usePlayerInitialContext"
  );
});

test("AC-6: useListeningUrlSync is extracted to src/components/listening-view/ and keyboard shortcuts are deprecated", async () => {
  const urlSyncHookFile = path.join(root, "src/components/listening-view/useListeningUrlSync.ts");
  assert.ok(fs.existsSync(urlSyncHookFile), "useListeningUrlSync.ts must exist");

  const listeningViewContent = fs.readFileSync(path.join(root, "src/components/ListeningView.tsx"), "utf-8");
  assert.ok(
    listeningViewContent.includes("useListeningUrlSync"),
    "ListeningView.tsx must import useListeningUrlSync"
  );
  assert.ok(
    !listeningViewContent.includes("useKeyboardShortcuts"),
    "ListeningView.tsx must not import deprecated useKeyboardShortcuts"
  );
});
