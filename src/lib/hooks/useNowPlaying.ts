"use client";

import { useEffect, useRef, useState } from "react";
import type { NowPlaying } from "@/app/api/now-playing/route";

const POLL_MS = 5000;

/**
 * Polls /api/now-playing and interpolates progress between polls, so the
 * progress bar moves smoothly instead of jumping every five seconds.
 *
 * Stops polling while the tab is hidden: nobody is looking, and every poll
 * is ultimately a request against the owner's Spotify rate limit.
 */
export function useNowPlaying(): { data: NowPlaying | null; progressMs: number } {
  const [data, setData] = useState<NowPlaying | null>(null);
  const [progressMs, setProgressMs] = useState(0);
  const receivedAt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // A fetch in progress leaves `timer` null, so the timer alone can't tell
    // "idle" from "polling": without this flag, hiding and showing the tab
    // mid-fetch would start a second loop.
    let inFlight = false;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = !cancelled && !document.hidden ? setTimeout(poll, POLL_MS) : null;
    };

    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      timer = null;
      try {
        const res = await fetch("/api/now-playing", { cache: "no-store" });
        if (res.ok) {
          const next = (await res.json()) as NowPlaying;
          if (!cancelled) {
            receivedAt.current = Date.now();
            setData(next);
            setProgressMs(next.progressMs);
          }
        }
      } catch {
        // Transient network failure: keep showing the last known state.
      } finally {
        inFlight = false;
      }
      schedule();
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (timer) clearTimeout(timer);
        timer = null;
      } else if (!timer && !inFlight) {
        void poll();
      }
    };

    void poll();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Advance the progress locally between polls while playing.
  useEffect(() => {
    if (!data?.isPlaying || !data.track) return;
    const base = data.progressMs;
    const duration = data.track.durationMs;
    const id = setInterval(() => {
      setProgressMs(Math.min(duration, base + (Date.now() - receivedAt.current)));
    }, 500);
    return () => clearInterval(id);
  }, [data]);

  return { data, progressMs };
}
