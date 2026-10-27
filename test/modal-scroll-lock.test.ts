import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { lockBodyScroll, unlockBodyScroll, getActiveScrollLocksCount } from "../src/lib/scroll-lock";

test("lockBodyScroll and unlockBodyScroll manage body overflow style with reference counting", () => {
  // Mock global document if running in Node environment
  const originalDocument = global.document;
  const mockBody = {
    style: {
      overflow: "",
    },
  };
  // @ts-expect-error Mocking document for unit test
  global.document = { body: mockBody };

  try {
    assert.equal(getActiveScrollLocksCount(), 0);
    assert.equal(document.body.style.overflow, "");

    // 1. First modal locks
    lockBodyScroll();
    assert.equal(getActiveScrollLocksCount(), 1);
    assert.equal(document.body.style.overflow, "hidden");

    // 2. Second modal opens on top (e.g. AdminLoginModal over CustomizationModal)
    lockBodyScroll();
    assert.equal(getActiveScrollLocksCount(), 2);
    assert.equal(document.body.style.overflow, "hidden");

    // 3. Second modal closes
    unlockBodyScroll();
    assert.equal(getActiveScrollLocksCount(), 1);
    assert.equal(document.body.style.overflow, "hidden", "Body must remain locked while first modal is still open");

    // 4. First modal closes
    unlockBodyScroll();
    assert.equal(getActiveScrollLocksCount(), 0);
    assert.equal(document.body.style.overflow, "", "Body overflow must be restored when all modals close");
  } finally {
    global.document = originalDocument;
  }
});

test("CustomizationModal, UploadModal, AdminLoginModal, and AdminSpotifyModal integrate useBodyScrollLock", () => {
  const components = [
    "src/components/modals/customization-modal/CustomizationModal.tsx",
    "src/components/modals/upload-modal/UploadModal.tsx",
    "src/components/modals/admin-login-modal/AdminLoginModal.tsx",
    "src/components/modals/admin-spotify-modal/AdminSpotifyModal.tsx",
  ];

  for (const relPath of components) {
    const fullPath = path.resolve(__dirname, "..", relPath);
    const content = fs.readFileSync(fullPath, "utf-8");
    assert.ok(
      content.includes("useBodyScrollLock"),
      `${relPath} must integrate useBodyScrollLock`
    );
  }
});
