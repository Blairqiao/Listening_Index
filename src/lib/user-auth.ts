/**
 * Spotify PKCE verifier and cookie helpers for the owner Spotify connection.
 */

import crypto from "node:crypto";

const VERIFIER_TTL_SECONDS = 10 * 60; // one login attempt

function cookie(name: string, value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  // Lax rather than Strict: the cookie must survive Spotify's redirect back.
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

export const PLAYER_VERIFIER_COOKIE = "player_spotify_pkce";

export function playerVerifierCookie(verifier: string): string {
  return cookie(PLAYER_VERIFIER_COOKIE, verifier, VERIFIER_TTL_SECONDS);
}

export function clearPlayerVerifierCookie(): string {
  return cookie(PLAYER_VERIFIER_COOKIE, "", 0);
}

/** PKCE, server side. No client secret is needed, so the player still works
 *  with only the client id the owner pastes into the customization menu. */
export function createVerifier(): string {
  return crypto.randomBytes(48).toString("base64url");
}
export function challengeFor(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export interface OwnerAuthorizationState {
  verifier: string;
  nonce: string;
  revision: string;
  returnOrigin: string;
  redirectUri: string;
  expiresAt: number;
}

function authorizationKey(): Buffer {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret || secret === "todo" || secret === "placeholder") {
    throw new Error("Admin authentication must be configured before connecting Spotify.");
  }
  return crypto.createHash("sha256").update(`owner-spotify-oauth:${secret}`).digest();
}

/** Keep PKCE private when Spotify's required loopback host differs from the opener. */
export function sealOwnerAuthorization(state: OwnerAuthorizationState): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", authorizationKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(state), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function readOwnerAuthorization(value: string): OwnerAuthorizationState | null {
  try {
    if (value.length > 8192) return null;
    const packed = Buffer.from(value, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", authorizationKey(), packed.subarray(0, 12));
    decipher.setAuthTag(packed.subarray(12, 28));
    const state = JSON.parse(Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString("utf8"));
    if (typeof state.verifier !== "string" || typeof state.nonce !== "string" ||
        typeof state.revision !== "string" || !/^\d+$/.test(state.revision) ||
        typeof state.returnOrigin !== "string" || typeof state.redirectUri !== "string" ||
        typeof state.expiresAt !== "number" || state.expiresAt <= Date.now() ||
        state.expiresAt > Date.now() + VERIFIER_TTL_SECONDS * 1000 ||
        new URL(state.returnOrigin).origin !== state.returnOrigin) return null;
    return state;
  } catch {
    return null;
  }
}
