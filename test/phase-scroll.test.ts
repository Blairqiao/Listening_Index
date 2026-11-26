import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const readSrc = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

// Period auto-scroll

test("phaseScrollTarget leaves a fully visible range alone", async () => {
  const { phaseScrollTarget } = await import("../src/lib/phase-scroll");
  assert.equal(
    phaseScrollTarget({ rangeTop: 200, rangeBottom: 400, viewportHeight: 800, scrollY: 100, topInset: 60, bottomInset: 0 }),
    null,
  );
});

test("phaseScrollTarget centers a range that fits and aligns a tall one under the sticky bar", async () => {
  const { phaseScrollTarget } = await import("../src/lib/phase-scroll");
  // Visible band is 60..800 (740px). Range 1000..1200 is 200px tall, so it centers: 270px above and below.
  assert.equal(
    phaseScrollTarget({ rangeTop: 1000, rangeBottom: 1200, viewportHeight: 800, scrollY: 0, topInset: 60, bottomInset: 0 }),
    1000 - 60 - 270,
  );
  // Taller than the band: range start sits right under the sticky bar.
  assert.equal(
    phaseScrollTarget({ rangeTop: 1000, rangeBottom: 2000, viewportHeight: 800, scrollY: 50, topInset: 60, bottomInset: 0 }),
    50 + 1000 - 60,
  );
  // Partly hidden behind the bottom inset counts as not visible.
  assert.notEqual(
    phaseScrollTarget({ rangeTop: 600, rangeBottom: 780, viewportHeight: 800, scrollY: 0, topInset: 60, bottomInset: 56 }),
    null,
  );
  // Above the viewport scrolls up and never below 0.
  assert.equal(
    phaseScrollTarget({ rangeTop: -500, rangeBottom: -400, viewportHeight: 800, scrollY: 100, topInset: 60, bottomInset: 0 }),
    0,
  );
});

test("CalendarView scrolls to the highlighted period only for phase card clicks", () => {
  const src = readSrc("src/components/views/CalendarView.tsx");
  assert.match(src, /<TastePhaseCards[\s\S]{0,200}onSelectPhase=\{handleSelectPhaseFromCards\}/);
  assert.ok(src.includes("phaseScrollTarget("));
  assert.ok(src.includes(".calendar-in-range"));
  assert.ok(src.includes("scrollBehavior()"));
});
