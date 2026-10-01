import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ControlRow } from "../src/components/ControlRow";

test("ControlRow - Mode 3 contract for page-level Live Player controls", () => {
  assert.equal(typeof ControlRow, "function", "ControlRow must be a React functional component");

  const controlRowPath = path.resolve(__dirname, "../src/components/ControlRow.tsx");
  const source = fs.readFileSync(controlRowPath, "utf-8");

  // 1. Mode 3 must render the 3 deck control buttons in the right slot (not null)
  assert.doesNotMatch(
    source,
    /case 3:\s*\n\s*\/\/[^\n]*\n\s*return null;/,
    "ControlRow Mode 3 must not return null for controls"
  );

  // 2. Must render Layout toggle button in Mode 3
  assert.match(
    source,
    /LAYOUT:\s*STACKED/,
    "ControlRow must render layout toggle button for Mode 3"
  );
  assert.match(
    source,
    /LAYOUT:\s*SPLIT/,
    "ControlRow must render split layout label for Mode 3"
  );

  // 3. Must render Visualizer audio mode toggle (Synthetic vs Real Live audio)
  assert.match(
    source,
    /LIVE AUDIO/,
    "ControlRow must render live audio button for Mode 3"
  );
  assert.match(
    source,
    /SYNTHETIC/,
    "ControlRow must render synthetic audio button for Mode 3"
  );

  // 4. Must render Link / Unlink button
  assert.match(
    source,
    /UNLINK/,
    "ControlRow must render unlink button when linked in Mode 3"
  );
  assert.match(
    source,
    /LINK/,
    "ControlRow must render link button when unlinked in Mode 3"
  );
});

test("ListeningView - wires ControlRow with Mode 3 layout, sourceMode, and link props", () => {
  const listeningViewPath = path.resolve(__dirname, "../src/components/ListeningView.tsx");
  const source = fs.readFileSync(listeningViewPath, "utf-8");

  assert.match(
    source,
    /<ControlRow[\s\S]*?layout=\{[\s\S]*?onToggleLayout=\{[\s\S]*?sourceMode=\{[\s\S]*?onToggleSourceMode=\{/,
    "ListeningView must pass layout and sourceMode props and handlers to ControlRow"
  );
});
