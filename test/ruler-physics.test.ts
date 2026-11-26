import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  RUBBER_BAND,
  RULER_MOTION,
  dampOffset,
  easeInOutCubic,
  easeOutCubic,
  jumpDuration,
  nearestIndex,
  projectFling,
  tweenOffset,
} from "../src/lib/ruler/tape-physics";

describe("tape-physics constants", () => {
  it("exports expected physics constants and RULER_MOTION tuning block", () => {
    assert.equal(RUBBER_BAND, 0.35);
    assert.deepEqual(RULER_MOTION, {
      frictionPer16ms: 0.952,
      maxReleaseVelocity: 3,
      staleReleaseMs: 60,
      snapMs: 180,
      keyStepMs: 140,
      jumpMinMs: 320,
      jumpMaxMs: 900,
      flingMinMs: 220,
      flingMaxMs: 1000,
      zoomMs: 280,
    });
  });
});

describe("dampOffset", () => {
  it("keeps raw inside [min, max] and maps overshoot to 35% past the edge", () => {
    assert.equal(dampOffset(-100, 0, 500), -35);
    assert.equal(dampOffset(600, 0, 500), 535);
    assert.equal(dampOffset(0, 0, 500), 0);
    assert.equal(dampOffset(250, 0, 500), 250);
    assert.equal(dampOffset(500, 0, 500), 500);
  });
});

describe("easing curves and tweenOffset", () => {
  it("easeInOutCubic hits endpoints and passes through (0.5, 0.5)", () => {
    assert.equal(easeInOutCubic(0), 0);
    assert.equal(easeInOutCubic(0.5), 0.5);
    assert.equal(easeInOutCubic(1), 1);
    assert.equal(easeOutCubic(0), 0);
    assert.equal(easeOutCubic(1), 1);
    assert.ok(easeOutCubic(0.5) > 0.5);
  });

  it("tweenOffset returns from at 0ms, exact to at/after durationMs, and is monotonic in between", () => {
    const duration = 300;
    for (const ease of [easeOutCubic, easeInOutCubic]) {
      assert.equal(tweenOffset(100, 500, 0, duration, ease), 100);
      assert.equal(tweenOffset(100, 500, -10, duration, ease), 100);
      assert.equal(tweenOffset(100, 500, duration, duration, ease), 500);
      assert.equal(tweenOffset(100, 500, duration + 100, duration, ease), 500);

      let prev = 100;
      for (let ms = 10; ms <= duration; ms += 10) {
        const cur = tweenOffset(100, 500, ms, duration, ease);
        assert.ok(cur >= prev, `expected monotonic increase at ${ms}ms: ${cur} < ${prev}`);
        prev = cur;
      }

      // Decreasing direction
      let prevDec = 500;
      for (let ms = 10; ms <= duration; ms += 10) {
        const cur = tweenOffset(500, 100, ms, duration, ease);
        assert.ok(cur <= prevDec, `expected monotonic decrease at ${ms}ms: ${cur} > ${prevDec}`);
        prevDec = cur;
      }
    }
  });

  it("is frame-rate independent: 60Hz and 120Hz sampling match at shared timestamps", () => {
    const from = 200;
    const to = 8200;
    const duration = 640;

    for (const ease of [easeOutCubic, easeInOutCubic]) {
      const samples60 = new Map<number, number>();
      const samples120 = new Map<number, number>();

      // Use exact integer millisecond multiples (16ms vs 8ms) and exact 1000/60 vs 1000/120
      for (let step = 0; step <= 40; step++) {
        const t = step * 16;
        samples60.set(t, tweenOffset(from, to, t, duration, ease));
      }
      for (let step = 0; step <= 80; step++) {
        const t = step * 8;
        samples120.set(t, tweenOffset(from, to, t, duration, ease));
      }

      for (const [t, val60] of samples60) {
        assert.equal(samples120.get(t), val60, `mismatch at shared timestamp ${t}ms`);
      }

      // Also check exact 60Hz (1000/60) vs 120Hz (1000/120) shared even frames
      for (let i = 0; i <= 38; i++) {
        const t60 = (i * 1000) / 60;
        const t120 = (i * 2 * 1000) / 120;
        assert.equal(
          tweenOffset(from, to, t60, duration, ease),
          tweenOffset(from, to, t120, duration, ease),
        );
      }
    }
  });
});

describe("jumpDuration", () => {
  it("returns jumpMinMs at 0px, stays within bounds, and grows with distance", () => {
    assert.equal(jumpDuration(0), RULER_MOTION.jumpMinMs);

    const dSmall = jumpDuration(40);
    const dMed = jumpDuration(400);
    const dLarge = jumpDuration(2000);
    const dHuge = jumpDuration(50000);

    assert.ok(dSmall > RULER_MOTION.jumpMinMs);
    assert.ok(dMed > dSmall);
    assert.ok(dLarge > dMed);
    assert.ok(dHuge <= RULER_MOTION.jumpMaxMs);
    assert.equal(dHuge, RULER_MOTION.jumpMaxMs);

    for (const px of [0, 10, 80, 300, 1000, 5000, 100000]) {
      const d = jumpDuration(px);
      assert.ok(
        d >= RULER_MOTION.jumpMinMs && d <= RULER_MOTION.jumpMaxMs,
        `jumpDuration(${px})=${d} out of bounds`,
      );
    }
  });
});

describe("projectFling", () => {
  it("picks the unit nearest to the projected rest point, clamped at both ends, with bounded duration", () => {
    const centers = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const tau = -16 / Math.log(RULER_MOTION.frictionPer16ms);

    // Mid-archive positive fling
    const v = 1.0; // px/ms -> projected = 200 + ~325.27 = ~525.27 -> nearest is index 5 (500)
    const mid = projectFling(centers, 200, v, 1, 9);
    assert.equal(mid.targetIdx, nearestIndex(centers, 200 + v * tau, 1, 9));
    assert.equal(mid.targetOffset, centers[mid.targetIdx]);
    assert.ok(
      mid.durationMs >= RULER_MOTION.flingMinMs && mid.durationMs <= RULER_MOTION.flingMaxMs,
      `expected duration within [${RULER_MOTION.flingMinMs}, ${RULER_MOTION.flingMaxMs}], got ${mid.durationMs}`,
    );

    // Clamped at realLast
    const high = projectFling(centers, 800, 3.0, 1, 9);
    assert.equal(high.targetIdx, 9);
    assert.equal(high.targetOffset, 900);
    assert.ok(
      high.durationMs >= RULER_MOTION.flingMinMs && high.durationMs <= RULER_MOTION.flingMaxMs,
    );

    // Clamped at realFirst
    const low = projectFling(centers, 200, -3.0, 1, 9);
    assert.equal(low.targetIdx, 1);
    assert.equal(low.targetOffset, 100);
    assert.ok(
      low.durationMs >= RULER_MOTION.flingMinMs && low.durationMs <= RULER_MOTION.flingMaxMs,
    );

    // Duration hits upper bound when projected distance is huge relative to velocity
    const clampedSlow = projectFling([0, 10000], 0, 0.1, 0, 1);
    assert.ok(
      clampedSlow.durationMs >= RULER_MOTION.flingMinMs &&
        clampedSlow.durationMs <= RULER_MOTION.flingMaxMs,
    );
  });
});

describe("nearestIndex", () => {
  it("clamps to [lo, hi], picks the closer centre, and breaks ties to the lower index", () => {
    const centers = [0, 100, 200, 300, 400];
    assert.equal(nearestIndex(centers, -50, 1, 3), 1);
    assert.equal(nearestIndex(centers, 50, 1, 3), 1);
    assert.equal(nearestIndex(centers, 500, 1, 3), 3);
    assert.equal(nearestIndex(centers, 350, 1, 3), 3);

    assert.equal(nearestIndex(centers, 140, 1, 3), 1);
    assert.equal(nearestIndex(centers, 160, 1, 3), 2);
    assert.equal(nearestIndex(centers, 200, 1, 3), 2);

    // Exact tie between index 1 (100) and index 2 (200) -> lower index 1
    assert.equal(nearestIndex(centers, 150, 1, 3), 1);
  });

  it("picks the lower index when sorted centers contain duplicates", () => {
    const dupes = [0, 100, 100, 100, 200, 200, 300];
    assert.equal(nearestIndex(dupes, 100, 0, 6), 1);
    assert.equal(nearestIndex(dupes, 120, 0, 6), 1);
    assert.equal(nearestIndex(dupes, 150, 0, 6), 1);
    assert.equal(nearestIndex(dupes, 180, 0, 6), 4);
    assert.equal(nearestIndex(dupes, 200, 0, 6), 4);
    assert.equal(nearestIndex(dupes, 100, 2, 5), 2);
  });
});
