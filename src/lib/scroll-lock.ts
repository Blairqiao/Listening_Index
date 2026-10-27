let activeLocksCount = 0;
let originalBodyOverflow = "";
let originalHtmlOverflow = "";

export function getActiveScrollLocksCount(): number {
  return activeLocksCount;
}

export function lockBodyScroll(): void {
  if (typeof document === "undefined" || !document.body) return;

  if (activeLocksCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
    originalHtmlOverflow = document.documentElement ? document.documentElement.style.overflow : "";
    document.body.style.overflow = "hidden";
    if (document.documentElement) {
      document.documentElement.style.overflow = "hidden";
    }
  }
  activeLocksCount++;
}

export function unlockBodyScroll(): void {
  if (typeof document === "undefined" || !document.body) return;

  activeLocksCount = Math.max(0, activeLocksCount - 1);
  if (activeLocksCount === 0) {
    document.body.style.overflow = originalBodyOverflow;
    if (document.documentElement) {
      document.documentElement.style.overflow = originalHtmlOverflow;
    }
  }
}
