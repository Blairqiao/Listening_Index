"use client";

import React, { useState } from "react";

export type ProfileRowSize = "tall" | "compact";

export const PROFILE_ROW_PX: Record<ProfileRowSize, number> = {
  tall: 55,
  compact: 32,
};

export const PROFILE_ROW_HEIGHT_CLASS: Record<ProfileRowSize, string> = {
  tall: "h-[54px] md:h-[55px]",
  compact: "h-8",
};

export interface ProfileBoxProps {
  heading: string;
  rightLabel?: string;
  rows: number;
  rowSize: ProfileRowSize;
  itemCount: number;
  headingAsRow?: boolean;
  mobileLimit?: number;
  scrollKey: string;
  children: React.ReactNode;
}

export const ProfileBox: React.FC<ProfileBoxProps> = ({
  heading,
  rightLabel,
  rows,
  rowSize,
  itemCount,
  headingAsRow = false,
  mobileLimit,
  scrollKey,
  children,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [prevScrollKey, setPrevScrollKey] = useState(scrollKey);
  if (scrollKey !== prevScrollKey) {
    setPrevScrollKey(scrollKey);
    setExpanded(false);
  }

  const rowHeightClass = PROFILE_ROW_HEIGHT_CLASS[rowSize];
  const placeholderCount = Math.max(0, rows - itemCount);
  const hasMobileToggle = mobileLimit !== undefined && itemCount > mobileLimit;
  const isMobileCollapsed = hasMobileToggle && !expanded;

  const renderedChildren = isMobileCollapsed
    ? React.Children.map(children, (child, index) => {
        if (index >= mobileLimit && React.isValidElement(child)) {
          return React.cloneElement(
            child as React.ReactElement<Record<string, unknown>>,
            { "data-mobile-collapsed": "true" },
          );
        }
        return child;
      })
    : children;

  return (
    <div className="min-w-0">
      <div
        className={
          headingAsRow
            ? `${rowHeightClass} flex items-end justify-between pb-2 font-mono text-[12px] text-[#5A5A55] select-none`
            : "mb-2 flex justify-between font-mono text-[12px] text-[#5A5A55] select-none"
        }
      >
        <span>{heading}</span>
        {rightLabel && <span>{rightLabel}</span>}
      </div>

      <div
        key={scrollKey}
        role="list"
        tabIndex={0}
        aria-label={heading}
        style={{ "--box-h": `${rows * PROFILE_ROW_PX[rowSize]}px` } as React.CSSProperties}
        className={`h-auto md:h-(--box-h) overflow-y-auto scrollbar-hidden${
          isMobileCollapsed ? " max-md:[&>[data-mobile-collapsed]]:hidden" : ""
        }`}
      >
        {renderedChildren}
        {Array.from({ length: placeholderCount }).map((_, idx) => (
          <div
            key={`ph-${idx}`}
            aria-hidden="true"
            data-profile-placeholder=""
            className={`${itemCount === 0 ? "flex" : "hidden md:flex"} ${rowHeightClass} border-b border-[#191917] items-center px-1 select-none`}
          />
        ))}
      </div>

      {hasMobileToggle && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
          className="md:hidden w-full py-2 font-mono text-[11px] text-[#8A8A83] hover:text-[#EDEDE8] focus-ring cursor-pointer"
        >
          {expanded ? "Show fewer ⌃" : `Show all ${itemCount} ⌄`}
        </button>
      )}
    </div>
  );
};
