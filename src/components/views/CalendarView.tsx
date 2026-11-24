"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  calendarYears,
  clipSelectionToYear,
  calendarThresholds,
  calendarLevel,
  isSelectableDate,
  monthSelection,
  yearSelection,
  normalizeSelection,
  selectionToRange,
  summarizeCalendar,
  weekColumns,
  monthStartColumns,
  type CalendarData,
  type CalendarSelection,
} from "@/lib/calendar";
import { formatRangeLabel } from "@/lib/range";

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const CalendarLegend: React.FC = () => {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#5A5A55] select-none">
      <span>Less</span>
      <div className="flex items-center gap-[3px]">
        <div className="w-[10px] h-[10px] rounded-[1px] calendar-level-0" title="0 plays" />
        <div className="w-[10px] h-[10px] rounded-[1px] calendar-level-1" title="Level 1" />
        <div className="w-[10px] h-[10px] rounded-[1px] calendar-level-2" title="Level 2" />
        <div className="w-[10px] h-[10px] rounded-[1px] calendar-level-3" title="Level 3" />
        <div className="w-[10px] h-[10px] rounded-[1px] calendar-level-4" title="Level 4" />
      </div>
      <span>More</span>
    </div>
  );
};

interface YearBlockProps {
  year: number;
  firstDate: string | null;
  today: string;
  clippedSelection: CalendarSelection | null;
  hasActiveSelection: boolean;
  isAnchorYear: boolean;
  selectionStart: string | null;
  selectionEnd: string | null;
  dayCounts: Map<string, number>;
  thresholds: [number, number, number];
  onSelectMonth: (year: number, month: number) => void;
  onSelectYear: (year: number) => void;
}

const YearBlock = React.memo<YearBlockProps>(
  function YearBlock({
    year,
    firstDate,
    today,
    clippedSelection,
    hasActiveSelection,
    isAnchorYear,
    selectionStart,
    selectionEnd,
    dayCounts,
    thresholds,
    onSelectMonth,
    onSelectYear,
  }) {
    const cols = useMemo(() => weekColumns(year), [year]);
    const monthCols = useMemo(() => monthStartColumns(year), [year]);
    const months = useMemo(
      () =>
        Array.from({ length: 12 }, (_, m) => {
          const monthNum = m + 1;
          const selection = monthSelection(year, monthNum);
          return {
            monthNum,
            label: SHORT_MONTHS[m],
            selection,
            maxDays: Number(selection.to.slice(8, 10)),
          };
        }),
      [year]
    );
    const numCols = cols.length;

    // Calculate total plays in this year
    const yearPlays = useMemo(() => {
      let total = 0;
      const prefix = `${String(year).padStart(4, "0")}-`;
      for (const [d, count] of dayCounts.entries()) {
        if (d.startsWith(prefix)) {
          total += count;
        }
      }
      return total;
    }, [year, dayCounts]);

    return (
      <section
        className={`border bg-[#0B0B0A] p-3 md:p-4 transition-colors ${
          isAnchorYear ? "border-[#383830]" : "border-[#1C1C1A]"
        }`}
        data-year={year}
      >
        {/* Header */}
        <div className="flex items-baseline justify-between gap-2 mb-3 select-none">
          <div className="flex items-baseline gap-2.5">
            <button
              type="button"
              onClick={() => onSelectYear(year)}
              className="font-display text-[15px] font-medium text-[#EDEDE8] hover:text-music-accent transition-colors bg-transparent border-0 p-0 cursor-pointer text-left"
              title={`Select year ${year}`}
            >
              {year}
            </button>
            <span className="font-mono text-[11px] text-[#5A5A55]">
              {yearPlays.toLocaleString("en-US")} plays
            </span>
          </div>
        </div>

        {/* 1. Mobile Heatmap (md:hidden) */}
        <div className="md:hidden w-full select-none">
          <div
            className="grid gap-[2px] items-center w-full"
            style={{ gridTemplateColumns: "18px repeat(12, minmax(0, 1fr))" }}
          >
            {/* Top row: spacer + 12 month buttons */}
            <div />
            {months.map((month) => {
              const isDisabled =
                firstDate === null ||
                month.selection.to < firstDate ||
                month.selection.from > today;
              return (
                <button
                  key={month.monthNum}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => onSelectMonth(year, month.monthNum)}
                  className="font-display text-[10px] text-[#5A5A55] font-medium py-1 text-center hover:text-music-accent disabled:opacity-20 disabled:pointer-events-none disabled:cursor-not-allowed bg-transparent border-0 cursor-pointer"
                  title={
                    isDisabled
                      ? `No data for ${month.label} ${year}`
                      : `Select ${month.label} ${year}`
                  }
                >
                  {month.label}
                </button>
              );
            })}

            {/* 31 Day rows */}
            {Array.from({ length: 31 }, (_, dayIdx) => {
              const dayNum = dayIdx + 1;
              const isLabelDay =
                dayNum === 1 || dayNum === 10 || dayNum === 20 || dayNum === 30;

              return (
                <React.Fragment key={dayNum}>
                  <div className="h-[10px] leading-[10px] text-[10px] text-[#5A5A55] text-right pr-[3px] select-none font-mono">
                    {isLabelDay ? dayNum : ""}
                  </div>
                  {months.map((month) => {
                    if (dayNum > month.maxDays) {
                      return (
                        <div
                          key={`empty-${month.monthNum}-${dayNum}`}
                          className="h-[10px] w-full rounded-[1px] opacity-[0.12] pointer-events-none"
                        />
                      );
                    }
                    const yStr = String(year).padStart(4, "0");
                    const mStr = String(month.monthNum).padStart(2, "0");
                    const dStr = String(dayNum).padStart(2, "0");
                    const dateKey = `${yStr}-${mStr}-${dStr}`;
                    const selectable = isSelectableDate(dateKey, firstDate, today);
                    if (!selectable) {
                      return (
                        <div
                          key={dateKey}
                          className="h-[10px] w-full rounded-[1px] opacity-[0.12] pointer-events-none"
                        />
                      );
                    }

                    const count = dayCounts.get(dateKey) ?? 0;
                    const level = calendarLevel(count, thresholds);
                    const isSelected =
                      clippedSelection !== null &&
                      dateKey >= clippedSelection.from &&
                      dateKey <= clippedSelection.to;
                    const isStartOrEnd =
                      dateKey === selectionStart || dateKey === selectionEnd;

                    const opacityClass =
                      hasActiveSelection && !isSelected ? "opacity-35" : "opacity-100";
                    const ringClass = isStartOrEnd
                      ? "ring-1 ring-inset ring-[#EDEDE8] z-10"
                      : "";

                    return (
                      <div
                        key={dateKey}
                        data-date={dateKey}
                        title={`${dateKey} · ${count} plays`}
                        className={`h-[10px] w-full rounded-[1px] calendar-level-${level} ${opacityClass} ${ringClass} cursor-pointer transition-[opacity,box-shadow] duration-75`}
                        style={{ touchAction: "pan-y" }}
                      />
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* 2. Desktop Heatmap (hidden md:block) */}
        <div className="hidden md:block w-full select-none">
          {/* Desktop Month Header Row */}
          <div
            className="grid items-center mb-1 text-[10px] text-[#5A5A55] font-mono select-none"
            style={{
              gridTemplateColumns: `20px repeat(${numCols}, minmax(0, 1fr))`,
              gap: "3px",
            }}
          >
            <div />
            {months.map((month, m) => {
              const colIndex = monthCols[m];
              const isDisabled =
                firstDate === null ||
                month.selection.to < firstDate ||
                month.selection.from > today;
              return (
                <button
                  key={month.monthNum}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => onSelectMonth(year, month.monthNum)}
                  style={{ gridColumnStart: colIndex + 2 }}
                  className="font-display text-[10px] text-[#5A5A55] hover:text-music-accent disabled:opacity-20 disabled:pointer-events-none disabled:cursor-not-allowed whitespace-nowrap overflow-visible text-left p-0 bg-transparent border-0 cursor-pointer"
                  title={
                    isDisabled
                      ? `No data for ${month.label} ${year}`
                      : `Select ${month.label} ${year}`
                  }
                >
                  {month.label}
                </button>
              );
            })}
          </div>

          {/* Desktop Grid (Weekdays M/W/F + Cells sharing the same row tracks) */}
          <div
            className="grid select-none"
            style={{
              gridTemplateColumns: `20px repeat(${numCols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(7, minmax(0, 1fr))`,
              gap: "3px",
            }}
          >
            {/* Weekday labels in column 1 aligned to rows 1, 3, 5 (M, W, F) */}
            <div
              style={{ gridColumn: 1, gridRow: 1 }}
              className="text-[10px] text-[#5A5A55] text-right font-mono select-none flex items-center justify-end leading-none pr-[3px]"
            >
              M
            </div>
            <div
              style={{ gridColumn: 1, gridRow: 3 }}
              className="text-[10px] text-[#5A5A55] text-right font-mono select-none flex items-center justify-end leading-none pr-[3px]"
            >
              W
            </div>
            <div
              style={{ gridColumn: 1, gridRow: 5 }}
              className="text-[10px] text-[#5A5A55] text-right font-mono select-none flex items-center justify-end leading-none pr-[3px]"
            >
              F
            </div>

            {/* Week grid cells */}
            {cols.map((colDays, colIdx) =>
              colDays.map((dateKey, rowIdx) => {
                const colNum = colIdx + 2;
                const rowNum = rowIdx + 1;
                if (!dateKey) {
                  return (
                    <div
                      key={`empty-${colIdx}-${rowIdx}`}
                      style={{ gridColumn: colNum, gridRow: rowNum }}
                      className="aspect-square rounded-[1.5px] opacity-[0.12] pointer-events-none"
                    />
                  );
                }
                const selectable = isSelectableDate(dateKey, firstDate, today);
                if (!selectable) {
                  return (
                    <div
                      key={dateKey}
                      style={{ gridColumn: colNum, gridRow: rowNum }}
                      className="aspect-square rounded-[1.5px] opacity-[0.12] pointer-events-none"
                    />
                  );
                }
                const count = dayCounts.get(dateKey) ?? 0;
                const level = calendarLevel(count, thresholds);
                const isSelected =
                  clippedSelection !== null &&
                  dateKey >= clippedSelection.from &&
                  dateKey <= clippedSelection.to;
                const isStartOrEnd =
                  dateKey === selectionStart || dateKey === selectionEnd;

                const opacityClass =
                  hasActiveSelection && !isSelected ? "opacity-35" : "opacity-100";
                const ringClass = isStartOrEnd
                  ? "ring-1 ring-inset ring-[#EDEDE8] z-10"
                  : "";

                return (
                  <div
                    key={dateKey}
                    data-date={dateKey}
                    style={{ gridColumn: colNum, gridRow: rowNum, touchAction: "pan-y" }}
                    title={`${dateKey} · ${count} plays`}
                    className={`aspect-square rounded-[1.5px] calendar-level-${level} ${opacityClass} ${ringClass} cursor-pointer transition-[opacity,box-shadow] duration-75 hover:outline hover:outline-1.5 hover:outline-[#EDEDE8] hover:z-20`}
                  />
                );
              })
            )}
          </div>
        </div>
      </section>
    );
  },
  (prev, next) => {
    if (prev.year !== next.year) return false;
    if (prev.firstDate !== next.firstDate) return false;
    if (prev.today !== next.today) return false;
    if (prev.hasActiveSelection !== next.hasActiveSelection) return false;
    if (prev.isAnchorYear !== next.isAnchorYear) return false;
    if (prev.selectionStart !== next.selectionStart) return false;
    if (prev.selectionEnd !== next.selectionEnd) return false;
    if (prev.dayCounts !== next.dayCounts) return false;
    if (
      prev.thresholds[0] !== next.thresholds[0] ||
      prev.thresholds[1] !== next.thresholds[1] ||
      prev.thresholds[2] !== next.thresholds[2]
    ) {
      return false;
    }

    const pSel = prev.clippedSelection;
    const nSel = next.clippedSelection;
    if (pSel === null && nSel === null) return true;
    if (pSel === null || nSel === null) return false;
    return pSel.from === nSel.from && pSel.to === nSel.to;
  }
);

export interface CalendarViewProps {
  data: CalendarData | null;
  isLoading: boolean; // true only for a first load with no data
  selection: CalendarSelection | null; // committed selection, owned by ListeningView
  onSelectionChange: (sel: CalendarSelection | null) => void; // called on drag end, a tap pair, month/year click, Clear
  onOpenInOverview: (sel: CalendarSelection) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  data,
  isLoading,
  selection,
  onSelectionChange,
  onOpenInOverview,
}) => {
  // Sync draft from selection prop
  const [draft, setDraft] = useState<CalendarSelection | null>(selection);
  const draftRef = useRef<CalendarSelection | null>(selection);
  const [pendingTouchAnchor, setPendingTouchAnchor] = useState<string | null>(null);
  const pendingTouchAnchorRef = useRef<string | null>(null);
  pendingTouchAnchorRef.current = pendingTouchAnchor;

  useEffect(() => {
    setDraft(selection);
    draftRef.current = selection;
    if (selection === null) {
      setPendingTouchAnchor(null);
    }
  }, [selection]);

  // Container ref for scoped hit testing
  const heatmapsContainerRef = useRef<HTMLDivElement | null>(null);

  // Pointer drag state
  const isDraggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const capturedTargetRef = useRef<HTMLElement | null>(null);
  const anchorRef = useRef<string | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchDateRef = useRef<string | null>(null);

  const windowPointerMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const windowPointerUpRef = useRef<((e: PointerEvent) => void) | null>(null);
  const windowPointerCancelRef = useRef<((e: PointerEvent) => void) | null>(null);
  const lostCaptureCleanupRef = useRef<(() => void) | null>(null);

  const removeWindowListeners = useCallback(() => {
    if (windowPointerMoveRef.current) {
      window.removeEventListener("pointermove", windowPointerMoveRef.current);
      windowPointerMoveRef.current = null;
    }
    if (windowPointerUpRef.current) {
      window.removeEventListener("pointerup", windowPointerUpRef.current);
      windowPointerUpRef.current = null;
    }
    if (windowPointerCancelRef.current) {
      window.removeEventListener("pointercancel", windowPointerCancelRef.current);
      windowPointerCancelRef.current = null;
    }
  }, []);

  const cleanupCaptureLoss = useCallback(() => {
    if (lostCaptureCleanupRef.current) {
      lostCaptureCleanupRef.current();
      lostCaptureCleanupRef.current = null;
    }
  }, []);

  const endDrag = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    cleanupCaptureLoss();

    const activeId = activePointerIdRef.current;
    const captured = capturedTargetRef.current;
    if (captured && activeId !== null) {
      try {
        if (captured.hasPointerCapture(activeId)) {
          captured.releasePointerCapture(activeId);
        }
      } catch {
        // Pointer capture may have already been released
      }
    }
    capturedTargetRef.current = null;
    activePointerIdRef.current = null;
    anchorRef.current = null;

    removeWindowListeners();

    if (draftRef.current) {
      onSelectionChange(draftRef.current);
    }
  }, [cleanupCaptureLoss, onSelectionChange, removeWindowListeners]);

  const handleWindowPointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current || e.pointerId !== activePointerIdRef.current) return;
    const container = heatmapsContainerRef.current;
    if (!container) return;

    // Scope pointer hit testing to current heatmap container
    const elem = document.elementFromPoint(e.clientX, e.clientY);
    if (!elem || !container.contains(elem)) return;

    const cell = elem.closest<HTMLElement>("[data-date]");
    if (cell && cell.dataset.date && anchorRef.current) {
      const nextDate = cell.dataset.date;
      const next = normalizeSelection(anchorRef.current, nextDate);
      if (
        !draftRef.current ||
        draftRef.current.from !== next.from ||
        draftRef.current.to !== next.to
      ) {
        draftRef.current = next;
        setDraft(next);
      }
    }
    e.preventDefault();
  }, []);

  const handleWindowPointerUp = useCallback(
    (e: PointerEvent) => {
      if (
        activePointerIdRef.current === null ||
        e.pointerId === activePointerIdRef.current
      ) {
        endDrag();
      }
    },
    [endDrag]
  );

  const handleWindowPointerCancel = useCallback(
    (e: PointerEvent) => {
      if (
        activePointerIdRef.current === null ||
        e.pointerId === activePointerIdRef.current
      ) {
        endDrag();
      }
    },
    [endDrag]
  );

  // Clean unmount of window listeners and capture-loss handlers
  useEffect(() => {
    return () => {
      cleanupCaptureLoss();
      removeWindowListeners();
    };
  }, [cleanupCaptureLoss, removeWindowListeners]);

  const handleContainerPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      if (
        activePointerIdRef.current !== null &&
        e.pointerId !== activePointerIdRef.current
      ) {
        return;
      }

      const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-date]");
      if (!cell || !cell.dataset.date) return;
      const d = cell.dataset.date;

      if (e.pointerType === "touch") {
        activePointerIdRef.current = e.pointerId;
        touchStartPosRef.current = { x: e.clientX, y: e.clientY };
        touchDateRef.current = d;
        return;
      }

      if (e.pointerType === "mouse" && e.button !== 0) return;

      cleanupCaptureLoss();

      activePointerIdRef.current = e.pointerId;
      anchorRef.current = d;
      capturedTargetRef.current = cell;
      isDraggingRef.current = true;

      let hasCapture = false;
      try {
        cell.setPointerCapture(e.pointerId);
        hasCapture = true;
      } catch {
        // Element may not support capture in test/mock environment
      }

      const initialDraft = { from: d, to: d };
      draftRef.current = initialDraft;
      setDraft(initialDraft);
      setPendingTouchAnchor(null);

      windowPointerMoveRef.current = handleWindowPointerMove;
      windowPointerUpRef.current = handleWindowPointerUp;
      windowPointerCancelRef.current = handleWindowPointerCancel;

      window.addEventListener("pointermove", handleWindowPointerMove, {
        passive: false,
      });
      window.addEventListener("pointerup", handleWindowPointerUp);
      window.addEventListener("pointercancel", handleWindowPointerCancel);

      if (hasCapture) {
        const onLostCapture = () => {
          cleanupCaptureLoss();
          endDrag();
        };
        cell.addEventListener("lostpointercapture", onLostCapture);
        lostCaptureCleanupRef.current = () => {
          cell.removeEventListener("lostpointercapture", onLostCapture);
        };
      }

      e.preventDefault();
    },
    [
      cleanupCaptureLoss,
      handleWindowPointerMove,
      handleWindowPointerUp,
      handleWindowPointerCancel,
      endDrag,
    ]
  );

  const handleContainerPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (
        e.pointerType === "touch" &&
        e.pointerId === activePointerIdRef.current
      ) {
        const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-date]");
        const d = cell?.dataset.date ?? touchDateRef.current;
        if (d && touchStartPosRef.current) {
          const dist = Math.hypot(
            e.clientX - touchStartPosRef.current.x,
            e.clientY - touchStartPosRef.current.y
          );
          if (dist <= 10) {
            const pending = pendingTouchAnchorRef.current;
            if (!pending) {
              const next = { from: d, to: d };
              draftRef.current = next;
              setDraft(next);
              setPendingTouchAnchor(d);
              onSelectionChange(next);
            } else {
              const next = normalizeSelection(pending, d);
              draftRef.current = next;
              setDraft(next);
              setPendingTouchAnchor(null);
              onSelectionChange(next);
            }
          }
        }
        activePointerIdRef.current = null;
        touchStartPosRef.current = null;
        touchDateRef.current = null;
      }
    },
    [onSelectionChange]
  );

  const handleContainerPointerCancel = useCallback((e: React.PointerEvent) => {
    if (
      e.pointerType === "touch" &&
      e.pointerId === activePointerIdRef.current
    ) {
      activePointerIdRef.current = null;
      touchStartPosRef.current = null;
      touchDateRef.current = null;
    }
  }, []);

  const handleSelectMonth = useCallback(
    (year: number, month: number) => {
      const next = monthSelection(year, month);
      draftRef.current = next;
      setDraft(next);
      setPendingTouchAnchor(null);
      onSelectionChange(next);
    },
    [onSelectionChange]
  );

  const handleSelectYear = useCallback(
    (year: number) => {
      const next = yearSelection(year);
      draftRef.current = next;
      setDraft(next);
      setPendingTouchAnchor(null);
      onSelectionChange(next);
    },
    [onSelectionChange]
  );

  const handleClear = useCallback(() => {
    draftRef.current = null;
    setDraft(null);
    setPendingTouchAnchor(null);
    onSelectionChange(null);
  }, [onSelectionChange]);

  const handleOpenInOverview = useCallback(() => {
    if (draftRef.current) {
      onOpenInOverview(draftRef.current);
    }
  }, [onOpenInOverview]);

  // Memoize data calculations before any conditional returns
  const dayCounts = useMemo(() => {
    if (!data) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const d of data.days) {
      map.set(d.date, d.count);
    }
    return map;
  }, [data]);

  const thresholds = useMemo<[number, number, number]>(() => {
    if (!data) return [1, 1, 1];
    return calendarThresholds(data.days.map((d) => d.count));
  }, [data]);

  const years = useMemo(() => {
    if (!data || !data.firstDate) return [];
    return calendarYears(data.firstDate, data.today);
  }, [data]);

  const draftSummary = useMemo(() => {
    if (!data || !data.firstDate || !draft) return null;
    return summarizeCalendar(data.days, draft, {
      firstDate: data.firstDate,
      today: data.today,
    });
  }, [data, draft]);

  // Skeleton only when loading with no data; return no content otherwise when data is null
  if (!data) {
    if (isLoading) {
      return (
        <div className="w-full flex flex-col gap-6">
          <div className="w-full border border-[#1C1C1A] bg-[#0B0B0A] p-4 animate-pulse">
            <div className="h-5 w-28 bg-[#141413] mb-4" />
            <div className="h-[180px] w-full bg-[#141413]" />
          </div>
        </div>
      );
    }
    return null;
  }

  // Loaded empty data state
  if (data.days.length === 0 || !data.firstDate) {
    return (
      <div className="w-full py-8 text-center font-mono text-[12px] text-[#5A5A55]">
        No Plays yet.
      </div>
    );
  }

  const draftFrom = draft?.from ?? null;
  const draftTo = draft?.to ?? null;
  const hasActiveSelection = Boolean(draft);

  return (
    <div className="w-full flex flex-col">
      {/* Sticky selection bar */}
      <div className="sticky top-0 z-20 bg-[#080808] border-b border-[#26261F] py-2 px-3 sm:px-4 mb-4 flex items-center justify-between gap-3 flex-wrap font-mono text-[12px]">
        <div className="flex items-baseline gap-2.5 flex-wrap min-h-[26px]">
          {pendingTouchAnchor ? (
            <>
              {draft && (
                <span className="text-music-accent font-semibold">
                  {formatRangeLabel(selectionToRange(draft))}
                </span>
              )}
              <span className="text-[#5A5A55]">Tap an end day</span>
            </>
          ) : draft ? (
            <>
              <span className="text-music-accent font-semibold">
                {formatRangeLabel(selectionToRange(draft))}
              </span>
              <span className="text-[#5A5A55]">
                {draftSummary ? `${draftSummary.plays.toLocaleString("en-US")} plays` : ""}
              </span>
            </>
          ) : (
            <span className="text-[#5A5A55]">Drag across days or pick a month</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {draft && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[#5A5A55] hover:text-[#EDEDE8] transition-colors cursor-pointer bg-transparent border-0 p-0 text-[12px] font-mono"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            disabled={!draft}
            onClick={handleOpenInOverview}
            className="font-mono text-[12px] whitespace-nowrap py-[3px] px-2.5 rounded-none transition-none border border-music-accent text-music-accent bg-transparent flex items-center justify-center text-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:border-[#26261F] disabled:text-[#5A5A55]"
          >
            Open in Overview &rarr;
          </button>
        </div>
      </div>

      {/* Year heatmaps container with delegated pointer events */}
      <div
        ref={heatmapsContainerRef}
        className="w-full flex flex-col gap-6"
        onPointerDown={handleContainerPointerDown}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerCancel}
      >
        {years.map((year) => {
          const clipped = clipSelectionToYear(draft, year);
          const isAnchorYear =
            draftFrom !== null && draftFrom.slice(0, 4) === String(year);
          const selectionStart =
            draftFrom !== null && draftFrom.slice(0, 4) === String(year)
              ? draftFrom
              : null;
          const selectionEnd =
            draftTo !== null && draftTo.slice(0, 4) === String(year)
              ? draftTo
              : null;

          return (
            <YearBlock
              key={year}
              year={year}
              firstDate={data.firstDate}
              today={data.today}
              clippedSelection={clipped}
              hasActiveSelection={hasActiveSelection}
              isAnchorYear={isAnchorYear}
              selectionStart={selectionStart}
              selectionEnd={selectionEnd}
              dayCounts={dayCounts}
              thresholds={thresholds}
              onSelectMonth={handleSelectMonth}
              onSelectYear={handleSelectYear}
            />
          );
        })}
      </div>
    </div>
  );
};
