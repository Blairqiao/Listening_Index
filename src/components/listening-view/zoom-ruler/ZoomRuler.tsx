"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  addCalendarDays,
  daysBetween,
  exactUnitOf,
  formatRangeLabel,
  isSameRange,
  presetRange,
  unitWindow,
  type CalendarUnit,
  type RangeSelection,
} from "@/lib/range";
import {
  LEVELS,
  buildRulerUnits,
  indexForDate,
  placementForRange,
  type RulerLevel,
  type RulerUnit,
} from "@/lib/ruler/units";
import { prefersReducedMotion } from "@/lib/motion";
import {
  RULER_MOTION,
  easeInOutCubic,
  nearestIndex,
} from "@/lib/ruler/tape-physics";
import {
  FIXED_PPD,
  allBlend,
  nearestLevel,
  restDay,
  snapPpd,
  unitCenterDay,
} from "@/lib/ruler/zoom";
import { drawRuler, type RulerCtx, type RulerPalette } from "@/lib/ruler/draw";
import { siteConfig } from "@/config";
import {
  createTapeController,
  type TapeController,
} from "@/components/listening-view/zoom-ruler/tape-controller";

export interface ZoomRulerProps {
  range: RangeSelection;
  onSelectRange: (sel: RangeSelection) => void;
  firstKey: string;
  todayKey: string;
  disabled?: boolean;
  label?: React.ReactNode;
}

const LEVEL_LABELS: Record<RulerLevel, string> = {
  all: "All",
  year: "Year",
  month: "Month",
  week: "Week",
  day: "Day",
};

const ALL_FILL_RATIO = 0.7;
const MAX_ALL_PPD = FIXED_PPD.year * 0.6;
const LIVE_ZOOM_SNAP_DELAY_MS = 150;
const DEFAULT_RULER_WIDTH = 440;
const DEFAULT_RULER_HEIGHT = 28;

interface UiSnapshot {
  activeLayer: 0 | 1;
  layer0: string;
  layer1: string;
  zoomOutDisabled: boolean;
  zoomInDisabled: boolean;
  isAllLocked: boolean;
  onToday: boolean;
}

interface RulerInternalState {
  firstKey: string;
  todayKey: string;
  workingLevel: RulerLevel;
  settledLevel: RulerLevel;
  ppd: number;
  units: RulerUnit[];
  centers: number[];
  realFirst: number;
  realLast: number;
  offset: number;
  lockedAllOffset: number;
  selected: number | null;
  anchorKey: string;
  exact: boolean;
  customLabel: string | null;
  isZooming: boolean;
  liveZoomDay: number;
  liveZoomBaseDay: number;
  cssWidth: number;
  cssHeight: number;
  zoomAnimId: number | null;
  zoomSnapTimer: ReturnType<typeof setTimeout> | null;
  drawRafId: number | null;
}

/**
 * Whether the Today icon should be grayed out. While a zoom animates, the previous
 * value holds, so a zoom step taken on today doesn't flash the icon state.
 */
export function nextOnToday(
  prev: boolean,
  s: {
    settledLevel: RulerLevel;
    isZooming: boolean;
    exact: boolean;
    selectedUnit: { from: string; to: string } | undefined;
    todayKey: string;
  },
): boolean {
  if (s.settledLevel === "all") return true;
  if (s.isZooming) return prev;
  return (
    s.exact &&
    s.selectedUnit !== undefined &&
    s.todayKey >= s.selectedUnit.from &&
    s.todayKey <= s.selectedUnit.to
  );
}

function levelForSpan(spanDays: number): RulerLevel {
  if (spanDays <= 1) return "day";
  if (spanDays <= 7) return "week";
  if (spanDays <= 31) return "month";
  if (spanDays <= 366) return "year";
  return "all";
}

/**
 * Pure SSR-safe projection of `range` into initial UI state without reading
 * `todayKey`, `firstKey`, `window`, or `document`.
 */
function describeRangeForUi(range: RangeSelection): {
  level: RulerLevel;
  word: string;
} {
  if (range.kind === "preset") {
    switch (range.key) {
      case "1d":
        return { level: "day", word: LEVEL_LABELS.day };
      case "1w":
        return { level: "week", word: LEVEL_LABELS.week };
      case "1m":
        return { level: "month", word: LEVEL_LABELS.month };
      case "6m":
      case "1y":
        return { level: "year", word: LEVEL_LABELS.year };
      case "all":
        return { level: "all", word: LEVEL_LABELS.all };
    }
  }

  const exact = exactUnitOf(range);
  if (exact) {
    return { level: exact.unit, word: LEVEL_LABELS[exact.unit] };
  }

  const spanDays = daysBetween(range.from, range.to) + 1;
  const level = levelForSpan(spanDays);
  return {
    level,
    word: LEVEL_LABELS[level],
  };
}

function clampKey(key: string, firstKey: string, todayKey: string): string {
  if (key < firstKey) return firstKey;
  if (key > todayKey) return todayKey;
  return key;
}

function clampIndex(idx: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, idx));
}

function normalizeFirstKey(firstKey: string, todayKey: string): string {
  return firstKey <= todayKey ? firstKey : todayKey;
}

/**
 * Effective day span used for All-level scale math so All is always strictly
 * zoomed out past Year even for short or single-day archives.
 */
function effectiveScaleDays(rulerWidth: number, trueArchiveDays: number): number {
  const width = rulerWidth > 0 ? rulerWidth : DEFAULT_RULER_WIDTH;
  const minDaysForZoomOut = (width * ALL_FILL_RATIO) / MAX_ALL_PPD;
  return Math.max(trueArchiveDays > 0 ? trueArchiveDays : 1, minDaysForZoomOut);
}

function computeCenters(
  units: RulerUnit[],
  firstKey: string,
  ppd: number,
): number[] {
  const centers = new Array<number>(units.length);
  for (let i = 0; i < units.length; i++) {
    centers[i] = unitCenterDay(units[i], firstKey) * ppd;
  }
  return centers;
}

function buildLevelGeometry(
  level: RulerLevel,
  firstKey: string,
  todayKey: string,
  ppd: number,
): {
  units: RulerUnit[];
  centers: number[];
  realFirst: number;
  realLast: number;
} {
  const unitKind: CalendarUnit = level === "all" ? "year" : level;
  const { units, realFirst, realLast } = buildRulerUnits(
    unitKind,
    firstKey,
    todayKey,
  );
  const centers = computeCenters(units, firstKey, ppd);
  return { units, centers, realFirst, realLast };
}

function readPalette(el: HTMLElement): RulerPalette {
  const cs = getComputedStyle(el);
  const accent =
    cs.getPropertyValue("--music-accent").trim() || siteConfig.accentColor;
  const fontFamily = cs.fontFamily || "monospace";
  return {
    accent,
    major: "#8A8A82",
    medium: "#5A5A52",
    minor: "#3A3A32",
    baseline: "#26261F",
    label: "#8A8A82",
    font: `10px ${fontFamily}`,
  };
}

function isAllSettled(s: RulerInternalState): boolean {
  return !s.isZooming && s.settledLevel === "all";
}

function dayOffsetToDateKey(
  firstKey: string,
  todayKey: string,
  dayOffset: number,
): string {
  return clampKey(addCalendarDays(firstKey, Math.round(dayOffset)), firstKey, todayKey);
}

export function ZoomRuler({
  range,
  onSelectRange,
  firstKey,
  todayKey,
  disabled = false,
  label,
}: ZoomRulerProps) {
  const isDisabled = Boolean(disabled);
  const hasLabel = label !== undefined && label !== null;

  const [ui, setUi] = useState<UiSnapshot>(() => {
    const initial = describeRangeForUi(range);
    const idx = LEVELS.indexOf(initial.level);
    return {
      activeLayer: 0,
      layer0: initial.word,
      layer1: "",
      zoomOutDisabled: idx <= 0,
      zoomInDisabled: idx >= LEVELS.length - 1,
      isAllLocked: initial.level === "all",
      onToday: true,
    };
  });

  const rulerContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<TapeController | null>(null);
  const onSelectRangeRef = useRef(onSelectRange);
  const disabledRef = useRef(isDisabled);
  const lastEmittedRef = useRef<RangeSelection | null>(null);
  const initializedRef = useRef(false);
  const stateRef = useRef<RulerInternalState | null>(null);
  const actionsRef = useRef<{
    scheduleDraw: () => void;
    animateZoomTo: (targetLevel: RulerLevel, emit: boolean) => void;
    finishZoomAt: (targetLevel: RulerLevel, emit: boolean) => void;
    syncUi: () => void;
    handleZoomStep: (delta: -1 | 1) => void;
    handleToday: () => void;
    cancelZoomTimers: () => void;
  } | null>(null);

  useEffect(() => {
    onSelectRangeRef.current = onSelectRange;
  }, [onSelectRange]);

  useEffect(() => {
    disabledRef.current = isDisabled;
    const ctrl = controllerRef.current;
    if (ctrl) {
      ctrl.setDisabled(isDisabled);
    }
    const s = stateRef.current;
    const actions = actionsRef.current;
    if (isDisabled && s && s.isZooming && actions) {
      actions.finishZoomAt(s.settledLevel, false);
    }
  }, [isDisabled]);

  // Mount canvas, tape controller, observers, and zoom state machine.
  useEffect(() => {
    const container = rulerContainerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;

    const effFirst = normalizeFirstKey(firstKey, todayKey);
    const initialPlacement = placementForRange(range, effFirst, todayKey);
    const initialWidth = container.clientWidth || DEFAULT_RULER_WIDTH;
    const initialHeight = container.clientHeight || DEFAULT_RULER_HEIGHT;
    const initialArchiveDays = Math.max(0, daysBetween(effFirst, todayKey));
    const initialScaleDays = effectiveScaleDays(initialWidth, initialArchiveDays);
    const initialPpd = snapPpd(initialPlacement.level, initialWidth, initialScaleDays);
    const initialGeo = buildLevelGeometry(
      initialPlacement.level,
      effFirst,
      todayKey,
      initialPpd,
    );
    const rawIdx = indexForDate(initialGeo.units, initialPlacement.anchorKey);
    const initialIdx = clampIndex(
      rawIdx < 0 ? initialGeo.realLast : rawIdx,
      initialGeo.realFirst,
      initialGeo.realLast,
    );
    const initialOffset = initialGeo.centers[initialIdx] ?? 0;
    const initialAllOffset =
      restDay("all", initialPlacement.anchorKey, effFirst, todayKey) *
      snapPpd("all", initialWidth, initialScaleDays);

    const state: RulerInternalState = {
      firstKey: effFirst,
      todayKey,
      workingLevel: initialPlacement.level,
      settledLevel: initialPlacement.level,
      ppd: initialPpd,
      units: initialGeo.units,
      centers: initialGeo.centers,
      realFirst: initialGeo.realFirst,
      realLast: initialGeo.realLast,
      offset: initialOffset,
      lockedAllOffset: initialAllOffset,
      selected: initialPlacement.exact ? initialIdx : null,
      anchorKey: initialPlacement.anchorKey,
      exact: initialPlacement.exact,
      customLabel: initialPlacement.label,
      isZooming: false,
      liveZoomDay: restDay("all", initialPlacement.anchorKey, effFirst, todayKey),
      liveZoomBaseDay: 0,
      cssWidth: initialWidth,
      cssHeight: initialHeight,
      zoomAnimId: null,
      zoomSnapTimer: null,
      drawRafId: null,
    };
    stateRef.current = state;

    function getScaleDays(): number {
      const trueDays = Math.max(0, daysBetween(state.firstKey, state.todayKey));
      return effectiveScaleDays(state.cssWidth, trueDays);
    }

    function getSnapPpd(level: RulerLevel): number {
      return snapPpd(level, state.cssWidth, getScaleDays());
    }

    function currentDisplayWord(): string {
      return LEVEL_LABELS[state.workingLevel];
    }

    function syncUi(): void {
      if (disposed) return;
      const nextWord = currentDisplayWord();
      const idx = LEVELS.indexOf(state.workingLevel);
      const nextZoomOutDisabled = idx <= 0;
      const nextZoomInDisabled = idx >= LEVELS.length - 1;
      const nextAllLocked = isAllSettled(state);
      const selectedUnit =
        state.selected !== null ? state.units[state.selected] : undefined;
      const todayInputs = {
        settledLevel: state.settledLevel,
        isZooming: state.isZooming,
        exact: state.exact,
        selectedUnit,
        todayKey: state.todayKey,
      };

      setUi((prev) => {
        const onToday = nextOnToday(prev.onToday, todayInputs);
        const currentWord = prev.activeLayer === 0 ? prev.layer0 : prev.layer1;
        const wordChanged = nextWord !== currentWord;
        const flagsChanged =
          prev.zoomOutDisabled !== nextZoomOutDisabled ||
          prev.zoomInDisabled !== nextZoomInDisabled ||
          prev.isAllLocked !== nextAllLocked ||
          prev.onToday !== onToday;

        if (!wordChanged && !flagsChanged) return prev;

        if (!wordChanged) {
          return {
            ...prev,
            zoomOutDisabled: nextZoomOutDisabled,
            zoomInDisabled: nextZoomInDisabled,
            isAllLocked: nextAllLocked,
            onToday,
          };
        }

        const nextLayer: 0 | 1 = prev.activeLayer === 0 ? 1 : 0;
        return {
          activeLayer: nextLayer,
          layer0: nextLayer === 0 ? nextWord : prev.layer0,
          layer1: nextLayer === 1 ? nextWord : prev.layer1,
          zoomOutDisabled: nextZoomOutDisabled,
          zoomInDisabled: nextZoomInDisabled,
          isAllLocked: nextAllLocked,
          onToday,
        };
      });
    }

    function emitRange(sel: RangeSelection): void {
      lastEmittedRef.current = sel;
      onSelectRangeRef.current(sel);
    }

    function cancelZoomTimers(): void {
      if (state.zoomAnimId !== null) {
        cancelAnimationFrame(state.zoomAnimId);
        state.zoomAnimId = null;
      }
      if (state.zoomSnapTimer !== null) {
        clearTimeout(state.zoomSnapTimer);
        state.zoomSnapTimer = null;
      }
    }

    function drawNow(): void {
      if (disposed || !container || !ctx) return;
      if (state.cssWidth <= 0 || state.cssHeight <= 0) return;

      const allSettled = isAllSettled(state);
      const allMode = allSettled && state.exact;
      const drawOffset = state.isZooming
        ? state.liveZoomDay * state.ppd
        : allSettled
          ? state.lockedAllOffset
          : state.offset;

      const selectedIdx =
        !allSettled && !state.isZooming && state.exact ? state.selected : null;

      drawRuler(ctx as unknown as RulerCtx, {
        width: state.cssWidth,
        height: state.cssHeight,
        level: state.workingLevel,
        units: state.units,
        centers: state.centers,
        offset: drawOffset,
        realFirst: state.realFirst,
        realLast: state.realLast,
        selected: selectedIdx,
        allMode,
        palette: readPalette(container),
      });
    }

    function scheduleDraw(): void {
      if (disposed || state.drawRafId !== null) return;
      state.drawRafId = requestAnimationFrame(() => {
        state.drawRafId = null;
        drawNow();
      });
    }

    function syncTapeUnits(targetDate: string): number {
      const raw = indexForDate(state.units, targetDate);
      const idx = clampIndex(
        raw < 0 ? state.realLast : raw,
        state.realFirst,
        state.realLast,
      );
      controllerRef.current?.setUnits(
        state.centers,
        state.realFirst,
        state.realLast,
        idx,
      );
      return idx;
    }

    function finishZoomAt(targetLevel: RulerLevel, emit: boolean): void {
      cancelZoomTimers();

      state.isZooming = false;
      state.workingLevel = targetLevel;
      state.settledLevel = targetLevel;
      state.ppd = getSnapPpd(targetLevel);
      if (emit) {
        state.exact = true;
        state.customLabel = null;
      }

      const geo = buildLevelGeometry(
        targetLevel,
        state.firstKey,
        state.todayKey,
        state.ppd,
      );
      state.units = geo.units;
      state.centers = geo.centers;
      state.realFirst = geo.realFirst;
      state.realLast = geo.realLast;

      const targetIdx = syncTapeUnits(state.anchorKey);
      state.offset = state.centers[targetIdx] ?? 0;
      state.selected = state.exact ? targetIdx : null;

      if (targetLevel === "all") {
        state.lockedAllOffset =
          restDay("all", state.anchorKey, state.firstKey, state.todayKey) *
          state.ppd;
      }

      syncUi();
      scheduleDraw();
      controllerRef.current?.refreshAria();

      if (emit) {
        if (targetLevel === "all") {
          emitRange(presetRange("all"));
        } else {
          const u = state.units[targetIdx];
          if (u) {
            emitRange(unitWindow(u.from, targetLevel));
          }
        }
      }
    }

    function animateZoomTo(targetLevel: RulerLevel, emit: boolean): void {
      cancelZoomTimers();

      if (prefersReducedMotion()) {
        finishZoomAt(targetLevel, emit);
        return;
      }

      const startPpd = state.ppd;
      const targetPpd = getSnapPpd(targetLevel);
      const logStart = Math.log(startPpd);
      const logEnd = Math.log(targetPpd);

      const startDay = state.isZooming
        ? state.liveZoomDay
        : (isAllSettled(state) ? state.lockedAllOffset : state.offset) / startPpd;
      const targetDay = restDay(
        targetLevel,
        state.anchorKey,
        state.firstKey,
        state.todayKey,
      );

      state.isZooming = true;
      state.liveZoomDay = startDay;
      syncUi();

      const startTime = performance.now();

      function step(): void {
        if (disposed) return;
        const t = Math.min(
          1,
          Math.max(0, (performance.now() - startTime) / RULER_MOTION.zoomMs),
        );
        const eased = easeInOutCubic(t);
        state.ppd = Math.exp(logStart + (logEnd - logStart) * eased);
        state.liveZoomDay = startDay + (targetDay - startDay) * eased;

        const nextLvl = nearestLevel(state.ppd, state.cssWidth, getScaleDays());
        if (nextLvl !== state.workingLevel) {
          state.workingLevel = nextLvl;
          const geo = buildLevelGeometry(
            nextLvl,
            state.firstKey,
            state.todayKey,
            state.ppd,
          );
          state.units = geo.units;
          state.centers = geo.centers;
          state.realFirst = geo.realFirst;
          state.realLast = geo.realLast;
          syncUi();
        } else {
          state.centers = computeCenters(state.units, state.firstKey, state.ppd);
        }

        drawNow();

        if (t < 1) {
          state.zoomAnimId = requestAnimationFrame(step);
        } else {
          finishZoomAt(targetLevel, emit);
        }
      }

      state.zoomAnimId = requestAnimationFrame(step);
    }

    function handleLiveZoom(factor: number): void {
      if (disabledRef.current || disposed) return;
      const wasAnimating = state.zoomAnimId !== null;
      cancelZoomTimers();

      const archiveMidDay = restDay(
        "all",
        state.anchorKey,
        state.firstKey,
        state.todayKey,
      );

      if (!state.isZooming) {
        state.liveZoomBaseDay = isAllSettled(state)
          ? restDay("day", state.anchorKey, state.firstKey, state.todayKey)
          : state.offset / state.ppd;
        state.isZooming = true;
      } else if (wasAnimating) {
        state.liveZoomBaseDay = state.liveZoomDay;
      }

      const scaleDays = getScaleDays();
      const minPpd = snapPpd("all", state.cssWidth, scaleDays);
      const maxPpd = snapPpd("day", state.cssWidth, scaleDays);
      state.ppd = Math.max(minPpd, Math.min(maxPpd, state.ppd * factor));

      const blend = allBlend(state.ppd, state.cssWidth, scaleDays);
      state.liveZoomDay =
        state.liveZoomBaseDay + (archiveMidDay - state.liveZoomBaseDay) * blend;

      const nextLvl = nearestLevel(state.ppd, state.cssWidth, scaleDays);
      if (nextLvl !== state.workingLevel) {
        state.workingLevel = nextLvl;
        const geo = buildLevelGeometry(
          nextLvl,
          state.firstKey,
          state.todayKey,
          state.ppd,
        );
        state.units = geo.units;
        state.centers = geo.centers;
        state.realFirst = geo.realFirst;
        state.realLast = geo.realLast;
      } else {
        state.centers = computeCenters(state.units, state.firstKey, state.ppd);
      }

      syncUi();
      scheduleDraw();

      state.zoomSnapTimer = setTimeout(() => {
        state.zoomSnapTimer = null;
        if (disposed || disabledRef.current) return;
        const snapTarget = nearestLevel(state.ppd, state.cssWidth, getScaleDays());
        animateZoomTo(snapTarget, true);
      }, LIVE_ZOOM_SNAP_DELAY_MS);
    }

    function handleZoomStep(delta: -1 | 1): void {
      if (disabledRef.current || disposed) return;
      const curIdx = LEVELS.indexOf(state.workingLevel);
      const nextIdx = curIdx + delta;
      if (nextIdx < 0 || nextIdx >= LEVELS.length) return;
      animateZoomTo(LEVELS[nextIdx], true);
    }

    function handleToday(): void {
      if (disabledRef.current || disposed) return;
      const wasZooming = state.isZooming;
      cancelZoomTimers();
      state.isZooming = false;
      state.anchorKey = state.todayKey;

      if (!wasZooming && state.settledLevel === "all") {
        return;
      }

      if (wasZooming) {
        const targetLevel = state.workingLevel;
        state.settledLevel = targetLevel;
        state.ppd = getSnapPpd(targetLevel);
        state.exact = true;
        state.customLabel = null;

        const geo = buildLevelGeometry(
          targetLevel,
          state.firstKey,
          state.todayKey,
          state.ppd,
        );
        state.units = geo.units;
        state.centers = geo.centers;
        state.realFirst = geo.realFirst;
        state.realLast = geo.realLast;

        if (targetLevel === "all") {
          const idx = syncTapeUnits(state.todayKey);
          state.offset = state.centers[idx] ?? 0;
          state.selected = idx;
          state.lockedAllOffset =
            restDay("all", state.todayKey, state.firstKey, state.todayKey) *
            state.ppd;
          syncUi();
          scheduleDraw();
          controllerRef.current?.refreshAria();
          emitRange(presetRange("all"));
          return;
        }

        const liveDate = dayOffsetToDateKey(
          state.firstKey,
          state.todayKey,
          state.liveZoomDay,
        );
        const curIdx = syncTapeUnits(liveDate);
        state.offset = state.centers[curIdx] ?? 0;
      }

      const targetIdx = state.realLast;
      const targetUnit = state.units[targetIdx];
      state.exact = true;
      state.customLabel = null;
      state.selected = targetIdx;
      syncUi();
      controllerRef.current?.goTo(targetIdx, true);
      controllerRef.current?.refreshAria();
      scheduleDraw();

      if (targetUnit && state.settledLevel !== "all") {
        emitRange(unitWindow(targetUnit.from, state.settledLevel));
      }
    }

    actionsRef.current = {
      scheduleDraw,
      animateZoomTo,
      finishZoomAt,
      syncUi,
      handleZoomStep,
      handleToday,
      cancelZoomTimers,
    };

    // Block pan wheel and navigation keys when settled at All, while keeping
    // ctrl/meta-wheel zoom and two-pointer pinch active.
    function onWheelCapture(e: WheelEvent): void {
      if (disabledRef.current) return;
      if (isAllSettled(state) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }

    function onKeyDownCapture(e: KeyboardEvent): void {
      if (disabledRef.current) return;
      if (
        (e.key === "t" || e.key === "T") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleToday();
        return;
      }
      if (
        isAllSettled(state) &&
        (e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "Home" ||
          e.key === "End")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }

    container.addEventListener("wheel", onWheelCapture, {
      capture: true,
      passive: false,
    });
    container.addEventListener("keydown", onKeyDownCapture, { capture: true });

    const controller = createTapeController({
      el: container,
      centers: state.centers,
      realFirst: state.realFirst,
      realLast: state.realLast,
      index: initialIdx,
      onFrame(offset) {
        if (state.isZooming || isAllSettled(state)) return;
        state.offset = offset;
        scheduleDraw();
      },
      onSettle(idx) {
        if (state.isZooming || isAllSettled(state)) return;
        const u = state.units[idx];
        if (!u) return;

        state.offset = state.centers[idx] ?? state.offset;
        state.selected = idx;
        state.exact = true;
        state.customLabel = null;
        state.anchorKey = dayOffsetToDateKey(
          state.firstKey,
          state.todayKey,
          state.offset / state.ppd,
        );

        syncUi();
        scheduleDraw();

        if (state.settledLevel !== "all") {
          emitRange(unitWindow(u.from, state.settledLevel));
        }
      },
      onZoom(factor) {
        handleLiveZoom(factor);
      },
      getValueText() {
        if (!state.exact && !state.isZooming && state.customLabel) {
          return state.customLabel;
        }
        if (state.settledLevel === "all" || state.workingLevel === "all") {
          return "All";
        }
        if (state.units.length === 0 || state.centers.length === 0) {
          return LEVEL_LABELS[state.workingLevel];
        }
        const idx = nearestIndex(
          state.centers,
          state.offset,
          state.realFirst,
          state.realLast,
        );
        const u = state.units[idx];
        return u
          ? formatRangeLabel({ kind: "window", from: u.from, to: u.to })
          : LEVEL_LABELS[state.workingLevel];
      },
    });
    controllerRef.current = controller;

    if (disabledRef.current) {
      controller.setDisabled(true);
    }

    function resizeCanvas(): void {
      if (disposed || !container || !canvas || !ctx) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;

      state.cssWidth = w;
      state.cssHeight = h;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!state.isZooming && state.settledLevel === "all") {
        state.ppd = getSnapPpd("all");
        const geo = buildLevelGeometry(
          "all",
          state.firstKey,
          state.todayKey,
          state.ppd,
        );
        state.units = geo.units;
        state.centers = geo.centers;
        state.realFirst = geo.realFirst;
        state.realLast = geo.realLast;
        const idx = syncTapeUnits(state.anchorKey);
        state.offset = state.centers[idx] ?? 0;
        state.lockedAllOffset =
          restDay("all", state.anchorKey, state.firstKey, state.todayKey) *
          state.ppd;
      }

      scheduleDraw();
    }

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(() => {
        resizeCanvas();
      });
      resizeObserver.observe(container);
    }

    // Redraw when the root accent CSS variable changes while the ruler is idle.
    let accentObserver: MutationObserver | null = null;
    if (typeof MutationObserver === "function") {
      accentObserver = new MutationObserver(() => {
        scheduleDraw();
      });
      accentObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
      if (document.body) {
        accentObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ["style", "class"],
        });
      }
    }

    if (document.fonts && typeof document.fonts.ready?.then === "function") {
      document.fonts.ready.then(() => {
        if (!disposed) scheduleDraw();
      });
    }

    syncUi();
    resizeCanvas();
    initializedRef.current = true;

    return () => {
      disposed = true;
      initializedRef.current = false;
      cancelZoomTimers();
      if (state.drawRafId !== null) {
        cancelAnimationFrame(state.drawRafId);
        state.drawRafId = null;
      }
      resizeObserver?.disconnect();
      accentObserver?.disconnect();
      container.removeEventListener("wheel", onWheelCapture, { capture: true });
      container.removeEventListener("keydown", onKeyDownCapture, { capture: true });
      controller.destroy();
      controllerRef.current = null;
      actionsRef.current = null;
      stateRef.current = null;
    };
    // Mount-only lifecycle; prop updates are synced in the dedicated effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external range, firstKey, or todayKey updates without echoing our own emits.
  useEffect(() => {
    if (!initializedRef.current) return;
    const state = stateRef.current;
    const controller = controllerRef.current;
    const actions = actionsRef.current;
    if (!state || !controller || !actions) return;

    const effFirst = normalizeFirstKey(firstKey, todayKey);
    const boundsChanged =
      effFirst !== state.firstKey || todayKey !== state.todayKey;

    if (
      !boundsChanged &&
      lastEmittedRef.current &&
      isSameRange(range, lastEmittedRef.current)
    ) {
      return;
    }

    lastEmittedRef.current = null;
    state.firstKey = effFirst;
    state.todayKey = todayKey;

    const placement = placementForRange(range, effFirst, todayKey);
    state.anchorKey = placement.anchorKey;
    state.exact = placement.exact;
    state.customLabel = placement.label;

    if (placement.level !== state.settledLevel || state.isZooming) {
      actions.animateZoomTo(placement.level, false);
      return;
    }

    if (placement.level === "all") {
      const trueDays = Math.max(0, daysBetween(effFirst, todayKey));
      const scaleDays = effectiveScaleDays(state.cssWidth, trueDays);
      state.ppd = snapPpd("all", state.cssWidth, scaleDays);
      const geo = buildLevelGeometry("all", effFirst, todayKey, state.ppd);
      state.units = geo.units;
      state.centers = geo.centers;
      state.realFirst = geo.realFirst;
      state.realLast = geo.realLast;
      const raw = indexForDate(state.units, placement.anchorKey);
      const idx = clampIndex(
        raw < 0 ? state.realLast : raw,
        state.realFirst,
        state.realLast,
      );
      controller.setUnits(state.centers, state.realFirst, state.realLast, idx);
      state.offset = state.centers[idx] ?? 0;
      state.selected = placement.exact ? idx : null;
      state.lockedAllOffset =
        restDay("all", placement.anchorKey, effFirst, todayKey) * state.ppd;
      actions.syncUi();
      actions.scheduleDraw();
      controller.refreshAria();
      return;
    }

    if (boundsChanged) {
      const geo = buildLevelGeometry(
        placement.level,
        effFirst,
        todayKey,
        state.ppd,
      );
      state.units = geo.units;
      state.centers = geo.centers;
      state.realFirst = geo.realFirst;
      state.realLast = geo.realLast;
      const raw = indexForDate(state.units, placement.anchorKey);
      const idx = clampIndex(
        raw < 0 ? state.realLast : raw,
        state.realFirst,
        state.realLast,
      );
      controller.setUnits(state.centers, state.realFirst, state.realLast, idx);
      state.offset = state.centers[idx] ?? 0;
      state.selected = placement.exact ? idx : null;
    } else {
      const raw = indexForDate(state.units, placement.anchorKey);
      const idx = clampIndex(
        raw < 0 ? state.realLast : raw,
        state.realFirst,
        state.realLast,
      );
      const currentIdx =
        state.centers.length > 0
          ? nearestIndex(
              state.centers,
              state.offset,
              state.realFirst,
              state.realLast,
            )
          : idx;
      state.selected = placement.exact ? idx : null;
      controller.setUnits(
        state.centers,
        state.realFirst,
        state.realLast,
        currentIdx,
      );
      controller.goTo(idx, true);
    }

    actions.syncUi();
    actions.scheduleDraw();
    controller.refreshAria();
  }, [range, firstKey, todayKey]);

  const zoomBtnClass = `font-mono text-[14px] leading-none h-[24px] sm:h-[28px] min-w-[22px] px-1 border-0 bg-transparent text-[#6A6A64] inline-flex items-center justify-center select-none box-border transition-none press hover:enabled:text-[#EDEDE8] active:enabled:text-music-accent focus-ring disabled:opacity-30 disabled:cursor-default ${
    isDisabled ? "cursor-wait" : "cursor-pointer"
  }`;

  const todayBtnClass = `font-mono w-[24px] h-[24px] sm:h-[28px] p-0 border-0 bg-transparent text-[#6A6A64] inline-flex items-center justify-center select-none flex-none sm:order-4 box-border transition-none press hover:enabled:text-music-accent focus-ring disabled:opacity-30 disabled:cursor-default ${
    isDisabled ? "cursor-wait" : "cursor-pointer"
  }`;

  return (
    <div
      role="group"
      aria-label="Time range filters"
      className={`flex flex-col items-stretch gap-2 w-full sm:flex-row sm:items-center sm:gap-1.5 sm:h-[28px] select-none box-border ${
        hasLabel ? "sm:justify-between" : "sm:w-auto shrink-0"
      } ${isDisabled ? "opacity-60 cursor-wait" : ""}`}
    >
      <div className="flex items-center justify-between gap-3 w-full h-[24px] sm:contents">
        {hasLabel && (
          <div className="flex-1 min-w-0 truncate sm:order-1 sm:mr-2.5">
            {label}
          </div>
        )}

        <div className="inline-flex items-center gap-1.5 shrink-0 sm:contents">
          <div className="inline-flex items-center gap-1.5 shrink-0 sm:order-2">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={isDisabled || ui.zoomOutDisabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                actionsRef.current?.handleZoomStep(-1);
              }}
              className={zoomBtnClass}
            >
              {"\u2212"}
            </button>
            <span
              aria-live="polite"
              className="inline-grid min-w-[38px] h-[24px] sm:h-[28px] items-center justify-items-center text-center font-mono text-[10px] text-[#8A8A82] select-none overflow-hidden shrink-0"
            >
              <span
                aria-hidden={ui.activeLayer !== 0}
                className={`col-start-1 row-start-1 whitespace-nowrap transition-opacity duration-150 ${
                  ui.activeLayer === 0 ? "opacity-100" : "opacity-0"
                }`}
              >
                {ui.layer0}
              </span>
              <span
                aria-hidden={ui.activeLayer !== 1}
                className={`col-start-1 row-start-1 whitespace-nowrap transition-opacity duration-150 ${
                  ui.activeLayer === 1 ? "opacity-100" : "opacity-0"
                }`}
              >
                {ui.layer1}
              </span>
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={isDisabled || ui.zoomInDisabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                actionsRef.current?.handleZoomStep(1);
              }}
              className={zoomBtnClass}
            >
              +
            </button>
          </div>

          <button
            type="button"
            aria-label="Jump to today"
            title="Jump to today (T)"
            disabled={isDisabled || ui.onToday}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              actionsRef.current?.handleToday();
            }}
            className={todayBtnClass}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
              <path
                d="M2 6.5h8.5M7.5 3.5l3 3-3 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={rulerContainerRef}
        aria-label="Zoomable timeline ruler"
        className={`w-full h-[28px] sm:order-3 sm:flex-initial sm:w-[440px] sm:min-w-[200px] sm:mx-1 relative overflow-hidden touch-none select-none box-border focus-ring ${
          isDisabled
            ? "cursor-wait"
            : ui.isAllLocked
              ? "cursor-default"
              : "cursor-grab active:cursor-grabbing"
        }`}
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-full pointer-events-none"
        />
      </div>
    </div>
  );
}
