import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLocalTimezone, isValidIanaTimezone, syncLocalTimezoneCookie } from "../src/lib/timezone-utils";

test("isValidIanaTimezone validates valid and invalid IANA timezone identifiers", () => {
  assert.equal(isValidIanaTimezone("America/Chicago"), true);
  assert.equal(isValidIanaTimezone("Europe/London"), true);
  assert.equal(isValidIanaTimezone("Asia/Tokyo"), true);
  assert.equal(isValidIanaTimezone("UTC"), true);

  assert.equal(isValidIanaTimezone("Not/A/Timezone"), false);
  assert.equal(isValidIanaTimezone(""), false);
  assert.equal(isValidIanaTimezone(undefined), false);
  assert.equal(isValidIanaTimezone(null), false);
});

test("detectLocalTimezone resolves a valid IANA timezone identifier from runtime", () => {
  const detected = detectLocalTimezone();
  assert.ok(typeof detected === "string" && detected.length > 0);
  assert.equal(isValidIanaTimezone(detected), true);
});

test("syncLocalTimezoneCookie sets listening_timezone cookie in document", () => {
  const originalDocument = globalThis.document;
  try {
    let cookieStore = "";
    (globalThis as { document?: unknown }).document = {
      get cookie() {
        return cookieStore;
      },
      set cookie(val: string) {
        cookieStore = val;
      },
    };

    syncLocalTimezoneCookie("America/Chicago");
    assert.match(cookieStore, /listening_timezone=America%2FChicago/);

    syncLocalTimezoneCookie("Invalid/Zone");
    assert.match(cookieStore, /listening_timezone=UTC/);
  } finally {
    (globalThis as { document?: unknown }).document = originalDocument;
  }
});
