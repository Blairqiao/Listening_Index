import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("UploadModal - Decoupled from inline authentication challenges", () => {
  const componentPath = path.resolve(__dirname, "../src/components/UploadModal.tsx");
  const source = fs.readFileSync(componentPath, "utf-8");

  // Removed password challenge state and logic
  assert.doesNotMatch(source, /passwordInput/, "Must remove passwordInput state");
  assert.doesNotMatch(source, /handleAuthenticate/, "Must remove handleAuthenticate");
  assert.doesNotMatch(source, /handleLogout/, "Must remove in-modal handleLogout");
  assert.doesNotMatch(source, /PROTECTED REPOSITORY ACTION/, "Must remove unauthenticated protected warning banner");

  // Dropzone and progress states remain intact
  assert.match(source, /processFiles/, "Must retain processFiles");
  assert.match(source, /DATABASE ENRICHMENT STATUS/, "Must retain database enrichment status");
  assert.match(source, /accept=["']\.zip,\.json["']/, "Must accept .zip and .json files");
});
