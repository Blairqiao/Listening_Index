/**
 * Headless Spotify Web API Client
 *
 * Implements server-to-server OAuth token refresh and recently played tracks ingestion.
 */

import { isConfigured } from "@/lib/db";

export interface SpotifyApiErrorDetails {
  status: number;
  message: string;
  retryAfter?: number;
}

export class SpotifyApiError extends Error {
  public status: number;
  public retryAfter?: number;

  constructor(details: SpotifyApiErrorDetails) {
    super(`Spotify API Error [${details.status}]: ${details.message}`);
    this.name = "SpotifyApiError";
    this.status = details.status;
    this.retryAfter = details.retryAfter;
  }
}

export interface SpotifyArtistSimple {
  id: string;
  name: string;
}

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  artists?: SpotifyArtistSimple[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  is_local: boolean;
  artists: SpotifyArtistSimple[];
  album: SpotifyAlbum;
}

export interface SpotifyPlayHistoryItem {
  track: SpotifyTrack;
  played_at: string; // ISO 8601
  context: {
    type: string;
    href: string;
    external_urls: Record<string, string>;
    uri: string;
  } | null;
}

export interface SpotifyRecentlyPlayedResponse {
  items: SpotifyPlayHistoryItem[];
  next: string | null;
  cursors: {
    after: string;
    before: string;
  } | null;
  limit: number;
  href: string;
}

// In-memory token cache to prevent duplicate token requests
interface CachedToken {
  accessToken: string;
  expiresAt: number; // Unix timestamp ms
}

let tokenCache: CachedToken | null = null;

/**
 * Retrieves an active Spotify access token using the refresh token flow.
 * Caches token in-memory with a 5-minute safety buffer.
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if valid and outside the 5-minute buffer
  if (tokenCache && now < tokenCache.expiresAt - 5 * 60 * 1000) {
    return tokenCache.accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (
    !isConfigured(clientId) ||
    !isConfigured(clientSecret) ||
    !isConfigured(refreshToken)
  ) {
    throw new Error(
      "Spotify credentials are not configured yet (currently set to 'todo' or empty). Ensure SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, " +
        "and SPOTIFY_REFRESH_TOKEN are updated in your environment."
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const retryAfter = response.headers.get("Retry-After");

    if (response.status === 429) {
      throw new SpotifyApiError({
        status: 429,
        message: `Rate limit exceeded on token refresh. Retry after ${retryAfter ?? "unknown"}s`,
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
      });
    }

    if (response.status === 401) {
      throw new SpotifyApiError({
        status: 401,
        message: `Invalid Spotify credentials or revoked refresh token: ${errorText}`,
      });
    }

    throw new SpotifyApiError({
      status: response.status,
      message: `Failed to refresh Spotify access token: ${errorText}`,
    });
  }

  const data = (await response.json()) as {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope?: string;
  };

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return data.access_token;
}

/**
 * Fetches the user's recently played tracks from the Spotify Web API.
 * Endpoint: GET https://api.spotify.com/v1/me/player/recently-played?limit=50
 */
export async function fetchRecentlyPlayed(
  limit = 50
): Promise<SpotifyRecentlyPlayedResponse> {
  const token = await getAccessToken();
  const clampedLimit = Math.min(Math.max(1, limit), 50);

  const url = `https://api.spotify.com/v1/me/player/recently-played?limit=${clampedLimit}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    const retryAfter = response.headers.get("Retry-After");

    if (response.status === 429) {
      throw new SpotifyApiError({
        status: 429,
        message: `Rate limited by Spotify API (/me/player/recently-played). Retry after ${retryAfter ?? "unknown"}s`,
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
      });
    }

    if (response.status === 401) {
      tokenCache = null;
      throw new SpotifyApiError({
        status: 401,
        message: `Unauthorized access to /me/player/recently-played: ${errorText}`,
      });
    }

    throw new SpotifyApiError({
      status: response.status,
      message: `Spotify Web API error (/me/player/recently-played): ${errorText}`,
    });
  }

  return (await response.json()) as SpotifyRecentlyPlayedResponse;
}
