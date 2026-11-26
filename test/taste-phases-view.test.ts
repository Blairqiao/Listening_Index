import { test } from "node:test";
import assert from "node:assert/strict";
import type { TastePhasesData, TastePhase } from "../src/lib/taste/types";
import {
  hasTastePhases,
  clampTasteLevel,
  phasesAtLevel,
  shiftAtLevel,
  visibleGaps,
  tasteRow,
  phaseSelection,
  selectedPhaseId,
  tasteLevelLabel,
  desktopRibbon,
  mobileRibbon,
} from "../src/lib/taste/view";

function makePhase(
  start: string,
  end: string,
  minK: number,
  maxK: number,
  plays: number,
  topArtist: string,
): TastePhase {
  return {
    id: `${start}_${end}`,
    start,
    end,
    minK,
    maxK,
    plays,
    topArtists: [
      { name: topArtist, plays: Math.round(plays * 0.4), share: 0.4 },
      { name: "Artist B", plays: Math.round(plays * 0.25), share: 0.25 },
      { name: "Artist C", plays: Math.round(plays * 0.15), share: 0.15 },
    ],
    inShift: false,
  };
}

// Nested 2-era / 4-phase fixture with leading, interior (9w), and trailing gaps.
// 2024 Jan 1 is Monday (dow 1), leap year (366 days, last col 52).
// 2025 Jan 1 is Wednesday (dow 3), non-leap (365 days, last col 52).
const FIXTURE: TastePhasesData = {
  timezone: "UTC",
  analyzedWeeks: 70,
  kEra: 2,
  kFine: 4,
  phases: [
    // Deliberately out of chronological order to verify sorting by start.
    makePhase("2025-05-25", "2025-12-27", 4, 4, 900, "Artist E"),
    makePhase("2024-06-02", "2025-12-27", 1, 1, 4200, "Artist A"),
    makePhase("2025-02-09", "2025-12-27", 2, 3, 2100, "Artist D"),
    makePhase("2024-11-03", "2025-02-08", 3, 4, 1100, "Artist B"),
    makePhase("2024-06-02", "2025-02-08", 2, 2, 2100, "Artist A"),
    makePhase("2024-06-02", "2024-08-31", 3, 4, 1000, "Artist A"),
    makePhase("2025-02-09", "2025-05-24", 4, 4, 1200, "Artist D"),
  ],
  shifts: [
    {
      week: "2025-02-09",
      minK: 2,
      levels: [
        { k: 2, kind: "gradual", widthWeeks: 6, rampStart: "2025-01-19", rampEnd: "2025-03-01" },
        { k: 3, kind: "gradual", widthWeeks: 6, rampStart: "2025-01-19", rampEnd: "2025-03-01" },
        { k: 4, kind: "sharp", widthWeeks: 2, rampStart: "2025-02-02", rampEnd: "2025-02-15" },
      ],
    },
    {
      week: "2024-11-03",
      minK: 3,
      levels: [
        { k: 3, kind: "sharp", widthWeeks: 1, rampStart: "2024-11-03", rampEnd: "2024-11-09" },
        { k: 4, kind: "sharp", widthWeeks: 1, rampStart: "2024-11-03", rampEnd: "2024-11-09" },
      ],
    },
    {
      week: "2025-05-25",
      minK: 4,
      levels: [
        { k: 4, kind: "sharp", widthWeeks: 1, rampStart: "2025-05-25", rampEnd: "2025-05-31" },
      ],
    },
  ],
  gaps: [
    { start: "2024-01-07", end: "2024-03-02" }, // leading: before first phase
    { start: "2024-09-01", end: "2024-11-02" }, // interior: 9 weeks
    { start: "2026-01-04", end: "2026-02-28" }, // trailing: after last phase
  ],
};

test("phasesAtLevel returns nested phases sorted by start with count equal to k", () => {
  const era = phasesAtLevel(FIXTURE, 2);
  assert.equal(era.length, 2);
  assert.deepEqual(
    era.map((p) => p.id),
    ["2024-06-02_2025-02-08", "2025-02-09_2025-12-27"],
  );

  const mid = phasesAtLevel(FIXTURE, 3);
  assert.equal(mid.length, 3);
  assert.deepEqual(
    mid.map((p) => p.id),
    ["2024-06-02_2024-08-31", "2024-11-03_2025-02-08", "2025-02-09_2025-12-27"],
  );

  const fine = phasesAtLevel(FIXTURE, 4);
  assert.equal(fine.length, 4);
  assert.deepEqual(
    fine.map((p) => p.id),
    [
      "2024-06-02_2024-08-31",
      "2024-11-03_2025-02-08",
      "2025-02-09_2025-05-24",
      "2025-05-25_2025-12-27",
    ],
  );
});

test("clampTasteLevel defaults null and out-of-range values to kEra and preserves in-range values", () => {
  assert.equal(clampTasteLevel(FIXTURE, null), 2);
  assert.equal(clampTasteLevel(FIXTURE, FIXTURE.kEra - 1), 2);
  assert.equal(clampTasteLevel(FIXTURE, FIXTURE.kFine + 1), 2);
  assert.equal(clampTasteLevel(FIXTURE, 2), 2);
  assert.equal(clampTasteLevel(FIXTURE, 3), 3);
  assert.equal(clampTasteLevel(FIXTURE, 4), 4);
});

test("hasTastePhases returns false for null and kFine <= 1, true otherwise", () => {
  assert.equal(hasTastePhases(null), false);
  assert.equal(
    hasTastePhases({
      ...FIXTURE,
      kEra: 1,
      kFine: 1,
      phases: [makePhase("2024-06-02", "2025-12-27", 1, 1, 500, "Artist A")],
      shifts: [],
      gaps: [],
    }),
    false,
  );
  assert.equal(hasTastePhases(FIXTURE), true);
});

test("visibleGaps drops leading and trailing gaps and keeps interior gaps", () => {
  const gaps = visibleGaps(FIXTURE);
  assert.deepEqual(gaps, [{ start: "2024-09-01", end: "2024-11-02" }]);
});

test("tasteRow inserts interior gaps with week count, sets first shiftIn null, and tracks gradual vs sharp per level", () => {
  const row3 = tasteRow(FIXTURE, 3);
  assert.equal(row3.length, 4);

  // Item 0: first phase
  assert.equal(row3[0].kind, "phase");
  if (row3[0].kind === "phase") {
    assert.equal(row3[0].phase.id, "2024-06-02_2024-08-31");
    assert.equal(row3[0].tone, "a");
    assert.equal(row3[0].shiftIn, null);
  }

  // Item 1: interior gap (2024-09-01 .. 2024-11-02 = 63 days = 9 weeks)
  assert.equal(row3[1].kind, "gap");
  if (row3[1].kind === "gap") {
    assert.deepEqual(row3[1].gap, { start: "2024-09-01", end: "2024-11-02" });
    assert.equal(row3[1].weeks, 9);
  }

  // Item 2: second phase (sharp shift)
  assert.equal(row3[2].kind, "phase");
  if (row3[2].kind === "phase") {
    assert.equal(row3[2].phase.id, "2024-11-03_2025-02-08");
    assert.equal(row3[2].tone, "b");
    assert.equal(row3[2].shiftIn?.kind, "sharp");
  }

  // Item 3: third phase (gradual shift at level 3)
  assert.equal(row3[3].kind, "phase");
  if (row3[3].kind === "phase") {
    assert.equal(row3[3].phase.id, "2025-02-09_2025-12-27");
    assert.equal(row3[3].tone, "a");
    assert.equal(row3[3].shiftIn?.kind, "gradual");
    assert.equal(row3[3].shiftIn?.widthWeeks, 6);
  }

  // At level 4, the 2025-02-09 boundary is sharp instead of gradual
  const row4 = tasteRow(FIXTURE, 4);
  const febPhase = row4.find(
    (item) => item.kind === "phase" && item.phase.start === "2025-02-09",
  );
  assert.ok(febPhase && febPhase.kind === "phase");
  assert.equal(febPhase.shiftIn?.kind, "sharp");
  assert.equal(shiftAtLevel(FIXTURE, "2025-02-09", 3)?.kind, "gradual");
  assert.equal(shiftAtLevel(FIXTURE, "2025-02-09", 4)?.kind, "sharp");
  assert.equal(shiftAtLevel(FIXTURE, "2024-11-03", 2), null);
});

test("selectedPhaseId matches only exact phase boundaries", () => {
  const phases = phasesAtLevel(FIXTURE, 3);
  const target = phases[1];
  assert.deepEqual(phaseSelection(target), { from: "2024-11-03", to: "2025-02-08" });
  assert.equal(selectedPhaseId(phases, phaseSelection(target)), target.id);
  assert.equal(selectedPhaseId(phases, { from: "2024-11-04", to: "2025-02-08" }), null);
  assert.equal(selectedPhaseId(phases, { from: "2024-11-03", to: "2025-02-07" }), null);
  assert.equal(selectedPhaseId(phases, null), null);
});

test("desktopRibbon computes hand-verified columns across year boundaries, drops non-overlapping years, and orders pieces", () => {
  // Year 2024 at level 3:
  // Jan 1 2024 is Mon (dow=1), leap year (366 days, last col = floor((1+365)/7) = 52).
  // Phase 1a: 2024-06-02 (dayOfYear0 = 31+29+31+30+31+1 = 153) -> col floor((1+153)/7) = 22
  //           2024-08-31 (dayOfYear0 = 153+90 = 243) -> col floor((1+243)/7) = 34
  // Gap:      2024-09-01 (dayOfYear0 = 244) -> col floor((1+244)/7) = 35
  //           2024-11-02 (dayOfYear0 = 306) -> col floor((1+306)/7) = 43
  // Phase 1b: 2024-11-03 (dayOfYear0 = 307) -> col floor((1+307)/7) = 44
  //           clipped to 2024-12-31 -> col 52
  const r2024 = desktopRibbon(2024, FIXTURE, 3);
  assert.deepEqual(r2024, [
    { kind: "phase", colStart: 22, colEnd: 34, phaseId: "2024-06-02_2024-08-31", tone: "a" },
    { kind: "phase", colStart: 44, colEnd: 52, phaseId: "2024-11-03_2025-02-08", tone: "b" },
    { kind: "gap", colStart: 35, colEnd: 43 },
  ]);

  // Year 2025 at level 3:
  // Jan 1 2025 is Wed (dow=3), non-leap (365 days, last col = floor((3+364)/7) = 52).
  // Phase 1b: clipped 2025-01-01 (col 0) .. 2025-02-08 (dayOfYear0=38, col floor((3+38)/7)=5)
  // Phase 2:  2025-02-09 (dayOfYear0=39, col 6) .. 2025-12-27 (dayOfYear0=360, col floor((3+360)/7)=51)
  // Gradual ramp at 2025-02-09: 2025-01-19 (dayOfYear0=18, col 3) .. 2025-03-01 (dayOfYear0=59, col 8)
  const r2025 = desktopRibbon(2025, FIXTURE, 3);
  assert.deepEqual(r2025, [
    { kind: "phase", colStart: 0, colEnd: 5, phaseId: "2024-11-03_2025-02-08", tone: "b" },
    { kind: "phase", colStart: 6, colEnd: 51, phaseId: "2025-02-09_2025-12-27", tone: "a" },
    {
      kind: "ramp",
      colStart: 3,
      colEnd: 8,
      from: "2024-11-03_2025-02-08",
      to: "2025-02-09_2025-12-27",
    },
  ]);

  // Year with no overlapping phases or visible gaps produces empty ribbon
  assert.deepEqual(desktopRibbon(2023, FIXTURE, 3), []);
  assert.deepEqual(desktopRibbon(2026, FIXTURE, 3), []);
});

test("mobileRibbon computes month-fraction percentages accurately", () => {
  // 2025 at level 4:
  // Phase 1b clipped to 2025 starts at 2025-01-01 -> leftPct = 0
  // Phase 2b starts at 2025-05-25 -> leftPct = (4 + 24/31) / 12 * 100
  const r2025 = mobileRibbon(2025, FIXTURE, 4);
  const pStartJan1 = r2025.find((p) => p.phaseId === "2024-11-03_2025-02-08");
  assert.ok(pStartJan1);
  assert.equal(pStartJan1.leftPct, 0);

  const pMay25 = r2025.find((p) => p.phaseId === "2025-05-25_2025-12-27");
  assert.ok(pMay25);
  assert.ok(Math.abs(pMay25.leftPct - ((4 + 24 / 31) / 12) * 100) < 1e-9);

  // 2024 at level 3:
  // Phase 1b ends on 2025-02-08, so in 2024 it clips to 2024-12-31 -> leftPct + widthPct === 100
  const r2024 = mobileRibbon(2024, FIXTURE, 3);
  const pEndDec31 = r2024.find((p) => p.phaseId === "2024-11-03_2025-02-08");
  assert.ok(pEndDec31);
  assert.ok(Math.abs(pEndDec31.leftPct + pEndDec31.widthPct - 100) < 1e-9);

  // Also test an exact 2025-12-31 end date
  const endDec31Data: TastePhasesData = {
    ...FIXTURE,
    kEra: 2,
    kFine: 2,
    phases: [
      makePhase("2025-01-01", "2025-06-30", 2, 2, 500, "Artist A"),
      makePhase("2025-07-01", "2025-12-31", 2, 2, 500, "Artist B"),
    ],
    shifts: [],
    gaps: [],
  };
  const rFull = mobileRibbon(2025, endDec31Data, 2);
  assert.equal(rFull[0].leftPct, 0);
  assert.ok(Math.abs(rFull[1].leftPct + rFull[1].widthPct - 100) < 1e-9);
});

test("tasteLevelLabel formats Taste Eras at kEra and Taste Phases at other levels", () => {
  const fiveToTwelve: TastePhasesData = {
    ...FIXTURE,
    kEra: 5,
    kFine: 12,
  };
  assert.equal(tasteLevelLabel(fiveToTwelve, 5), "5 Taste Eras");
  assert.equal(tasteLevelLabel(fiveToTwelve, 12), "12 Taste Phases");
  assert.equal(tasteLevelLabel(fiveToTwelve, 8), "8 Taste Phases");
});
