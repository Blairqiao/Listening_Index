"use client";

import { useEffect, useRef, useState } from "react";

export type CalendarStatus = "idle" | "loading" | "ready" | "error";

export function shouldRefetchCalendar(
  last: { timezone: string; refreshKey: number } | null,
  next: { timezone: string; refreshKey: number },
): boolean {
  if (last === null) return true;
  return last.timezone !== next.timezone || last.refreshKey !== next.refreshKey;
}

interface EpochEntry {
  key: string;
  promise: Promise<unknown>;
  data?: unknown;
}

// One entry per path: the hook only ever wants the current timezone and refresh key,
// and keeps its own copy of the previous result while a new one loads.
const epochStore = new Map<string, EpochEntry>();

function epochKey(timezone: string, refreshKey: number): string {
  return `${timezone}|${refreshKey}`;
}

/** Fetches `path` for this timezone and refresh key once; hover, idle and mount callers share the request. */
export function loadEpochJson<T>(path: string, timezone: string, refreshKey: number): Promise<T> {
  const key = epochKey(timezone, refreshKey);
  const existing = epochStore.get(path);
  if (existing && existing.key === key) return existing.promise as Promise<T>;

  const entry: EpochEntry = { key, promise: Promise.resolve() };
  entry.promise = fetch(`${path}?tz=${encodeURIComponent(timezone)}`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<T>;
    })
    .then(
      (json) => {
        entry.data = json;
        return json;
      },
      (err: unknown) => {
        if (epochStore.get(path) === entry) epochStore.delete(path);
        throw err;
      },
    );
  epochStore.set(path, entry);
  return entry.promise as Promise<T>;
}

export function peekEpochJson<T>(path: string, timezone: string, refreshKey: number): T | undefined {
  const entry = epochStore.get(path);
  return entry && entry.key === epochKey(timezone, refreshKey) ? (entry.data as T | undefined) : undefined;
}

/** Warms a tab before it opens. Failures stay silent; the tab retries when it mounts. */
export function prefetchEpochJson(path: string, timezone: string, refreshKey: number): void {
  loadEpochJson(path, timezone, refreshKey).catch(() => {});
}

export function clearEpochJsonCache(): void {
  epochStore.clear();
}

export function useEpochJson<T>(
  path: string,
  opts: {
    enabled: boolean;
    timezone: string;
    refreshKey: number;
  },
  logTag: string,
): { data: T | null; status: CalendarStatus } {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<CalendarStatus>("idle");
  const loadedTargetRef = useRef<{ timezone: string; refreshKey: number } | null>(null);
  const pendingTargetRef = useRef<{ timezone: string; refreshKey: number } | null>(null);
  const reqSeqRef = useRef<number>(0);
  const cached = opts.enabled ? peekEpochJson<T>(path, opts.timezone, opts.refreshKey) : undefined;

  useEffect(() => {
    if (!opts.enabled) {
      return;
    }

    const nextTarget = { timezone: opts.timezone, refreshKey: opts.refreshKey };
    if (!shouldRefetchCalendar(loadedTargetRef.current, nextTarget)) {
      // Obsolete any pending in-flight requests that were fetching a different target (e.g. A -> B -> A race)
      pendingTargetRef.current = null;
      reqSeqRef.current++;
      // Restore status to "ready" since data for this target is already loaded
      setStatus("ready");
      return;
    }

    if (cached !== undefined) {
      pendingTargetRef.current = null;
      reqSeqRef.current++;
      loadedTargetRef.current = nextTarget;
      setData(cached);
      setStatus("ready");
      return;
    }

    if (!shouldRefetchCalendar(pendingTargetRef.current, nextTarget)) {
      // Same target is already in-flight; keep loading without duplicating the request
      setStatus("loading");
      return;
    }

    pendingTargetRef.current = nextTarget;
    setStatus("loading");
    const seq = ++reqSeqRef.current;

    loadEpochJson<T>(path, opts.timezone, opts.refreshKey)
      .then((json) => {
        if (reqSeqRef.current !== seq) return;
        pendingTargetRef.current = null;
        loadedTargetRef.current = nextTarget;
        setData(json);
        setStatus("ready");
      })
      .catch((err) => {
        if (reqSeqRef.current !== seq) return;
        pendingTargetRef.current = null;
        console.error(`${logTag} Error:`, err);
        setStatus("error");
      });
  }, [path, logTag, opts.enabled, opts.timezone, opts.refreshKey, cached]);

  // Prefetched data renders on the first enabled pass, before the effect copies it into state.
  return cached !== undefined ? { data: cached, status: "ready" } : { data, status };
}
