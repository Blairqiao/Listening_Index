import React, { useCallback, useEffect, useRef, useState } from "react";
import { beginLogin, beginLoginPopup } from "@/lib/spotify-auth";
import { sliderToVolume } from "@/lib/volume-utils";
import { createSingleFlight } from "@/lib/async-utils";
import type { PlaybackContextSelection } from "@/lib/player-playback";
import { loadSpotifySdk } from "./useSpotifySdk";
import {
  DEVICE_NAME,
  THIS_BROWSER,
  contextSelectionForUri,
  fetchPlayerAccessToken,
  resolveActiveDevice,
  toPlaybackTrack,
  type ActiveDevice,
  type SpotifyApiPlaybackResponse,
} from "./player-api";

export type PlayerStatus = "checking" | "unlinked" | "connecting" | "ready" | "error";

const SDK_TIMEOUT_MESSAGE =
  "Spotify SDK connection timed out. A Spotify Premium account is required for in-browser playback.";
const ADMIN_EXPIRED_MESSAGE = "Admin session expired. Click the navigation bar lock icon to log in.";

export interface UsePlayerConnectionParams {
  isAuthenticated: boolean;
  openModal: () => void;
  volumeRef: React.MutableRefObject<number>;
  userPlaylistsRef: React.MutableRefObject<ReadonlyArray<{ name: string; uri: string }>>;
  setSelectedContext: React.Dispatch<React.SetStateAction<PlaybackContextSelection>>;
  loadInitialContext: () => Promise<void>;
  loadPlaylists: () => Promise<void>;
}

/**
 * Owns the Web Playback SDK player: linking, connecting, reconnecting with a fresh
 * token, probing the active device, and tearing everything down on unlink or logout.
 *
 * Each connection attempt gets a number; callbacks from an older attempt are ignored,
 * so a teardown during a slow connect cannot leave the player half-connected.
 */
export function usePlayerConnection({
  isAuthenticated,
  openModal,
  volumeRef,
  userPlaylistsRef,
  setSelectedContext,
  loadInitialContext,
  loadPlaylists,
}: UsePlayerConnectionParams) {
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const connectingRef = useRef<boolean>(false);
  const connectionAttemptRef = useRef<number>(0);
  const armedContextRef = useRef<boolean>(true);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const singleFlightCheckRef = useRef(createSingleFlight<void>());

  const [isLinked, setIsLinked] = useState<boolean | null>(null);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [activeDevice, setActiveDevice] = useState<ActiveDevice | null>(null);
  const [state, setState] = useState<SpotifyPlaybackState | null>(null);
  const [probedTrack, setProbedTrack] = useState<SpotifyPlaybackTrack | null>(null);
  const [position, setPosition] = useState<number>(0);
  const [isAuthorizing, setIsAuthorizing] = useState<boolean>(false);

  const clearConnectionTimeout = useCallback(() => {
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
  }, []);

  const startConnectionTimeout = useCallback(() => {
    connectionTimeoutRef.current = setTimeout(() => {
      if (!deviceIdRef.current) {
        setPlayerStatus("error");
        setErrorMessage(SDK_TIMEOUT_MESSAGE);
      }
    }, 20000);
  }, []);

  // Query Spotify API for active playback device & current track
  const probeActivePlayback = useCallback(async (localId: string | null) => {
    try {
      const accessToken = await fetchPlayerAccessToken();
      if (!accessToken) return;

      const res = await fetch("https://api.spotify.com/v1/me/player", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.status === 200) {
        const data: SpotifyApiPlaybackResponse = await res.json();
        setActiveDevice(resolveActiveDevice(data, localId));

        // Seed the current track if the browser SDK is not playing yet
        if (data.item) {
          setProbedTrack(toPlaybackTrack(data.item));
          if (typeof data.progress_ms === "number") {
            setPosition(data.progress_ms);
          }
          const contextUri = data.context?.uri;
          if (contextUri) {
            setSelectedContext((prev) => contextSelectionForUri(prev, contextUri, userPlaylistsRef.current));
          }
        }
      } else if (res.status === 204 || res.status === 404) {
        // Nothing playing anywhere
        if (localId) {
          setActiveDevice(THIS_BROWSER);
        }
      }
    } catch (e) {
      console.warn("[PLAYER] Failed to probe active playback device:", e);
    }
  }, [setSelectedContext, userPlaylistsRef]);

  // Connect Web Playback SDK
  const connectPlayer = useCallback(async (forceReconnect = false) => {
    if (connectingRef.current) return;
    const currentAttempt = ++connectionAttemptRef.current;

    // In-place reconnect of existing player instance: forces SDK to invoke getOAuthToken with new token
    if (playerRef.current && (forceReconnect || !deviceIdRef.current)) {
      connectingRef.current = true;
      setPlayerStatus("connecting");
      setErrorMessage(null);
      clearConnectionTimeout();
      startConnectionTimeout();
      try {
        playerRef.current.disconnect();
        const ok = await playerRef.current.connect();
        if (currentAttempt !== connectionAttemptRef.current) return;
        if (ok) {
          if (deviceIdRef.current) {
            clearConnectionTimeout();
            setPlayerStatus("ready");
            void probeActivePlayback(deviceIdRef.current);
          }
        } else {
          clearConnectionTimeout();
          setPlayerStatus("error");
          setErrorMessage("Failed to reconnect player with new Spotify token.");
        }
      } catch (err) {
        if (currentAttempt !== connectionAttemptRef.current) return;
        clearConnectionTimeout();
        setPlayerStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Reconnect error");
      } finally {
        if (currentAttempt === connectionAttemptRef.current) {
          connectingRef.current = false;
        }
      }
      return;
    }

    if (playerRef.current && deviceIdRef.current && !forceReconnect) {
      setPlayerStatus("ready");
      void probeActivePlayback(deviceIdRef.current);
      return;
    }

    connectingRef.current = true;
    setErrorMessage(null);
    setPlayerStatus("connecting");

    deviceIdRef.current = null;
    setDeviceId(null);
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    try {
      await loadSpotifySdk();
      if (currentAttempt !== connectionAttemptRef.current) return;
      if (!window.Spotify) {
        throw new Error("Spotify SDK did not initialize");
      }

      const player = new window.Spotify.Player({
        name: DEVICE_NAME,
        volume: sliderToVolume(volumeRef.current),
        getOAuthToken: (cb) => {
          fetch("/api/player/token")
            .then((r) => {
              if (r.status === 401) {
                setPlayerStatus("error");
                setErrorMessage(ADMIN_EXPIRED_MESSAGE);
                return null;
              }
              return r.json();
            })
            .then((d) => {
              if (!d) return;
              if (d?.accessToken) {
                cb(d.accessToken);
              } else if (d?.linked === false) {
                setIsLinked(false);
                setPlayerStatus("unlinked");
              } else if (d?.error) {
                setIsLinked(false);
                setPlayerStatus("unlinked");
                setErrorMessage(d.error);
              }
            })
            .catch((e) => {
              console.error("[PLAYER] Failed to refresh token:", e);
              setIsLinked(false);
              setPlayerStatus("unlinked");
              setErrorMessage("Failed to refresh token from server.");
            });
        },
      });

      player.addListener("ready", ({ device_id }) => {
        if (currentAttempt !== connectionAttemptRef.current || playerRef.current !== player) return;
        clearConnectionTimeout();
        deviceIdRef.current = device_id;
        setDeviceId(device_id);
        setPlayerStatus("ready");
        void probeActivePlayback(device_id);
      });

      player.addListener("not_ready", () => {
        if (currentAttempt !== connectionAttemptRef.current || playerRef.current !== player) return;
        deviceIdRef.current = null;
        setDeviceId(null);
        setPlayerStatus("connecting");
      });

      player.addListener("player_state_changed", (s) => {
        setState(s);
        if (s) {
          setPosition(s.position);
          setActiveDevice(THIS_BROWSER);
          if (!s.paused) {
            armedContextRef.current = false;
          }
          const contextUri = s.context?.uri;
          if (contextUri) {
            setSelectedContext((prev) =>
              contextSelectionForUri(prev, contextUri, userPlaylistsRef.current, s.context?.metadata?.name)
            );
          }
        }
      });

      player.addListener("account_error", () => {
        clearConnectionTimeout();
        setErrorMessage("Spotify Premium is required for in-browser playback.");
        setPlayerStatus("error");
      });

      player.addListener("authentication_error", () => {
        clearConnectionTimeout();
        setIsLinked(false);
        setPlayerStatus("unlinked");
        setErrorMessage("Spotify session expired or token rejected. Please re-link via the Spotify status icon in the navigation bar.");
      });

      player.addListener("initialization_error", (e) => {
        clearConnectionTimeout();
        setErrorMessage(e.message);
        setPlayerStatus("error");
      });

      player.addListener("playback_error", (e) => {
        setErrorMessage(e.message);
      });

      const ok = await player.connect();
      if (currentAttempt !== connectionAttemptRef.current) {
        player.disconnect();
        return;
      }
      if (ok) {
        playerRef.current = player;
        startConnectionTimeout();
      } else {
        player.disconnect();
        setPlayerStatus("error");
        setErrorMessage("The player could not connect to Spotify.");
      }
    } catch (e) {
      if (currentAttempt !== connectionAttemptRef.current) return;
      clearConnectionTimeout();
      setPlayerStatus("error");
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      if (currentAttempt === connectionAttemptRef.current) {
        connectingRef.current = false;
      }
    }
  }, [probeActivePlayback, volumeRef, setSelectedContext, userPlaylistsRef, clearConnectionTimeout, startConnectionTimeout]);

  // Pause, disconnect, and clear player state
  const teardownPlayer = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    connectionAttemptRef.current++;
    connectingRef.current = false;
    if (playerRef.current) {
      playerRef.current.pause().catch(() => {});
      playerRef.current.disconnect();
      playerRef.current = null;
    }
    deviceIdRef.current = null;
    setDeviceId(null);
    setState(null);
    setProbedTrack(null);
    setActiveDevice(null);
    setIsLinked(false);
    setPlayerStatus("unlinked");
    armedContextRef.current = true;
  }, []);

  // Check /api/player/token, then connect when linked
  const checkTokenStatus = useCallback(
    (forceReconnect = false) => {
      return singleFlightCheckRef.current(async () => {
        if (!isAuthenticated) {
          teardownPlayer();
          return;
        }

        setPlayerStatus("checking");
        setErrorMessage(null);
        try {
          const res = await fetch("/api/player/token");
          if (res.status === 401) {
            teardownPlayer();
            setPlayerStatus("error");
            setErrorMessage(ADMIN_EXPIRED_MESSAGE);
            return;
          }

          const data = await res.json().catch(() => ({}));
          if (data?.linked) {
            setIsLinked(true);
            void probeActivePlayback(deviceIdRef.current);
            void loadInitialContext();
            void loadPlaylists();
            await connectPlayer(forceReconnect);
          } else {
            teardownPlayer();
          }
        } catch (err) {
          teardownPlayer();
          console.warn("[PLAYER] Failed to check token status:", err);
        }
      });
    },
    [isAuthenticated, connectPlayer, probeActivePlayback, teardownPlayer, loadInitialContext, loadPlaylists]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      teardownPlayer();
    } else {
      void checkTokenStatus();
    }
  }, [isAuthenticated, checkTokenStatus, teardownPlayer]);

  // Re-check when the owner links or unlinks in the Spotify modal
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStatusChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ connected?: boolean }>;
      if (customEvent.detail?.connected === false) {
        teardownPlayer();
      } else {
        void checkTokenStatus(true);
      }
    };

    window.addEventListener("spotify-status-changed", onStatusChanged);

    return () => {
      window.removeEventListener("spotify-status-changed", onStatusChanged);
    };
  }, [checkTokenStatus, teardownPlayer]);

  // Disconnect only when the provider itself unmounts
  useEffect(() => {
    const attemptRef = connectionAttemptRef;
    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      attemptRef.current++;
      connectingRef.current = false;
      playerRef.current?.disconnect();
      playerRef.current = null;
      deviceIdRef.current = null;
    };
  }, []);

  // Link Spotify action button handler
  const handleLinkSpotify = useCallback(async () => {
    if (!isAuthenticated) {
      openModal();
      return;
    }

    setIsAuthorizing(true);
    setErrorMessage(null);

    try {
      const popupResult = await beginLoginPopup();
      if (popupResult === null) {
        await beginLogin();
        return;
      }

      if (popupResult) {
        await checkTokenStatus();
      } else {
        setErrorMessage("Spotify authorization window closed before completion.");
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setIsAuthorizing(false);
    }
  }, [isAuthenticated, openModal, checkTokenStatus]);

  // Unlink Spotify handler
  const handleUnlink = useCallback(async () => {
    teardownPlayer();
    try {
      await fetch("/api/player/token", { method: "DELETE" });
    } catch (e) {
      console.warn("[PLAYER] Failed to unlink Spotify:", e);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("spotify-status-changed", { detail: { connected: false } })
      );
    }
  }, [teardownPlayer]);

  return {
    playerRef,
    deviceIdRef,
    armedContextRef,
    isLinked,
    playerStatus,
    errorMessage,
    setErrorMessage,
    deviceId,
    activeDevice,
    setActiveDevice,
    state,
    setState,
    probedTrack,
    position,
    setPosition,
    isAuthorizing,
    connectPlayer,
    checkTokenStatus,
    handleLinkSpotify,
    handleUnlink,
  };
}
