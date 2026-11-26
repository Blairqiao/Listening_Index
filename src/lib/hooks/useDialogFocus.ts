"use client";

import { useEffect, useRef } from "react";
import type React from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Computes the next focusable index when cycling focus inside a dialog.
 * Exported as a pure helper for unit tests.
 */
export function nextFocusIndex(
  current: number,
  count: number,
  backwards: boolean,
): number {
  if (count <= 0) return -1;
  if (count === 1) return 0;
  if (current < 0 || current >= count) {
    return backwards ? count - 1 : 0;
  }
  return backwards ? (current - 1 + count) % count : (current + 1) % count;
}

function isFocusableVisible(el: HTMLElement): boolean {
  if (el.hasAttribute("disabled") || el.getAttribute("aria-hidden") === "true") {
    return false;
  }
  if (el.closest('[hidden], [aria-hidden="true"]')) {
    return false;
  }
  if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
  }
  return el.tabIndex >= 0;
}

function getFocusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    isFocusableVisible,
  );
}

function focusElement(el: HTMLElement | null | undefined): void {
  if (!el || typeof el.focus !== "function") return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

/**
 * Moves focus into a dialog on open, traps Tab / Shift+Tab inside `panelRef`,
 * and restores focus to the previously active element when closed.
 */
export function useDialogFocus(
  open: boolean,
  panelRef: React.RefObject<HTMLElement | null>,
  options?: { initialFocusRef?: React.RefObject<HTMLElement | null> },
): void {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const initialFocusRef = options?.initialFocusRef;

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    let rafId: number | undefined;

    const focusInitial = () => {
      const panel = panelRef.current;
      if (!panel) return;

      const preferred = initialFocusRef?.current;
      if (preferred && panel.contains(preferred) && isFocusableVisible(preferred)) {
        focusElement(preferred);
        return;
      }

      const focusables = getFocusableElements(panel);
      focusElement(focusables[0] ?? panel);
    };

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      rafId = window.requestAnimationFrame(focusInitial);
    } else {
      focusInitial();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;

      const focusables = getFocusableElements(panel);
      if (focusables.length === 0) {
        event.preventDefault();
        focusElement(panel);
        return;
      }

      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const currentIndex = active ? focusables.indexOf(active) : -1;
      const nextIndex = nextFocusIndex(currentIndex, focusables.length, event.shiftKey);
      if (nextIndex >= 0) {
        event.preventDefault();
        focusElement(focusables[nextIndex]);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      if (rafId !== undefined && typeof window !== "undefined") {
        window.cancelAnimationFrame(rafId);
      }
      document.removeEventListener("keydown", handleKeyDown);

      const previous = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (previous && previous.isConnected) {
        focusElement(previous);
      }
    };
  }, [open, panelRef, initialFocusRef]);
}
