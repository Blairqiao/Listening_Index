import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BASE_MODES, ADMIN_MODES, getAvailableModes } from "../src/components/ModeTabs";
import { sanitizeActiveMode, getAllowedShortcutKeys } from "../src/components/ListeningView";

test("ModeTabs - unauthenticated mode list contains only modes 0, 1, 2", () => {
  const modes = getAvailableModes(false);
  assert.equal(modes.length, 3, "Unauthenticated user must see exactly 3 tabs");
  assert.deepEqual(
    modes.map((m) => m.id),
    [0, 1, 2],
    "Unauthenticated user must only see modes 0 (Overview), 1 (Stream Log), and 2 (Sessions)"
  );
  assert.equal(
    modes.some((m) => m.id === 3),
    false,
    "Mode 3 (Live Player) must NOT be present when isAuthenticated is false"
  );
  assert.deepEqual(modes, BASE_MODES);
});

test("ModeTabs - authenticated mode list contains all 4 modes (0, 1, 2, 3)", () => {
  const modes = getAvailableModes(true);
  assert.equal(modes.length, 4, "Authenticated admin must see 4 tabs");
  assert.deepEqual(
    modes.map((m) => m.id),
    [0, 1, 2, 3],
    "Authenticated admin must see modes 0, 1, 2, and 3"
  );
  const liveTab = modes.find((m) => m.id === 3);
  assert.ok(liveTab, "Mode 3 tab must exist for authenticated admin");
  assert.equal(liveTab?.label, "[ 4 · LIVE PLAYER ]");
  assert.equal(liveTab?.abbrev, "[ LIVE ]");
  assert.deepEqual(modes, ADMIN_MODES);
});

test("ListeningView - mode selection boundary clamps mode 3 to 0 when unauthenticated", () => {
  assert.equal(
    sanitizeActiveMode(3, false),
    0,
    "Attempting to select mode 3 while unauthenticated must clamp to mode 0"
  );
  assert.equal(
    sanitizeActiveMode(3, true),
    3,
    "Attempting to select mode 3 while authenticated must be allowed"
  );
  assert.equal(sanitizeActiveMode(0, false), 0);
  assert.equal(sanitizeActiveMode(1, false), 1);
  assert.equal(sanitizeActiveMode(2, false), 2);
});

test("ListeningView - keyboard shortcuts restrict key '4' when unauthenticated", () => {
  const unauthKeys = getAllowedShortcutKeys(false);
  assert.deepEqual(
    unauthKeys,
    ["1", "2", "3"],
    "Unauthenticated shortcuts must only allow keys 1, 2, 3"
  );
  assert.equal(
    unauthKeys.includes("4"),
    false,
    "Key '4' must NOT be in allowed shortcuts when unauthenticated"
  );

  const authKeys = getAllowedShortcutKeys(true);
  assert.deepEqual(
    authKeys,
    ["1", "2", "3", "4"],
    "Authenticated shortcuts must allow keys 1, 2, 3, and 4"
  );
  assert.ok(authKeys.includes("4"), "Key '4' must be present when authenticated");
});

test("ModeTabs & ListeningView - source architecture verification", () => {
  const modeTabsSrc = fs.readFileSync(
    path.resolve(__dirname, "../src/components/ModeTabs.tsx"),
    "utf-8"
  );
  assert.match(
    modeTabsSrc,
    /isAuthenticated/,
    "ModeTabs must consume isAuthenticated from useConfig"
  );
  assert.match(
    modeTabsSrc,
    /BASE_MODES/,
    "ModeTabs must define BASE_MODES"
  );
  assert.match(
    modeTabsSrc,
    /ADMIN_MODES/,
    "ModeTabs must define ADMIN_MODES"
  );

  const listeningViewSrc = fs.readFileSync(
    path.resolve(__dirname, "../src/components/ListeningView.tsx"),
    "utf-8"
  );
  assert.match(
    listeningViewSrc,
    /isAuthenticated/,
    "ListeningView must consume isAuthenticated from useConfig"
  );
  assert.match(
    listeningViewSrc,
    /setActiveMode\(0\)/,
    "ListeningView must enforce fallback to mode 0 when unauthenticated"
  );
});
