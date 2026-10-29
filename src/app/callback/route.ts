import { NextRequest } from "next/server";
import { requestOrigin } from "@/lib/request-origin";
import { saveOwnerPlaybackToken } from "@/lib/db/queries";
import { closePopup as renderPopup, describeOAuthError } from "@/lib/popup-response";
import { readOwnerAuthorization, clearPlayerVerifierCookie, PLAYER_VERIFIER_COOKIE } from "@/lib/user-auth";
import { AUTH_MESSAGE, getRedirectUri } from "@/lib/spotify-auth";
import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { consumeOwnerAuthorization } from "@/lib/db/queries/config";
import { resetSpotifyTokenCache, exchangeAuthorizationCode } from "@/lib/spotify";

export const dynamic = "force-dynamic";

function closePopup(origin: string, ok: boolean, message: string | null) {
  const res = renderPopup(origin, ok, message, AUTH_MESSAGE, `${origin}/`);
  res.headers.append("Set-Cookie", clearPlayerVerifierCookie());
  return res;
}

/**
 * Handles Spotify OAuth redirect for the Web Playback SDK player.
 * Exchanges authorization code and persists owner playback refresh token to Neon DB.
 */
export async function GET(request: NextRequest) {
  const fallbackOrigin = requestOrigin(request, false);
  const stateValue = request.nextUrl.searchParams.get("state");
  if (!stateValue) {
    return closePopup(fallbackOrigin, false, isAuthorizedAdminRequest(request)
      ? "Connection expired. Try again." : "Admin sign-in required.");
  }
  const state = readOwnerAuthorization(stateValue);
  if (!state || state.redirectUri !== getRedirectUri(request)) {
    return closePopup(fallbackOrigin, false, "Connection expired or invalid. Try again.");
  }
  const origin = state.returnOrigin;
  const cookieVerifier = request.cookies.get(PLAYER_VERIFIER_COOKIE)?.value;
  if (cookieVerifier && cookieVerifier !== state.verifier) {
    return closePopup(origin, false, "Connection expired or invalid. Try again.");
  }
  if (!await consumeOwnerAuthorization(state.nonce, state.revision)) {
    return closePopup(origin, false, "Connection expired or already used. Try again.");
  }
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  if (error) return closePopup(origin, false, describeOAuthError(error));
  if (!code) return closePopup(origin, false, "No authorization code returned.");

  const clientId =
    process.env.SPOTIFY_CLIENT_ID ||
    process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId) return closePopup(origin, false, "No Spotify client id configured.");

  try {
    const tokenRes = await exchangeAuthorizationCode(
      code,
      state.redirectUri,
      clientId,
      clientSecret,
      state.verifier
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

    const saved = await saveOwnerPlaybackToken(token.refresh_token, displayName, profileUrl, state.revision);
    if (!saved) return closePopup(origin, false, "Spotify connection changed. Try again.");
    resetSpotifyTokenCache();
    return closePopup(origin, true, null);
  } catch (e) {
    console.error("[PLAYER SPOTIFY] connect failed:", e);
    return closePopup(origin, false, "Connecting failed.");
  }
}
