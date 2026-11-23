import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readModuleSource } from "./helpers/module-source";
import { presetRange, zoomOutRange, type RangeSelection } from "../src/lib/range";
import { rangeBackTarget, syncDrillStack } from "../src/components/listening-view/useRangeDrillStack";
import { ControlRow } from "../src/components/listening-view/ControlRow";

const win = (from: string, to: string): RangeSelection => ({ kind: "window", from, to });

test("zoomOutRange opens the next calendar unit up", () => {
  assert.deepEqual(zoomOutRange(win("2025-11-12", "2025-11-12")), win("2025-11-01", "2025-11-30"));
  assert.deepEqual(zoomOutRange(win("2025-11-03", "2025-11-09")), win("2025-11-01", "2025-11-30"));
  assert.deepEqual(zoomOutRange(win("2024-02-01", "2024-02-29")), win("2024-01-01", "2024-12-31"));
  assert.deepEqual(zoomOutRange(win("2025-09-29", "2025-10-05")), win("2025-01-01", "2025-12-31"));
  assert.deepEqual(zoomOutRange(win("2025-01-01", "2025-12-31")), presetRange("all"));
  assert.deepEqual(zoomOutRange(win("2025-12-28", "2026-01-03")), presetRange("all"));
  assert.equal(zoomOutRange(presetRange("1y")), null);
});

test("the back target is the range drilled from, else one calendar unit up", () => {
  const day = win("2025-11-12", "2025-11-12");
  assert.deepEqual(rangeBackTarget([presetRange("1w")], day), presetRange("1w"));
  assert.deepEqual(rangeBackTarget([], day), win("2025-11-01", "2025-11-30"));
  assert.equal(rangeBackTarget([presetRange("1w")], presetRange("1w")), null);
});

test("the drill stack trims to the range it returns to and clears on a preset", () => {
  const month = win("2025-11-01", "2025-11-30");
  const day = win("2025-11-12", "2025-11-12");
  const stack = [presetRange("1y"), month];
  assert.deepEqual(syncDrillStack(stack, day), stack, "a deeper window keeps its parents");
  assert.deepEqual(syncDrillStack(stack, month), [presetRange("1y")]);
  assert.deepEqual(syncDrillStack(stack, presetRange("1y")), []);
  assert.deepEqual(syncDrillStack(stack, presetRange("1m")), []);
});

const baseProps = {
  mode: 0 as const,
  onSelectRange: () => {},
  logStartDate: "2025-01-01",
  isSessionOpen: false,
  sessionTagTime: "",
};

test("ControlRow shows a back button beside the window chip", () => {
  const html = renderToStaticMarkup(
    React.createElement(ControlRow, {
      ...baseProps,
      range: win("2025-11-01", "2025-11-30"),
      rangeBack: { target: presetRange("1y"), onBack: () => {} },
    })
  );
  assert.match(html, /<button[^>]*aria-label="Back to 1y"[^>]*>← 1y<\/button>/);
  assert.match(html, /Nov 2025/);
});

test("ControlRow labels a return to the full archive as All", () => {
  const html = renderToStaticMarkup(
    React.createElement(ControlRow, {
      ...baseProps,
      range: win("2025-01-01", "2025-12-31"),
      rangeBack: { target: presetRange("all"), onBack: () => {} },
    })
  );
  assert.match(html, /aria-label="Back to All"/);
});

test("ControlRow shows no back button on a preset", () => {
  const html = renderToStaticMarkup(
    React.createElement(ControlRow, { ...baseProps, range: presetRange("1y"), rangeBack: null })
  );
  assert.doesNotMatch(html, /Back to/);
});

test("ListeningView gives the control row a back target for Overview and profiles", () => {
  const source = readModuleSource(path.resolve(__dirname, "../src/components/ListeningView.tsx"));
  const idx = source.indexOf("<ControlRow");
  assert.match(source.slice(idx, idx + 1500), /rangeBack=\{/);
});
