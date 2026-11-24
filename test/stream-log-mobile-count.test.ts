import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ControlRow } from "../src/components/listening-view/ControlRow";
import { presetRange } from "../src/lib/range";
import { readModuleSource } from "./helpers/module-source";

test("ControlRow: renders exact count and handles 0 tracks without defaulting to 50", () => {
  // Test count 25
  const markup25 = renderToStaticMarkup(
    React.createElement(ControlRow, {
      mode: 1,
      range: presetRange("all"),
      onSelectRange: () => { },
      firstKey: "2024-08-14",
      todayKey: "2026-11-24",
      logStartDate: "2026-09-04T00:00:00.000Z",
      isSessionOpen: false,
      sessionTagTime: "",
      streamLogCount: 25,
    })
  );

  assert.ok(
    markup25.includes(">Last 25<"),
    "ControlRow must render Last 25 on mobile"
  );
  assert.ok(
    markup25.includes("Last 25 tracks"),
    "ControlRow must render Last 25 tracks on desktop"
  );
  assert.ok(
    markup25.includes("md:hidden") && markup25.includes("hidden md:inline"),
    "ControlRow must use md: breakpoint to match StreamLogView mobile threshold"
  );

  // Test count 0 (empty stream log)
  const markup0 = renderToStaticMarkup(
    React.createElement(ControlRow, {
      mode: 1,
      range: presetRange("all"),
      onSelectRange: () => { },
      firstKey: "2024-08-14",
      todayKey: "2026-11-24",
      logStartDate: "2026-09-04T00:00:00.000Z",
      isSessionOpen: false,
      sessionTagTime: "",
      streamLogCount: 0,
    })
  );

  assert.ok(
    markup0.includes("No tracks"),
    "ControlRow must render No tracks when count is 0 instead of defaulting to 50"
  );
  assert.ok(
    !markup0.includes("Last 50"),
    "ControlRow must not render Last 50 when count is 0"
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
  const listeningViewSource = readModuleSource(path.resolve(__dirname, "../src/components/ListeningView.tsx"));

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
