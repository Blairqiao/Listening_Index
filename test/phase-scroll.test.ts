import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const readSrc = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

// Period auto-scroll

test("phaseScrollTarget leaves a range that is already centered alone", async () => {
  const { phaseScrollTarget } = await import("../src/lib/phase-scroll");
  // Band 60..800, range 200px tall: centered top is 330. Within 24px of it means no scroll.
  assert.equal(
    phaseScrollTarget({ rangeTop: 330, rangeBottom: 530, viewportHeight: 800, scrollY: 100, topInset: 60, bottomInset: 0 }),
    null,
  );
  assert.equal(
    phaseScrollTarget({ rangeTop: 350, rangeBottom: 550, viewportHeight: 800, scrollY: 100, topInset: 60, bottomInset: 0 }),
    null,
  );
});

test("phaseScrollTarget re-centers a visible range that sits off-center", async () => {
  const { phaseScrollTarget } = await import("../src/lib/phase-scroll");
  // Fully visible near the top of the band; centering moves it down by 270 - 140 = 130.
  assert.equal(
    phaseScrollTarget({ rangeTop: 200, rangeBottom: 400, viewportHeight: 800, scrollY: 400, topInset: 60, bottomInset: 0 }),
    400 + 200 - 60 - 270,
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

test("CalendarView centers the highlighted period for phase card and ribbon clicks", () => {
  const src = readSrc("src/components/views/CalendarView.tsx");
  assert.match(src, /<TastePhaseCards[\s\S]{0,200}onSelectPhase=\{handleSelectPhaseAndCenter\}/);
  assert.match(src, /<YearBlock[\s\S]{0,800}onSelectPhase=\{handleSelectPhaseAndCenter\}/);
  assert.ok(!src.includes("handleSelectPhaseFromCards"));
  assert.ok(src.includes("phaseScrollTarget("));
  assert.ok(src.includes(".calendar-in-range"));
  assert.ok(src.includes("scrollBehavior()"));
});
