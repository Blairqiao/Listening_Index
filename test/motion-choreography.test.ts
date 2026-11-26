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
