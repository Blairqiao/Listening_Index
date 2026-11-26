import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTastePhases } from "../src/lib/taste";
import type { WeekArtistRow } from "../src/lib/taste/types";
import {
  addDaysUtc,
  assertTasteInvariants,
  buildGapScenarios,
  buildScenarios,
  parseDateUtc,
  weekDate,
  weeksPlaysToRows,
} from "./helpers/taste-scenarios";

const START_SUNDAY = "2020-01-05";

function weekIndexFromDate(week: string): number {
  return Math.round((parseDateUtc(week) - parseDateUtc(START_SUNDAY)) / (7 * 86_400_000));
}

function assertBoundsMatch(actualWeeks: string[], expectedIndices: number[], label: string): void {
  assert.equal(
    actualWeeks.length,
    expectedIndices.length,
    `${label}: expected ${expectedIndices.length} boundaries, got ${actualWeeks.length} (${actualWeeks.join(", ")})`
  );
  const actualIndices = actualWeeks.map(weekIndexFromDate);
  for (let i = 0; i < expectedIndices.length; i++) {
    const diff = Math.abs(actualIndices[i] - expectedIndices[i]);
    assert.ok(
      diff <= 2,
      `${label}: boundary ${i} at week ${actualIndices[i]} differs from ${expectedIndices[i]} by ${diff} (> 2)`
    );
  }
}

for (const seed of [7, 8, 9, 10]) {
  const scenarios = buildScenarios(seed);
  const byName = new Map(scenarios.map((s) => [s.name, s]));

  test(`sharp-5 (seed ${seed}): kFine=5, kEra=5, sharp shifts`, () => {
    const sc = byName.get("sharp-5")!;
    const data = computeTastePhases(weeksPlaysToRows(sc.weeksPlays, START_SUNDAY), "UTC");
    assertTasteInvariants(data);
    assert.equal(data.kFine, 5);
    assert.equal(data.kEra, 5);
    assertBoundsMatch(
      data.shifts.map((s) => s.week),
      sc.trueBounds,
      `sharp-5#${seed}`
    );
    for (const shift of data.shifts) {
      for (const lvl of shift.levels) {
        assert.equal(lvl.kind, "sharp");
      }
    }
  });

  test(`nested-5/12 (seed ${seed}): kFine=12, kEra=5, exact nesting`, () => {
    const sc = byName.get("nested-5/12")!;
    const data = computeTastePhases(weeksPlaysToRows(sc.weeksPlays, START_SUNDAY), "UTC");
    assertTasteInvariants(data);
    assert.equal(data.kFine, 12);
    assert.equal(data.kEra, 5);
    assertBoundsMatch(
      data.shifts.map((s) => s.week),
      sc.trueBounds,
      `nested-fine#${seed}`
    );
    assertBoundsMatch(
      data.shifts.filter((s) => s.minK <= data.kEra).map((s) => s.week),
      sc.coarseBounds!,
      `nested-era#${seed}`
    );
    for (const shift of data.shifts) {
      for (const lvl of shift.levels) {
        assert.equal(lvl.kind, "sharp");
      }
    }
  });

  test(`gradual-4 (seed ${seed}): kEra=4, gradual ramp width 4..8, bridge phases inShift`, () => {
    const sc = byName.get("gradual-4")!;
    const data = computeTastePhases(weeksPlaysToRows(sc.weeksPlays, START_SUNDAY), "UTC");
    assertTasteInvariants(data);
    assert.equal(data.kEra, 4);

    const eraShifts = data.shifts.filter((s) => s.minK <= data.kEra);
    assertBoundsMatch(
      eraShifts.map((s) => s.week),
      sc.trueBounds,
      `gradual-4#${seed}`
    );

    for (const shift of eraShifts) {
      const atEra = shift.levels.find((l) => l.k === data.kEra);
      assert.ok(atEra, `shift ${shift.week} must have level k=${data.kEra}`);
      assert.equal(atEra.kind, "gradual");
      assert.ok(
        atEra.widthWeeks >= 4 && atEra.widthWeeks <= 8,
        `expected gradual width in [4, 8], got ${atEra.widthWeeks} (seed ${seed}, week ${shift.week})`
      );
    }

    const finePhases = data.phases.filter(
      (p) => p.minK <= data.kFine && data.kFine <= p.maxK
    );
    const inShiftPhases = finePhases.filter((p) => p.inShift);
    assert.equal(
      inShiftPhases.length,
      sc.trueBounds.length,
      `expected ${sc.trueBounds.length} bridge phases with inShift=true on seed ${seed}`
    );
    for (const center of sc.trueBounds) {
      const match = inShiftPhases.find((p) => {
        const startIdx = weekIndexFromDate(p.start);
        const endIdx = weekIndexFromDate(addDaysUtc(p.end, -6));
        return startIdx <= center + 2 && endIdx >= center - 2;
      });
      assert.ok(match, `expected a bridge phase with inShift=true near week ${center}`);
    }
  });

  test(`light-5 (seed ${seed}): kFine=5 at 25 Plays per week`, () => {
    const sc = byName.get("light-5(25p)")!;
    const data = computeTastePhases(weeksPlaysToRows(sc.weeksPlays, START_SUNDAY), "UTC");
    assertTasteInvariants(data);
    assert.equal(data.kFine, 5);
    assertBoundsMatch(
      data.shifts.map((s) => s.week),
      sc.trueBounds,
      `light-5#${seed}`
    );
  });

  test(`eclectic-1 & binges-1 (seed ${seed}): stationary listeners stay K=1`, () => {
    for (const name of ["eclectic-1", "binges-1"] as const) {
      const sc = byName.get(name)!;
      const data = computeTastePhases(weeksPlaysToRows(sc.weeksPlays, START_SUNDAY), "UTC");
      assertTasteInvariants(data);
      assert.equal(data.kFine, 1, `${name}#${seed} must have kFine=1`);
      assert.equal(data.kEra, 1, `${name}#${seed} must have kEra=1`);
      assert.equal(data.shifts.length, 0);
      assert.equal(data.phases.length, 1);
    }
  });
}

test("gap scenarios preserve era continuity and compute gap/phase end dates", () => {
  for (const sc of buildGapScenarios(11)) {
    const data = computeTastePhases(weeksPlaysToRows(sc.weeksPlays, START_SUNDAY), "UTC");
    assertTasteInvariants(data);

    assert.deepEqual(
      data.gaps.map(({ start, end }) => ({ start, end })),
      sc.expectedGaps.map((g) => ({
        start: weekDate(g.startIdx, START_SUNDAY),
        end: addDaysUtc(weekDate(g.endIdx, START_SUNDAY), 6),
      })),
      `${sc.name}: unexpected gaps`
    );

    assertBoundsMatch(
      data.shifts.map((s) => s.week),
      sc.trueBounds,
      sc.name
    );

    if (sc.expectPhaseEndsAtGap) {
      const firstPhase = data.phases.find(
        (p) => p.minK <= data.kFine && data.kFine <= p.maxK && p.start === weekDate(0, START_SUNDAY)
      );
      assert.ok(firstPhase);
      assert.equal(firstPhase.end, addDaysUtc(weekDate(59, START_SUNDAY), 6));
      assert.equal(data.shifts[0].week, weekDate(80, START_SUNDAY));
    }

    // No active phase at any level may overlap any gap
    for (const phase of data.phases) {
      for (const gap of data.gaps) {
        assert.ok(
          phase.end < gap.start || phase.start > gap.end,
          `${sc.name}: phase ${phase.id} must not overlap gap ${gap.start}..${gap.end}`
        );
      }
    }
  }
});

test("short active islands (< MIN_PHASE_WEEKS) between two gaps merge into one continuous gap", () => {
  const rows: WeekArtistRow[] = [];
  // 20w active A, 6w low (5 plays/wk), 2w active island (20 plays/wk), 24w zero, 20w active B
  for (let w = 0; w < 20; w++) {
    rows.push({ week: weekDate(w, START_SUNDAY), artistKey: "a", artistName: "Artist A", plays: 40 });
  }
  for (let w = 20; w < 26; w++) {
    rows.push({ week: weekDate(w, START_SUNDAY), artistKey: "a", artistName: "Artist A", plays: 5 });
  }
  for (let w = 26; w < 28; w++) {
    rows.push({ week: weekDate(w, START_SUNDAY), artistKey: "m", artistName: "Artist M", plays: 20 });
  }
  // weeks 28..51 have 0 plays
  for (let w = 52; w < 72; w++) {
    rows.push({ week: weekDate(w, START_SUNDAY), artistKey: "b", artistName: "Artist B", plays: 40 });
  }

  const data = computeTastePhases(rows, "UTC");
  assertTasteInvariants(data);
  assert.equal(data.gaps.length, 1, "flanking gaps around a <4w island must merge into one gap");
  assert.equal(data.gaps[0].start, weekDate(20, START_SUNDAY));
  assert.equal(data.gaps[0].end, addDaysUtc(weekDate(51, START_SUNDAY), 6));
  assert.equal(data.gaps[0].plays, 6 * 5 + 2 * 20);
});

test("Phase dates bridge non-gap sparse weeks and resolve most-played Artist names", () => {
  const rows: WeekArtistRow[] = [];
  // 16 weeks of Artist Alpha (2 weeks gap < 4 at weeks 16..17), 16 weeks of Artist Beta
  for (let w = 0; w < 16; w++) {
    rows.push({
      week: weekDate(w, START_SUNDAY),
      artistKey: "artist-alpha",
      artistName: w === 0 ? "artist alpha" : "Artist Alpha",
      plays: 30,
    });
  }
  for (let w = 16; w < 18; w++) {
    rows.push({
      week: weekDate(w, START_SUNDAY),
      artistKey: "artist-alpha",
      artistName: "Artist Alpha",
      plays: 5, // below MIN_WEEK_PLAYS, only 2 weeks so not a TasteGap
    });
  }
  for (let w = 18; w < 34; w++) {
    rows.push({
      week: weekDate(w, START_SUNDAY),
      artistKey: "artist-beta",
      artistName: "Artist Beta",
      plays: 30,
    });
  }

  const data = computeTastePhases(rows, "UTC");
  assertTasteInvariants(data);
  assert.equal(data.gaps.length, 0);
  assert.equal(data.kFine, 2);
  const finePhases = data.phases
    .filter((p) => p.minK <= 2 && 2 <= p.maxK)
    .sort((a, b) => (a.start < b.start ? -1 : 1));
  assert.equal(finePhases[0].end, addDaysUtc(finePhases[1].start, -1));
  assert.equal(finePhases[0].topArtists[0].name, "Artist Alpha");
});

test("degenerate inputs return kFine=1 without throwing", () => {
  const empty = computeTastePhases([], "UTC");
  assertTasteInvariants(empty);
  assert.equal(empty.analyzedWeeks, 0);
  assert.equal(empty.gaps.length, 0);

  const shortRows: WeekArtistRow[] = Array.from({ length: 5 }, (_, w) => ({
    week: weekDate(w, START_SUNDAY),
    artistKey: "solo",
    artistName: "Solo Artist",
    plays: 25,
  }));
  const shortData = computeTastePhases(shortRows, "America/Los_Angeles");
  assertTasteInvariants(shortData);
  assert.equal(shortData.timezone, "America/Los_Angeles");
  assert.equal(shortData.analyzedWeeks, 5);
  assert.equal(shortData.kFine, 1);
  assert.equal(shortData.kEra, 1);
  assert.equal(shortData.phases.length, 1);

  const lowPlayRows: WeekArtistRow[] = Array.from({ length: 10 }, (_, w) => ({
    week: weekDate(w, START_SUNDAY),
    artistKey: "quiet",
    artistName: "Quiet Artist",
    plays: 6,
  }));
  const lowData = computeTastePhases(lowPlayRows, "UTC");
  assertTasteInvariants(lowData);
  assert.equal(lowData.analyzedWeeks, 0);
  assert.equal(lowData.gaps.length, 1);
});
