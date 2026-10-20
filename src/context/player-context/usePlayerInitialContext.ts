import { useState, useCallback } from "react";

export interface InitialPlaybackContext {
  track: {
    id?: string;
    name: string;
    artist: string;
    album: string;
    imageUrl?: string;
    durationMs: number;
  } | null;
  context: {
    type: "auto" | "playlist";
    name: string;
    uri?: string;
  } | null;
}

export function usePlayerInitialContext() {
  const [initialContext, setInitialContext] = useState<InitialPlaybackContext>({
    track: null,
    context: null,
  });

  // Query database for current / last-played playback context
  const loadInitialContext = useCallback(async () => {
    try {
      const res = await fetch("/api/player/current-context");
      if (res.ok) {
        const data = await res.json();
        if (data?.track) {
          setInitialContext({
            track: data.track,
            context: data.context || { type: "auto", name: "Recent Favorites" },
          });
        }
      }
    } catch (e) {
      console.warn("[PLAYER] Failed to load initial context:", e);
    }
  }, []);

  return { initialContext, setInitialContext, loadInitialContext };
}
