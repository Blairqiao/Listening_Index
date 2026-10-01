import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("ListeningView - Modal integration and keyboard routing", () => {
  const componentPath = path.resolve(__dirname, "../src/components/ListeningView.tsx");
  const source = fs.readFileSync(componentPath, "utf-8");

  // AdminLoginModal mounted
  assert.match(source, /<AdminLoginModal\s*\/>/, "ListeningView must mount <AdminLoginModal />");

  // Keyboard shortcut L triggers admin auth
  assert.match(
    source,
    /(e\.key === ["']l["'] \|\| e\.key === ["']L["'])/,
    "Must listen for key L to toggle admin auth"
  );

  // Key U is strictly gated behind isAuthenticated
  assert.match(
    source,
    /if\s*\(\(e\.key === ["']u["'] \|\| e\.key === ["']U["']\)\s*&&\s*isAuthenticated\)/,
    "Key U must strictly require isAuthenticated"
  );

  // Reset upload modal on logout
  assert.match(
    source,
    /if\s*\(!isAuthenticated\)\s*\{\s*setIsUploadModalOpen\(false\);/,
    "Must close upload modal when unauthenticated"
  );
});
