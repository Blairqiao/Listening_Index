import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/auth-utils";
import crypto from "node:crypto";
import { requestOrigin } from "@/lib/request-origin";
import { beginOwnerAuthorization } from "@/lib/db/queries/config";
import { getActiveSiteConfig } from "@/lib/db/queries";
import { challengeFor, createVerifier, playerVerifierCookie, sealOwnerAuthorization } from "@/lib/user-auth";
import { getRedirectUri, TOKEN_SCOPES } from "@/lib/spotify-auth";

export const dynamic = "force-dynamic";

/**
 * Starts connecting Spotify for the Web Playback SDK player.
 * Admin-only: Live playback is strictly single-user for the authenticated admin.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }

  const config = await getActiveSiteConfig();
  const clientId =
    process.env.SPOTIFY_CLIENT_ID ||
    process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ||
    config.spotifyClientId;

  if (!clientId) {
    return NextResponse.json(
      { error: "Add your Spotify client id in the settings menu first." },
      { status: 503 }
    );
  }

  const verifier = createVerifier();
  const nonce = crypto.randomBytes(32).toString("hex");
  const revision = await beginOwnerAuthorization(nonce);
  const redirectUri = getRedirectUri(request);
  const state = sealOwnerAuthorization({
    verifier, nonce, revision, redirectUri,
    returnOrigin: requestOrigin(request, false),
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    scope: TOKEN_SCOPES,
    code_challenge_method: "S256",
    code_challenge: challengeFor(verifier),
    show_dialog: "true",
  });

  const response = NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`);
  response.headers.append("Set-Cookie", playerVerifierCookie(verifier));
  return response;
}
