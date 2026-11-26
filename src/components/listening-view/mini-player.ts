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
export const MINI_PLAYER_EXIT_MS = 150;

/**
 * The bar fades in with a short rise and leaves the same way. Under reduced
 * motion it only fades.
 */
export function miniPlayerBarClass(phase: ModalPhase): string {
  if (phase === "open") return "drawer-enter";
  const hidden = "opacity-0 motion-safe:translate-y-3";
  return phase === "closing" ? `${hidden} drawer-exit` : hidden;
}
