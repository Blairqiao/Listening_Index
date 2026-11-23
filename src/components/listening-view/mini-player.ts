import type { Mode } from "@/lib/types";

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
