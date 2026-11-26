import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const readSrc = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

function cssBlock(css: string, selector: string): string {
  const start = css.indexOf(selector);
  assert.notEqual(start, -1, `${selector} must exist in globals.css`);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error(`unterminated block ${selector}`);
}

// Press feedback

test("motion-hover animates the scale property so active:scale-* presses ease instead of snapping", () => {
  const block = cssBlock(readSrc("src/app/globals.css"), "@utility motion-hover");
  assert.match(block, /\bscale var\(--motion-press\)/);
  assert.match(readSrc("src/components/views/TastePhaseCards.tsx"), /motion-hover[^"`]*active:scale-\[0\.99\]/);
});

// Mini player entrance and exit

test("mini player bar slides up on enter and back down on exit, fading instead under reduced motion", async () => {
  const { miniPlayerBarClass, MINI_PLAYER_EXIT_MS } = await import("../src/components/listening-view/mini-player");
  assert.equal(MINI_PLAYER_EXIT_MS, 180);
  const entering = miniPlayerBarClass("entering");
  assert.match(entering, /motion-safe:translate-y-full/);
  assert.match(entering, /motion-reduce:opacity-0/);
  assert.doesNotMatch(entering, /drawer-(enter|exit)/, "the start state must not transition");
  const open = miniPlayerBarClass("open");
  assert.match(open, /\bdrawer-enter\b/);
  assert.doesNotMatch(open, /translate-y-full|opacity-0/);
  const closing = miniPlayerBarClass("closing");
  assert.match(closing, /\bdrawer-exit\b/);
  assert.match(closing, /motion-safe:translate-y-full/);
});

test("drawer transitions use the drawer curve to enter and a shorter ease-out to exit", () => {
  const css = readSrc("src/app/globals.css");
  assert.match(css, /--ease-drawer:\s*cubic-bezier\(0\.32, 0\.72, 0, 1\)/);
  const enter = cssBlock(css, "@utility drawer-enter");
  assert.match(enter, /translate 240ms var\(--ease-drawer\)/);
  assert.match(enter, /opacity 240ms/);
  const exit = cssBlock(css, "@utility drawer-exit");
  assert.match(exit, /translate 180ms var\(--ease-out-strong\)/);
  assert.match(exit, /opacity 180ms/);
});

test("ListeningView keeps the mini player mounted through its exit", () => {
  const src = readSrc("src/components/ListeningView.tsx");
  assert.match(src, /usePresence\(\s*isMiniPlayerOpen,\s*MINI_PLAYER_EXIT_MS\s*\)/);
  assert.match(src, /miniPlayer\.shouldRender && miniPlayerTrack/);
  assert.match(src, /miniPlayerBarClass\(miniPlayer\.phase\)/);
  assert.match(readSrc("src/components/listening-view/MiniPlayerBar.tsx"), /className\?: string/);
});

// Metric value swap

test("changedIndexes lists only the metrics whose text changed", async () => {
  const { changedIndexes } = await import("../src/lib/choreography");
  assert.deepEqual(changedIndexes(["233", "54", "30", "1.0h"], ["233", "61", "30", "1.2h"]), [1, 3]);
  assert.deepEqual(changedIndexes(["1", "2"], ["1", "2"]), []);
});

test("metric swap is a 150ms fade with a 2px blur clearing, and no movement", async () => {
  const { METRIC_SWAP_KEYFRAMES, METRIC_SWAP_TIMING } = await import("../src/lib/choreography");
  assert.deepEqual(METRIC_SWAP_KEYFRAMES[0], { opacity: 0, filter: "blur(2px)" });
  assert.deepEqual(METRIC_SWAP_KEYFRAMES[1], { opacity: 1, filter: "blur(0px)" });
  assert.equal(METRIC_SWAP_TIMING.duration, 150);
  assert.equal(METRIC_SWAP_TIMING.easing, "cubic-bezier(0.23, 1, 0.32, 1)");
  assert.ok(!JSON.stringify(METRIC_SWAP_KEYFRAMES).includes("translate"));
});

test("MetricRibbon plays the swap on values that change, not on mount", () => {
  const src = readSrc("src/components/listening-view/MetricRibbon.tsx");
  assert.match(src, /changedIndexes\(/);
  assert.match(src, /\.animate\(METRIC_SWAP_KEYFRAMES, METRIC_SWAP_TIMING\)/);
});

// Activity bars

const cadence = [
  { date: "2026-11-01", count: 10, startTime: "2026-11-01T00:00:00.000Z", endTime: "2026-11-01T23:59:59.999Z" },
  { date: "2026-11-02", count: 5, startTime: "2026-11-02T00:00:00.000Z", endTime: "2026-11-02T23:59:59.999Z" },
  { date: "2026-11-03", count: 0, startTime: "2026-11-03T00:00:00.000Z", endTime: "2026-11-03T23:59:59.999Z" },
];

test("activity bars size with scaleY from the baseline so a range step can morph them", async () => {
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ActivityChart } = await import("../src/components/views/ActivityChart");
  for (const onSelectBucket of [() => {}, undefined]) {
    const html = renderToStaticMarkup(
      React.createElement(ActivityChart, { granularity: "day", activityCadence: cadence, onSelectBucket, visitorTimezone: "UTC" }),
    );
    assert.match(html, /transform:scaleY\(1\)/);
    assert.match(html, /transform:scaleY\(0\.5\)/);
    assert.match(html, /transform:scaleY\(0\.04\)/, "empty buckets keep the 4% stub");
    assert.doesNotMatch(html, /height:\d+%/);
    assert.match(html, /\bbar-morph\b/);
    assert.match(html, /\borigin-bottom\b/);
  }
});

test("bar-morph eases bar heights over 180ms and keeps the fast hover color", () => {
  const block = cssBlock(readSrc("src/app/globals.css"), "@utility bar-morph");
  assert.match(block, /transform 180ms var\(--ease-out-strong\)/);
  assert.match(block, /background-color var\(--motion-hover\)/);
});

test("the bar container remounts when the bar count changes, so only same-count steps morph", () => {
  const src = readSrc("src/components/views/ActivityChart.tsx");
  assert.match(src, /key=\{activityCadence\.length\}[\s\S]{0,80}ref=\{chartRef\}|ref=\{chartRef\}[\s\S]{0,80}key=\{activityCadence\.length\}/);
});

// Calendar range sweep

test("staggerDelays spreads delays from 0 to the spread with gaps that shrink", async () => {
  const { staggerDelays } = await import("../src/lib/choreography");
  assert.deepEqual(staggerDelays(1, 200), [0]);
  assert.deepEqual(staggerDelays(0, 200), []);
  const d = staggerDelays(6, 200);
  assert.equal(d[0], 0);
  assert.equal(d[d.length - 1], 200);
  const gaps = d.slice(1).map((v, i) => v - d[i]);
  gaps.forEach((g, i) => {
    assert.ok(g > 0, "delays increase");
    if (i > 0) assert.ok(g < gaps[i - 1], "each gap is shorter than the last");
  });
});

test("range sweep lifts cells from the dimmed opacity over 160ms across 200ms", async () => {
  const { RANGE_SWEEP_KEYFRAMES, RANGE_SWEEP_TIMING, RANGE_SWEEP_SPREAD_MS } = await import("../src/lib/choreography");
  assert.deepEqual(RANGE_SWEEP_KEYFRAMES, [{ opacity: 0.4 }, { opacity: 1 }]);
  assert.equal(RANGE_SWEEP_TIMING.duration, 160);
  assert.equal(RANGE_SWEEP_TIMING.fill, "backwards", "cells hold the dim value until their turn");
  assert.equal(RANGE_SWEEP_SPREAD_MS, 200);
});

test("CalendarView sweeps the range on phase, ribbon, month and year picks, never on drag", () => {
  const src = readSrc("src/components/views/CalendarView.tsx");
  for (const handler of ["handleSelectMonth", "handleSelectYear", "handleSelectPhaseAndCenter"]) {
    const start = src.indexOf(`const ${handler} = useCallback(`);
    assert.notEqual(start, -1, handler);
    assert.match(src.slice(start, start + 500), /pendingSweepRef\.current = /, `${handler} must queue a sweep`);
  }
  assert.match(src, /staggerDelays\(/);
  assert.match(src, /\.animate\(RANGE_SWEEP_KEYFRAMES/);
  assert.match(src, /prefersReducedMotion\(\)/);
  const move = src.slice(src.indexOf("const handleWindowPointerMove"), src.indexOf("const handleWindowPointerUp"));
  assert.doesNotMatch(move, /pendingSweepRef/);
});
