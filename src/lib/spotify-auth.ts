import type { NextRequest } from "next/server";
import { requestOrigin } from "./request-origin";

/** Posted by the callback tab once tokens are stored. */
export const AUTH_MESSAGE = "spotify-player-auth";

/** Unified 7-scope super-set powering both background sync and live playback. */
export const TOKEN_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-recently-played",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

export const TOKEN_SCOPE = TOKEN_SCOPES;
export const Token_Scope = TOKEN_SCOPES;

/** @deprecated Renamed to TOKEN_SCOPES / TOKEN_SCOPE */
export const PLAYER_SCOPES = TOKEN_SCOPES;

export interface TokenExpirationStatus {
  daysRemaining: number | null;
  isExpiringSoon: boolean;
}

export function calculateTokenExpiration(updatedAt: string | null): TokenExpirationStatus {
  if (!updatedAt) {
    return { daysRemaining: null, isExpiringSoon: false };
  }
  const updatedTime = new Date(updatedAt).getTime();
  const elapsedDays = Math.floor((Date.now() - updatedTime) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, 180 - elapsedDays);
  const isExpiringSoon = daysRemaining <= 14;
  return { daysRemaining, isExpiringSoon };
}

export function getRedirectUri(request?: NextRequest): string {
  if (process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI) {
    return process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
  }
  if (request) {
    const origin = requestOrigin(request);
    return `${origin}/callback`;
  }
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    // Spotify strictly rejects "localhost" in redirect URIs and requires 127.0.0.1
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      return `${origin.replace("://localhost", "://127.0.0.1")}/callback`;
    }
    return `${origin}/callback`;
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/callback`;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/callback`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/callback`;
  }
  return "";
}

export interface RedirectUriDisplay {
  productionUri: string;
  localUri: string;
  activeEnvironment: "production" | "local";
}

export function resolveRedirectUriDisplay(
  activeRedirectUri?: string | null
): RedirectUriDisplay {
  const uri = activeRedirectUri || (typeof window !== "undefined" ? getRedirectUri() : "");
  const isHttps = uri.startsWith("https://");

  let productionUri = "https://<your-app>.vercel.app/callback";
  if (isHttps) {
    productionUri = uri;
  } else if (process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")) {
    productionUri = `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/callback`;
  } else if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    productionUri = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/callback`;
  }

  let localUri = "http://127.0.0.1:8888/callback";
  if (uri.startsWith("http://127.0.0.1") || uri.startsWith("http://localhost")) {
    localUri = uri.replace("://localhost", "://127.0.0.1");
  }

  return {
    productionUri,
    localUri,
    activeEnvironment: isHttps ? "production" : "local",
  };
}

/** Sends the visitor to Spotify's consent screen. Does not return. */
export async function beginLogin(): Promise<void> {
  window.location.href = "/api/player/login";
}

/**
 * Connects in a popup instead, so the dashboard never unloads: no reload, no
 * lost tab, no re-fetch of the whole page just to sign in. Resolves true once
 * the callback tab reports success, false if the visitor closes the popup.
 * Returns null when the browser blocked the popup, so the caller can fall
 * back to the full-page redirect.
 */
export async function beginLoginPopup(): Promise<boolean | null> {
  const url = "/api/player/login";
  const w = 480;
  const h = 720;
  // Center on the window the visitor is actually looking at.
  const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
  const popup = window.open(
    url,
    "spotify-authorize",
    `width=${w},height=${h},left=${Math.round(left)},top=${Math.round(top)}`
  );
  if (!popup) return null;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      clearInterval(poll);
      resolve(ok);
    };
    const onMessage = (e: MessageEvent) => {
      const isAllowedOrigin =
        e.origin === window.location.origin ||
        e.origin === "http://127.0.0.1:8888" ||
        e.origin === "http://localhost:8888" ||
        e.origin === "http://127.0.0.1:3000" ||
        e.origin === "http://localhost:3000";
      if (!isAllowedOrigin) return;
      if (e.data?.type !== AUTH_MESSAGE) return;
      finish(Boolean(e.data.ok));
    };
    window.addEventListener("message", onMessage);
    // A closed popup is the signal when the visitor backs out
    const poll = setInterval(() => {
      if (popup.closed) {
        setTimeout(() => finish(false), 200);
      }
    }, 400);
  });
}
