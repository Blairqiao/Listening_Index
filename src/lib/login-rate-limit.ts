/**
 * In-memory limit on failed admin login attempts.
 *
 * Counters live in this server instance only: each instance counts separately and a
 * cold start resets them. That is enough to slow password guessing on a small site.
 */

export const LOGIN_WINDOW_MS = 15 * 60_000;
export const MAX_FAILURES_PER_IP = 5;
// High enough that a stranger cannot cheaply lock the owner out, low enough to bound guessing.
export const MAX_FAILURES_GLOBAL = 100;
export const MAX_TRACKED_KEYS = 1000;

const UNKNOWN_CLIENT_KEY = "unknown";

interface FailureWindow {
  count: number;
  windowStart: number;
}

export type LoginAttemptCheck =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

const failuresByKey = new Map<string, FailureWindow>();
let globalFailures: FailureWindow = { count: 0, windowStart: 0 };

function isLive(entry: FailureWindow, now: number): boolean {
  return entry.count > 0 && now - entry.windowStart < LOGIN_WINDOW_MS;
}

function refusal(entry: FailureWindow, now: number): LoginAttemptCheck {
  const remainingMs = entry.windowStart + LOGIN_WINDOW_MS - now;
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)) };
}

/** x-real-ip, else the first x-forwarded-for entry, else one shared key. */
export function loginClientKey(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || UNKNOWN_CLIENT_KEY;
}

export function loginFailureCount(key: string, now: number): number {
  const entry = failuresByKey.get(key);
  return entry && isLive(entry, now) ? entry.count : 0;
}

/**
 * Call before verifying the password. The global ceiling refuses every attempt, correct
 * or not: letting a correct password through would let a guesser who rotates IPs keep going.
 */
export function checkLoginAttempt(key: string, now: number): LoginAttemptCheck {
  const entry = failuresByKey.get(key);
  if (entry && isLive(entry, now) && entry.count >= MAX_FAILURES_PER_IP) return refusal(entry, now);
  if (isLive(globalFailures, now) && globalFailures.count >= MAX_FAILURES_GLOBAL) {
    return refusal(globalFailures, now);
  }
  return { allowed: true };
}

export function recordLoginFailure(key: string, now: number): void {
  globalFailures = isLive(globalFailures, now)
    ? { ...globalFailures, count: globalFailures.count + 1 }
    : { count: 1, windowStart: now };

  const entry = failuresByKey.get(key);
  if (entry && isLive(entry, now)) {
    entry.count++;
    return;
  }

  failuresByKey.delete(key);
  for (const [otherKey, other] of failuresByKey) {
    if (!isLive(other, now)) failuresByKey.delete(otherKey);
  }
  while (failuresByKey.size >= MAX_TRACKED_KEYS) {
    failuresByKey.delete(failuresByKey.keys().next().value!);
  }
  failuresByKey.set(key, { count: 1, windowStart: now });
}

/** Call after a successful login. The global count is left alone. */
export function clearLoginFailures(key: string): void {
  failuresByKey.delete(key);
}

export function trackedLoginKeyCount(): number {
  return failuresByKey.size;
}

/** For tests. */
export function resetLoginRateLimit(): void {
  failuresByKey.clear();
  globalFailures = { count: 0, windowStart: 0 };
}
