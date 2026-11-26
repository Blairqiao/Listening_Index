/** Matches --motion-exit in globals.css. The modal unmounts after this. */
export const MODAL_EXIT_MS = 150;

export type ModalPhase = "entering" | "open" | "closing";

/** `entering` is the mounted first frame before the open transition starts. */
export function modalPhase(isOpen: boolean, isVisible: boolean): ModalPhase {
  if (isVisible) return "open";
  return isOpen ? "entering" : "closing";
}

export function modalBackdropClass(phase: ModalPhase): string {
  if (phase === "open") return "opacity-100 pointer-events-auto modal-enter";
  if (phase === "closing") return "opacity-0 pointer-events-none modal-exit";
  return "opacity-0 pointer-events-none";
}

export function modalPanelClass(phase: ModalPhase): string {
  if (phase === "open") return "opacity-100 modal-enter";
  if (phase === "closing") return "opacity-0 motion-safe:scale-[0.97] modal-exit";
  return "opacity-0 motion-safe:scale-[0.97] motion-safe:translate-y-2";
}
