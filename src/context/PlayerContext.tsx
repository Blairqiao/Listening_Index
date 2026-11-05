"use client";

import React, { createContext, useContext, useRef, useState } from "react";
import { useConfig } from "@/context/ConfigContext";
import { getStoredVolume } from "@/lib/volume-utils";
import type { PlaybackContextSelection } from "@/lib/player-playback";
import { usePlayerPlaylists, UserPlaylistSummary } from "./player-context/usePlayerPlaylists";
import { usePlayerInitialContext } from "./player-context/usePlayerInitialContext";
import { usePlayerConnection, type PlayerStatus } from "./player-context/usePlayerConnection";
import { usePlaybackControls } from "./player-context/usePlaybackControls";
import type { ActiveDevice } from "./player-context/player-api";

export type { UserPlaylistSummary, PlaybackContextSelection, ActiveDevice };

export interface PlayerContextValue {
  playerStatus: PlayerStatus;
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

const PlayerContext = createContext<PlayerContextValue | null>(null);

function readSavedContext(): PlaybackContextSelection {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("listening_selected_context");
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore localStorage read or JSON parse errors
    }
  }
  return { type: "auto", name: "Recent Favorites" };
}

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, openModal } = useConfig();

  const [volume, setVolumeState] = useState<number>(() => getStoredVolume(0.35));
  const volumeRef = useRef<number>(volume);
  volumeRef.current = volume;

  const { initialContext, loadInitialContext } = usePlayerInitialContext();
  const [selectedContext, setSelectedContext] = useState<PlaybackContextSelection>(readSavedContext);

  const { userPlaylists, loadPlaylists } = usePlayerPlaylists();
  const userPlaylistsRef = useRef(userPlaylists);
  userPlaylistsRef.current = userPlaylists;

  const connection = usePlayerConnection({
    isAuthenticated,
    openModal,
    volumeRef,
    userPlaylistsRef,
    setSelectedContext,
    loadInitialContext,
    loadPlaylists,
  });
  const { state, probedTrack } = connection;

  const controls = usePlaybackControls({
    playerRef: connection.playerRef,
    deviceIdRef: connection.deviceIdRef,
    armedContextRef: connection.armedContextRef,
    volumeRef,
    state,
    setState: connection.setState,
    setPosition: connection.setPosition,
    setVolumeState,
    setActiveDevice: connection.setActiveDevice,
    setErrorMessage: connection.setErrorMessage,
    selectedContext,
    setSelectedContext,
    fallbackTrackUri: initialContext.track?.id || undefined,
  });

  // Last-played Track from the server, shown before the SDK or a probe reports one
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

  const currentTrack = state?.track_window.current_track || probedTrack || fallbackTrack;
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
  const duration =
    state?.duration ||
    currentTrack?.duration_ms ||
    probedTrack?.duration_ms ||
    initialContext.track?.durationMs ||
    0;

  const value: PlayerContextValue = {
    playerStatus: connection.playerStatus,
    errorMessage: connection.errorMessage,
    deviceId: connection.deviceId,
    isLinked: connection.isLinked,
    activeDevice: connection.activeDevice,
    state,
    currentTrack,
    previousTrack,
    nextTrack,
    contextName,
    position: connection.position,
    duration,
    isPlaying: state ? !state.paused : false,
    volume,
    shuffle: state ? state.shuffle : false,
    repeatMode: state ? state.repeat_mode : 0,
    isAuthorizing: connection.isAuthorizing,
    connectPlayer: connection.connectPlayer,
    checkTokenStatus: connection.checkTokenStatus,
    handleLinkSpotify: connection.handleLinkSpotify,
    handleUnlink: connection.handleUnlink,
    ...controls,
    selectedContext,
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
