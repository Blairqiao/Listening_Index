import { NextRequest, NextResponse } from "next/server";
import { getActiveSiteConfig } from "@/lib/db/queries/config";
import { userRepository } from "@/lib/db/repositories";
import {
  VERIFIER_COOKIE,
  clearVerifierCookie,
  createGuestSession,
  encryptToken,
  sessionCookie,
} from "@/lib/user-auth";

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

  if (error) return closePopup(origin, false, describe(error));
  if (!code) return closePopup(origin, false, "No authorization code returned.");
  if (!verifier) return closePopup(origin, false, "Login expired. Try again.");

  const config = await getActiveSiteConfig();
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
      return closePopup(origin, false, token.error_description || "Token exchange failed.");
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
    return closePopup(origin, false, e instanceof Error ? e.message : String(e));
  }
}

function describe(error: string): string {
  return error === "access_denied" ? "Authorization was declined." : error;
}

/**
 * Posting to the opener rather than redirecting keeps the dashboard loaded
 * behind the popup. The origin is pinned so no other page can read the result.
 */
function closePopup(origin: string, ok: boolean, message: string | null): NextResponse {
  const payload = JSON.stringify({ type: "spotify-player-auth", ok, message });
  const html = `<!doctype html><meta charset="utf-8"><title>Spotify</title>
<body style="background:#080808;color:#5A5A55;font:12px ui-monospace,monospace;display:grid;place-items:center;height:100vh;margin:0">
<p>${ok ? "Connected. You can close this window." : escapeHtml(message || "Sign-in failed.")}</p>
<script>
  try { if (window.opener) window.opener.postMessage(${payload}, ${JSON.stringify(origin)}); } catch (e) {}
  if (window.opener) window.close(); else location.replace(${JSON.stringify(origin)});
</script>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
