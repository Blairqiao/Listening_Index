import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FRICTION_PER_16MS,
  MIN_VELOCITY,
  RUBBER_BAND,
  SETTLE_RATE,
  dampOffset,
  momentumStep,
  nearestIndex,
  settleStep,
} from "../src/lib/ruler/tape-physics";

describe("tape-physics constants", () => {
  it("exports expected physics constants", () => {
    assert.equal(FRICTION_PER_16MS, 0.93);
    assert.equal(RUBBER_BAND, 0.35);
    assert.equal(SETTLE_RATE, 0.28);
    assert.equal(MIN_VELOCITY, 0.02);
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

describe("momentumStep", () => {
  it("scales velocity by exactly 0.93 for a 16ms step", () => {
    const res = momentumStep({ offset: 100, velocity: 1 }, 16, 0, 500);
    assert.equal(res.velocity, 0.93);
    assert.equal(res.offset, 114.88);
    assert.equal(res.done, false);
    assert.equal(res.hitEdge, null);
  });

  it("clamps at max and returns hitEdge 'max' when crossing max", () => {
    const res = momentumStep({ offset: 495, velocity: 1 }, 16, 0, 500);
    assert.equal(res.offset, 500);
    assert.equal(res.done, true);
    assert.equal(res.hitEdge, "max");
  });

  it("clamps at min and returns hitEdge 'min' when crossing min", () => {
    const res = momentumStep({ offset: 5, velocity: -1 }, 16, 0, 500);
    assert.equal(res.offset, 0);
    assert.equal(res.done, true);
    assert.equal(res.hitEdge, "min");
  });

  it("returns done: true with hitEdge: null when |velocity| drops below MIN_VELOCITY", () => {
    const res = momentumStep({ offset: 100, velocity: 0.021 }, 16, 0, 500);
    assert.ok(Math.abs(res.velocity) < MIN_VELOCITY);
    assert.equal(res.done, true);
    assert.equal(res.hitEdge, null);
  });
});

describe("settleStep", () => {
  it("moves 28% of remaining distance and converges to target within 0.5px in under 40 steps", () => {
    const first = settleStep(0, 100);
    assert.equal(first.offset, 100 * SETTLE_RATE);
    assert.equal(first.done, false);

    let offset = 0;
    const target = 1000;
    let steps = 0;
    let done = false;
    while (!done && steps < 40) {
      const next = settleStep(offset, target);
      offset = next.offset;
      done = next.done;
      steps++;
    }
    assert.equal(done, true);
    assert.equal(offset, target);
    assert.ok(steps < 40, `expected < 40 steps, got ${steps}`);
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
