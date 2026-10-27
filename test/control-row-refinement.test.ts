import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { formatStreamLogDateSpan } from "../src/lib/format-utils";

test("formatStreamLogDateSpan formats date ranges correctly", () => {
  // 1. Multi-day span
  const span = formatStreamLogDateSpan(
    "2026-10-24T10:00:00.000Z",
    "2026-10-26T22:00:00.000Z",
    "UTC"
  );
  assert.equal(span, "24 OCT – 26 OCT");

  // 2. Same-day entries
  const sameDay = formatStreamLogDateSpan(
    "2026-10-26T08:00:00.000Z",
    "2026-10-26T22:00:00.000Z",
    "UTC"
  );
  assert.equal(sameDay, "26 OCT");

  // 3. Fallbacks
  assert.equal(formatStreamLogDateSpan(undefined, undefined), "STREAM LOG");
});

test("ControlRow component supports dynamic scope labels for Stream Log, Sessions, and Live Player", () => {
  const controlRowPath = path.resolve(__dirname, "../src/components/ControlRow.tsx");
  const content = fs.readFileSync(controlRowPath, "utf-8");

  // Mode 1: uses dateSpan / streamLogDateSpan
  assert.ok(
    content.includes("dateSpan") || content.includes("streamLogDateSpan"),
    "ControlRow must accept streamLogDateSpan or dateSpan prop for Mode 1"
  );

  // Mode 2: renders session index/total (e.g. SESSION 01 / 20)
  assert.ok(
    content.includes("sessionIndex") || content.includes("sessionNumber"),
    "ControlRow must accept session index or session number prop for Mode 2"
  );

  // Mode 3: renders device telemetry
  assert.ok(
    content.includes("activeDevice") || content.includes("deviceName"),
    "ControlRow must accept activeDevice or deviceName prop for Mode 3"
  );

  // Mode 3 layout button hidden on mobile (< md)
  assert.ok(
    content.includes("hidden md:flex"),
    "ControlRow must hide layout controls on mobile viewports"
  );
});

test("LivePlayerView houses context selector inside playback controls without redundant middle device band", () => {
  const livePlayerPath = path.resolve(__dirname, "../src/components/LivePlayerView.tsx");
  const content = fs.readFileSync(livePlayerPath, "utf-8");

  // Must not have the old separate "Device & Playback Context Row"
  assert.ok(
    !content.includes("Device & Playback Context Row"),
    "LivePlayerView must remove redundant middle device & context row"
  );

  // Must render context selector in transport/controls area
  assert.ok(
    content.includes("selectContext"),
    "LivePlayerView must preserve selectContext"
  );
});
