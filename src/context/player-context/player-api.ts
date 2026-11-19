import type { PlaybackContextSelection } from "@/lib/player-playback";

export const DEVICE_NAME = "Listening Index";

export interface ActiveDevice {
  name: string;
  isThisBrowser: boolean;
}

export interface SpotifyApiPlaybackResponse {
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

export const THIS_BROWSER: ActiveDevice = { name: DEVICE_NAME, isThisBrowser: true };

/** Whether playback is active in this browser or on a remote device */
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

/** Cycles repeat mode: 0 (off) -> 1 (context) -> 2 (track) -> 0 */
export function cycleRepeatMode(current: number): number {
  return (current + 1) % 3;
}

/** The repeat query string value for the mode after `current` */
export function getNextRepeatState(current: number): "off" | "context" | "track" {
  const next = cycleRepeatMode(current);
  if (next === 1) return "context";
  if (next === 2) return "track";
  return "off";
}

export type TokenResponse =
  | { kind: "linked"; accessToken: string | null }
  | { kind: "unlinked" }
  | { kind: "admin-expired" }
  | { kind: "failed"; message: string };

/**
 * Classifies a /api/player/token response. Only an OK `linked: false` means the
 * credential is gone, and only the ADMIN_AUTH_REQUIRED code means the admin session
 * expired; any other failure may be transient.
 */
export async function readTokenResponse(res: Response): Promise<TokenResponse> {
  const body = await res.json().catch(() => null);
  if (body?.code === "ADMIN_AUTH_REQUIRED") return { kind: "admin-expired" };
  if (res.ok && body?.linked === true) {
    return { kind: "linked", accessToken: typeof body.accessToken === "string" ? body.accessToken : null };
  }
  if (res.ok && body?.linked === false) return { kind: "unlinked" };
  const message =
    typeof body?.error === "string" && body.error
      ? body.error
      : `Spotify token request failed (HTTP ${res.status}).`;
  return { kind: "failed", message };
}

/** Fetch active player access token from server endpoint. */
export async function fetchPlayerAccessToken(): Promise<string | null> {
  try {
    const tokenRes = await fetch("/api/player/token");
    const tokenData = await tokenRes.json().catch(() => ({}));
    return typeof tokenData?.accessToken === "string" ? tokenData.accessToken : null;
  } catch {
    return null;
  }
}

/** Fetch auto queue track URIs from server endpoint. */
export async function fetchAutoQueueUris(): Promise<string[] | null> {
  try {
    const queueRes = await fetch("/api/player/auto-queue");
    if (queueRes.ok) {
      const queueData = await queueRes.json();
      if (Array.isArray(queueData?.uris) && queueData.uris.length > 0) {
        return queueData.uris;
      }
    }
  } catch (err) {
    console.warn("[PLAYER] Failed to fetch auto queue:", err);
  }
  return null;
}

/** PUT /me/player/play on a device. A missing body resumes whatever is loaded. */
export function startPlayback(accessToken: string, deviceId: string, body?: string): Promise<Response> {
  return fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body,
  });
}

/** Maps a Web API now-playing item to the SDK's track shape. */
export function toPlaybackTrack(item: NonNullable<SpotifyApiPlaybackResponse["item"]>): SpotifyPlaybackTrack {
  return {
    id: item.id || null,
    uri: item.uri || (item.id ? `spotify:track:${item.id}` : ""),
    name: item.name,
    duration_ms: item.duration_ms,
    artists: item.artists?.map((a) => ({ name: a.name, uri: a.uri || "" })) || [],
    album: {
      name: item.album?.name || "",
      uri: item.album?.uri || "",
      images: item.album?.images || [],
    },
  };
}

/**
 * The context selection for a playing context URI: the matching owner playlist if there is
 * one, otherwise a generic label. Returns `prev` unchanged when it already points at the URI.
 */
export function contextSelectionForUri(
  prev: PlaybackContextSelection,
  contextUri: string,
  playlists: ReadonlyArray<{ name: string; uri: string }>,
  metadataName?: string
): PlaybackContextSelection {
  if (prev.uri === contextUri) return prev;
  const matchingPlaylist = playlists.find((p) => p.uri === contextUri);
  if (matchingPlaylist) {
    return { type: "playlist", name: matchingPlaylist.name, uri: matchingPlaylist.uri };
  }
  const name = metadataName || (contextUri.includes(":album:") ? "Active Album" : "Spotify Queue");
  return { type: "playlist", name, uri: contextUri };
}
