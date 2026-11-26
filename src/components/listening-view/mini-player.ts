import type { Mode } from "@/lib/types";
import type { ModalPhase } from "@/lib/modal-motion";

export function shouldShowMiniPlayer(p: {
  isAuthenticated: boolean;
  activeMode: Mode;
  hasTrack: boolean;
}): boolean {
  return p.isAuthenticated && p.activeMode !== 3 && p.hasTrack;
}

export function miniPlayerProgress(position: number, duration: number): number {
  if (duration <= 0 || !Number.isFinite(duration) || Number.isNaN(position)) {
    return 0;
  }
  return Math.min(1, Math.max(0, position / duration));
}

/** Matches the drawer-exit transition in globals.css. */
export const MINI_PLAYER_EXIT_MS = 180;

/**
 * The bar rises from below the viewport and drops back on exit. Under reduced
 * motion it fades in place instead.
 */
export function miniPlayerBarClass(phase: ModalPhase): string {
  if (phase === "open") return "drawer-enter";
  const hidden = "motion-safe:translate-y-full motion-reduce:opacity-0";
  return phase === "closing" ? `${hidden} drawer-exit` : hidden;
}
