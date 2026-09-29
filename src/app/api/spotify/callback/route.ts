import { NextRequest, NextResponse } from "next/server";
import { configRepository } from "@/lib/db/repositories";
import { userRepository } from "@/lib/db/repositories";
import {
  VERIFIER_COOKIE,
  clearVerifierCookie,
  createGuestSession,
  encryptToken,
  sessionCookie,
} from "@/lib/user-auth";
import { closePopup as renderPopup, describeOAuthError } from "@/lib/popup-response";

export const dynamic = "force-dynamic";

/**
 * Finishes sign-in. The code is exchanged here rather than in the browser,
 * so the refresh token goes straight from Spotify into encrypted storage
 * without ever existing in JavaScript.
 *
 * Renders a tiny page instead of redirecting because the player opens this
 * flow in a popup: the page tells the opener it is done and closes itself.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const verifier = request.cookies.get(VERIFIER_COOKIE)?.value;

  if (error) return closePopup(origin, false, describeOAuthError(error));
  if (!code) return closePopup(origin, false, "No authorization code returned.");
  if (!verifier) return closePopup(origin, false, "Login expired. Try again.");

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
        redirect_uri: `${origin}/api/spotify/callback`,
        code_verifier: verifier,
      }),
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok || !token.refresh_token) {
      // Spotify's own error text stays in the server log; the page shows only
      // a fixed message, so nothing from a response is ever reflected.
      console.warn("[SPOTIFY CALLBACK] token exchange failed:", token.error, token.error_description);
      return closePopup(origin, false, "Token exchange failed.");
    }

    // Identify the account so the session has something to key on.
    const meRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!meRes.ok) return closePopup(origin, false, "Could not read the Spotify profile.");
    const me = await meRes.json();

    await userRepository().upsertUser({
      id: me.id,
      displayName: me.display_name ?? null,
      encryptedRefreshToken: encryptToken(token.refresh_token),
    });

    const session = createGuestSession(me.id);
    if (!session) return closePopup(origin, false, "Sessions are not configured.");

    const response = closePopup(origin, true, null);
    response.headers.append("Set-Cookie", sessionCookie(session));
    response.headers.append("Set-Cookie", clearVerifierCookie());
    return response;
  } catch (e) {
    console.error("[SPOTIFY CALLBACK] sign-in failed:", e);
    return closePopup(origin, false, "Sign-in failed.");
  }
}

/** This flow's popups report back to the player tab under this message type. */
function closePopup(origin: string, ok: boolean, message: string | null) {
  return renderPopup(origin, ok, message, "spotify-player-auth");
}
