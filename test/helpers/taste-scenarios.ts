import assert from "node:assert/strict";
import {
  MIN_PHASE_WEEKS,
  MIN_WEEK_PLAYS,
  TOP_ARTISTS,
  type TastePhasesData,
  type WeekArtistRow,
} from "../../src/lib/taste/types";

export interface TasteScenario {
  name: string;
  weeksPlays: string[][];
  trueBounds: number[]; // timeline week indices in 1..n-1
  coarseBounds?: number[];
}

export interface GapScenario {
  name: string;
  weeksPlays: string[][];
  trueBounds: number[]; // timeline week indices
  expectedGaps: Array<{ startIdx: number; endIdx: number }>;
  expectPhaseEndsAtGap?: boolean;
}

const MS_PER_DAY = 86_400_000;

export function parseDateUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function formatDateUtc(ms: number): string {
  const d = new Date(ms);
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysUtc(iso: string, days: number): string {
  return formatDateUtc(parseDateUtc(iso) + days * MS_PER_DAY);
}

export function weekDate(index: number, startSunday = "2020-01-05"): string {
  return addDaysUtc(startSunday, index * 7);
}

export function weeksPlaysToRows(
  weeksPlays: readonly string[][],
  startSunday = "2020-01-05"
): WeekArtistRow[] {
  const rows: WeekArtistRow[] = [];
  for (let t = 0; t < weeksPlays.length; t++) {
    const plays = weeksPlays[t];
    if (plays.length === 0) continue;
    const counts = new Map<string, number>();
    for (const artist of plays) {
      counts.set(artist, (counts.get(artist) ?? 0) + 1);
    }
    const week = weekDate(t, startSunday);
    for (const [artistName, count] of counts) {
      rows.push({
        week,
        artistKey: artistName.toLowerCase(),
        artistName,
        plays: count,
      });
    }
  }
  return rows;
}

export function makeRng(seed0: number): () => number {
  let s = seed0 >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function makeProfile(
  tag: string,
  size: number,
  rnd: () => number,
  shared?: Map<string, number>,
  sharedWeight = 0.25
): Map<string, number> {
  const m = new Map<string, number>();
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const w = (1 / Math.pow(i + 1.5, 1.15)) * (0.7 + 0.6 * rnd());
    m.set(`${tag}_${i}`, w);
    sum += w;
  }
  for (const [k, v] of m) m.set(k, (v / sum) * (shared ? 1 - sharedWeight : 1));
  if (shared) {
    for (const [k, v] of shared) m.set(k, (m.get(k) ?? 0) + v * sharedWeight);
  }
  return m;
}

export function mixProfiles(
  a: Map<string, number>,
  b: Map<string, number>,
  alpha: number
): Map<string, number> {
  const m = new Map<string, number>();
  for (const [k, v] of a) m.set(k, (m.get(k) ?? 0) + v * (1 - alpha));
  for (const [k, v] of b) m.set(k, (m.get(k) ?? 0) + v * alpha);
  return m;
}

export function sampleWeekPlays(
  dist: Map<string, number>,
  nPlays: number,
  rnd: () => number
): string[] {
  const keys = [...dist.keys()];
  const cdf: number[] = [];
  let acc = 0;
  for (const k of keys) {
    acc += dist.get(k)!;
    cdf.push(acc);
  }
  const out: string[] = [];
  for (let i = 0; i < nPlays; i++) {
    const u = rnd() * acc;
    let lo = 0;
    let hi = cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < u) lo = mid + 1;
      else hi = mid;
    }
    out.push(keys[lo]);
  }
  return out;
}

export function buildScenarios(seed = 123): TasteScenario[] {
  const rnd = makeRng(seed);
  const baseShared = makeProfile("core", 15, rnd);

  // 1. Sharp 5 eras (200 weeks, 150 plays/wk)
  const s1: TasteScenario = (() => {
    const bounds = [40, 82, 120, 165];
    const eras = Array.from({ length: 5 }, (_, i) =>
      makeProfile(`e${i}`, 25, rnd, baseShared, 0.2)
    );
    const wp: string[][] = [];
    for (let t = 0; t < 200; t++) {
      const idx = bounds.filter((b) => t >= b).length;
      wp.push(sampleWeekPlays(eras[idx], 150, rnd));
    }
    return { name: "sharp-5", weeksPlays: wp, trueBounds: bounds };
  })();

  // 2. Nested: 5 major eras, 12 sub-phases
  const s2: TasteScenario = (() => {
    const coarse = [42, 84, 126, 168];
    const fine = [20, 42, 62, 84, 100, 114, 126, 146, 168, 180, 190];
    const eras = Array.from({ length: 5 }, (_, i) =>
      makeProfile(`ne${i}`, 20, rnd, baseShared, 0.15)
    );
    const subs = Array.from({ length: 12 }, (_, i) => {
      const eraIdx = coarse.filter((b) => (i === 0 ? 0 : fine[i - 1]) >= b).length;
      const subFlavor = makeProfile(`ns${i}`, 12, rnd);
      return mixProfiles(eras[eraIdx], subFlavor, 0.45);
    });
    const wp: string[][] = [];
    for (let t = 0; t < 200; t++) {
      const idx = fine.filter((b) => t >= b).length;
      wp.push(sampleWeekPlays(subs[idx], 150, rnd));
    }
    return {
      name: "nested-5/12",
      weeksPlays: wp,
      trueBounds: fine,
      coarseBounds: coarse,
    };
  })();

  // 3. Gradual 4 eras (6-week linear crossfades around 50, 100, 150)
  const s3: TasteScenario = (() => {
    const centers = [50, 100, 150];
    const eras = Array.from({ length: 4 }, (_, i) =>
      makeProfile(`g${i}`, 25, rnd, baseShared, 0.2)
    );
    const wp: string[][] = [];
    for (let t = 0; t < 200; t++) {
      let dist: Map<string, number>;
      if (t < 47) dist = eras[0];
      else if (t < 53) dist = mixProfiles(eras[0], eras[1], (t - 47) / 6);
      else if (t < 97) dist = eras[1];
      else if (t < 103) dist = mixProfiles(eras[1], eras[2], (t - 97) / 6);
      else if (t < 147) dist = eras[2];
      else if (t < 153) dist = mixProfiles(eras[2], eras[3], (t - 147) / 6);
      else dist = eras[3];
      wp.push(sampleWeekPlays(dist, 150, rnd));
    }
    return { name: "gradual-4", weeksPlays: wp, trueBounds: centers };
  })();

  // 4. Light listener (5 sharp eras, 25 plays/wk)
  const s4: TasteScenario = (() => {
    const bounds = [40, 82, 120, 165];
    const eras = Array.from({ length: 5 }, (_, i) =>
      makeProfile(`l${i}`, 25, rnd, baseShared, 0.2)
    );
    const wp: string[][] = [];
    for (let t = 0; t < 200; t++) {
      const idx = bounds.filter((b) => t >= b).length;
      wp.push(sampleWeekPlays(eras[idx], 25, rnd));
    }
    return { name: "light-5(25p)", weeksPlays: wp, trueBounds: bounds };
  })();

  // 5. Stationary eclectic listener (K = 1)
  const s5: TasteScenario = (() => {
    const dist = makeProfile("eclectic", 60, rnd);
    const wp: string[][] = [];
    for (let t = 0; t < 200; t++) wp.push(sampleWeekPlays(dist, 150, rnd));
    return { name: "eclectic-1", weeksPlays: wp, trueBounds: [] };
  })();

  // 6. Stationary + 2-3 week album binges (K = 1)
  const s6: TasteScenario = (() => {
    const dist = makeProfile("base", 40, rnd);
    const wp: string[][] = [];
    let bingeArtist: string | null = null;
    let bingeLeft = 0;
    let bingeId = 0;
    for (let t = 0; t < 200; t++) {
      if (bingeLeft <= 0 && rnd() < 0.25) {
        bingeArtist = `binge_${bingeId++}`;
        bingeLeft = rnd() < 0.6 ? 2 : 3;
      }
      let cur = dist;
      if (bingeLeft > 0 && bingeArtist) {
        const bDist = new Map([[bingeArtist, 1]]);
        cur = mixProfiles(dist, bDist, 0.35);
        bingeLeft--;
      }
      wp.push(sampleWeekPlays(cur, 150, rnd));
    }
    return { name: "binges-1", weeksPlays: wp, trueBounds: [] };
  })();

  return [s1, s2, s3, s4, s5, s6];
}

export function buildGapScenarios(seed = 11): GapScenario[] {
  const rnd = makeRng(seed);
  const shared = makeProfile("core", 15, rnd);
  const A = makeProfile("A", 25, rnd, shared, 0.2);
  const B = makeProfile("B", 25, rnd, shared, 0.2);
  const C = makeProfile("C", 25, rnd, shared, 0.2);
  const weeks = (dist: Map<string, number> | null, len: number, plays = 150) =>
    Array.from({ length: len }, () => (dist ? sampleWeekPlays(dist, plays, rnd) : []));

  return [
    {
      name: "gap-same",
      weeksPlays: [...weeks(A, 60), ...weeks(null, 20), ...weeks(A, 40), ...weeks(B, 60)],
      trueBounds: [120],
      expectedGaps: [{ startIdx: 60, endIdx: 79 }],
    },
    {
      name: "gap-change",
      weeksPlays: [...weeks(A, 60), ...weeks(null, 20), ...weeks(B, 60)],
      trueBounds: [80],
      expectedGaps: [{ startIdx: 60, endIdx: 79 }],
      expectPhaseEndsAtGap: true,
    },
    {
      name: "sparse-same",
      weeksPlays: [...weeks(A, 60), ...weeks(A, 10, 6), ...weeks(A, 40), ...weeks(B, 60)],
      trueBounds: [110],
      expectedGaps: [{ startIdx: 60, endIdx: 69 }],
    },
    {
      name: "gap-3eras",
      weeksPlays: [
        ...weeks(A, 50),
        ...weeks(B, 30),
        ...weeks(null, 20),
        ...weeks(B, 30),
        ...weeks(C, 50),
      ],
      trueBounds: [50, 130],
      expectedGaps: [{ startIdx: 80, endIdx: 99 }],
    },
  ];
}

export function assertTasteInvariants(data: TastePhasesData): void {
  assert.ok(data.kFine >= 1, `kFine must be >= 1, got ${data.kFine}`);
  assert.ok(
    data.kEra >= 1 && data.kEra <= data.kFine,
    `kEra (${data.kEra}) must be in [1, kFine (${data.kFine})]`
  );

  if (data.analyzedWeeks === 0) {
    assert.equal(data.phases.length, 0, "0 analyzedWeeks must produce 0 phases");
    assert.equal(data.shifts.length, 0, "0 analyzedWeeks must produce 0 shifts");
    assert.equal(data.kFine, 1);
    assert.equal(data.kEra, 1);
    return;
  }

  const firstPhaseStart = data.phases.reduce(
    (min, p) => (p.start < min ? p.start : min),
    data.phases[0]?.start ?? ""
  );
  const lastPhaseEnd = data.phases.reduce(
    (max, p) => (p.end > max ? p.end : max),
    data.phases[0]?.end ?? ""
  );
  const interiorGaps = data.gaps.filter(
    (g) => g.start > firstPhaseStart && g.end < lastPhaseEnd
  );

  if (interiorGaps.length === 0) {
    assert.equal(
      data.phases.length,
      2 * data.kFine - 1,
      `expected ${2 * data.kFine - 1} phases, got ${data.phases.length}`
    );
  }
  assert.equal(
    data.shifts.length,
    data.kFine - 1,
    `expected ${data.kFine - 1} shifts, got ${data.shifts.length}`
  );

  const minKs = data.shifts.map((s) => s.minK).sort((a, b) => a - b);
  assert.deepEqual(
    minKs,
    Array.from({ length: data.kFine - 1 }, (_, i) => i + 2),
    "shift minK values must be distinct and cover 2..kFine"
  );

  for (let i = 1; i < data.shifts.length; i++) {
    assert.ok(
      data.shifts[i - 1].week < data.shifts[i].week,
      `shifts must be strictly sorted by week: ${data.shifts[i - 1].week} < ${data.shifts[i].week}`
    );
  }

  for (const shift of data.shifts) {
    assert.match(shift.week, /^\d{4}-\d{2}-\d{2}$/);
    const expectedLevels = Array.from(
      { length: data.kFine - shift.minK + 1 },
      (_, idx) => shift.minK + idx
    );
    assert.deepEqual(
      shift.levels.map((l) => l.k),
      expectedLevels,
      `shift ${shift.week} levels must cover [${shift.minK}..${data.kFine}]`
    );
    for (const lvl of shift.levels) {
      assert.ok(lvl.kind === "sharp" || lvl.kind === "gradual");
      assert.ok(lvl.widthWeeks >= 1);
      assert.equal(lvl.kind === "gradual", lvl.widthWeeks >= MIN_PHASE_WEEKS);
      assert.ok(lvl.rampStart <= lvl.rampEnd, `rampStart ${lvl.rampStart} <= rampEnd ${lvl.rampEnd}`);
    }
  }

  // Nesting and level tiling
  for (let k = 1; k <= data.kFine; k++) {
    const levelBounds = data.shifts
      .filter((s) => s.minK <= k)
      .map((s) => s.week)
      .sort();
    if (k < data.kFine) {
      const nextBounds = new Set(data.shifts.filter((s) => s.minK <= k + 1).map((s) => s.week));
      for (const b of levelBounds) {
        assert.ok(nextBounds.has(b), `level ${k} boundary ${b} must appear in level ${k + 1}`);
      }
    }

    const activePhases = data.phases
      .filter((p) => p.minK <= k && k <= p.maxK)
      .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
    if (interiorGaps.length === 0) {
      assert.equal(activePhases.length, k, `level ${k} must have ${k} active Taste Phases`);
    } else {
      assert.ok(
        activePhases.length >= k,
        `level ${k} must have at least ${k} active Taste Phases, got ${activePhases.length}`
      );
    }

    for (let i = 0; i < activePhases.length; i++) {
      const phase = activePhases[i];
      assert.equal(phase.id, `${phase.start}_${phase.end}`);
      assert.ok(phase.start <= phase.end);
      assert.ok(phase.plays >= MIN_WEEK_PLAYS);
      assert.ok(phase.topArtists.length >= 1 && phase.topArtists.length <= TOP_ARTISTS);
      for (const gap of data.gaps) {
        assert.ok(
          phase.end < gap.start || phase.start > gap.end,
          `active phase ${phase.id} must not overlap gap ${gap.start}..${gap.end}`
        );
      }
      for (let j = 0; j < phase.topArtists.length; j++) {
        const artist = phase.topArtists[j];
        assert.ok(artist.share > 0 && artist.share <= 1, `invalid share ${artist.share}`);
        if (j > 0) {
          assert.ok(phase.topArtists[j - 1].plays >= artist.plays);
          assert.ok(phase.topArtists[j - 1].share >= artist.share);
        }
      }
      if (i > 0) {
        assert.ok(
          activePhases[i - 1].end < phase.start,
          `phases at level ${k} must not overlap: ${activePhases[i - 1].end} < ${phase.start}`
        );
      }
    }

    const activeStarts = new Set(activePhases.slice(1).map((p) => p.start));
    if (interiorGaps.length === 0) {
      assert.deepEqual(
        activePhases.slice(1).map((p) => p.start),
        levelBounds,
        `active phase starts at level ${k} must match shift weeks`
      );
    } else {
      for (const b of levelBounds) {
        assert.ok(
          activeStarts.has(b),
          `level ${k} shift week ${b} must be an active phase start`
        );
      }
    }
  }

  for (let i = 0; i < data.gaps.length; i++) {
    const gap = data.gaps[i];
    assert.ok(gap.start <= gap.end);
    const spanDays = (parseDateUtc(gap.end) - parseDateUtc(gap.start)) / MS_PER_DAY + 1;
    assert.ok(spanDays >= MIN_PHASE_WEEKS * 7, `gap span must be >= ${MIN_PHASE_WEEKS} weeks`);
    if (i > 0) {
      assert.ok(data.gaps[i - 1].end < gap.start);
    }
  }
}
