import { useEffect, useRef, useState } from "react";
import type { TrackTelemetryStats } from "@/lib/db/queries";
import { getTrackStatsCacheKey, type ActiveEntityCandidate } from "./listening-helpers";

/** Play counts and ranks for the active Track and Artist, cached per Track for the page's lifetime. */
export function useTrackStats(activeEntity: ActiveEntityCandidate | null): TrackTelemetryStats | null {
  const activeTrackId = activeEntity?.id;
  const activeTrackTitle = activeEntity?.title;
  const activeTrackArtist = activeEntity?.artist;

  const trackStatsCacheRef = useRef<Map<string, TrackTelemetryStats>>(new Map());
  const [trackStats, setTrackStats] = useState<TrackTelemetryStats | null>(null);

  useEffect(() => {
    if (!activeTrackId && !activeTrackTitle && !activeTrackArtist) {
      setTrackStats(null);
      return;
    }

    const key = getTrackStatsCacheKey({
      trackId: activeTrackId,
      title: activeTrackTitle,
      artist: activeTrackArtist,
    });

    const cached = trackStatsCacheRef.current.get(key);
    if (cached) {
      setTrackStats(cached);
      return;
    }

    // Clear on a cache miss so the previous Track's stats don't linger while loading
    setTrackStats(null);

    let isSubscribed = true;
    const params = new URLSearchParams();
    if (activeTrackId) params.set("trackId", activeTrackId);
    if (activeTrackTitle) params.set("title", activeTrackTitle);
    if (activeTrackArtist) params.set("artist", activeTrackArtist);

    fetch(`/api/listening/track-stats?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<TrackTelemetryStats>;
      })
      .then((data) => {
        if (!isSubscribed) return;
        trackStatsCacheRef.current.set(key, data);
        setTrackStats(data);
      })
      .catch((err) => {
        console.error("[TRACK STATS FETCH] Error loading stats:", err);
      });

    return () => {
      isSubscribed = false;
    };
  }, [activeTrackId, activeTrackTitle, activeTrackArtist]);

  return trackStats;
}
