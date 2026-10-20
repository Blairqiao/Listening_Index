import { useState, useCallback } from "react";

export interface UserPlaylistSummary {
  id: string;
  name: string;
  uri: string;
  trackCount: number;
  imageUrl?: string;
}

export function usePlayerPlaylists() {
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylistSummary[]>([]);

  // Fetch owner playlists from Spotify API
  const loadPlaylists = useCallback(async () => {
    try {
      const res = await fetch("/api/player/playlists");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.playlists)) {
          setUserPlaylists(data.playlists);
        }
      }
    } catch (e) {
      console.warn("[PLAYER] Failed to load playlists:", e);
    }
  }, []);

  return { userPlaylists, setUserPlaylists, loadPlaylists };
}
