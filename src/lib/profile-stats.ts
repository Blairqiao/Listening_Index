const DAY_MS = 86_400_000;

export function longestStreak(days: string[]): number {
  let longest = 0;
  let current = 0;
  let previous = -Infinity;
  for (const day of [...new Set(days)].sort()) {
    const timestamp = Date.parse(day);
    current = timestamp - previous === DAY_MS ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = timestamp;
  }
  return longest;
}

export function pickBestMonth(months: string[]): { month: string; plays: number } | null {
  const counts = new Map<string, number>();
  for (const month of months) {
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }

  let best: { month: string; plays: number } | null = null;
  for (const [month, plays] of counts) {
    if (!best || plays > best.plays || (plays === best.plays && month > best.month)) {
      best = { month, plays };
    }
  }
  return best;
}

export function hourHistogram(hours: number[]): number[] {
  const counts = Array<number>(24).fill(0);
  for (const hour of hours) counts[hour] += 1;
  return counts;
}

export function artistShare(trackPlays: number, artistPlays: number): number | null {
  return trackPlays > 0 && artistPlays > 0 ? trackPlays / artistPlays : null;
}

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  year: "numeric",
});

export function formatMonthLabel(month: string): string {
  return monthFormatter.format(new Date(`${month}-01T00:00:00Z`)).toUpperCase();
}

export function formatShare(share: number | null): string {
  if (share === null) return "—";
  if (share > 0 && share < 0.01) return "<1%";
  return `${Math.round(share * 100)}%`;
}
