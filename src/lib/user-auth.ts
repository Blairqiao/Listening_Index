/**
 * Spotify PKCE verifier and cookie helpers for the owner Spotify connection.
 */

import crypto from "node:crypto";

/** Separate from any other cookie so the owner flow cannot collide. */
export const OWNER_VERIFIER_COOKIE = "owner_spotify_pkce";
const VERIFIER_TTL_SECONDS = 10 * 60; // one login attempt

function cookie(name: string, value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  // Lax rather than Strict: the cookie must survive Spotify's redirect back.
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

export function ownerVerifierCookie(verifier: string): string {
  return cookie(OWNER_VERIFIER_COOKIE, verifier, VERIFIER_TTL_SECONDS);
}

export function clearOwnerVerifierCookie(): string {
  return cookie(OWNER_VERIFIER_COOKIE, "", 0);
}

/** PKCE, server side. No client secret is needed, so the player still works
 *  with only the client id the owner pastes into the customization menu. */
export function createVerifier(): string {
  return crypto.randomBytes(48).toString("base64url");
}
export function challengeFor(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}
