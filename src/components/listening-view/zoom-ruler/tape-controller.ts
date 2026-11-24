import {
  RUBBER_BAND,
  dampOffset,
  momentumStep,
  nearestIndex,
  settleStep,
} from "@/lib/ruler/tape-physics";

const TAP_MAX_DISTANCE = 6;
const MOMENTUM_START_VELOCITY = 0.08;
const WHEEL_PAN_SCALE = 0.8;
const WHEEL_MAX_OVERSHOOT = 40;
const WHEEL_SETTLE_DELAY_MS = 120;
const MAX_FRAME_DT_MS = 32;
const VELOCITY_MIN_DT_MS = 8;
const VELOCITY_SMOOTHING = 0.65;

export interface TapeControllerOptions {
  el: HTMLElement;
  centers: number[];
  realFirst: number;
  realLast: number;
  index: number;
  /** Called on every animation frame while moving (and on initial mount / programmatic sync). */
  onFrame: (offset: number) => void;
  /**
   * Called once when user-initiated motion (drag, flick, tap, pointercancel, wheel, or keyboard)
   * stops on a real unit. Never called by programmatic `setUnits` or `goTo`.
   */
  onSettle: (index: number) => void;
  /** Called on ctrl/⌘+wheel (`Math.exp(-deltaY * 0.01)`) and two-pointer pinch distance ratio. */
  onZoom?: (factor: number) => void;
  /** Supplies the `aria-valuetext` string applied on mount, every settle, and `refreshAria()`. */
  getValueText?: () => string;
}

export interface TapeController {
  /**
   * Replace unit geometry and jump to `index` immediately.
   * Cancels in-flight motion and calls `onFrame`, never `onSettle`.
   */
  setUnits(centers: number[], realFirst: number, realLast: number, index: number): void;
  /**
   * Programmatically move the tape to `index` (clamped to `[realFirst, realLast]`).
   * Cancels in-flight motion and calls `onFrame`, never `onSettle`.
   */
  goTo(index: number, animate: boolean): void;
  /** Ignores user input and cancels any active drag, pinch, wheel settle, or animation. */
  setDisabled(disabled: boolean): void;
  /** Syncs `aria-valuetext` from `getValueText` onto the element. */
  refreshAria(): void;
  /** Removes every listener, cancels rAF and timers, and restores element attributes/styles. */
  destroy(): void;
}

function clampUnitBounds(
  nextCenters: number[],
  nextRealFirst: number,
  nextRealLast: number,
): { first: number; last: number } {
  if (nextCenters.length === 0) {
    return { first: 0, last: -1 };
  }
  const maxIdx = nextCenters.length - 1;
  const first = Math.max(0, Math.min(maxIdx, nextRealFirst));
  const last = Math.max(first, Math.min(maxIdx, nextRealLast));
  return { first, last };
}

function restoreAttribute(el: HTMLElement, name: string, previous: string | null): void {
  if (previous === null) {
    el.removeAttribute(name);
  } else {
    el.setAttribute(name, previous);
  }
}

export function createTapeController(opts: TapeControllerOptions): TapeController {
  const { el, onFrame, onSettle, onZoom, getValueText } = opts;

  const prevTabIndex = el.getAttribute("tabindex");
  const prevRole = el.getAttribute("role");
  const prevAriaValueText = el.getAttribute("aria-valuetext");
  const prevAriaDisabled = el.getAttribute("aria-disabled");
  const prevTouchAction = el.style.touchAction;

  el.setAttribute("tabindex", "0");
  el.setAttribute("role", "slider");
  el.style.touchAction = "none";

  let centers = opts.centers.slice();
  const initialBounds = clampUnitBounds(centers, opts.realFirst, opts.realLast);
  let realFirst = initialBounds.first;
  let realLast = initialBounds.last;

  function hasUnits(): boolean {
    return centers.length > 0 && realFirst >= 0 && realLast >= realFirst && realLast < centers.length;
  }

  function clampRealIndex(index: number): number {
    return Math.max(realFirst, Math.min(realLast, index));
  }

  let currentOffset = hasUnits() ? centers[clampRealIndex(opts.index)] : 0;
  let disabled = false;
  let destroyed = false;

  let animId: number | null = null;
  let wheelTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingKeyTarget: number | null = null;

  let isDragging = false;
  let dragMoved = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartOffset = 0;
  let lastPointerX = 0;
  let lastPointerTime = 0;
  let velocity = 0;

  const activePointers = new Map<number, { x: number; y: number }>();
  let wasPinching = false;
  let lastPinchDist = 0;

  function cancelMotion(): void {
    pendingKeyTarget = null;
    if (wheelTimeout !== null) {
      clearTimeout(wheelTimeout);
      wheelTimeout = null;
    }
    if (animId !== null) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function releaseAllPointers(): void {
    for (const pointerId of activePointers.keys()) {
      try {
        el.releasePointerCapture(pointerId);
      } catch {
        // Ignore if capture was already released or unsupported.
      }
    }
    activePointers.clear();
    isDragging = false;
    dragMoved = false;
    wasPinching = false;
    lastPinchDist = 0;
    velocity = 0;
  }

  function refreshAria(): void {
    if (destroyed || typeof getValueText !== "function") return;
    el.setAttribute("aria-valuetext", getValueText());
  }

  function finishSettle(targetIdx: number, emitSettle: boolean): void {
    animId = null;
    pendingKeyTarget = null;
    if (emitSettle) {
      onSettle(targetIdx);
    }
    refreshAria();
  }

  function moveToIndex(
    index: number,
    animate: boolean,
    emitSettle: boolean,
    isKeyboard = false,
  ): void {
    if (destroyed || !hasUnits()) return;
    cancelMotion();

    const targetIdx = clampRealIndex(index);
    const targetOffset = centers[targetIdx];
    pendingKeyTarget = isKeyboard ? targetIdx : null;

    if (!animate) {
      currentOffset = targetOffset;
      onFrame(currentOffset);
      finishSettle(targetIdx, emitSettle);
      return;
    }

    function tick(): void {
      if (destroyed || (emitSettle && disabled)) {
        animId = null;
        return;
      }
      const step = settleStep(currentOffset, targetOffset);
      currentOffset = step.offset;
      onFrame(currentOffset);

      if (step.done) {
        finishSettle(targetIdx, emitSettle);
        return;
      }
      animId = requestAnimationFrame(tick);
    }

    tick();
  }

  function settleToNearest(): void {
    if (destroyed || disabled || !hasUnits()) return;
    const targetIdx = nearestIndex(centers, currentOffset, realFirst, realLast);
    moveToIndex(targetIdx, true, true);
  }

  function startMomentum(): void {
    if (destroyed || disabled || !hasUnits()) return;
    cancelMotion();

    let lastTime = performance.now();
    const minBound = centers[realFirst];
    const maxBound = centers[realLast];

    function tick(now: number): void {
      if (destroyed || disabled) {
        animId = null;
        return;
      }
      const dt = Math.max(0, Math.min(MAX_FRAME_DT_MS, now - lastTime));
      lastTime = now;

      const step = momentumStep({ offset: currentOffset, velocity }, dt, minBound, maxBound);
      currentOffset = step.offset;
      velocity = step.velocity;
      onFrame(currentOffset);

      if (step.hitEdge === "min") {
        finishSettle(realFirst, true);
        return;
      }
      if (step.hitEdge === "max") {
        finishSettle(realLast, true);
        return;
      }
      if (step.done) {
        animId = null;
        settleToNearest();
        return;
      }
      animId = requestAnimationFrame(tick);
    }

    animId = requestAnimationFrame(tick);
  }

  function resumeSinglePointerDrag(point: { x: number; y: number }): void {
    isDragging = true;
    dragMoved = false;
    dragStartX = point.x;
    dragStartY = point.y;
    dragStartOffset = currentOffset;
    lastPointerX = point.x;
    lastPointerTime = performance.now();
    velocity = 0;
  }

  function onPointerDown(e: PointerEvent): void {
    if (disabled || destroyed || !hasUnits()) return;
    cancelMotion();
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events or unsupported capture targets.
    }

    if (activePointers.size === 1) {
      wasPinching = false;
      resumeSinglePointerDrag({ x: e.clientX, y: e.clientY });
    } else if (activePointers.size === 2) {
      isDragging = false;
      wasPinching = true;
      const pts = Array.from(activePointers.values());
      lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (disabled || destroyed || !hasUnits()) return;
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (lastPinchDist > 0 && dist > 0 && typeof onZoom === "function") {
        onZoom(dist / lastPinchDist);
      }
      lastPinchDist = dist;
      return;
    }

    if (!isDragging) return;

    if (
      !dragMoved &&
      Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) >= TAP_MAX_DISTANCE
    ) {
      dragMoved = true;
    }

    const now = performance.now();
    const dt = now - lastPointerTime;
    const dx = e.clientX - dragStartX;

    const minBound = centers[realFirst];
    const maxBound = centers[realLast];
    let rawStart = dragStartOffset;
    if (dragStartOffset < minBound) {
      rawStart = minBound - (minBound - dragStartOffset) / RUBBER_BAND;
    } else if (dragStartOffset > maxBound) {
      rawStart = maxBound + (dragStartOffset - maxBound) / RUBBER_BAND;
    }
    const rawOffset = rawStart - dx;
    currentOffset = dampOffset(rawOffset, minBound, maxBound);

    if (dt > VELOCITY_MIN_DT_MS) {
      const instV = -(e.clientX - lastPointerX) / dt;
      velocity = velocity * (1 - VELOCITY_SMOOTHING) + instV * VELOCITY_SMOOTHING;
      lastPointerX = e.clientX;
      lastPointerTime = now;
    }

    onFrame(currentOffset);
  }

  function onPointerCancel(e: PointerEvent): void {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.delete(e.pointerId);

    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if capture was already released.
    }

    if (disabled || destroyed || !hasUnits()) {
      isDragging = false;
      wasPinching = false;
      velocity = 0;
      return;
    }

    if (activePointers.size === 1) {
      const remaining = activePointers.values().next().value;
      if (remaining) {
        resumeSinglePointerDrag(remaining);
      }
      return;
    }

    if (activePointers.size === 0) {
      wasPinching = false;
      isDragging = false;
      velocity = 0;
      settleToNearest();
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.delete(e.pointerId);

    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if capture was already released.
    }

    if (disabled || destroyed || !hasUnits()) {
      isDragging = false;
      wasPinching = false;
      velocity = 0;
      return;
    }

    if (activePointers.size === 1) {
      const remaining = activePointers.values().next().value;
      if (remaining) {
        resumeSinglePointerDrag(remaining);
      }
      return;
    }

    if (activePointers.size === 0) {
      if (wasPinching) {
        wasPinching = false;
        isDragging = false;
        velocity = 0;
        settleToNearest();
        return;
      }

      if (!isDragging) return;
      const movedPastTap = dragMoved;
      isDragging = false;
      dragMoved = false;

      const totalDist = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
      if (!movedPastTap && totalDist < TAP_MAX_DISTANCE) {
        const rect = el.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const tappedTapeX = currentOffset + (clickX - rect.width / 2);
        const targetIdx = nearestIndex(centers, tappedTapeX, realFirst, realLast);
        moveToIndex(targetIdx, true, true);
        return;
      }

      const minBound = centers[realFirst];
      const maxBound = centers[realLast];

      if (
        (currentOffset <= minBound && velocity <= 0) ||
        (currentOffset >= maxBound && velocity >= 0)
      ) {
        settleToNearest();
        return;
      }

      if (Math.abs(velocity) > MOMENTUM_START_VELOCITY) {
        startMomentum();
      } else {
        settleToNearest();
      }
    }
  }

  function onWheel(e: WheelEvent): void {
    if (disabled || destroyed || !hasUnits()) return;

    if (e.ctrlKey || e.metaKey) {
      if (typeof onZoom === "function") {
        e.preventDefault();
        cancelMotion();
        onZoom(Math.exp(-e.deltaY * 0.01));
      }
      return;
    }

    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (delta === 0) return;

    e.preventDefault();
    pendingKeyTarget = null;
    if (animId !== null) {
      cancelAnimationFrame(animId);
      animId = null;
    }

    currentOffset += delta * WHEEL_PAN_SCALE;

    const minBound = centers[realFirst];
    const maxBound = centers[realLast];
    if (currentOffset < minBound - WHEEL_MAX_OVERSHOOT) {
      currentOffset = minBound - WHEEL_MAX_OVERSHOOT;
    }
    if (currentOffset > maxBound + WHEEL_MAX_OVERSHOOT) {
      currentOffset = maxBound + WHEEL_MAX_OVERSHOOT;
    }

    onFrame(currentOffset);

    if (wheelTimeout !== null) {
      clearTimeout(wheelTimeout);
    }
    wheelTimeout = setTimeout(() => {
      wheelTimeout = null;
      settleToNearest();
    }, WHEEL_SETTLE_DELAY_MS);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (disabled || destroyed || !hasUnits()) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const curIdx = pendingKeyTarget ?? nearestIndex(centers, currentOffset, realFirst, realLast);
      moveToIndex(curIdx - 1, true, true, true);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const curIdx = pendingKeyTarget ?? nearestIndex(centers, currentOffset, realFirst, realLast);
      moveToIndex(curIdx + 1, true, true, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      moveToIndex(realFirst, true, true, true);
    } else if (e.key === "End") {
      e.preventDefault();
      moveToIndex(realLast, true, true, true);
    }
  }

  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", onPointerUp);
  el.addEventListener("pointercancel", onPointerCancel);
  el.addEventListener("wheel", onWheel, { passive: false });
  el.addEventListener("keydown", onKeyDown);

  onFrame(currentOffset);
  refreshAria();

  return {
    setUnits(newCenters, newRealFirst, newRealLast, newIndex) {
      if (destroyed) return;
      cancelMotion();
      releaseAllPointers();
      centers = newCenters.slice();
      const bounds = clampUnitBounds(centers, newRealFirst, newRealLast);
      realFirst = bounds.first;
      realLast = bounds.last;
      currentOffset = hasUnits() ? centers[clampRealIndex(newIndex)] : 0;
      onFrame(currentOffset);
      refreshAria();
    },
    goTo(index, animate) {
      moveToIndex(index, animate, false);
    },
    setDisabled(nextDisabled) {
      if (destroyed) return;
      disabled = nextDisabled;
      if (disabled) {
        cancelMotion();
        releaseAllPointers();
        el.setAttribute("aria-disabled", "true");
      } else {
        el.removeAttribute("aria-disabled");
      }
    },
    refreshAria,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelMotion();
      releaseAllPointers();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerCancel);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("keydown", onKeyDown);
      restoreAttribute(el, "tabindex", prevTabIndex);
      restoreAttribute(el, "role", prevRole);
      restoreAttribute(el, "aria-valuetext", prevAriaValueText);
      restoreAttribute(el, "aria-disabled", prevAriaDisabled);
      el.style.touchAction = prevTouchAction;
    },
  };
}
