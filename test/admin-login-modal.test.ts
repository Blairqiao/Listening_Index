import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("AdminLoginModal - component structure and contract verification", () => {
  const componentPath = path.resolve(__dirname, "../src/components/AdminLoginModal.tsx");
  assert.ok(fs.existsSync(componentPath), "AdminLoginModal.tsx must exist");

  const source = fs.readFileSync(componentPath, "utf-8");

  // Header and title
  assert.match(source, /\[\s*ADMIN AUTHENTICATION\s*\]/, "Modal header must display [ ADMIN AUTHENTICATION ]");

  // Form controls
  assert.match(source, /useConfig/, "Must use useConfig hook");
  assert.match(source, /login\s*\(/, "Must call login method from context");
  assert.match(source, /type=\{showPassword\s*\?\s*["']text["']\s*:\s*["']password["']\}/, "Must support password reveal toggle");
  assert.match(source, /EyeOff/, "Must import EyeOff icon");
  assert.match(source, /Eye/, "Must import Eye icon");
  assert.match(source, /AUTHENTICATING\.\.\./, "Must display authenticating state");
  assert.match(source, /UNLOCK/, "Must display UNLOCK submit label");

  // Accessibility and key handling
  assert.match(source, /role=["']dialog["']/, "Must include role='dialog'");
  assert.match(source, /aria-modal=["']true["']/, "Must include aria-modal='true'");
  assert.match(source, /Escape/, "Must handle Escape key to close");
});
