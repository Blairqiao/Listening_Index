import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ControlRow } from "../src/components/listening-view/ControlRow";

test("ControlRow: renders exact count and handles 0 tracks without defaulting to 50", () => {
  // Test count 25
  const markup25 = renderToStaticMarkup(
    React.createElement(ControlRow, {
      mode: 1,
      range: "all",
      onSelectRange: () => { },
      logStartDate: "2026-09-04T00:00:00.000Z",
      isSessionOpen: false,
      sessionTagTime: "",
      streamLogCount: 25,
    })
  );

  assert.ok(
    markup25.includes("[ LAST 25 ]"),
    "ControlRow must render [ LAST 25 ] on mobile"
  );
  assert.ok(
    markup25.includes("[ LAST 25 TRACKS ]"),
    "ControlRow must render [ LAST 25 TRACKS ] on desktop"
  );
  assert.ok(
    markup25.includes("md:hidden") && markup25.includes("hidden md:inline"),
    "ControlRow must use md: breakpoint to match StreamLogView mobile threshold"
  );

  // Test count 0 (empty stream log)
  const markup0 = renderToStaticMarkup(
    React.createElement(ControlRow, {
      mode: 1,
      range: "all",
      onSelectRange: () => { },
      logStartDate: "2026-09-04T00:00:00.000Z",
      isSessionOpen: false,
      sessionTagTime: "",
      streamLogCount: 0,
    })
  );

  assert.ok(
    markup0.includes("[ NO TRACKS ]"),
    "ControlRow must render [ NO TRACKS ] when count is 0 instead of defaulting to 50"
  );
  assert.ok(
    !markup0.includes("[ LAST 50 ]"),
    "ControlRow must not render [ LAST 50 ] when count is 0"
  );
});

test("StreamLogView: declares onVisibleCountChange prop and notifies of visible track count", () => {
  const streamLogSource = fs.readFileSync(
    path.resolve(__dirname, "../src/components/views/StreamLogView.tsx"),
    "utf-8"
  );

  assert.ok(
    streamLogSource.includes("onVisibleCountChange"),
    "StreamLogView must declare and accept onVisibleCountChange prop"
  );
  assert.ok(
    streamLogSource.includes("onVisibleCountChange?.(renderedEntries.length)"),
    "StreamLogView must emit renderedEntries.length via onVisibleCountChange"
  );
});

test("ListeningView: passes visibleStreamLogCount to ControlRow and wires onVisibleCountChange", () => {
  const listeningViewSource = fs.readFileSync(
    path.resolve(__dirname, "../src/components/ListeningView.tsx"),
    "utf-8"
  );

  assert.ok(
    listeningViewSource.includes("visibleStreamLogCount"),
    "ListeningView must maintain visibleStreamLogCount state"
  );
  assert.ok(
    listeningViewSource.includes("streamLogCount={visibleStreamLogCount"),
    "ListeningView must pass visibleStreamLogCount to ControlRow"
  );
  assert.ok(
    listeningViewSource.includes("onVisibleCountChange={setVisibleStreamLogCount}"),
    "ListeningView must wire setVisibleStreamLogCount to StreamLogView"
  );
});
