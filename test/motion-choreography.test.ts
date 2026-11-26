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

// Calendar range sweep (removed: it didn't read well)

test("CalendarView picks highlight their range at once, with no sweep", () => {
  const src = readSrc("src/components/views/CalendarView.tsx");
  assert.doesNotMatch(src, /pendingSweepRef|RANGE_SWEEP|staggerDelays/);
  assert.doesNotMatch(readSrc("src/lib/choreography.ts"), /RANGE_SWEEP|staggerDelays/);
});

// First-load entrance

test("intro delays: metrics lead, track rows follow with shrinking gaps, bars grow left to right", async () => {
  const c = await import("../src/lib/choreography");
  assert.deepEqual([0, 1, 2, 3].map(c.metricIntroDelay), [0, 40, 70, 90]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 9].map(c.trackRowIntroDelay), [100, 130, 155, 175, 190, 200, 200, 200]);
  assert.equal(c.INDEX_INTRO_DELAY_MS, 140);
  assert.equal(c.barIntroDelay(0, 28), 120);
  assert.equal(c.barIntroDelay(27, 28), 220);
  assert.ok(c.INTRO_MS >= 220 + 280, "the intro gate outlasts the last bar");
  assert.ok(c.INTRO_MS <= 650);
});

test("intro CSS only runs under [data-intro] and collapses to a plain fade for reduced motion", () => {
  const css = readSrc("src/app/globals.css");
  assert.match(cssBlock(css, "@keyframes intro-rise"), /opacity:\s*0[\s\S]*translate:\s*0 var\(--intro-rise/);
  assert.match(cssBlock(css, "@keyframes intro-grow"), /scale:\s*1 0/);
  assert.match(cssBlock(css, "@keyframes intro-fade"), /opacity:\s*0/);
  for (const cls of ["intro-rise", "intro-row", "intro-fade", "intro-grow"]) {
    const block = cssBlock(css, `[data-intro] .${cls} {`);
    assert.match(block, /var\(--intro-delay, 0ms\)/, `${cls} must read --intro-delay`);
    assert.match(block, /\bboth\b/, `${cls} must hold its start state while delayed`);
  }
  const reduced = css.slice(css.indexOf("/* Reduced motion: the intro"));
  assert.match(reduced.slice(0, 600), /animation-name:\s*intro-fade/);
  assert.match(reduced.slice(0, 600), /animation-delay:\s*0ms/);
});

test("ListeningView flags the first reveal with data-intro and lifts the veil in 200ms", () => {
  const src = readSrc("src/components/ListeningView.tsx");
  assert.match(src, /data-intro=\{isIntroPlaying \? "" : undefined\}/);
  assert.match(src, /INTRO_MS/);
  assert.match(src, /fixed inset-0 z-40[^`]*duration-\[var\(--motion-medium\)\]/);
  assert.doesNotMatch(readSrc("src/app/globals.css"), /--motion-showpiece/);
});

test("intro roles: metric contents rise, track rows rise, indexes fade, bars grow", async () => {
  assert.match(readSrc("src/components/listening-view/MetricRibbon.tsx"), /intro-rise[\s\S]{0,200}metricIntroDelay\(i\)/);
  const overview = readSrc("src/components/views/OverviewView.tsx");
  assert.match(overview, /intro-row[\s\S]{0,300}trackRowIntroDelay\(idx\)/);
  assert.equal((overview.match(/intro-fade/g) ?? []).length, 2, "artist and album indexes fade");
  assert.match(overview, /INDEX_INTRO_DELAY_MS/);

  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ActivityChart } = await import("../src/components/views/ActivityChart");
  const html = renderToStaticMarkup(
    React.createElement(ActivityChart, { granularity: "day", activityCadence: cadence, visitorTimezone: "UTC" }),
  );
  assert.match(html, /\bintro-grow\b/);
  assert.match(html, /--intro-delay:120ms/);
});
