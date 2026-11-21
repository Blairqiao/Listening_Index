import type { ProfilePeakDay, ProfileSummaryStats } from "./search-types";
import { SESSION_GAP_MS } from "./session-calculation";

const DAY_MS = 86_400_000;

export interface StreakRange {
  days: number;
  start: string | null;
  end: string | null;
}

export function longestStreakRange(days: string[]): StreakRange {
  const sorted = [...new Set(days)].sort();
  if (sorted.length === 0) {
    return { days: 0, start: null, end: null };
  }

  let bestDays = 0;
  let bestStart: string | null = null;
  let bestEnd: string | null = null;

  let currentDays = 0;
  let currentStart: string | null = null;
  let previousTimestamp = -Infinity;

  for (const day of sorted) {
    const timestamp = Date.parse(day);
    if (timestamp - previousTimestamp === DAY_MS) {
      currentDays += 1;
    } else {
      currentDays = 1;
      currentStart = day;
    }
    if (currentDays >= bestDays) {
      bestDays = currentDays;
      bestStart = currentStart;
      bestEnd = day;
    }
    previousTimestamp = timestamp;
  }

  return { days: bestDays, start: bestStart, end: bestEnd };
}

export function longestStreak(days: string[]): number {
  return longestStreakRange(days).days;
}

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parseUtcDate(dateStr: string): Date | null {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n))) return null;
  const [year, month, day] = parts;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

export function formatStreakSentence(
  stats: Pick<ProfileSummaryStats, "longestStreakDays" | "longestStreakStart" | "longestStreakEnd">,
): string | null {
  if (
    !stats ||
    typeof stats.longestStreakDays !== "number" ||
    stats.longestStreakDays < 2 ||
    !stats.longestStreakStart ||
    !stats.longestStreakEnd
  ) {
    return null;
  }

  const startDate = parseUtcDate(stats.longestStreakStart);
  const endDate = parseUtcDate(stats.longestStreakEnd);
  if (!startDate || !endDate) {
    return null;
  }

  const startYear = startDate.getUTCFullYear();
  const startMonth = SHORT_MONTHS[startDate.getUTCMonth()];
  const startDay = startDate.getUTCDate();

  const endYear = endDate.getUTCFullYear();
  const endMonth = SHORT_MONTHS[endDate.getUTCMonth()];
  const endDay = endDate.getUTCDate();

  let range: string;
  if (startYear === endYear) {
    if (startDate.getUTCMonth() === endDate.getUTCMonth()) {
      range = `${startMonth} ${startDay}–${endDay}, ${startYear}`;
    } else {
      range = `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${startYear}`;
    }
  } else {
    range = `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`;
  }

  return `Longest streak: ${stats.longestStreakDays} days (${range})`;
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

export function dayOfWeekHistogram(isoDays: number[]): number[] {
  const counts = Array<number>(7).fill(0);
  for (const day of isoDays) {
    if (Number.isInteger(day) && day >= 1 && day <= 7) {
      counts[day - 1] += 1;
    }
  }
  return counts;
}

export function peakDayOfWeek(counts: number[]): number | null {
  return peakHour(counts.slice(0, 7));
}

export function computePeakDay(
  days: Array<{ date: string; plays: number }>,
): ProfilePeakDay | null {
  const positive = days.filter((d) => d.plays > 0);
  if (positive.length === 0) return null;

  const sorted = [...positive].sort(
    (a, b) => b.plays - a.plays || b.date.localeCompare(a.date),
  );
  return { date: sorted[0].date, plays: sorted[0].plays };
}

export function computeCompletionRate(
  plays: Array<{ msPlayed: number; durationMs: number }>,
): number | null {
  const valid = plays.filter((p) => Number.isFinite(p.durationMs) && p.durationMs > 0);
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, p) => {
    const ms = Number.isFinite(p.msPlayed) ? p.msPlayed : 0;
    const ratio = ms / p.durationMs;
    const clamped = Math.min(1, Math.max(0, ratio));
    return acc + clamped;
  }, 0);
  return sum / valid.length;
}

export function countFullAlbumSessions(
  plays: Array<{ trackId: string; playedAt: string }>,
  minDistinctTracks = 3,
  sessionGapMs = SESSION_GAP_MS,
): number {
  if (plays.length === 0) return 0;
  const sorted = [...plays].sort((a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt));
  const sessions: Array<Array<{ trackId: string; playedAt: string }>> = [];
  for (const play of sorted) {
    const currentSession = sessions[sessions.length - 1];
    if (
      !currentSession ||
      Date.parse(play.playedAt) - Date.parse(currentSession[currentSession.length - 1].playedAt) > sessionGapMs
    ) {
      sessions.push([play]);
    } else {
      currentSession.push(play);
    }
  }

  let count = 0;
  for (const session of sessions) {
    const distinctTracks = new Set(session.map((p) => p.trackId));
    if (distinctTracks.size >= minDistinctTracks) {
      count += 1;
    }
  }
  return count;
}

export function formatListeningDuration(ms: number): string {
  const clampedMs = Math.max(0, Number.isFinite(ms) ? ms : 0);
  if (clampedMs === 0) return "0M";
  if (clampedMs < 60_000) return "<1M";
  const totalMinutes = Math.round(clampedMs / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}M`;
  const hours = Math.floor(totalMinutes / 60);
  const remMins = totalMinutes % 60;
  if (hours < 100) {
    return remMins === 0 ? `${hours}H` : `${hours}H ${remMins}M`;
  }
  return `${Math.round(clampedMs / 3_600_000).toLocaleString()}H`;
}

export function formatCompactPlayDate(iso: string | null | undefined, tz: string): string {
  if (!iso) return "--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const day = parts.find((p) => p.type === "day")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const year = parts.find((p) => p.type === "year")?.value;
    if (!day || !month || !year) return "--";
    return `${day} ${month} ${year}`.toUpperCase();
  } catch {
    return "--";
  }
}
