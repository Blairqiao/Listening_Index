import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("ModeTabs - Compressed action buttons without text labels", () => {
  const componentPath = path.resolve(__dirname, "../src/components/ModeTabs.tsx");
  const source = fs.readFileSync(componentPath, "utf-8");

  // Must not have desktop text names
  assert.doesNotMatch(source, /\[\s*U\s*·\s*UPLOAD\s*\]/, "Must remove [ U · UPLOAD ] text");
  assert.doesNotMatch(source, /\[\s*C\s*·\s*CONFIG\s*\]/, "Must remove [ C · CONFIG ] text");

  // Must render icon-only button format
  assert.match(source, /Menu/, "Must use Menu icon");
  assert.match(source, /Upload/, "Must use Upload icon");
  assert.match(source, /Lock/, "Must use Lock icon");
  assert.match(source, /Unlock/, "Must use Unlock icon");

  // Visibility check: upload button only renders if isAuthenticated
  assert.match(
    source,
    /isAuthenticated\s*&&\s*onOpenUpload/,
    "Upload button must only render when isAuthenticated is true"
  );

  // Admin button actions
  assert.match(source, /openAdminLoginModal/, "Must use openAdminLoginModal when locked");
  assert.match(source, /logout/, "Must call logout when unlocked");
});
