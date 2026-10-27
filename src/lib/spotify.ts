/**
 * Headless Spotify Web API Client
 *
 * Implements server-to-server OAuth token refresh and recently played tracks ingestion.
 */

import { isConfigured } from "@/lib/db";
import { getActiveSiteConfig } from "@/lib/db/queries";
import { getOwnerCredential, rotateOwnerCredential } from "@/lib/owner-spotify";

/** Resolve the current database connection before reusing credentials. */
export async function resolveCredentials(): Promise<{
  clientId: string;
  clientSecret: string | undefined;
  refreshToken: string;
  fromDatabase: boolean;
  displayName: string | null;
  revision: string;
} | null> {
  const stored = await getOwnerCredential();
  if (!stored) return null;
  const config = await getActiveSiteConfig();
  const clientId =
    process.env.SPOTIFY_CLIENT_ID ||
    process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ||
    config.spotifyClientId;
  if (!clientId) return null;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  return {
    clientId,
    clientSecret: isConfigured(clientSecret) ? clientSecret : undefined,
    refreshToken: stored.refreshToken,
    fromDatabase: true,
    displayName: stored.displayName,
    revision: stored.revision ?? "0",
  };
}

/** True when the owner's Spotify is reachable by either route. */
export async function isOwnerSpotifyConfigured(): Promise<boolean> {
  return (await resolveCredentials()) !== null;
}

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
  connection: string;
}

let tokenCache: CachedToken | null = null;
const activeTokenPromises = new Map<string, Promise<string>>();
let tokenCacheGeneration = 0;

/**
 * Drops the cached access token. Called when the owner connects or
 * disconnects from the settings menu: the cache would otherwise keep
 * answering for the previous account for up to an hour.
 */
export function resetSpotifyTokenCache(): void {
  tokenCache = null;
  tokenCacheGeneration += 1;
}

/**
 * Refreshes a Spotify access token using a refresh token.
 * Supports both Client Secret (Authorization Code) and Client ID only (PKCE).
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret?: string
): Promise<Response> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  // A refresh token from the Authorization Code flow is redeemed with the
  // client secret; one from the PKCE flow has no secret and is redeemed with
  // the client id alone. Support both, so a token minted by a PKCE app works.
  if (isConfigured(clientSecret)) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", clientId);
  }

  return fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers,
    body: body.toString(),
  });
}

/**
 * Exchanges a Spotify authorization code for access and refresh tokens.
 * Supports optional code_verifier (for PKCE) and client secret.
 */
export async function exchangeAuthorizationCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret?: string,
  codeVerifier?: string
): Promise<Response> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  if (codeVerifier) {
    body.set("code_verifier", codeVerifier);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (isConfigured(clientSecret)) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", clientId);
  }

  return fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers,
    body: body.toString(),
  });
}

/**
 * Retrieves an active Spotify access token using the refresh token flow.
 * Caches token in-memory with a 5-minute safety buffer.
 * Deduplicates concurrent token refresh calls via an in-flight promise latch.
 */
export async function getAccessToken(): Promise<string> {
  const creds = await resolveCredentials();
  if (!creds) throw new Error("Spotify is not connected. Connect it from the Spotify Connection Manager.");
  const connection = JSON.stringify([creds.revision, creds.refreshToken]);
  const generation = tokenCacheGeneration;
  if (tokenCache?.connection === connection && Date.now() < tokenCache.expiresAt - 5 * 60 * 1000) {
    return tokenCache.accessToken;
  }
  const pendingKey = JSON.stringify([generation, connection]);
  const pending = activeTokenPromises.get(pendingKey);
  if (pending) return pending;

  const work = (async () => {
    const response = await refreshAccessToken(creds.refreshToken, creds.clientId, creds.clientSecret);
    if (!response.ok) {
      const errorText = await response.text();
      const retryAfter = response.headers.get("Retry-After");
      throw new SpotifyApiError({
        status: response.status,
        message: response.status === 401
          ? `Invalid Spotify credentials or revoked refresh token: ${errorText}`
          : `Failed to refresh Spotify access token: ${errorText}`,
        retryAfter: response.status === 429 && retryAfter ? parseInt(retryAfter, 10) : undefined,
      });
    }
    const data = await response.json() as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };
    let revision = creds.revision;
    const refreshToken = data.refresh_token || creds.refreshToken;
    if (refreshToken !== creds.refreshToken) {
      const rotatedRevision = await rotateOwnerCredential(creds, refreshToken);
      if (rotatedRevision === null) throw new Error("Spotify connection changed during token refresh.");
      revision = rotatedRevision;
    }
    const current = await getOwnerCredential();
    if (!current || (current.revision ?? "0") !== revision || current.refreshToken !== refreshToken || generation !== tokenCacheGeneration) {
      throw new Error("Spotify connection changed during token refresh.");
    }
    tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      connection: JSON.stringify([revision, refreshToken]),
    };
    return data.access_token;
  })();
  activeTokenPromises.set(pendingKey, work);
  try {
    return await work;
  } finally {
    if (activeTokenPromises.get(pendingKey) === work) activeTokenPromises.delete(pendingKey);
  }
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
