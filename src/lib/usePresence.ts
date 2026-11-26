"use client";

import { useEffect, useState } from "react";
import { modalPhase, type ModalPhase } from "@/lib/modal-motion";

/**
 * Keeps an element mounted through its exit transition. The element mounts in
 * its "entering" state, switches to "open" two frames later so the browser
 * paints the start state first, and unmounts `exitMs` after closing.
 */
export function usePresence(isOpen: boolean, exitMs: number): { shouldRender: boolean; phase: ModalPhase } {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let raf1: number | undefined;
    let raf2: number | undefined;
    if (isOpen) {
      setShouldRender(true);
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => setIsVisible(true));
      });
    } else {
      setIsVisible(false);
      timer = setTimeout(() => setShouldRender(false), exitMs);
    }
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      if (raf1 !== undefined) window.cancelAnimationFrame(raf1);
      if (raf2 !== undefined) window.cancelAnimationFrame(raf2);
    };
  }, [isOpen, exitMs]);

  return { shouldRender, phase: modalPhase(isOpen, isVisible) };
}
