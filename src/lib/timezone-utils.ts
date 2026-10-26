/**
 * Utility functions for IANA timezone validation and client-side auto-detection.
 */

/**
 * Validates whether candidate string is a recognized IANA timezone identifier.
 */
export function isValidIanaTimezone(tz: unknown): boolean {
  if (typeof tz !== "string" || !tz.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Automatically detects the client's local IANA timezone from the browser runtime.
 * Falls back to the provided fallback or "UTC" if detection fails.
 */
export function detectLocalTimezone(fallback: string = "UTC"): string {
  try {
    if (typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
      const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (isValidIanaTimezone(resolved)) {
        return resolved;
      }
    }
  } catch {
    // Ignore runtime exceptions in unconfigured environments
  }
  return isValidIanaTimezone(fallback) ? fallback : "UTC";
}

/**
 * Persists the client timezone into the standard listening_timezone cookie
 * so subsequent server-side endpoint requests render correctly formatted timestamps.
 */
export function syncLocalTimezoneCookie(tz: string): void {
  if (typeof document === "undefined") return;
  const validTz = isValidIanaTimezone(tz) ? tz : "UTC";
  document.cookie = `listening_timezone=${encodeURIComponent(validTz)}; path=/; max-age=31536000; SameSite=Lax`;
}
