"use client";

import { useEffect, useRef, useState } from "react";
import { EnrichedTrackItem } from "@/lib/db/queries";

interface DeferredTrackCandidate {
  id: string;
  trackId?: string;
  albumImageUrl?: string | null;
  status?: string;
}

interface UseDeferredEnrichmentOptions {
  items: DeferredTrackCandidate[];
  onEnriched?: (enriched: EnrichedTrackItem[], delistedIds: string[]) => void;
  enabled?: boolean;
}

// Module-level cache of requested IDs so requests are not repeated across component re-renders
export const sessionRequestedTrackIds = new Set<string>();

export function clearSessionRequestedTrackIds(): void {
  sessionRequestedTrackIds.clear();
}

const QUOTA_REACHED_KEY = "spotify_quota_reached";
const QUOTA_RESET_AT_KEY = "spotify_quota_reset_at";

/**
 * Checks whether Spotify daily quota is exhausted according to sessionStorage,
 * expiring and clearing the state if quotaResetAt has passed.
 */
export function isStoredQuotaExhausted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const isReached = sessionStorage.getItem(QUOTA_REACHED_KEY) === "true";
    if (!isReached) return false;

    const resetAtStr = sessionStorage.getItem(QUOTA_RESET_AT_KEY);
    if (resetAtStr) {
      const resetTime = new Date(resetAtStr).getTime();
      if (!isNaN(resetTime)) {
        if (Date.now() >= resetTime) {
          sessionStorage.removeItem(QUOTA_REACHED_KEY);
          sessionStorage.removeItem(QUOTA_RESET_AT_KEY);
          return false;
        }
        return true;
      }
    }
    return isReached;
  } catch {
    return false;
  }
}

/**
 * Hook to manage client-side deferred micro-enrichment for viewport tracks.
 * Identifies visible un-enriched tracks, batches up to 5 tracks with a 600ms debounce,
 * and calls /api/upload/enrich with source: 'dynamic'.
 * Respects quota limits and silences future calls if quota is reached.
 */
export function useDeferredEnrichment({
  items,
  onEnriched,
  enabled = true,
}: UseDeferredEnrichmentOptions) {
  const [isQuotaExhausted, setIsQuotaExhausted] = useState<boolean>(() => {
    return isStoredQuotaExhausted();
  });
  const [retryTrigger, setRetryTrigger] = useState(0);

  const onEnrichedRef = useRef(onEnriched);
  onEnrichedRef.current = onEnriched;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Expire quota state if mounted tab crosses reset timestamp
  useEffect(() => {
    if (!isQuotaExhausted || typeof window === "undefined") return;

    try {
      const resetAtStr = sessionStorage.getItem(QUOTA_RESET_AT_KEY);
      if (!resetAtStr) return;

      const resetTime = new Date(resetAtStr).getTime();
      if (isNaN(resetTime)) return;

      const delay = resetTime - Date.now();
      if (delay <= 0) {
        sessionStorage.removeItem(QUOTA_REACHED_KEY);
        sessionStorage.removeItem(QUOTA_RESET_AT_KEY);
        setIsQuotaExhausted(false);
        return;
      }

      const timer = setTimeout(() => {
        sessionStorage.removeItem(QUOTA_REACHED_KEY);
        sessionStorage.removeItem(QUOTA_RESET_AT_KEY);
        setIsQuotaExhausted(false);
      }, delay);

      return () => clearTimeout(timer);
    } catch {
      // Ignore storage access errors
    }
  }, [isQuotaExhausted]);

  useEffect(() => {
    if (isQuotaExhausted) {
      if (!isStoredQuotaExhausted()) {
        setIsQuotaExhausted(false);
      }
      return;
    }

    if (!enabled || items.length === 0) {
      return;
    }

    // Find up to 5 pending tracks not yet requested this session
    const pendingCandidates: string[] = [];
    for (const item of items) {
      const trackId = item.trackId || item.id;
      if (!trackId) continue;

      const isUnenriched = !item.albumImageUrl && item.status !== "[DELISTED]";
      if (isUnenriched && !sessionRequestedTrackIds.has(trackId)) {
        pendingCandidates.push(trackId);
        if (pendingCandidates.length >= 5) break;
      }
    }

    if (pendingCandidates.length === 0) {
      return;
    }

    // Debounce to allow smooth scrolling without rapid-fire requests
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      // Mark candidates as in-flight
      for (const id of pendingCandidates) {
        sessionRequestedTrackIds.add(id);
      }

      try {
        const res = await fetch("/api/upload/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackIds: pendingCandidates,
            source: "dynamic",
          }),
        });

        if (!res.ok) {
          for (const id of pendingCandidates) {
            sessionRequestedTrackIds.delete(id);
          }
          return;
        }

        const data = (await res.json()) as {
          success?: boolean;
          quotaReached?: boolean;
          quotaResetAt?: string;
          rateLimited?: boolean;
          retryAfterSeconds?: number;
          enriched?: EnrichedTrackItem[];
          delistedIds?: string[];
        };

        if (data.quotaReached) {
          try {
            sessionStorage.setItem(QUOTA_REACHED_KEY, "true");
            if (data.quotaResetAt) {
              sessionStorage.setItem(QUOTA_RESET_AT_KEY, data.quotaResetAt);
            }
          } catch {
            // Ignore storage write errors
          }
          setIsQuotaExhausted(true);
        }

        if (
          (data.enriched && data.enriched.length > 0) ||
          (data.delistedIds && data.delistedIds.length > 0)
        ) {
          onEnrichedRef.current?.(data.enriched || [], data.delistedIds || []);
        }

        // Release candidate IDs that were not resolved (e.g. rate-limited or transient failure)
        const resolvedIds = new Set<string>();
        if (Array.isArray(data.enriched)) {
          for (const e of data.enriched) {
            const id = e.requestedId || (e as unknown as { id: string }).id;
            if (id) resolvedIds.add(id);
          }
        }
        if (Array.isArray(data.delistedIds)) {
          for (const d of data.delistedIds) {
            resolvedIds.add(d);
          }
        }

        for (const id of pendingCandidates) {
          if (!resolvedIds.has(id)) {
            sessionRequestedTrackIds.delete(id);
          }
        }

        if (data.rateLimited) {
          const cooldownSec = data.retryAfterSeconds || 10;
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            setRetryTrigger((prev) => prev + 1);
          }, cooldownSec * 1000);
        }
      } catch {
        // Network or transient error: silent fail, allow future retry
        for (const id of pendingCandidates) {
          sessionRequestedTrackIds.delete(id);
        }
      }
    }, 600);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [items, enabled, isQuotaExhausted, retryTrigger]);

  return { isQuotaExhausted };
}
