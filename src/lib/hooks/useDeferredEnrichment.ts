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
const sessionRequestedTrackIds = new Set<string>();

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
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("spotify_quota_reached") === "true";
  });

  const onEnrichedRef = useRef(onEnriched);
  onEnrichedRef.current = onEnriched;

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || isQuotaExhausted || items.length === 0) {
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
            limit: pendingCandidates.length,
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
          enriched?: EnrichedTrackItem[];
          delistedIds?: string[];
        };

        if (data.quotaReached) {
          sessionStorage.setItem("spotify_quota_reached", "true");
          setIsQuotaExhausted(true);
        }

        if (
          (data.enriched && data.enriched.length > 0) ||
          (data.delistedIds && data.delistedIds.length > 0)
        ) {
          onEnrichedRef.current?.(data.enriched || [], data.delistedIds || []);
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
    };
  }, [items, enabled, isQuotaExhausted]);

  return { isQuotaExhausted };
}
