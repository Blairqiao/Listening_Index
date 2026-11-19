"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { RangeKey, ActivityBucket } from "@/lib/types";
import { formatCadenceTooltip } from "@/lib/format-utils";
import { useConfig } from "@/context/ConfigContext";

export interface ActivityChartProps {
  range: RangeKey;
  activityCadence: ActivityBucket[];
  monthlyCadence?: ActivityBucket[];
  isLoading?: boolean;
  label?: string;
  headerAside?: React.ReactNode;
  visitorTimezone?: string;
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
  range,
  activityCadence: yearlyOrRangeCadence = [],
  monthlyCadence,
  isLoading = false,
  label = "ACTIVITY",
  headerAside,
  visitorTimezone: propTimezone,
}) => {
  let contextTimezone = "UTC";
  try {
    contextTimezone = useConfig().visitorTimezone || "UTC";
  } catch {
    // Rendered outside ConfigProvider
  }
  const tz = propTimezone || contextTimezone || "UTC";

  const chartRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const monthCount = range === "all" ? monthlyCadence?.length ?? 0 : 0;

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || monthCount === 0) return;
    setChartWidth(chart.clientWidth);
    const observer = new ResizeObserver(([entry]) => setChartWidth(entry.contentRect.width));
    observer.observe(chart);
    return () => observer.disconnect();
  }, [monthCount]);

  const showMonths = monthCount > 0 && chartWidth >= monthCount * 6 - 2;
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

  const headingClass = "font-mono text-[11px] tracking-[0.14em] text-[#5A5A55] mb-2 select-none";
  const heading = `[ ${label} / ${range === "all" ? "ALL" : range.toUpperCase()} ]`;

  return (
    <div>
      {headerAside == null ? (
        <div className={headingClass}>{heading}</div>
      ) : (
        <div className="flex justify-between items-baseline gap-2">
          <span className={headingClass}>{heading}</span>
          {headerAside}
        </div>
      )}

      <div>
        <div
          ref={chartRef}
          className="flex gap-[2px] items-end h-[80px] w-full"
          role="img"
          aria-label="Activity cadence histogram"
        >
          {isLoading && activityCadence.length === 0 ? (
            Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-none bg-[#141413] animate-pulse select-none"
                style={{ height: `${((i * 7 + 13) % 36) + 12}%` }}
              />
            ))
          ) : activityCadence.length === 0 ? (
            Array.from({ length: EMPTY_CADENCE_BAR_COUNTS[range] ?? 24 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-none select-none transition-none cursor-default bg-[#1C1C1A]"
                style={{ height: "4%" }}
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
                (range === "1w"
                  ? (item.isMarker !== undefined ? item.isMarker : i % 4 === 0)
                  : Boolean(item.isMarker));

              const tooltipText =
                item.startTime && item.endTime
                  ? formatCadenceTooltip(item, showMonths ? "1y" : range, tz)
                  : `${item.date} — ${item.count} plays`;

              return (
                <div
                  key={i}
                  title={tooltipText}
                  className={`flex-1 rounded-none select-none transition-none cursor-default ${
                    isHot
                      ? "bg-music-accent"
                      : isMarkerBar
                        ? "bg-[#2A2A26] hover:bg-[#3E3E38]"
                        : "bg-[#1C1C1A] hover:bg-[#2E2E2A]"
                  }`}
                  style={{
                    height: `${heightPercent}%`,
                  }}
                />
              );
            })
          )}
        </div>

        {/* Contextual markers according to range */}
        {range === "1d" && (
          <div className="flex justify-between mt-1.5 font-mono text-[10px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
            <span>-24H</span>
            <span>-12H</span>
            <span>NOW</span>
          </div>
        )}

        {range === "1w" && (
          <div className="flex justify-between mt-1.5 font-mono text-[10px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
            {activityCadence.length === 0 ? (
              ["-7D", "-6D", "-5D", "-4D", "-3D", "-2D", "NOW"].map((m, i) => (
                <span key={i} className="text-center flex-1 truncate">
                  {m}
                </span>
              ))
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

        {range === "1m" && (
          <div className="flex justify-between mt-1.5 font-mono text-[10px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
            {activityCadence.length === 0 ? (
              <>
                <span>-30D</span>
                <span>-22D</span>
                <span>-15D</span>
                <span>-7D</span>
                <span>NOW</span>
              </>
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

        {range === "6m" && (
          <div className="flex justify-between mt-1.5 font-mono text-[10px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
            {activityCadence.length === 0 ? (
              <>
                <span>-6M</span>
                <span>-5M</span>
                <span>-4M</span>
                <span>-3M</span>
                <span>NOW</span>
              </>
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

        {range === "1y" && (
          <div className="flex justify-between mt-1.5 font-mono text-[10px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
            {activityCadence.length === 0 ? (
              <>
                <span>-12M</span>
                <span>-9M</span>
                <span>-6M</span>
                <span>-3M</span>
                <span>NOW</span>
              </>
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

        {range === "all" && (
          <div className="flex justify-between mt-1.5 font-mono text-[10px] text-[#5A5A55] select-none h-[14px] leading-[14px]">
            {activityCadence.length === 0 ? (
              <>
                <span>ALL-TIME</span>
                <span>NOW</span>
              </>
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
