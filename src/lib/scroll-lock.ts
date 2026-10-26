let activeLocksCount = 0;
let originalOverflow = "";

export function getActiveScrollLocksCount(): number {
  return activeLocksCount;
}

export function lockBodyScroll(): void {
  if (typeof document === "undefined" || !document.body) return;

  if (activeLocksCount === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  activeLocksCount++;
}

export function unlockBodyScroll(): void {
  if (typeof document === "undefined" || !document.body) return;

  activeLocksCount = Math.max(0, activeLocksCount - 1);
  if (activeLocksCount === 0) {
    document.body.style.overflow = originalOverflow;
  }
}
