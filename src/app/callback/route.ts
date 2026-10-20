import { NextRequest } from "next/server";
import { requestOrigin } from "@/lib/request-origin";
import { getActiveSiteConfig, saveOwnerPlaybackToken } from "@/lib/db/queries";
import { closePopup as renderPopup, describeOAuthError } from "@/lib/popup-response";
import { PLAYER_VERIFIER_COOKIE, clearPlayerVerifierCookie } from "@/lib/user-auth";
import { AUTH_MESSAGE, getRedirectUri } from "@/lib/spotify-auth";
import { isAuthorizedAdminRequest } from "@/lib/auth-utils";
import { resetSpotifyTokenCache, exchangeAuthorizationCode } from "@/lib/spotify";

export const dynamic = "force-dynamic";

function closePopup(origin: string, ok: boolean, message: string | null) {
  const res = renderPopup(origin, ok, message, AUTH_MESSAGE);
  res.headers.append("Set-Cookie", clearPlayerVerifierCookie());
  return res;
}

/**
 * Handles Spotify OAuth redirect for the Web Playback SDK player.
 * Exchanges authorization code and persists owner playback refresh token to Neon DB.
 */
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);

  if (!isAuthorizedAdminRequest(request)) {
    return closePopup(origin, false, "Admin sign-in required.");
  }

  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const verifier = request.cookies.get(PLAYER_VERIFIER_COOKIE)?.value;

  if (error) return closePopup(origin, false, describeOAuthError(error));
  if (!code) return closePopup(origin, false, "No authorization code returned.");
  if (!verifier) return closePopup(origin, false, "Connection expired. Try again.");

  const config = await getActiveSiteConfig();
  const clientId =
    process.env.SPOTIFY_CLIENT_ID ||
    process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ||
    config.spotifyClientId;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId) return closePopup(origin, false, "No Spotify client id configured.");

  try {
    const tokenRes = await exchangeAuthorizationCode(
      code,
      getRedirectUri(request),
      clientId,
      clientSecret,
      verifier
    );

    const token = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !token.refresh_token) {
      console.warn("[PLAYER SPOTIFY] token exchange failed:", token.error, token.error_description);
      return closePopup(
        origin,
        false,
        token.error_description || token.error || "Token exchange failed."
      );
    }

    let displayName: string | null = null;
    let profileUrl: string | null = null;
    try {
      const meRes = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      const me = meRes.ok ? await meRes.json().catch(() => null) : null;
      displayName = me?.display_name || me?.id || null;
      profileUrl = me?.external_urls?.spotify || (me?.id ? `https://open.spotify.com/user/${me.id}` : null);
    } catch {
      // Proceed even if fetching profile name fails
    }

    await saveOwnerPlaybackToken(token.refresh_token, displayName, profileUrl);
    resetSpotifyTokenCache();
    return closePopup(origin, true, null);
  } catch (e) {
    console.error("[PLAYER SPOTIFY] connect failed:", e);
    return closePopup(origin, false, "Connecting failed.");
  }
}
