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
});
