"use client";

import React, { useCallback, useMemo, useState } from "react";
import type { RangeKey, ActivityBucket } from "@/lib/types";
import type { CadenceGranularity } from "@/lib/range";
import { formatBucketTooltip } from "@/lib/format-utils";
import { useConfig } from "@/context/ConfigContext";

export type ActivityBucketSelectHandler = (
  bucket: ActivityBucket,
  granularity: CadenceGranularity
) => void;

export interface ActivityChartProps {
  granularity: CadenceGranularity;
  rangeKey?: RangeKey | null;
  rangeLabel?: string;
  activityCadence: ActivityBucket[];
  monthlyCadence?: ActivityBucket[];
  isLoading?: boolean;
  onSelectBucket?: ActivityBucketSelectHandler;
  label?: string;
  headerAside?: React.ReactNode;
  showRange?: boolean;
  visitorTimezone?: string;
  heading?: React.ReactNode;
}

const EMPTY_CADENCE_BAR_COUNTS: Record<RangeKey, number> = {
  "1d": 24,
  "1w": 28,
  "1m": 30,
  "6m": 26,
  "1y": 12,
  all: 5,
};

export const ActivityChart: React.FC<ActivityChartProps> = ({
  granularity,
  rangeKey = null,
  rangeLabel,
  activityCadence: yearlyOrRangeCadence = [],
  monthlyCadence,
  isLoading = false,
  onSelectBucket,
  label = "Activity",
  headerAside,
  showRange = true,
  visitorTimezone: propTimezone,
  heading: headingProp,
}) => {

  let contextTimezone = "UTC";
  try {
    contextTimezone = useConfig().visitorTimezone || "UTC";
  } catch {
    // Rendered outside ConfigProvider
  }
  const tz = propTimezone || contextTimezone || "UTC";

  const [chartWidth, setChartWidth] = useState(0);
  const monthCount = granularity === "year" ? monthlyCadence?.length ?? 0 : 0;

  // A callback ref, because the bar container remounts when the bar count changes.
  const chartRef = useCallback(
    (chart: HTMLDivElement | null) => {
      if (!chart || monthCount === 0) return;
      setChartWidth(chart.clientWidth);
      const observer = new ResizeObserver(([entry]) => setChartWidth(entry.contentRect.width));
      observer.observe(chart);
      return () => observer.disconnect();
    },
    [monthCount],
  );

  const showMonths = monthCount > 0 && chartWidth >= monthCount * 6 - 2;
  const effectiveGranularity: CadenceGranularity = showMonths ? "month" : granularity;
  const isClickable = Boolean(onSelectBucket) && effectiveGranularity !== "hour";
  const activityCadence = showMonths && monthlyCadence ? monthlyCadence : yearlyOrRangeCadence;
  const axisLabels = showMonths
    ? activityCadence.filter((_, i) => i === 0 || i === activityCadence.length - 1 ||
      (activityCadence.length >= 3 && i === Math.floor(activityCadence.length / 2)))
    : activityCadence;

  const maxCadence = useMemo(() => {
    if (activityCadence.length === 0) return 1;
    return Math.max(...activityCadence.map((d) => d.count), 1);
  }, [activityCadence]);

  const cadenceStartDate = activityCadence.length > 0 ? activityCadence[0].date : "";
  const cadenceEndDate =
    activityCadence.length > 0
      ? activityCadence[activityCadence.length - 1].date
      : "";

  const headingClass = "font-mono text-[12px] text-[#5A5A55] mb-2 select-none";
  const headingSuffix = rangeLabel ?? rangeKey ?? "";
  const defaultHeadingText = showRange
    ? headingSuffix ? `${label} / ${headingSuffix}` : label
    : label;
  const isChartSkeleton = isLoading && activityCadence.length === 0;

  return (
    <div>
      {headingProp !== undefined ? (
        headerAside == null ? (
          headingProp
        ) : (
          <div className="flex justify-between items-baseline gap-2">
            {headingProp}
            {headerAside}
          </div>
        )
      ) : headerAside == null ? (
        <div className={headingClass}>{defaultHeadingText}</div>
      ) : (
        <div className="flex justify-between items-baseline gap-2">
          <span className={headingClass}>{defaultHeadingText}</span>
          {headerAside}
        </div>
      )}

      <div>
        <div
          key={activityCadence.length}
          ref={chartRef}
          className={`flex gap-[2px] items-end h-[80px] w-full ${isChartSkeleton ? "" : "animate-content-enter"}`}
          role={isClickable ? "group" : "img"}
          aria-label="Activity cadence histogram"
        >
          {isChartSkeleton ? (
            Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-none bg-[#141413] animate-pulse select-none"
                style={{ height: `${((i * 7 + 13) % 36) + 12}%` }}
              />
            ))
          ) : activityCadence.length === 0 ? (
            Array.from({ length: rangeKey ? (EMPTY_CADENCE_BAR_COUNTS[rangeKey] ?? 24) : 0 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-full origin-bottom rounded-none select-none bar-morph cursor-default bg-[#1C1C1A]"
                style={{ transform: "scaleY(0.04)" }}
              />
            ))
          ) : (
            activityCadence.map((item, i) => {
              const isZero = item.count === 0;
              const ratio = item.count / maxCadence;
              const isHot = !isZero && ratio > 0.8;
              const heightPercent = Math.max(Math.round(ratio * 100), 4);

              const isMarkerBar =
                !isZero &&
                (granularity === "block6h"
                  ? (item.isMarker !== undefined ? item.isMarker : i % 4 === 0)
                  : Boolean(item.isMarker));

              const tooltipText =
                item.startTime && item.endTime
                  ? formatBucketTooltip(item, effectiveGranularity, tz)
                  : `${item.date} — ${item.count} plays`;

              // Height as a scale from the baseline, so a range step morphs on the compositor.
              const barScale = `scaleY(${heightPercent / 100})`;
              const barColor = isHot
                ? "bg-music-accent hover:bg-music-accent-hover"
                : isMarkerBar
                  ? "bg-[#2A2A26] hover:bg-[#3E3E38]"
                  : "bg-[#1C1C1A] hover:bg-[#2E2E2A]";

              if (isClickable) {
                return (
                  <button
                    key={i}
                    type="button"
                    title={tooltipText}
                    aria-label={`${tooltipText}. Show this range`}
                    disabled={isLoading}
                    onClick={() => {
                      onSelectBucket?.(item, effectiveGranularity);
                    }}
                    className={`p-0 border-0 flex-1 h-full origin-bottom rounded-none select-none bar-morph cursor-pointer focus-visible:outline-music-accent disabled:cursor-wait disabled:pointer-events-none ${barColor}`}
                    style={{
                      transform: barScale,
                    }}
                  />
                );
              }

              return (
                <div
                  key={i}
                  title={tooltipText}
                  className={`flex-1 h-full origin-bottom rounded-none select-none bar-morph cursor-default ${barColor}`}
                  style={{
                    transform: barScale,
                  }}
                />
              );
            })
          )}
        </div>

        {/* Contextual markers according to granularity */}
        {granularity === "hour" && (
          <div className="flex justify-between mt-1.5 font-mono text-[11px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
            {rangeKey ? (
              <>
                <span>-24h</span>
                <span>-12h</span>
                <span>Now</span>
              </>
            ) : activityCadence.length > 0 ? (
              <>
                <span>{activityCadence[0].date}</span>
                <span>{activityCadence[Math.floor(activityCadence.length / 2)]?.date || ""}</span>
                <span>{activityCadence[activityCadence.length - 1].date}</span>
              </>
            ) : null}
          </div>
        )}

        {granularity === "block6h" && (
          <div className="flex justify-between mt-1.5 font-mono text-[11px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
            {activityCadence.length === 0 ? (
              rangeKey ? (
                ["-7d", "-6d", "-5d", "-4d", "-3d", "-2d", "Now"].map((m, i) => (
                  <span key={i} className="text-center flex-1 truncate">
                    {m}
                  </span>
                ))
              ) : null
            ) : (
              activityCadence
                .filter((item, idx) =>
                  item.isMarker !== undefined ? item.isMarker : idx % 4 === 0
                )
                .map((item, i) => (
                  <span key={i} className="text-center flex-1 truncate">
                    {item.markerLabel || item.date.split(" ")[0]}
                  </span>
                ))
            )}
          </div>
        )}

        {granularity === "day" && (
          <div className="flex justify-between mt-1.5 font-mono text-[11px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
            {activityCadence.length === 0 ? (
              rangeKey ? (
                <>
                  <span>-30d</span>
                  <span>-22d</span>
                  <span>-15d</span>
                  <span>-7d</span>
                  <span>Now</span>
                </>
              ) : null
            ) : activityCadence.some((item) => item.markerLabel) ? (
              activityCadence
                .filter((item) => item.markerLabel)
                .map((item, i) => <span key={i}>{item.markerLabel}</span>)
            ) : (
              <>
                <span>{activityCadence[0]?.date || cadenceStartDate}</span>
                <span>{activityCadence[7]?.date || ""}</span>
                <span>{activityCadence[14]?.date || ""}</span>
                <span>{activityCadence[21]?.date || ""}</span>
                <span>{activityCadence[activityCadence.length - 1]?.date || cadenceEndDate}</span>
              </>
            )}
          </div>
        )}

        {granularity === "week" && (
          <div className="flex justify-between mt-1.5 font-mono text-[11px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
            {activityCadence.length === 0 ? (
              rangeKey ? (
                <>
                  <span>-6m</span>
                  <span>-5m</span>
                  <span>-4m</span>
                  <span>-3m</span>
                  <span>Now</span>
                </>
              ) : null
            ) : (
              (activityCadence.some((item) => item.markerLabel)
                ? activityCadence.filter((item) => item.markerLabel)
                : activityCadence.filter((_, idx) => idx % 4 === 0 || idx === activityCadence.length - 1)
              ).map((item, i) => (
                <span key={i}>{item.markerLabel || item.date}</span>
              ))
            )}
          </div>
        )}

        {granularity === "month" && (
          <div className="flex justify-between mt-1.5 font-mono text-[11px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
            {activityCadence.length === 0 ? (
              rangeKey ? (
                <>
                  <span>-12m</span>
                  <span>-9m</span>
                  <span>-6m</span>
                  <span>-3m</span>
                  <span>Now</span>
                </>
              ) : null
            ) : activityCadence.length <= 12 ? (
              activityCadence.map((item, i) => (
                <span key={i} className="text-center flex-1">
                  {item.date}
                </span>
              ))
            ) : (
              <>
                <span>{cadenceStartDate}</span>
                <span>
                  {activityCadence[Math.floor(activityCadence.length / 2)]?.date}
                </span>
                <span>{cadenceEndDate}</span>
              </>
            )}
          </div>
        )}

        {granularity === "year" && (
          <div className="flex justify-between mt-1.5 font-mono text-[11px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
            {activityCadence.length === 0 ? (
              rangeKey ? (
                <>
                  <span>All-time</span>
                  <span>Now</span>
                </>
              ) : null
            ) : (
              axisLabels.map((item, i) => {
                return (
                  <span key={i} className={showMonths ? undefined : "text-center flex-1"}>
                    {item.date}
                  </span>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
