import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prefersReducedMotion, scrollBehavior } from "../src/lib/motion";

function withWindow(
  stubWindow: { matchMedia?: (query: string) => { matches: boolean } } | undefined,
  fn: () => void,
) {
  const g = globalThis as { window?: unknown };
  const hadWindow = Object.prototype.hasOwnProperty.call(g, "window");
  const prevWindow = g.window;
  try {
    if (stubWindow === undefined) {
      delete g.window;
    } else {
      g.window = stubWindow;
    }
    fn();
  } finally {
    if (hadWindow) {
      g.window = prevWindow;
    } else {
      delete g.window;
    }
  }
}

describe("motion helpers", () => {
  it("prefersReducedMotion returns false when window is undefined (SSR)", () => {
    withWindow(undefined, () => {
      assert.equal(prefersReducedMotion(), false);
    });
  });

  it("prefersReducedMotion returns false when matchMedia is absent", () => {
    withWindow({}, () => {
      assert.equal(prefersReducedMotion(), false);
    });
  });

  it("prefersReducedMotion reads (prefers-reduced-motion: reduce) via matchMedia", () => {
    let seenQuery = "";
    withWindow(
      {
        matchMedia: (query: string) => {
          seenQuery = query;
          return { matches: true };
        },
      },
      () => {
        assert.equal(prefersReducedMotion(), true);
        assert.equal(seenQuery, "(prefers-reduced-motion: reduce)");
      },
    );

    withWindow(
      {
        matchMedia: () => ({ matches: false }),
      },
      () => {
        assert.equal(prefersReducedMotion(), false);
      },
    );
  });

  it("scrollBehavior returns auto when reduced motion is enabled and smooth otherwise", () => {
    withWindow(
      {
        matchMedia: () => ({ matches: true }),
      },
      () => {
        assert.equal(scrollBehavior(), "auto");
      },
    );

    withWindow(
      {
        matchMedia: () => ({ matches: false }),
      },
      () => {
        assert.equal(scrollBehavior(), "smooth");
      },
    );

    withWindow(undefined, () => {
      assert.equal(scrollBehavior(), "smooth");
    });
  });
});
