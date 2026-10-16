"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useConfig } from "@/context/ConfigContext";
import {
  beginLogin,
  beginLoginPopup,
  clearToken,
  setConfiguredClientId,
  AUTH_MESSAGE,
} from "@/lib/spotify-auth";
import { getStoredVolume, setStoredVolume, sliderToVolume } from "@/lib/volume-utils";
import { resolvePlayRequest, shouldToggleInPlace } from "@/lib/player-playback";
import { createSingleFlight } from "@/lib/player-connection";

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";
const DEVICE_NAME = "Listening Index";

export interface ActiveDevice {
  name: string;
  isThisBrowser: boolean;
}

export interface PlayerContextValue {
  playerStatus: "checking" | "unlinked" | "connecting" | "ready" | "error";
  errorMessage: string | null;
  deviceId: string | null;
  isLinked: boolean | null;
  activeDevice: ActiveDevice | null;
  state: SpotifyPlaybackState | null;
  currentTrack: SpotifyPlaybackTrack | null;
  previousTrack: SpotifyPlaybackTrack | null;
  nextTrack: SpotifyPlaybackTrack | null;
  contextName: string | null;
  position: number;
  duration: number;
  isPlaying: boolean;
  volume: number; // slider value [0, 1]
  shuffle: boolean;
  repeatMode: number; // 0: off, 1: context, 2: track
  isAuthorizing: boolean;
  connectPlayer: (forceReconnect?: boolean) => Promise<void>;
  checkTokenStatus: (forceReconnect?: boolean) => Promise<void>;
  handleLinkSpotify: () => Promise<void>;
  handleUnlink: () => Promise<void>;
  handleTransferPlayback: () => Promise<void>;
  handleTogglePlay: (trackIdOrUri?: string) => Promise<void>;
  handlePrevious: () => void;
  handleNext: () => void;
  handleSeek: (ms: number) => void;
  handleVolume: (sliderValue: number) => void;
  handleToggleShuffle: () => Promise<void>;
  handleCycleRepeat: () => Promise<void>;
  selectedContext: PlaybackContextSelection;
  selectContext: (ctx: PlaybackContextSelection) => Promise<void>;
  userPlaylists: UserPlaylistSummary[];
  loadPlaylists: () => Promise<void>;
}

export interface PlaybackContextSelection {
  type: "auto" | "playlist";
  name: string;
  uri?: string;
}

export interface UserPlaylistSummary {
  id: string;
  name: string;
  uri: string;
  trackCount: number;
  imageUrl?: string;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

interface SpotifyApiPlaybackResponse {
  is_playing: boolean;
  progress_ms?: number;
  shuffle_state?: boolean;
  repeat_state?: string;
  device?: {
    id: string;
    name: string;
  };
  context?: {
    uri: string;
    type?: string;
  };
  item?: {
    id: string;
    uri: string;
    name: string;
    duration_ms: number;
    artists?: Array<{ name: string; uri?: string }>;
    album?: {
      name: string;
      uri?: string;
      images?: Array<{ url: string; height?: number; width?: number }>;
    };
  };
}

/** Pure helper to resolve whether playback is active locally or on a remote device */
export function resolveActiveDevice(
  playback: SpotifyApiPlaybackResponse | null,
  localDeviceId: string | null
): ActiveDevice | null {
  if (!playback || !playback.device) return null;
  const isThis = Boolean(localDeviceId && playback.device.id === localDeviceId);
  return {
    name: playback.device.name || (isThis ? DEVICE_NAME : "Unknown Device"),
    isThisBrowser: isThis,
  };
}

/** Pure helper for cycling repeat mode: 0 (off) -> 1 (context) -> 2 (track) -> 0 */
export function cycleRepeatMode(current: number): number {
  return (current + 1) % 3;
}

/** Pure helper for repeat query string parameter */
export function getNextRepeatState(current: number): "off" | "context" | "track" {
  const next = cycleRepeatMode(current);
  if (next === 1) return "context";
  if (next === 2) return "track";
  return "off";
}

let sdkPromise: Promise<void> | null = null;
function loadSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Spotify) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const tag = document.createElement("script");
    tag.src = SDK_SRC;
    tag.async = true;
    tag.onerror = () => reject(new Error("Could not load the Spotify SDK script"));
    document.body.appendChild(tag);
  });
  return sdkPromise;
}

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { config, isAuthenticated, openModal } = useConfig();

  const playerRef = useRef<SpotifyPlayer | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const connectingRef = useRef<boolean>(false);
  const armedContextRef = useRef<boolean>(true);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const singleFlightCheckRef = useRef(createSingleFlight<void>());

  const [isLinked, setIsLinked] = useState<boolean | null>(null);
  const [playerStatus, setPlayerStatus] = useState<
    "checking" | "unlinked" | "connecting" | "ready" | "error"
  >("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [activeDevice, setActiveDevice] = useState<ActiveDevice | null>(null);
  const [state, setState] = useState<SpotifyPlaybackState | null>(null);
  const [position, setPosition] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(() => getStoredVolume(0.35));
  const volumeRef = useRef<number>(volume);
  volumeRef.current = volume;
  const [isAuthorizing, setIsAuthorizing] = useState<boolean>(false);
  const [initialContext, setInitialContext] = useState<{
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
  }>({ track: null, context: null });

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

  const [selectedContext, setSelectedContext] = useState<PlaybackContextSelection>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("listening_selected_context");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return { type: "auto", name: "Recent Favorites" };
  });

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

  useEffect(() => {
    setConfiguredClientId(config.spotifyClientId);
  }, [config.spotifyClientId]);

  // Query Spotify API for active playback device
  const probeActivePlayback = useCallback(async (localId: string | null) => {
    try {
      const tokenRes = await fetch("/api/player/token");
      const tokenData = await tokenRes.json().catch(() => ({}));
      const accessToken = tokenData?.accessToken;
      if (!accessToken) return;

      const res = await fetch("https://api.spotify.com/v1/me/player", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.status === 200) {
        const data: SpotifyApiPlaybackResponse = await res.json();
        const resolved = resolveActiveDevice(data, localId);
        setActiveDevice(resolved);
      } else if (res.status === 204 || res.status === 404) {
        // Nothing playing anywhere
        if (localId) {
          setActiveDevice({ name: DEVICE_NAME, isThisBrowser: true });
        }
      }
    } catch (e) {
      console.warn("[PLAYER] Failed to probe active playback device:", e);
    }
  }, []);

  // Connect Web Playback SDK
  const connectPlayer = useCallback(async (forceReconnect = false) => {
    if (connectingRef.current) return;

    // In-place reconnect of existing player instance: forces SDK to invoke getOAuthToken with new token
    if (playerRef.current && (forceReconnect || !deviceIdRef.current)) {
      connectingRef.current = true;
      setPlayerStatus("connecting");
      setErrorMessage(null);
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = setTimeout(() => {
        if (!deviceIdRef.current) {
          setPlayerStatus("error");
          setErrorMessage("Spotify SDK connection timed out. A Spotify Premium account is required for in-browser playback.");
        }
      }, 20000);
      try {
        playerRef.current.disconnect();
        const ok = await playerRef.current.connect();
        if (ok) {
          if (deviceIdRef.current) {
            if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
            setPlayerStatus("ready");
            void probeActivePlayback(deviceIdRef.current);
          }
        } else {
          if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
          setPlayerStatus("error");
          setErrorMessage("Failed to reconnect player with new Spotify token.");
        }
      } catch (err) {
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        setPlayerStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Reconnect error");
      } finally {
        connectingRef.current = false;
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
      await loadSdk();
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
                setErrorMessage("Admin session expired. Press 'L' to log in.");
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
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        deviceIdRef.current = device_id;
        setDeviceId(device_id);
        setPlayerStatus("ready");
        void probeActivePlayback(device_id);
      });

      player.addListener("not_ready", () => {
        setPlayerStatus("connecting");
      });

      player.addListener("player_state_changed", (s) => {
        setState(s);
        if (s) {
          setPosition(s.position);
          setActiveDevice({ name: DEVICE_NAME, isThisBrowser: true });
        }
      });

      player.addListener("account_error", () => {
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        setErrorMessage("Spotify Premium is required for in-browser playback.");
        setPlayerStatus("error");
      });

      player.addListener("authentication_error", () => {
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        setIsLinked(false);
        setPlayerStatus("unlinked");
        setErrorMessage("Spotify session expired or token rejected. Please re-link via Spotify modal (S).");
      });

      player.addListener("initialization_error", (e) => {
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        setErrorMessage(e.message);
        setPlayerStatus("error");
      });

      player.addListener("playback_error", (e) => {
        setErrorMessage(e.message);
      });

      const ok = await player.connect();
      if (ok) {
        playerRef.current = player;
        connectionTimeoutRef.current = setTimeout(() => {
          if (!deviceIdRef.current) {
            setPlayerStatus("error");
            setErrorMessage("Spotify SDK connection timed out. A Spotify Premium account is required for in-browser playback.");
          }
        }, 20000);
      } else {
        player.disconnect();
        setPlayerStatus("error");
        setErrorMessage("The player could not connect to Spotify.");
      }
    } catch (e) {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      setPlayerStatus("error");
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      connectingRef.current = false;
    }
  }, [probeActivePlayback]);

  // Helper to pause, disconnect, and clear player state cleanly
  const teardownPlayer = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.pause().catch(() => {});
      playerRef.current.disconnect();
    }
    deviceIdRef.current = null;
    setDeviceId(null);
    setState(null);
    setActiveDevice(null);
    setIsLinked(false);
    setPlayerStatus("unlinked");
    armedContextRef.current = true;
  }, []);

  // Initial check of /api/player/token on mount
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
            setErrorMessage("Admin session expired. Press 'L' to log in.");
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

  // Synchronize token status automatically when owner links or unlinks in the Spotify modal
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onAuthMessage = (e: MessageEvent) => {
      if (e.data?.type === AUTH_MESSAGE && e.data?.ok) {
        void checkTokenStatus(true);
      }
    };

    const onStatusChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ connected?: boolean }>;
      if (customEvent.detail?.connected === false) {
        teardownPlayer();
      } else {
        void checkTokenStatus(true);
      }
    };

    window.addEventListener("message", onAuthMessage);
    window.addEventListener("spotify-status-changed", onStatusChanged);

    return () => {
      window.removeEventListener("message", onAuthMessage);
      window.removeEventListener("spotify-status-changed", onStatusChanged);
    };
  }, [checkTokenStatus]);

  // Cleanup player only when PlayerProvider itself unmounts
  useEffect(() => {
    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
      deviceIdRef.current = null;
    };
  }, []);

  // Tick playback position when streaming
  useEffect(() => {
    if (!state || state.paused) return;
    const interval = setInterval(() => {
      setPosition((p) => {
        const dur = state.duration || 0;
        return dur > 0 ? Math.min(dur, p + 250) : p + 250;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [state]);

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
    try {
      await fetch("/api/player/token", { method: "DELETE" });
    } catch (e) {
      console.warn("[PLAYER] Failed to unlink Spotify:", e);
    }
    playerRef.current?.disconnect();
    playerRef.current = null;
    deviceIdRef.current = null;
    setDeviceId(null);
    clearToken();
    setState(null);
    setActiveDevice(null);
    setIsLinked(false);
    setPlayerStatus("unlinked");
  }, []);

  // Transfer playback to Listening Index device
  const handleTransferPlayback = useCallback(async () => {
    const id = deviceIdRef.current;
    if (!id) return;
    setErrorMessage(null);

    try {
      const tokenRes = await fetch("/api/player/token");
      const tokenData = await tokenRes.json().catch(() => ({}));
      const accessToken = tokenData?.accessToken;
      if (!accessToken) {
        setErrorMessage("Could not get access token for transfer.");
        return;
      }

      const res = await fetch("https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ device_ids: [id], play: true }),
      });

      if (res.ok || res.status === 204) {
        setActiveDevice({ name: DEVICE_NAME, isThisBrowser: true });
      } else {
        setErrorMessage(
          res.status === 404
            ? "Nothing is currently queued in Spotify. Start a track on any Spotify app, then transfer."
            : `Transfer failed (${res.status}).`
        );
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to transfer playback.");
    }
  }, []);

  // Transport control handlers
  const handlePrevious = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.previousTrack().catch(() => {
        playerRef.current?.seek(0);
      });
    } else {
      setPosition(0);
    }
  }, []);

  const handleTogglePlay = useCallback(
    async (trackIdOrUri?: string) => {
      setErrorMessage(null);

      // 1. If currently playing and context has not been armed for a new source, toggle pause/resume:
      const canToggleInPlace = shouldToggleInPlace({
        isContextArmed: armedContextRef.current,
        hasPlayer: Boolean(playerRef.current),
        hasLoadedTrack: Boolean(state?.track_window?.current_track),
        trackIdOrUri,
      });

      if (canToggleInPlace && playerRef.current) {
        try {
          const currentState = await playerRef.current.getCurrentState();
          if (currentState && currentState.track_window?.current_track) {
            await playerRef.current.togglePlay();
            return;
          }
        } catch (e) {
          console.warn("[PLAYER] SDK getCurrentState failed, falling back to Web API:", e);
        }
      }

      // 2. Start playback of armed context or specific track via Spotify Web API.
      const targetDeviceId = deviceIdRef.current;
      if (!targetDeviceId) {
        setErrorMessage("Spotify player is not ready yet. Please wait a moment.");
        return;
      }

      try {
        const tokenRes = await fetch("/api/player/token");
        const tokenData = await tokenRes.json().catch(() => ({}));
        const accessToken = tokenData?.accessToken;
        if (!accessToken) {
          setErrorMessage("Could not get access token for playback.");
          return;
        }

        const playReq = await resolvePlayRequest({
          trackIdOrUri,
          selectedContext,
          fallbackTrackUri: initialContext.track?.id || undefined,
          fetchAutoQueue:
            selectedContext.type === "auto"
              ? async () => {
                  const queueRes = await fetch("/api/player/auto-queue");
                  if (queueRes.ok) {
                    const queueData = await queueRes.json();
                    if (Array.isArray(queueData?.uris) && queueData.uris.length > 0) {
                      return queueData.uris;
                    }
                  }
                  return null;
                }
              : undefined,
        });

        const body = playReq ? JSON.stringify(playReq) : undefined;

        const res = await fetch(
          `https://api.spotify.com/v1/me/player/play?device_id=${targetDeviceId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              ...(body ? { "Content-Type": "application/json" } : {}),
            },
            body,
          }
        );

        if (res.ok || res.status === 204) {
          armedContextRef.current = false;
          setActiveDevice({ name: DEVICE_NAME, isThisBrowser: true });
        } else {
          const errData = await res.json().catch(() => ({}));
          const msg =
            errData?.error?.message ||
            (res.status === 403
              ? "Spotify Premium is required for Web Playback."
              : res.status === 404
              ? "No track queued to play. Select a track or enter Spotify URL."
              : `Playback failed (${res.status}).`);
          setErrorMessage(msg);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Playback toggle failed";
        setErrorMessage(message || "Playback toggle failed");
      }
    },
    [selectedContext, initialContext.track?.id, state?.track_window?.current_track]
  );

  const selectContext = useCallback(
    async (ctx: PlaybackContextSelection) => {
      setSelectedContext(ctx);
      try {
        localStorage.setItem("listening_selected_context", JSON.stringify(ctx));
      } catch {}

      const targetDeviceId = deviceIdRef.current;
      // Smart trigger: If music is already streaming, immediately switch playback to selected context
      if (state && !state.paused && targetDeviceId) {
        try {
          const tokenRes = await fetch("/api/player/token");
          const tokenData = await tokenRes.json().catch(() => ({}));
          const accessToken = tokenData?.accessToken;
          if (!accessToken) return;

          let body: string | undefined;
          if (ctx.type === "playlist" && ctx.uri) {
            body = JSON.stringify({ context_uri: ctx.uri });
          } else if (ctx.type === "auto") {
            const queueRes = await fetch("/api/player/auto-queue");
            if (queueRes.ok) {
              const queueData = await queueRes.json();
              if (Array.isArray(queueData?.uris) && queueData.uris.length > 0) {
                body = JSON.stringify({ uris: queueData.uris });
              }
            }
          }

          if (body) {
            await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${targetDeviceId}`, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body,
            });
            armedContextRef.current = false;
            setActiveDevice({ name: DEVICE_NAME, isThisBrowser: true });
          }
        } catch (e) {
          console.warn("[PLAYER] Failed to switch playback context:", e);
        }
      } else {
        armedContextRef.current = true;
      }
    },
    [state]
  );

  const handleNext = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.nextTrack().catch(() => {});
    }
  }, []);

  const handleSeek = useCallback((ms: number) => {
    setPosition(ms);
    playerRef.current?.seek(ms);
  }, []);

  const handleVolume = useCallback((v: number) => {
    setVolumeState(v);
    volumeRef.current = v;
    setStoredVolume(v);
    playerRef.current?.setVolume(sliderToVolume(v));
  }, []);

  const handleToggleShuffle = useCallback(async () => {
    try {
      const tokenRes = await fetch("/api/player/token");
      const tokenData = await tokenRes.json().catch(() => ({}));
      const accessToken = tokenData?.accessToken;
      if (!accessToken) return;

      const nextState = !(state?.shuffle ?? false);
      await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${nextState}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setState((prev) => (prev ? { ...prev, shuffle: nextState } : null));
    } catch (e) {
      console.warn("[PLAYER] Failed to toggle shuffle:", e);
    }
  }, [state?.shuffle]);

  const handleCycleRepeat = useCallback(async () => {
    try {
      const tokenRes = await fetch("/api/player/token");
      const tokenData = await tokenRes.json().catch(() => ({}));
      const accessToken = tokenData?.accessToken;
      if (!accessToken) return;

      const currentMode = state?.repeat_mode ?? 0;
      const nextMode = cycleRepeatMode(currentMode);
      const nextState = getNextRepeatState(currentMode);

      await fetch(`https://api.spotify.com/v1/me/player/repeat?state=${nextState}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setState((prev) => (prev ? { ...prev, repeat_mode: nextMode } : null));
    } catch (e) {
      console.warn("[PLAYER] Failed to cycle repeat mode:", e);
    }
  }, [state?.repeat_mode]);

  const fallbackTrack: SpotifyPlaybackTrack | null = initialContext.track
    ? {
        id: initialContext.track.id || null,
        uri: initialContext.track.id ? `spotify:track:${initialContext.track.id}` : "",
        name: initialContext.track.name,
        duration_ms: initialContext.track.durationMs,
        artists: [{ name: initialContext.track.artist, uri: "" }],
        album: {
          name: initialContext.track.album,
          uri: "",
          images: initialContext.track.imageUrl
            ? [{ url: initialContext.track.imageUrl, height: 300, width: 300 }]
            : [],
        },
      }
    : null;

  const currentTrack = state?.track_window.current_track || fallbackTrack;
  const previousTrack =
    state?.track_window.previous_tracks && state.track_window.previous_tracks.length > 0
      ? state.track_window.previous_tracks[state.track_window.previous_tracks.length - 1]
      : null;
  const nextTrack = state?.track_window.next_tracks?.[0] || null;
  const contextName =
    state?.context?.metadata?.name ||
    (selectedContext.type === "playlist"
      ? selectedContext.name
      : initialContext.context?.name || "Recent Favorites");
  const duration = state?.duration || currentTrack?.duration_ms || initialContext.track?.durationMs || 0;
  const isPlaying = state ? !state.paused : false;
  const shuffle = state ? state.shuffle : false;
  const repeatMode = state ? state.repeat_mode : 0;

  const value: PlayerContextValue = {
    playerStatus,
    errorMessage,
    deviceId,
    isLinked,
    activeDevice,
    state,
    currentTrack,
    previousTrack,
    nextTrack,
    contextName,
    position,
    duration,
    isPlaying,
    volume,
    shuffle,
    repeatMode,
    isAuthorizing,
    connectPlayer,
    checkTokenStatus,
    handleLinkSpotify,
    handleUnlink,
    handleTransferPlayback,
    handleTogglePlay,
    handlePrevious,
    handleNext,
    handleSeek,
    handleVolume,
    handleToggleShuffle,
    handleCycleRepeat,
    selectedContext,
    selectContext,
    userPlaylists,
    loadPlaylists,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return ctx;
}
