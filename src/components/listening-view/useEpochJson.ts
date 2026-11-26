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

    if (!shouldRefetchCalendar(pendingTargetRef.current, nextTarget)) {
      // Same target is already in-flight; keep loading without duplicating the request
      setStatus("loading");
      return;
    }

    pendingTargetRef.current = nextTarget;
    setStatus("loading");
    const seq = ++reqSeqRef.current;

    const tzParam = encodeURIComponent(opts.timezone);
    fetch(`${path}?tz=${tzParam}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<T>;
      })
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
  }, [path, logTag, opts.enabled, opts.timezone, opts.refreshKey]);

  return { data, status };
}
