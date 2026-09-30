/**
 * Client side of the server-held session.
 *
 * The browser no longer stores a refresh token. It asks this app for an
 * access token when the SDK needs one, and the session cookie does the
 * identifying — which is why signing in on a phone carries over to a laptop,
 * where localStorage never could.
 */

export interface GuestSession {
  /** False when SESSION_SECRET or TOKEN_ENCRYPTION_KEY is unset, in which
   *  case the player falls back to the browser-only flow. */
  available: boolean;
  signedIn: boolean;
  displayName: string | null;
}

export async function readGuestSession(): Promise<GuestSession> {
  try {
    const res = await fetch("/api/spotify/session", { cache: "no-store" });
    if (!res.ok) return { available: false, signedIn: false, displayName: null };
    return (await res.json()) as GuestSession;
  } catch {
    return { available: false, signedIn: false, displayName: null };
  }
}

/** Short-lived; the SDK asks again whenever it needs one. */
export async function fetchAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/spotify/session", {
      method: "POST",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.accessToken ?? null;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  try {
    await fetch("/api/spotify/session", { method: "DELETE" });
  } catch {}
}

/**
 * Opens sign-in in a popup and resolves when the callback page reports back.
 * Returns null if the browser blocked the popup, so the caller can send the
 * visitor there as a full navigation instead.
 */
export function signInPopup(): Promise<boolean> | null {
  const w = 480;
  const h = 720;
  const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
  const popup = window.open(
    "/api/spotify/login",
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
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "spotify-player-auth") return;
      finish(Boolean(e.data.ok));
    };
    window.addEventListener("message", onMessage);
    // Closing the popup posts nothing, so the cookie is the only way to tell
    // whether it actually worked.
    const poll = setInterval(async () => {
      if (!popup.closed) return;
      const session = await readGuestSession();
      finish(session.signedIn);
    }, 500);
  });
}
