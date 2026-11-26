import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTapeController } from "../src/components/listening-view/zoom-ruler/tape-controller";

const TAP_MAX_DISTANCE = 6;
const CENTERS = [0, 100, 200, 300, 400, 500, 600];

class FakeTapeElement extends EventTarget {
  tabIndex = 0;
  style = { touchAction: "" };
  private attrs = new Map<string, string>();

  getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      width: 400,
      height: 28,
      right: 400,
      bottom: 28,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  }

  setPointerCapture(_pointerId: number): void {}
  releasePointerCapture(_pointerId: number): void {}
  hasPointerCapture(_pointerId: number): boolean {
    return true;
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, String(value));
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attrs.delete(name);
  }

  focus(): void {}
}

function makePointerEvent(
  type: "pointerdown" | "pointermove" | "pointerup",
  clientX: number,
  clientY = 14,
): Event {
  const e = new Event(type);
  Object.assign(e, {
    clientX,
    clientY,
    pointerId: 1,
    button: 0,
    isPrimary: true,
    pointerType: "mouse",
  });
  return e;
}

describe("createTapeController tap-to-jump", () => {
  let origRaf: typeof globalThis.requestAnimationFrame;
  let origCancelRaf: typeof globalThis.cancelAnimationFrame;
  let origPerfNow: typeof performance.now;

  let nowMs: number;
  let nextRafId: number;
  let rafQueue: Map<number, FrameRequestCallback>;

  beforeEach(() => {
    origRaf = globalThis.requestAnimationFrame;
    origCancelRaf = globalThis.cancelAnimationFrame;
    origPerfNow = performance.now;

    nowMs = 1000;
    nextRafId = 1;
    rafQueue = new Map();

    performance.now = () => nowMs;
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      const id = nextRafId++;
      rafQueue.set(id, cb);
      return id;
    };
    globalThis.cancelAnimationFrame = (id: number): void => {
      rafQueue.delete(id);
    };
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = origRaf;
    globalThis.cancelAnimationFrame = origCancelRaf;
    performance.now = origPerfNow;
  });

  function flushFrames(hasSettled: () => boolean, maxFrames = 500): number {
    let frames = 0;
    while (!hasSettled() && rafQueue.size > 0 && frames < maxFrames) {
      nowMs += 16;
      const batch = Array.from(rafQueue.entries());
      rafQueue.clear();
      for (const [, cb] of batch) {
        cb(nowMs);
      }
      frames++;
    }
    return frames;
  }

  it("tapping at clientX 300 (tape x 400) settles on index 4", (t) => {
    const el = new FakeTapeElement();
    const settled: number[] = [];
    const controller = createTapeController({
      el: el as unknown as HTMLElement,
      centers: CENTERS,
      realFirst: 0,
      realLast: 6,
      index: 3,
      onFrame: () => {},
      onSettle: (idx) => settled.push(idx),
    });
    t.after(() => controller.destroy());

    el.dispatchEvent(makePointerEvent("pointerdown", 300));
    el.dispatchEvent(makePointerEvent("pointerup", 300));

    flushFrames(() => settled.length > 0);
    assert.deepEqual(settled, [4]);
  });

  it("tapping at clientX 0 (tape x 100) settles on index 1", (t) => {
    const el = new FakeTapeElement();
    const settled: number[] = [];
    const controller = createTapeController({
      el: el as unknown as HTMLElement,
      centers: CENTERS,
      realFirst: 0,
      realLast: 6,
      index: 3,
      onFrame: () => {},
      onSettle: (idx) => settled.push(idx),
    });
    t.after(() => controller.destroy());

    el.dispatchEvent(makePointerEvent("pointerdown", 0));
    el.dispatchEvent(makePointerEvent("pointerup", 0));

    flushFrames(() => settled.length > 0);
    assert.deepEqual(settled, [1]);
  });

  it("dragging 3 * TAP_MAX_DISTANCE with pointermoves does not tap-jump to the clicked unit", (t) => {
    const el = new FakeTapeElement();
    const settled: number[] = [];
    const controller = createTapeController({
      el: el as unknown as HTMLElement,
      centers: CENTERS,
      realFirst: 0,
      realLast: 6,
      index: 3,
      onFrame: () => {},
      onSettle: (idx) => settled.push(idx),
    });
    t.after(() => controller.destroy());

    const startX = 300; // tape x 400 (unit 4) if tapped
    const dragDistance = 3 * TAP_MAX_DISTANCE;

    el.dispatchEvent(makePointerEvent("pointerdown", startX));
    for (const step of [TAP_MAX_DISTANCE, 2 * TAP_MAX_DISTANCE, dragDistance]) {
      nowMs += 16;
      el.dispatchEvent(makePointerEvent("pointermove", startX + step));
    }

    assert.equal(settled.length, 0, "onSettle should not fire before pointerup");

    nowMs += 16;
    el.dispatchEvent(makePointerEvent("pointerup", startX + dragDistance));

    flushFrames(() => settled.length > 0);
    assert.equal(settled.length, 1);
    assert.notEqual(settled[0], 4);
  });

  it("releasing 100ms after the last pointermove makes no fling and snaps to the nearest unit", (t) => {
    const el = new FakeTapeElement();
    const settled: number[] = [];
    const frames: number[] = [];
    const controller = createTapeController({
      el: el as unknown as HTMLElement,
      centers: CENTERS,
      realFirst: 0,
      realLast: 6,
      index: 3, // offset 300
      onFrame: (offset) => frames.push(offset),
      onSettle: (idx) => settled.push(idx),
    });
    t.after(() => controller.destroy());

    // Drag quickly left by 80px (offset moves from 300 -> 380, nearest unit is 4 at 400)
    el.dispatchEvent(makePointerEvent("pointerdown", 200));
    nowMs += 16;
    el.dispatchEvent(makePointerEvent("pointermove", 160));
    nowMs += 16;
    el.dispatchEvent(makePointerEvent("pointermove", 120));

    // Pause 100ms (> staleReleaseMs 60ms) before pointerup
    nowMs += 100;
    el.dispatchEvent(makePointerEvent("pointerup", 120));

    flushFrames(() => settled.length > 0);
    assert.deepEqual(settled, [4]);
    assert.equal(frames[frames.length - 1], CENTERS[4]);
  });

  it("fast release lands exactly on a unit centre with onSettle called once", (t) => {
    const el = new FakeTapeElement();
    const settled: number[] = [];
    const frames: number[] = [];
    const controller = createTapeController({
      el: el as unknown as HTMLElement,
      centers: CENTERS,
      realFirst: 0,
      realLast: 6,
      index: 1, // offset 100
      onFrame: (offset) => frames.push(offset),
      onSettle: (idx) => settled.push(idx),
    });
    t.after(() => controller.destroy());

    // Fast drag leftward (negative clientX -> positive offset velocity)
    el.dispatchEvent(makePointerEvent("pointerdown", 300));
    nowMs += 16;
    el.dispatchEvent(makePointerEvent("pointermove", 270));
    nowMs += 16;
    el.dispatchEvent(makePointerEvent("pointermove", 230));
    nowMs += 10;
    el.dispatchEvent(makePointerEvent("pointerup", 230));

    // Flush all scheduled frames well past completion to confirm onSettle fires only once
    flushFrames(() => false, 200);
    assert.equal(settled.length, 1);
    const landedIdx = settled[0];
    assert.ok(landedIdx > 2, `expected fling past release offset 170 to index > 2, got ${landedIdx}`);
    assert.equal(frames[frames.length - 1], CENTERS[landedIdx]);
  });

  it("pointerdown mid-tween cancels the tween with no onSettle", (t) => {
    const el = new FakeTapeElement();
    const settled: number[] = [];
    const controller = createTapeController({
      el: el as unknown as HTMLElement,
      centers: CENTERS,
      realFirst: 0,
      realLast: 6,
      index: 0,
      onFrame: () => {},
      onSettle: (idx) => settled.push(idx),
    });
    t.after(() => controller.destroy());

    // Tap to start a tween toward unit 2
    el.dispatchEvent(makePointerEvent("pointerdown", 350));
    el.dispatchEvent(makePointerEvent("pointerup", 350));

    // Advance 2 frames (mid-tween)
    flushFrames(() => false, 2);
    assert.equal(settled.length, 0);

    // Interrupt with pointerdown; flush frames while pointer is still held
    el.dispatchEvent(makePointerEvent("pointerdown", 200));
    flushFrames(() => false, 100);
    assert.equal(settled.length, 0, "cancelled tween must not call onSettle");
  });

  it("under reduced motion, goTo(…, true) reaches the target on the first frame", (t) => {
    const origWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      matchMedia: (query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
      }),
    };
    t.after(() => {
      if (origWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = origWindow;
      }
    });

    const el = new FakeTapeElement();
    const settled: number[] = [];
    const frames: number[] = [];
    const controller = createTapeController({
      el: el as unknown as HTMLElement,
      centers: CENTERS,
      realFirst: 0,
      realLast: 6,
      index: 0,
      onFrame: (offset) => frames.push(offset),
      onSettle: (idx) => settled.push(idx),
    });
    t.after(() => controller.destroy());

    frames.length = 0; // discard mount frame
    controller.goTo(6, true);
    const extraFrames = flushFrames(() => false, 10);

    assert.equal(frames.length, 1, "reduced motion goTo must emit only one frame");
    assert.equal(frames[0], CENTERS[6], "first frame must reach target offset");
    assert.equal(extraFrames, 0, "no additional rAF frames should be queued");
    assert.equal(settled.length, 0, "programmatic goTo must never call onSettle");
  });

  it("under reduced motion, fast release snaps to nearest unit with no fling on the first frame", (t) => {
    const origWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      matchMedia: (query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
      }),
    };
    t.after(() => {
      if (origWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = origWindow;
      }
    });

    const el = new FakeTapeElement();
    const settled: number[] = [];
    const frames: number[] = [];
    const controller = createTapeController({
      el: el as unknown as HTMLElement,
      centers: CENTERS,
      realFirst: 0,
      realLast: 6,
      index: 1, // offset 100
      onFrame: (offset) => frames.push(offset),
      onSettle: (idx) => settled.push(idx),
    });
    t.after(() => controller.destroy());

    // Fast drag leftward by 70px -> offset 170 (nearest unit 2 at 200)
    el.dispatchEvent(makePointerEvent("pointerdown", 300));
    nowMs += 16;
    el.dispatchEvent(makePointerEvent("pointermove", 270));
    nowMs += 16;
    el.dispatchEvent(makePointerEvent("pointermove", 230));
    frames.length = 0;
    nowMs += 10;
    el.dispatchEvent(makePointerEvent("pointerup", 230));

    const extraFrames = flushFrames(() => false, 10);
    assert.deepEqual(settled, [2]);
    assert.deepEqual(frames, [CENTERS[2]]);
    assert.equal(extraFrames, 0);
  });

  it("goTo of less than one unit uses snapMs rather than jumpDuration", (t) => {
    const el = new FakeTapeElement();
    const frames: Array<{ t: number; offset: number }> = [];
    const controller = createTapeController({
      el: el as unknown as HTMLElement,
      centers: CENTERS,
      realFirst: 0,
      realLast: 6,
      index: 3, // offset 300
      onFrame: (offset) => frames.push({ t: nowMs, offset }),
      onSettle: () => {},
    });
    t.after(() => controller.destroy());

    // Drag 40px left (offset 340, only 60px < 100px unit spacing from index 4)
    el.dispatchEvent(makePointerEvent("pointerdown", 200));
    nowMs += 16;
    el.dispatchEvent(makePointerEvent("pointermove", 160));
    frames.length = 0;

    const startTime = nowMs;
    controller.goTo(4, true);
    flushFrames(() => false, 50);

    const elapsed = frames[frames.length - 1].t - startTime;
    assert.equal(frames[frames.length - 1].offset, CENTERS[4]);
    assert.ok(elapsed <= 196, `expected snap duration (~180ms), got ${elapsed}ms`);
  });
});
