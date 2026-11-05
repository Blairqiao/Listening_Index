import React, { useCallback, useEffect } from "react";
import { setStoredVolume, sliderToVolume } from "@/lib/volume-utils";
import {
  resolvePlayRequest,
  shouldToggleInPlace,
  isSameContext,
  formatPlayErrorMessage,
  type PlaybackContextSelection,
} from "@/lib/player-playback";
import {
  THIS_BROWSER,
  cycleRepeatMode,
  fetchAutoQueueUris,
  fetchPlayerAccessToken,
  getNextRepeatState,
  startPlayback,
  type ActiveDevice,
} from "./player-api";

export interface UsePlaybackControlsParams {
  playerRef: React.MutableRefObject<SpotifyPlayer | null>;
  deviceIdRef: React.MutableRefObject<string | null>;
  /** True while a newly chosen context waits for the next play press to start it */
  armedContextRef: React.MutableRefObject<boolean>;
  volumeRef: React.MutableRefObject<number>;
  state: SpotifyPlaybackState | null;
  setState: React.Dispatch<React.SetStateAction<SpotifyPlaybackState | null>>;
  setPosition: React.Dispatch<React.SetStateAction<number>>;
  setVolumeState: React.Dispatch<React.SetStateAction<number>>;
  setActiveDevice: (device: ActiveDevice | null) => void;
  setErrorMessage: (message: string | null) => void;
  selectedContext: PlaybackContextSelection;
  setSelectedContext: React.Dispatch<React.SetStateAction<PlaybackContextSelection>>;
  fallbackTrackUri?: string;
}

/** Transport, volume, shuffle, repeat, device transfer and context selection. */
export function usePlaybackControls({
  playerRef,
  deviceIdRef,
  armedContextRef,
  volumeRef,
  state,
  setState,
  setPosition,
  setVolumeState,
  setActiveDevice,
  setErrorMessage,
  selectedContext,
  setSelectedContext,
  fallbackTrackUri,
}: UsePlaybackControlsParams) {
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
  }, [state, setPosition]);

  // Transfer playback to Listening Index device
  const handleTransferPlayback = useCallback(async () => {
    const id = deviceIdRef.current;
    if (!id) return;
    setErrorMessage(null);
    armedContextRef.current = false;

    try {
      const accessToken = await fetchPlayerAccessToken();
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
        armedContextRef.current = false;
        setActiveDevice(THIS_BROWSER);
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
  }, [deviceIdRef, armedContextRef, setActiveDevice, setErrorMessage]);

  const handlePrevious = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.previousTrack().catch(() => {
        playerRef.current?.seek(0);
      });
    } else {
      setPosition(0);
    }
  }, [playerRef, setPosition]);

  const handleTogglePlay = useCallback(
    async (trackIdOrUri?: string) => {
      setErrorMessage(null);

      // 1. If currently playing and no specific track is requested, unconditionally pause:
      if (state && !state.paused && !trackIdOrUri) {
        if (playerRef.current) {
          try {
            await playerRef.current.pause();
            armedContextRef.current = false;
            return;
          } catch (e) {
            console.warn("[PLAYER] Failed to pause player via SDK:", e);
          }
        }
      }

      // 2. If track is loaded and can toggle in place (resume paused track):
      const canToggleInPlace = shouldToggleInPlace({
        isContextArmed: armedContextRef.current,
        hasPlayer: Boolean(playerRef.current),
        hasLoadedTrack: Boolean(state?.track_window?.current_track),
        isPlaying: state ? !state.paused : false,
        trackIdOrUri,
      });

      if (canToggleInPlace && playerRef.current) {
        try {
          const currentState = await playerRef.current.getCurrentState();
          if (currentState && currentState.track_window?.current_track) {
            await playerRef.current.resume();
            armedContextRef.current = false;
            return;
          }
        } catch (e) {
          console.warn("[PLAYER] SDK resume failed, falling back to Web API:", e);
        }
      }

      // 3. Start playback of armed context or specific track via Spotify Web API.
      const targetDeviceId = deviceIdRef.current;
      if (!targetDeviceId) {
        setErrorMessage("Spotify player is not ready yet. Please wait a moment.");
        return;
      }

      try {
        const accessToken = await fetchPlayerAccessToken();
        if (!accessToken) {
          setErrorMessage("Could not get access token for playback.");
          return;
        }

        const playReq = await resolvePlayRequest({
          trackIdOrUri,
          selectedContext,
          fallbackTrackUri,
          fetchAutoQueue: selectedContext.type === "auto" ? fetchAutoQueueUris : undefined,
        });

        const res = await startPlayback(accessToken, targetDeviceId, playReq ? JSON.stringify(playReq) : undefined);

        if (res.ok || res.status === 204) {
          armedContextRef.current = false;
          setActiveDevice(THIS_BROWSER);
        } else {
          armedContextRef.current = true;
          const errData = await res.json().catch(() => ({}));
          setErrorMessage(formatPlayErrorMessage(res.status, errData, "Playback"));
        }
      } catch (error) {
        armedContextRef.current = true;
        const message = error instanceof Error ? error.message : "Playback toggle failed";
        setErrorMessage(message || "Playback toggle failed");
      }
    },
    [selectedContext, fallbackTrackUri, state, playerRef, deviceIdRef, armedContextRef, setActiveDevice, setErrorMessage]
  );

  const selectContext = useCallback(
    async (ctx: PlaybackContextSelection) => {
      // If already playing this context, avoid restarting it from track 1
      if (isSameContext(selectedContext, ctx) && state && !state.paused) {
        return;
      }

      setSelectedContext(ctx);
      try {
        localStorage.setItem("listening_selected_context", JSON.stringify(ctx));
      } catch {
        // Ignore localStorage write errors
      }

      const targetDeviceId = deviceIdRef.current;
      // If music is already streaming, switch playback to the selected context now
      if (state && !state.paused && targetDeviceId) {
        try {
          const accessToken = await fetchPlayerAccessToken();
          if (!accessToken) return;

          const playReq = await resolvePlayRequest({
            selectedContext: ctx,
            fetchAutoQueue: ctx.type === "auto" ? fetchAutoQueueUris : undefined,
          });

          if (playReq) {
            const res = await startPlayback(accessToken, targetDeviceId, JSON.stringify(playReq));
            if (res.ok || res.status === 204) {
              armedContextRef.current = false;
              setActiveDevice(THIS_BROWSER);
            } else {
              armedContextRef.current = true;
              const errData = await res.json().catch(() => ({}));
              setErrorMessage(formatPlayErrorMessage(res.status, errData, "Playback switch"));
            }
          }
        } catch (e) {
          console.warn("[PLAYER] Failed to switch playback context:", e);
          armedContextRef.current = true;
          setErrorMessage(e instanceof Error ? e.message : "Playback switch failed");
        }
      } else {
        armedContextRef.current = true;
      }
    },
    [state, selectedContext, setSelectedContext, deviceIdRef, armedContextRef, setActiveDevice, setErrorMessage]
  );

  const handleNext = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.nextTrack().catch(() => {});
    }
  }, [playerRef]);

  const handleSeek = useCallback((ms: number) => {
    setPosition(ms);
    playerRef.current?.seek(ms);
  }, [playerRef, setPosition]);

  const handleVolume = useCallback((v: number) => {
    setVolumeState(v);
    volumeRef.current = v;
    setStoredVolume(v);
    playerRef.current?.setVolume(sliderToVolume(v));
  }, [playerRef, volumeRef, setVolumeState]);

  const handleToggleShuffle = useCallback(async () => {
    try {
      const accessToken = await fetchPlayerAccessToken();
      if (!accessToken) return;

      const nextState = !(state?.shuffle ?? false);
      const res = await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${nextState}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok || res.status === 204) {
        setState((prev) => (prev ? { ...prev, shuffle: nextState } : null));
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMessage(formatPlayErrorMessage(res.status, errData, "Shuffle"));
      }
    } catch (e) {
      console.warn("[PLAYER] Failed to toggle shuffle:", e);
      setErrorMessage(e instanceof Error ? e.message : "Failed to toggle shuffle");
    }
  }, [state?.shuffle, setState, setErrorMessage]);

  const handleCycleRepeat = useCallback(async () => {
    try {
      const accessToken = await fetchPlayerAccessToken();
      if (!accessToken) return;

      const currentMode = state?.repeat_mode ?? 0;
      const nextMode = cycleRepeatMode(currentMode);
      const nextState = getNextRepeatState(currentMode);

      const res = await fetch(`https://api.spotify.com/v1/me/player/repeat?state=${nextState}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok || res.status === 204) {
        setState((prev) => (prev ? { ...prev, repeat_mode: nextMode } : null));
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMessage(formatPlayErrorMessage(res.status, errData, "Repeat"));
      }
    } catch (e) {
      console.warn("[PLAYER] Failed to cycle repeat mode:", e);
      setErrorMessage(e instanceof Error ? e.message : "Failed to cycle repeat mode");
    }
  }, [state?.repeat_mode, setState, setErrorMessage]);

  return {
    handleTransferPlayback,
    handlePrevious,
    handleTogglePlay,
    selectContext,
    handleNext,
    handleSeek,
    handleVolume,
    handleToggleShuffle,
    handleCycleRepeat,
  };
}
