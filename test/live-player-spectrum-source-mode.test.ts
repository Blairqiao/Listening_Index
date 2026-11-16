/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts";

type Mode = "synthetic" | "live";

/**
 * Renders the real SpectrumCanvas on a minimal hook runtime that runs effects when
 * their dependencies change, with the browser's share picker replaced by a counter.
 */
function setup(t: TestContext, options: { strictMode?: boolean } = {}) {
  const slots: any[] = [];
  let cursor = 0;
  let pendingEffects: Array<() => void> = [];

  const runEffect = (slot: any, effect: () => unknown) => {
    slot.cleanup?.();
    const cleanup = effect();
    slot.cleanup = typeof cleanup === "function" ? cleanup : undefined;
  };

  const react = {
    createElement: (type: unknown, props: unknown) => ({ type, props }),
    useRef(init: unknown) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: init };
      return slots[i];
    },
    useEffect(effect: () => unknown, deps?: unknown[]) {
      const i = cursor++;
      const slot = (slots[i] ??= { deps: undefined, mounted: false });
      const changed = !slot.mounted || !deps || deps.some((d, n) => !Object.is(d, slot.deps?.[n]));
      if (!changed) return;
      const firstRun = !slot.mounted;
      slot.deps = deps;
      slot.mounted = true;
      pendingEffects.push(() => {
        runEffect(slot, effect);
        // React StrictMode runs each mount effect, cleans it up, and runs it again.
        if (firstRun && options.strictMode) runEffect(slot, effect);
      });
    },
  };

  let pickerCalls = 0;
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getDisplayMedia: async () => {
          pickerCalls++;
          throw new Error("NotAllowedError");
        },
      },
    },
  });
  const previousWarn = console.warn;
  console.warn = () => undefined;
  t.after(() => {
    if (previousNavigator) Object.defineProperty(globalThis, "navigator", previousNavigator);
    else delete (globalThis as any).navigator;
    console.warn = previousWarn;
  });

  const { SpectrumCanvas } = loadTs("src/components/views/live-player-view/SpectrumCanvas.tsx", { react });

  let toggleCalls = 0;
  const onToggleSource = () => {
    toggleCalls++;
  };
  const render = (sourceMode: Mode) => {
    cursor = 0;
    SpectrumCanvas({ trackKey: "track-1", isLive: true, accentColor: "#33cc66", sourceMode, onToggleSource });
    const effects = pendingEffects;
    pendingEffects = [];
    effects.forEach((run) => run());
  };

  return {
    render,
    get pickerCalls() {
      return pickerCalls;
    },
    get toggleCalls() {
      return toggleCalls;
    },
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("mounting with sourceMode live does not open the share picker and falls back to synthetic", async (t) => {
  const canvas = setup(t);
  canvas.render("live");
  await settle();
  assert.equal(canvas.pickerCalls, 0);
  assert.equal(canvas.toggleCalls, 1);
});

test("a StrictMode double mount with sourceMode live asks for the fallback once and never opens the picker", async (t) => {
  const canvas = setup(t, { strictMode: true });
  canvas.render("live");
  await settle();
  assert.equal(canvas.pickerCalls, 0);
  assert.equal(canvas.toggleCalls, 1);
});

test("a synthetic-to-live transition after mount opens the share picker", async (t) => {
  const canvas = setup(t);
  canvas.render("synthetic");
  await settle();
  assert.equal(canvas.pickerCalls, 0);
  assert.equal(canvas.toggleCalls, 0);

  canvas.render("live");
  assert.equal(canvas.pickerCalls, 1);
});

test("going live works after a mount that fell back to synthetic", async (t) => {
  const canvas = setup(t);
  canvas.render("live");
  canvas.render("synthetic");
  await settle();
  assert.equal(canvas.pickerCalls, 0);

  canvas.render("live");
  assert.equal(canvas.pickerCalls, 1);
});

test("a declined share falls back to synthetic", async (t) => {
  const canvas = setup(t);
  canvas.render("synthetic");
  canvas.render("live");
  await settle();
  assert.equal(canvas.pickerCalls, 1);
  assert.equal(canvas.toggleCalls, 1);
});
