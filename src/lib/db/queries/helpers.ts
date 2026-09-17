import { siteConfig } from "@/config";

export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDurationHoursMinutes(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  }
  return `${m}m`;
}

export function getTimezone(): string {
  return siteConfig.timezone || "America/Chicago";
}

/**
 * Validates and sanitizes a timezone string.
 * Gracefully falls back to getTimezone() if tz is undefined, empty, or not a recognized IANA timezone identifier.
 * Prevents PostgreSQL 'time zone not recognized' runtime query crashes from untrusted query params or headers.
 */
export function sanitizeTimezone(tz?: string | null): string {
  if (!tz || typeof tz !== "string") return getTimezone();
  const trimmed = tz.trim();
  if (!trimmed) return getTimezone();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch {
    return getTimezone();
  }
}

export function formatTimeTz(date: Date, tz = getTimezone()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
    }).formatToParts(date);
    const hour = parts.find((p) => p.type === "hour")?.value || "00";
    const minute = parts.find((p) => p.type === "minute")?.value || "00";
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "";
    return tzName ? `${hour}:${minute} ${tzName}` : `${hour}:${minute}`;
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

export function formatHHmmTz(date: Date, tz = getTimezone()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const hour = parts.find((p) => p.type === "hour")?.value || "00";
    const minute = parts.find((p) => p.type === "minute")?.value || "00";
    return `${hour}:${minute}`;
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

export function formatDayGroupTz(date: Date, tz = getTimezone()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      day: "2-digit",
      month: "short",
    }).formatToParts(date);
    const day = parts.find((p) => p.type === "day")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value.toUpperCase() || "";
    return `${day} ${month}`;
  } catch {
    return date.toISOString().slice(5, 10).toUpperCase();
  }
}

export function formatLogStartDate(date: Date, tz = getTimezone()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).formatToParts(date);
    const day = parts.find((p) => p.type === "day")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value.toUpperCase() || "";
    const year = parts.find((p) => p.type === "year")?.value || "";
    return `${day} ${month} ${year}`;
  } catch {
    return date.toISOString().slice(0, 10).toUpperCase();
  }
}

export function formatSittingAge(ageMs: number): string {
  const ageMins = Math.max(1, Math.round(ageMs / 60000));
  if (ageMins < 60) {
    return `${ageMins}M`;
  }
  const ageHours = Math.floor(ageMins / 60);
  if (ageHours < 24) {
    return `${ageHours}H`;
  }
  const ageDays = Math.floor(ageHours / 24);
  return `${ageDays}D`;
}
