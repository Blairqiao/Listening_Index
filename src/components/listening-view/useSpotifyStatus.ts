import { useCallback, useEffect, useRef, useState } from "react";

export interface SpotifyStatus {
  connected: boolean;
  isExpiringSoon: boolean;
  daysRemaining?: number | null;
  displayName?: string | null;
}

/** Owner Spotify connection status for the admin prompts. Re-checked when the Spotify modal closes. */
export function useSpotifyStatus(isAuthenticated: boolean, isAdminSpotifyModalOpen: boolean) {
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyStatus | null>(null);

  const fetchSpotifyStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setSpotifyStatus(null);
      return;
    }
    try {
      const res = await fetch("/api/owner/spotify", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSpotifyStatus({
          connected: Boolean(data.connected),
          isExpiringSoon: Boolean(data.isExpiringSoon),
          daysRemaining: typeof data.daysRemaining === "number" ? data.daysRemaining : null,
          displayName: data.displayName || null,
        });
      }
    } catch (err) {
      console.warn("[SPOTIFY STATUS] Error probing status:", err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchSpotifyStatus();
    } else {
      setSpotifyStatus(null);
    }
  }, [isAuthenticated, fetchSpotifyStatus]);

  const prevAdminSpotifyModalOpenRef = useRef(isAdminSpotifyModalOpen);
  useEffect(() => {
    if (prevAdminSpotifyModalOpenRef.current && !isAdminSpotifyModalOpen && isAuthenticated) {
      void fetchSpotifyStatus();
    }
    prevAdminSpotifyModalOpenRef.current = isAdminSpotifyModalOpen;
  }, [isAdminSpotifyModalOpen, isAuthenticated, fetchSpotifyStatus]);

  return spotifyStatus;
}
