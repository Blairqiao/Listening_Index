export function isScreenSmall(window: Window): boolean {
  return window.innerWidth < 640;
}

export function compactDate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.toLocaleString("default", { month: "numeric" });
  const day = date.getDate();
  return `${month}/${day}/${year}`;
}