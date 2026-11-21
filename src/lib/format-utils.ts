import type { RangeKey } from "./types";

export interface OverviewMetricsRaw {
  totalMs: number;
  trackCount: number;
  artistCount: number;
  elapsedDays: number;
}

export interface StreamLogMetricsRaw {
  totalPlays: number;
  uniqueTracks: number;
  uniqueArtists: number;
  streakDays: number;
}

export function formatOverviewMetrics(
  raw: OverviewMetricsRaw,
  unit: "minutes" | "hours",
  range: RangeKey
): [string, string, string, string] {
  let timeStr: string;
  if (unit === "hours") {
    const hours = raw.totalMs / 3600000.0;
    if (range === "1d" || range === "1w") {
      timeStr = hours.toFixed(1);
    } else {
      timeStr = Math.round(hours).toLocaleString();
    }
  } else {
    timeStr = Math.round(raw.totalMs / 60000.0).toLocaleString();
  }

  const tracksStr = raw.trackCount.toLocaleString();
  const artistsStr = raw.artistCount.toLocaleString();

  const totalHours = raw.totalMs / 3600000.0;
  const days = Math.max(1, raw.elapsedDays);
  const dailyAvgStr = `${(totalHours / days).toFixed(1)}h`;

  return [timeStr, tracksStr, artistsStr, dailyAvgStr];
}

export function formatStreamLogMetrics(
  raw: StreamLogMetricsRaw
): [string, string, string, string] {
  const playsStr = raw.totalPlays.toLocaleString();
  const tracksStr = raw.uniqueTracks.toLocaleString();
  const artistsStr = raw.uniqueArtists.toLocaleString();
  const streakStr = `${raw.streakDays} ${raw.streakDays === 1 ? "day" : "days"}`;

  return [playsStr, tracksStr, artistsStr, streakStr];
}

export function formatCadenceTooltip(
  bucket: { startTime: string; endTime: string; count: number },
  range: RangeKey,
  tz = "UTC"
): string {
  const startDate = new Date(bucket.startTime);
  const endDate = new Date(bucket.endTime);
  const playsLabel = `${bucket.count.toLocaleString()} ${bucket.count === 1 ? "play" : "plays"}`;
  const formatTz = range === "1d" ? tz : "UTC";

  if (range === "all") {
    const year = new Intl.DateTimeFormat("en-US", {
      timeZone: formatTz,
      year: "numeric",
    }).format(startDate);
    return `${year} — ${playsLabel}`;
  }

  if (range === "1y") {
    const month = new Intl.DateTimeFormat("en-US", {
      timeZone: formatTz,
      month: "short",
    }).format(startDate);
    const year = new Intl.DateTimeFormat("en-US", {
      timeZone: formatTz,
      year: "numeric",
    }).format(startDate);
    return `${month} ${year} — ${playsLabel}`;
  }

  if (range === "6m") {
    const startParts = new Intl.DateTimeFormat("en-US", {
      timeZone: formatTz,
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).formatToParts(startDate);

    const endParts = new Intl.DateTimeFormat("en-US", {
      timeZone: formatTz,
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).formatToParts(endDate);

    const sMonth = startParts.find((p) => p.type === "month")?.value || "";
    const sDay = startParts.find((p) => p.type === "day")?.value || "";
    const sYear = startParts.find((p) => p.type === "year")?.value || "";

    const eMonth = endParts.find((p) => p.type === "month")?.value || "";
    const eDay = endParts.find((p) => p.type === "day")?.value || "";
    const eYear = endParts.find((p) => p.type === "year")?.value || "";

    if (sYear === eYear) {
      return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${sYear} — ${playsLabel}`;
    }
    return `${sMonth} ${sDay}, ${sYear} – ${eMonth} ${eDay}, ${eYear} — ${playsLabel}`;
  }

  if (range === "1m") {
    const month = new Intl.DateTimeFormat("en-US", {
      timeZone: formatTz,
      month: "short",
    }).format(startDate);
    const day = new Intl.DateTimeFormat("en-US", {
      timeZone: formatTz,
      day: "2-digit",
    }).format(startDate);
    const year = new Intl.DateTimeFormat("en-US", {
      timeZone: formatTz,
      year: "numeric",
    }).format(startDate);
    return `${month} ${day}, ${year} — ${playsLabel}`;
  }

  if (range === "1w") {
    const month = new Intl.DateTimeFormat("en-US", {
      timeZone: formatTz,
      month: "short",
    }).format(startDate);
    const day = new Intl.DateTimeFormat("en-US", {
      timeZone: formatTz,
      day: "2-digit",
    }).format(startDate);
    const startHour = new Intl.DateTimeFormat("en-US", {
      timeZone: formatTz,
      hour: "2-digit",
      hour12: false,
    }).format(startDate);
    let endHour = new Intl.DateTimeFormat("en-US", {
      timeZone: formatTz,
      hour: "2-digit",
      hour12: false,
    }).format(endDate);
    if (startHour === "18" && (endHour === "23" || endHour === "00" || endHour === "24")) {
      endHour = "24";
    }
    return `${month} ${day}, ${startHour}:00–${endHour}:00 — ${playsLabel}`;
  }

  // 1d
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: formatTz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(startDate);
  return `${hour} — ${playsLabel}`;
}

export function formatCatalogPercentile(
  rank: number | null,
  total: number
): string {
  if (rank == null || rank <= 0 || total <= 0) {
    return "New";
  }
  const p = (rank / total) * 100;
  if (p < 1) {
    return `Top ${p.toFixed(1)}%`;
  }
  return `Top ${Math.round(p)}%`;
}

export function formatRankDisplay(
  rank: number | null,
  total: number,
  format: "rank" | "percentile"
): string {
  if (rank == null || rank <= 0) {
    return "New";
  }
  if (format === "rank") {
    return total > 0
      ? `${rank.toLocaleString()} / ${total.toLocaleString()}`
      : `${rank.toLocaleString()}`;
  }
  return formatCatalogPercentile(rank, total);
}


export function formatPlaysDisplay(plays: number): string {
  const countStr = plays.toLocaleString();
  return `${countStr} ${plays === 1 ? "play" : "plays"}`;
}

export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function compactDate(dateStr: string): string {
  const date = new Date(dateStr);
  // The empty-ledger placeholder ("--") is not a date
  if (isNaN(date.getTime())) return "--";
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

export function formatDayGroup(date: Date, tz = "UTC"): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      day: "2-digit",
      month: "short",
    }).formatToParts(date);
    const day = parts.find((p) => p.type === "day")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value || "";
    return `${day} ${month}`;
  } catch {
    return date.toISOString().slice(5, 10);
  }
}

export function formatStreamLogDateSpan(
  oldestDateStr?: string,
  newestDateStr?: string,
  tz = "UTC"
): string {
  if (!oldestDateStr && !newestDateStr) return "Stream log";
  if (!oldestDateStr || !newestDateStr) {
    const d = new Date(newestDateStr || oldestDateStr!);
    return isNaN(d.getTime()) ? "Stream log" : formatDayGroup(d, tz);
  }
  const oldest = new Date(oldestDateStr);
  const newest = new Date(newestDateStr);
  if (isNaN(oldest.getTime()) || isNaN(newest.getTime())) return "Stream log";

  const oldestGroup = formatDayGroup(oldest, tz);
  const newestGroup = formatDayGroup(newest, tz);
  if (oldestGroup === newestGroup) {
    return oldestGroup;
  }
  return `${oldestGroup} – ${newestGroup}`;
}


