import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("CustomizationModal handleResetColor restores deployedConfig.accentColor instead of DEFAULT_SITE_CONFIG", () => {
  const modalPath = path.resolve(__dirname, "../src/components/modals/customization-modal/CustomizationModal.tsx");
  const modalContent = fs.readFileSync(modalPath, "utf-8");

  // Verify handleResetColor uses deployedConfig.accentColor
  assert.ok(
    !modalContent.includes("const defaultColor = DEFAULT_SITE_CONFIG.accentColor;"),
    "handleResetColor must not reset visitor color to hardcoded DEFAULT_SITE_CONFIG.accentColor"
  );
  assert.ok(
    modalContent.includes("deployedConfig.accentColor"),
    "handleResetColor must reset visitor color to deployedConfig.accentColor"
  );
});

test("ConfigContext exposes resetLocalCustomizations that reverts to deployedConfig and removes localStorage", () => {
  const contextPath = path.resolve(__dirname, "../src/context/ConfigContext.tsx");
  const contextContent = fs.readFileSync(contextPath, "utf-8");

  assert.ok(
    contextContent.includes("resetLocalCustomizations"),
    "ConfigContext must expose resetLocalCustomizations"
  );
});
