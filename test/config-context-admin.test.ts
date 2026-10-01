import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("ConfigContext - defines and exports admin login modal state controls", () => {
  const contextPath = path.resolve(__dirname, "../src/context/ConfigContext.tsx");
  const source = fs.readFileSync(contextPath, "utf-8");

  assert.match(source, /isAdminLoginModalOpen:\s*boolean;/, "ConfigContextType must declare isAdminLoginModalOpen");
  assert.match(source, /openAdminLoginModal:\s*\(\)\s*=>\s*void;/, "ConfigContextType must declare openAdminLoginModal");
  assert.match(source, /closeAdminLoginModal:\s*\(\)\s*=>\s*void;/, "ConfigContextType must declare closeAdminLoginModal");

  assert.match(source, /const\s*\[isAdminLoginModalOpen,\s*setIsAdminLoginModalOpen\]\s*=\s*useState<boolean>\(false\);/, "Must initialize isAdminLoginModalOpen state to false");
  assert.match(source, /const\s+openAdminLoginModal\s*=\s*useCallback\(\(\)\s*=>\s*setIsAdminLoginModalOpen\(true\),\s*\[\]\);/, "Must define openAdminLoginModal");
  assert.match(source, /const\s+closeAdminLoginModal\s*=\s*useCallback\(\(\)\s*=>\s*setIsAdminLoginModalOpen\(false\),\s*\[\]\);/, "Must define closeAdminLoginModal");
});
