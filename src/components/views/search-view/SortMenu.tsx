"use client";

import React, { useEffect, useId, useRef, useState, type JSX, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { SEARCH_SORT_OPTIONS, type SearchSort } from "@/lib/search-types";

const chipBaseClass = "font-mono text-[12px] whitespace-nowrap px-2.5 py-[3px] rounded-none border bg-transparent cursor-pointer transition-none focus-ring focus-visible:border-music-accent focus-visible:text-music-accent";
const idleChipColors = "border-[#26261F] text-[#6A6A64] hover:text-[#EDEDE8] hover:border-[#3A3A32]";
export const searchChipClass = `${chipBaseClass} ${idleChipColors}`;

export function SortMenu({
  value,
  onChange,
  onOpenChange,
}: {
  value: SearchSort;
  onChange: (sort: SearchSort) => void;
  onOpenChange?: (open: boolean) => void;
}): JSX.Element {
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const open = highlightedIndex !== null;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();
  const selectedIndex = Math.max(0, SEARCH_SORT_OPTIONS.findIndex((option) => option.value === value));

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;

    listboxRef.current?.focus();
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) {
        setHighlightedIndex(null);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  function closeAndFocusTrigger() {
    setHighlightedIndex(null);
    triggerRef.current?.focus();
  }

  function select(sort: SearchSort) {
    closeAndFocusTrigger();
    if (sort !== value) onChange(sort);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex(selectedIndex);
    }
  }

  function handleListboxKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (highlightedIndex === null) return;
    const lastIndex = SEARCH_SORT_OPTIONS.length - 1;

    switch (event.key) {
      case "ArrowDown":
        setHighlightedIndex(highlightedIndex === lastIndex ? 0 : highlightedIndex + 1);
        break;
      case "ArrowUp":
        setHighlightedIndex(highlightedIndex === 0 ? lastIndex : highlightedIndex - 1);
        break;
      case "Home":
        setHighlightedIndex(0);
        break;
      case "End":
        setHighlightedIndex(lastIndex);
        break;
      case "Enter":
      case " ":
        select(SEARCH_SORT_OPTIONS[highlightedIndex].value);
        break;
      case "Escape":
        closeAndFocusTrigger();
        break;
      case "Tab":
        closeAndFocusTrigger();
        return;
      default:
        return;
    }
    event.preventDefault();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label="Sort by"
        onClick={() => setHighlightedIndex(open ? null : selectedIndex)}
        onKeyDown={handleTriggerKeyDown}
        className={`relative inline-flex items-center gap-1 font-mono text-[12px] bg-transparent border-0 cursor-pointer p-0 transition-none focus-ring focus-visible:text-music-accent press hit-area whitespace-nowrap ${
          open ? "text-music-accent" : "text-[#6A6A64] hover:text-[#EDEDE8]"
        }`}
      >
        <span>Sort:</span>
        <span>{SEARCH_SORT_OPTIONS[selectedIndex].label}</span>
        <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" className="flex-none" />
      </button>
      {open && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label="Sort by"
          aria-activedescendant={`${listboxId}-${highlightedIndex}`}
          tabIndex={-1}
          onKeyDown={handleListboxKeyDown}
          className="absolute right-0 top-full z-20 mt-1 min-w-full border border-[#26261F] bg-[#080808] py-1 focus-ring"
        >
          {SEARCH_SORT_OPTIONS.map(({ value: optionValue, label }, index) => {
            const selected = optionValue === value;
            const colorClass = index === highlightedIndex
              ? "bg-[#111110] text-[#EDEDE8]"
              : selected ? "text-music-accent" : "text-[#8A8A83]";

            return (
              <li
                key={optionValue}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={selected}
                onClick={() => select(optionValue)}
                className={`block w-full px-2.5 py-1.5 text-left font-mono text-[12px] whitespace-nowrap cursor-pointer hover:bg-[#111110] hover:text-[#EDEDE8] focus-ring ${colorClass}`}
              >
                {label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
