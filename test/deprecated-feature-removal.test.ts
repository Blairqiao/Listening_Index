import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");

test("AC-1: package.json has test script and removes auth:spotify; scripts/get-spotify-token.ts is removed", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
  assert.equal(
    pkg.scripts?.test,
    "tsx --test test/*.test.ts",
    "package.json must contain test script: tsx --test test/*.test.ts"
  );
  assert.equal(
    pkg.scripts?.["auth:spotify"],
    undefined,
    "package.json must not contain auth:spotify script"
  );
  assert.equal(
    pkg.scripts?.["test:rate-limit"],
    undefined,
    "package.json must not contain test:rate-limit script"
  );
  assert.equal(
    pkg.scripts?.["sync:spotify"],
    undefined,
    "package.json must not contain duplicate sync:spotify script"
  );
  assert.ok(
    !fs.existsSync(path.join(root, "scripts/get-spotify-token.ts")),
    "scripts/get-spotify-token.ts must be deleted"
  );
  assert.ok(
    !fs.existsSync(path.join(root, "scripts/test-rate-limit.ts")),
    "scripts/test-rate-limit.ts must be deleted"
  );
});

test("AC-2: Obsolete owner OAuth routes and cookie helpers are removed", () => {
  assert.ok(
    !fs.existsSync(path.join(root, "src/app/api/owner/spotify/login/route.ts")),
    "src/app/api/owner/spotify/login/route.ts must be deleted"
  );
  assert.ok(
    !fs.existsSync(path.join(root, "src/app/api/owner/spotify/callback/route.ts")),
    "src/app/api/owner/spotify/callback/route.ts must be deleted"
  );

  const userAuthContent = fs.readFileSync(path.join(root, "src/lib/user-auth.ts"), "utf-8");
  assert.ok(
    !userAuthContent.includes("OWNER_VERIFIER_COOKIE"),
    "src/lib/user-auth.ts must not contain OWNER_VERIFIER_COOKIE"
  );
  assert.ok(
    !userAuthContent.includes("ownerVerifierCookie"),
    "src/lib/user-auth.ts must not contain ownerVerifierCookie"
  );
  assert.ok(
    !userAuthContent.includes("clearOwnerVerifierCookie"),
    "src/lib/user-auth.ts must not contain clearOwnerVerifierCookie"
  );
});

test("AC-3: Dead localStorage OAuth code is removed from src/lib/spotify-auth.ts and PlayerContext.tsx", () => {
  const spotifyAuthContent = fs.readFileSync(path.join(root, "src/lib/spotify-auth.ts"), "utf-8");
  const deadSymbols = [
    "spotify_player_token",
    "spotify_player_verifier",
    "spotify_player_return_to",
    "spotify_player_client_id",
    "readToken",
    "writeToken",
    "clearToken",
    "completeLogin",
    "getFreshAccessToken",
    "consumeReturnPath",
    "getClientId",
  ];

  for (const sym of deadSymbols) {
    assert.ok(
      !spotifyAuthContent.includes(sym),
      `src/lib/spotify-auth.ts must not contain ${sym}`
    );
  }

  const playerContextContent = fs.readFileSync(path.join(root, "src/context/PlayerContext.tsx"), "utf-8");
  assert.ok(
    !playerContextContent.includes("clearToken"),
    "src/context/PlayerContext.tsx must not call clearToken"
  );
});

test("AC-4: Dead single-row ingestion queries and obsolete synthetic cleanup are removed", () => {
  const ingestionContent = fs.readFileSync(path.join(root, "src/lib/db/queries/ingestion.ts"), "utf-8");
  const queriesIndexContent = fs.readFileSync(path.join(root, "src/lib/db/queries/index.ts"), "utf-8");
  const enrichmentQueriesContent = fs.readFileSync(path.join(root, "src/lib/db/queries/enrichment.ts"), "utf-8");
  const enrichmentPipelineContent = fs.readFileSync(path.join(root, "src/lib/enrichment.ts"), "utf-8");

  const deadIngestionFns = ["upsertArtist", "upsertAlbum", "upsertTrack", "insertPlay"];
  for (const fn of deadIngestionFns) {
    assert.ok(
      !ingestionContent.includes(`function ${fn}`),
      `ingestion.ts must not declare function ${fn}`
    );
    assert.ok(
      !queriesIndexContent.includes(fn),
      `queries/index.ts must not export ${fn}`
    );
  }

  assert.ok(
    !enrichmentQueriesContent.includes("cleanupOrphanedSyntheticEntities"),
    "enrichment.ts queries must not declare cleanupOrphanedSyntheticEntities"
  );
  assert.ok(
    !enrichmentPipelineContent.includes("cleanupOrphanedSyntheticEntities"),
    "enrichment.ts pipeline must not invoke cleanupOrphanedSyntheticEntities"
  );
  assert.ok(
    !queriesIndexContent.includes("cleanupOrphanedSyntheticEntities"),
    "queries/index.ts must not export cleanupOrphanedSyntheticEntities"
  );

  const ownerSpotifyContent = fs.readFileSync(path.join(root, "src/lib/owner-spotify.ts"), "utf-8");
  assert.ok(
    !ownerSpotifyContent.includes("OWNER_RECORD_ID"),
    "owner-spotify.ts must not export OWNER_RECORD_ID"
  );
});

test("AC-5: resize-utils is deleted, compactDate moved to format-utils, dead props cleaned, SPOTIFY_REFRESH_TOKEN warning removed", () => {
  assert.ok(
    !fs.existsSync(path.join(root, "src/lib/resize-utils.ts")),
    "src/lib/resize-utils.ts must be deleted"
  );

  const formatUtilsContent = fs.readFileSync(path.join(root, "src/lib/format-utils.ts"), "utf-8");
  assert.ok(
    formatUtilsContent.includes("export function compactDate"),
    "src/lib/format-utils.ts must export compactDate"
  );

  const controlRowContent = fs.readFileSync(path.join(root, "src/components/listening-view/ControlRow.tsx"), "utf-8");
  assert.ok(
    !controlRowContent.includes("resize-utils"),
    "ControlRow.tsx must not import from resize-utils"
  );
  assert.ok(
    !controlRowContent.includes("isLinked"),
    "ControlRow.tsx must not declare or accept isLinked"
  );
  assert.ok(
    !controlRowContent.includes("// totalPlays"),
    "ControlRow.tsx must not contain commented-out // totalPlays"
  );

  const listeningViewContent = fs.readFileSync(path.join(root, "src/components/ListeningView.tsx"), "utf-8");
  assert.ok(
    !listeningViewContent.includes("isLinked={isLinked}"),
    "ListeningView.tsx must not pass isLinked to ControlRow"
  );

  const metricRibbonContent = fs.readFileSync(path.join(root, "src/components/listening-view/MetricRibbon.tsx"), "utf-8");
  assert.ok(
    !metricRibbonContent.includes("// trackRankFormat"),
    "MetricRibbon.tsx must not contain commented-out // trackRankFormat"
  );

  const spotifyContent = fs.readFileSync(path.join(root, "src/lib/spotify.ts"), "utf-8");
  assert.ok(
    !spotifyContent.includes("process.env.SPOTIFY_REFRESH_TOKEN"),
    "src/lib/spotify.ts must not reference process.env.SPOTIFY_REFRESH_TOKEN"
  );
});
