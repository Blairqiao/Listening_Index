/**
 * Guest sessions and refresh-token custody.
 *
 * The player used to run entirely in the browser: PKCE in JavaScript, tokens
 * in localStorage, nothing reaching this server. That is why it added no
 * security burden — but it also meant a guest reconnected on every new device,
 * because localStorage does not travel.
 *
 * Moving the refresh token server-side fixes that, and is the safer half of
 * the trade: the long-lived credential never touches JavaScript, so XSS on
 * this page cannot steal it. The cost is custody. A guest's refresh token is
 * their Spotify account, so it is encrypted at rest with a key this app holds
 * in its environment, never alongside the data.
 *
 * The browser gets only a session cookie, and short-lived access tokens
 * minted on demand.
 */

import crypto from "node:crypto";

export const SESSION_COOKIE = "spotify_session";
export const VERIFIER_COOKIE = "spotify_pkce";
/** Separate from the guest verifier so the two flows can never consume each other's. */
export const OWNER_VERIFIER_COOKIE = "owner_spotify_pkce";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const VERIFIER_TTL_SECONDS = 10 * 60; // one login attempt

/** Deliberately its own secret. It does not fall back to CRON_SECRET, which
 *  the README has owners put in a cron-job.org URL: anyone who read that URL
 *  could otherwise forge a session for any guest and mint their tokens. Nor
 *  ADMIN_PASSWORD, so rotating one never silently logs out the other. */
function getSessionKey(): string | null {
  const key = process.env.SESSION_SECRET;
  return key && key.trim() ? key : null;
}

/**
 * AES-256-GCM. GCM rather than CBC because it authenticates as well as
 * encrypts: a tampered ciphertext fails to decrypt rather than silently
 * yielding garbage that we would then send to Spotify.
 */
function getEncryptionKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw || !raw.trim()) return null;
  const key = Buffer.from(raw.trim(), "base64");
  // A short key would silently weaken everything, so refuse it outright.
  return key.length === 32 ? key : null;
}

/** Whether tokens can be sealed at rest — needed by guests and the owner alike. */
export function getEncryptionKeyConfigured(): boolean {
  return getEncryptionKey() !== null;
}

export function isGuestAuthConfigured(): boolean {
  return Boolean(getSessionKey() && getEncryptionKey());
}

export function encryptToken(plain: string): string {
  const key = getEncryptionKey();
  if (!key) throw new Error("TOKEN_ENCRYPTION_KEY is not configured (32 bytes, base64)");
  // A fresh iv per encryption is mandatory for GCM; reuse would leak plaintext.
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptToken(payload: string): string | null {
  const key = getEncryptionKey();
  if (!key) return null;
  const parts = payload.split(".");
  if (parts.length !== 3) return null;
  try {
    const [ivB64, tagB64, dataB64] = parts;
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Wrong key or tampered payload. Treat as no token rather than throwing.
    return null;
  }
}

/** `<userId>.<expiresAt>.<hmac>` — stateless, so verifying costs no lookup. */
export function createGuestSession(userId: string): string | null {
  const key = getSessionKey();
  if (!key) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${encodeURIComponent(userId)}.${expiresAt}`;
  const sig = crypto.createHmac("sha256", key).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/** Returns the Spotify user id, or null if absent, expired or forged. */
export function readGuestSession(token?: string | null): string | null {
  const key = getSessionKey();
  if (!key || !token) return null;
  // Split from the right: the signature and expiry never contain a dot, but
  // a Spotify user id can (legacy usernames such as "john.smith"), and
  // encodeURIComponent leaves dots as they are.
  const sigDot = token.lastIndexOf(".");
  const expDot = sigDot > 0 ? token.lastIndexOf(".", sigDot - 1) : -1;
  if (expDot <= 0) return null;
  const encodedId = token.slice(0, expDot);
  const expiresStr = token.slice(expDot + 1, sigDot);
  const sig = token.slice(sigDot + 1);
  if (!/^\d+$/.test(expiresStr)) return null;
  const expiresAt = parseInt(expiresStr, 10);
  if (!Number.isFinite(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) return null;

  const expected = crypto
    .createHmac("sha256", key)
    .update(`${encodedId}.${expiresStr}`)
    .digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  // Constant-time: a plain === would leak the signature byte by byte.
  if (!crypto.timingSafeEqual(a, b)) return null;

  const userId = decodeURIComponent(encodedId);
  // Reserved ids (the owner's stored credential) are never guest identities.
  // Refusing them here means even a correctly signed session cannot reach
  // the owner's token through the guest endpoints.
  if (userId.startsWith("__")) return null;
  return userId;
}

function cookie(name: string, value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  // Lax rather than Strict: the cookie must survive Spotify's redirect back.
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

export function sessionCookie(token: string): string {
  return cookie(SESSION_COOKIE, token, SESSION_TTL_SECONDS);
}
export function clearSessionCookie(): string {
  return cookie(SESSION_COOKIE, "", 0);
}
export function verifierCookie(verifier: string): string {
  return cookie(VERIFIER_COOKIE, verifier, VERIFIER_TTL_SECONDS);
}
export function clearVerifierCookie(): string {
  return cookie(VERIFIER_COOKIE, "", 0);
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
