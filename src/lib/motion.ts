/** False during SSR. Reads `(prefers-reduced-motion: reduce)` in the browser. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** "smooth" unless reduced motion is on. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}

/**
 * Resolves with the task's value, or with undefined once `capMs` passes or the
 * task fails. Used to hold a reveal until its data is ready, without letting a
 * slow request block the UI.
 */
export function withRevealCap<T>(task: Promise<T>, capMs: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), capMs);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      },
    );
  });
}
