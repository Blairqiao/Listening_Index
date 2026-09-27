import { NextRequest, NextResponse } from "next/server";
import { getActiveSiteConfig } from "@/lib/db/queries/config";
import {
  challengeFor,
  createVerifier,
  isGuestAuthConfigured,
  verifierCookie,
} from "@/lib/user-auth";

export const dynamic = "force-dynamic";

const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

/**
 * Starts sign-in. The PKCE verifier is generated here and kept in an
 * HttpOnly cookie rather than in the page, so the browser never holds either
 * half of the exchange — the callback reads it back server-side.
 */
export async function GET(request: NextRequest) {
  if (!isGuestAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Guest sign-in is not configured. Set SESSION_SECRET and TOKEN_ENCRYPTION_KEY.",
      },
      { status: 503 }
    );
  }

  const config = await getActiveSiteConfig();
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || config.spotifyClientId;
  if (!clientId) {
    return NextResponse.json({ error: "No Spotify client id configured." }, { status: 503 });
  }

  const verifier = createVerifier();
  const origin = request.nextUrl.origin;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: `${origin}/api/spotify/callback`,
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challengeFor(verifier),
  });

  const response = NextResponse.redirect(
    `https://accounts.spotify.com/authorize?${params}`
  );
  response.headers.append("Set-Cookie", verifierCookie(verifier));
  return response;
}
