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

export function hourHistogram(hours: number[]): number[] {
  const counts = Array<number>(24).fill(0);
  for (const hour of hours) counts[hour] += 1;
  return counts;
}

export function artistShare(trackPlays: number, artistPlays: number): number | null {
  return trackPlays > 0 && artistPlays > 0 ? trackPlays / artistPlays : null;
}

export function formatShare(share: number | null): string {
  if (share === null) return "—";
  if (share > 0 && share < 0.01) return "<1%";
  return `${Math.round(share * 100)}%`;
}

export const OTHER_SEGMENT_ID = "__other__";

export interface ShareSegment {
  id: string;
  label: string;
  plays: number;
}

export function buildShareSegments(
  tracks: { id: string; name: string; plays: number }[],
  total: number,
): ShareSegment[] {
  if (total <= 0) return [];

  const segments = tracks
    .filter(({ plays }) => plays > 0)
    .map(({ id, name, plays }) => ({ id, label: name, plays }));
  const remainder = total - segments.reduce((sum, { plays }) => sum + plays, 0);
  if (remainder > 0) {
    segments.push({ id: OTHER_SEGMENT_ID, label: "Other Tracks", plays: remainder });
  }
  return segments;
}

export function segmentIdForTrack(trackId: string, segments: ShareSegment[]): string | null {
  if (segments.some(({ id }) => id === trackId)) return trackId;
  return segments.some(({ id }) => id === OTHER_SEGMENT_ID) ? OTHER_SEGMENT_ID : null;
}

export function peakHour(counts: number[]): number | null {
  const max = Math.max(0, ...counts);
  return max > 0 ? counts.indexOf(max) : null;
}
