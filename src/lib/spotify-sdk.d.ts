/**
 * Minimal typings for the Spotify Web Playback SDK.
 *
 * Only the surface this dashboard uses, rather than pulling in a dependency
 * for a script that arrives from Spotify's CDN at runtime.
 */

interface SpotifyPlaybackTrack {
  id: string | null;
  uri: string;
  name: string;
  duration_ms: number;
  artists: Array<{ name: string; uri: string }>;
  album: {
    name: string;
    uri: string;
    images: Array<{ url: string; width?: number; height?: number }>;
  };
}

interface SpotifyPlaybackState {
  paused: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat_mode: number;
  track_window: {
    current_track: SpotifyPlaybackTrack;
    next_tracks: SpotifyPlaybackTrack[];
    previous_tracks: SpotifyPlaybackTrack[];
  };
}

interface SpotifyPlayerError {
  message: string;
}

interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  getCurrentState(): Promise<SpotifyPlaybackState | null>;
  setName(name: string): Promise<void>;
  getVolume(): Promise<number>;
  setVolume(volume: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
  addListener(event: "ready" | "not_ready", cb: (o: { device_id: string }) => void): boolean;
  addListener(event: "player_state_changed", cb: (s: SpotifyPlaybackState | null) => void): boolean;
  addListener(
    event: "initialization_error" | "authentication_error" | "account_error" | "playback_error",
    cb: (e: SpotifyPlayerError) => void
  ): boolean;
  removeListener(event: string): boolean;
}

interface SpotifyPlayerInit {
  name: string;
  getOAuthToken: (cb: (token: string) => void) => void;
  volume?: number;
}

// No imports or exports in this file: it stays an ambient script so the
// interfaces above are global, the way the CDN script's own globals are.
interface Window {
  onSpotifyWebPlaybackSDKReady?: () => void;
  Spotify?: {
    Player: new (init: SpotifyPlayerInit) => SpotifyPlayer;
  };
}
