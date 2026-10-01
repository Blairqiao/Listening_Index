import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("CustomizationModal - Polymorphic visitor vs admin mode verification", () => {
  const componentPath = path.resolve(__dirname, "../src/components/CustomizationModal.tsx");
  const source = fs.readFileSync(componentPath, "utf-8");

  // Polymorphic title
  assert.match(source, /isAuthenticated\s*\?\s*["']\[\s*ACTIVE CONFIGURATION\s*\]["']\s*:\s*["']\[\s*APPEARANCE\s*\]["']/, "Must switch title between [ ACTIVE CONFIGURATION ] and [ APPEARANCE ]");

  // Removed in-modal password strip
  assert.doesNotMatch(source, /adminPassword/, "Must remove in-modal adminPassword state");
  assert.doesNotMatch(source, /handleUnlock/, "Must remove handleUnlock");

  // Section gating: Identity, Timezone, and Links only render when isAuthenticated
  assert.match(source, /isAuthenticated\s*&&[\s\S]*?IDENTITY/, "Identity section must only render when isAuthenticated");
  assert.match(source, /isAuthenticated\s*&&[\s\S]*?TIMEZONE/, "Timezone section must only render when isAuthenticated");
  assert.match(source, /isAuthenticated\s*&&[\s\S]*?LINKS/, "Links section must only render when isAuthenticated");

  // Accent Color section is always rendered
  assert.match(source, /ColorPicker/, "ColorPicker must always be present");

  // Visitor footer actions
  assert.match(source, /RESET COLOR/, "Must provide RESET COLOR button for visitors");
  assert.match(source, /SAVE LOCALLY/, "Must provide SAVE LOCALLY button for visitors");
});
