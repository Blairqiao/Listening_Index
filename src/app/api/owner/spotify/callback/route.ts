import { NextRequest } from "next/server";
import { requestOrigin } from "@/lib/request-origin";
import { isAuthorizedAdminRequest } from "@/lib/auth-utils";
import { configRepository } from "@/lib/db/repositories";
import { saveOwnerCredential } from "@/lib/owner-spotify";
import { closePopup as renderPopup, describeOAuthError } from "@/lib/popup-response";
import { resetSpotifyTokenCache } from "@/lib/spotify";
import { OWNER_VERIFIER_COOKIE, clearOwnerVerifierCookie } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

/** The settings menu listens for this type; the player tab listens for its own. */
const MESSAGE_TYPE = "spotify-owner-auth";

function closePopup(origin: string, ok: boolean, message: string | null) {
  const res = renderPopup(origin, ok, message, MESSAGE_TYPE);
  // Single-use either way: a verifier left behind could be replayed.
  res.headers.append("Set-Cookie", clearOwnerVerifierCookie());
  return res;
}

/**
 * Finishes connecting the owner's Spotify.
 *
 * Checks the admin cookie again rather than trusting that the login step
 * did: this is the request that actually replaces the dashboard's account,
 * and it can be reached directly by URL.
 */
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);

  if (!isAuthorizedAdminRequest(request)) {
    return closePopup(origin, false, "Admin sign-in required.");
  }

  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const verifier = request.cookies.get(OWNER_VERIFIER_COOKIE)?.value;

  if (error) return closePopup(origin, false, describeOAuthError(error));
  if (!code) return closePopup(origin, false, "No authorization code returned.");
  if (!verifier) return closePopup(origin, false, "Connection expired. Try again.");

  const config = await configRepository().getActiveSiteConfig();
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || config.spotifyClientId;
  if (!clientId) return closePopup(origin, false, "No Spotify client id configured.");

  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${origin}/api/owner/spotify/callback`,
        code_verifier: verifier,
      }),
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok || !token.refresh_token) {
      console.warn("[OWNER SPOTIFY] token exchange failed:", token.error, token.error_description);
      return closePopup(origin, false, "Token exchange failed.");
    }

    const meRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const me = meRes.ok ? await meRes.json() : null;

    await saveOwnerCredential(token.refresh_token, me?.display_name ?? me?.id ?? null);
    // The cache could still hold an access token for a previous account.
    resetSpotifyTokenCache();

    return closePopup(origin, true, null);
  } catch (e) {
    console.error("[OWNER SPOTIFY] connect failed:", e);
    return closePopup(origin, false, "Connecting failed.");
  }
}
