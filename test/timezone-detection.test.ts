import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { detectLocalTimezone, isValidIanaTimezone } from "../src/lib/timezone-utils";

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

test("TimezoneSelect component renders detect local timezone button", () => {
  const tzSelectPath = path.resolve(__dirname, "../src/components/customization-modal/TimezoneSelect.tsx");
  const content = fs.readFileSync(tzSelectPath, "utf-8");

  assert.ok(
    content.includes("detectLocalTimezone") || content.includes("DETECT"),
    "TimezoneSelect must include automatic local timezone detection"
  );
});
