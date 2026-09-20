/**
 * Browser-side Spotify authorization (PKCE).
 *
 * The dashboard's existing Spotify access is server-side: one refresh token in
 * an environment variable, used to read the owner's history. The player needs
 * something different — each visitor authorizes their own account, in their own
 * browser, and streams to their own device. That rules out the client secret
 * (it can never reach the browser), so this uses the Authorization Code flow
 * with PKCE, which is designed for exactly that.
 *
 * Tokens live in localStorage. They are that visitor's own credentials for
 * their own account, they never reach this app's server, and they expire in an
 * hour.
 */

const TOKEN_KEY = "spotify_player_token";
const VERIFIER_KEY = "spotify_player_verifier";
const RETURN_KEY = "spotify_player_return_to";

/** `streaming` is what the Web Playback SDK requires; the read scopes let us
 *  name the account, and the modify scopes drive transport controls. */
export const PLAYER_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

export interface StoredToken {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. */
  expiresAt: number;
}

export function getClientId(): string | null {
  return process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || null;
}

export function getRedirectUri(): string {
  return `${window.location.origin}/callback`;
}

function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  // Unreserved characters only, so the verifier survives the round trip.
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function base64Url(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return base64Url(digest);
}

export function readToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (!parsed?.accessToken || !parsed?.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeToken(token: StoredToken) {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  } catch {}
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

/** Sends the visitor to Spotify's consent screen. Does not return. */
export async function beginLogin(): Promise<void> {
  const clientId = getClientId();
  if (!clientId) throw new Error("NEXT_PUBLIC_SPOTIFY_CLIENT_ID is not set");

  const verifier = randomString(64);
  const challenge = await challengeFor(verifier);
  try {
    sessionStorage.setItem(VERIFIER_KEY, verifier);
    // Come back to whichever tab the visitor was on.
    sessionStorage.setItem(RETURN_KEY, window.location.pathname + window.location.search);
  } catch {}

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: PLAYER_SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export function consumeReturnPath(): string {
  try {
    const path = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return path || "/";
  } catch {
    return "/";
  }
}

async function postToken(body: Record<string, string>): Promise<StoredToken> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error_description || json.error || "Token request failed");
  }
  return {
    accessToken: json.access_token,
    // A refresh response may omit refresh_token, in which case the old one stands.
    refreshToken: json.refresh_token || body.refresh_token || "",
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
}

/** Exchanges the ?code= from the redirect for tokens. Called on /callback. */
export async function completeLogin(code: string): Promise<StoredToken> {
  const clientId = getClientId();
  if (!clientId) throw new Error("NEXT_PUBLIC_SPOTIFY_CLIENT_ID is not set");
  let verifier = "";
  try {
    verifier = sessionStorage.getItem(VERIFIER_KEY) || "";
    sessionStorage.removeItem(VERIFIER_KEY);
  } catch {}
  if (!verifier) throw new Error("Missing PKCE verifier — start the login again");

  const token = await postToken({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier,
  });
  writeToken(token);
  return token;
}

/**
 * Returns a valid access token, refreshing when it is close to expiry.
 * Returns null when the visitor has not connected, or the grant was revoked.
 */
export async function getFreshAccessToken(): Promise<string | null> {
  const stored = readToken();
  if (!stored) return null;
  // A minute of slack: the SDK asks for a token right before it needs it.
  if (stored.expiresAt - Date.now() > 60_000) return stored.accessToken;

  const clientId = getClientId();
  if (!clientId) return null;
  try {
    const refreshed = await postToken({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: stored.refreshToken,
    });
    writeToken(refreshed);
    return refreshed.accessToken;
  } catch {
    clearToken();
    return null;
  }
}
