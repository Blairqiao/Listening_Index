import { NextRequest, NextResponse } from "next/server";
import { requestOrigin } from "@/lib/request-origin";
import { isAuthorizedAdminRequest } from "@/lib/auth-utils";
import { getActiveSiteConfig } from "@/lib/db/queries";
import { canStoreOwnerCredential } from "@/lib/owner-spotify";
import { challengeFor, createVerifier, ownerVerifierCookie } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

/** Read-only, and the same set the terminal script requests. */
const OWNER_SCOPES = [
  "user-read-recently-played",
  "user-read-playback-state",
  "user-read-currently-playing",
].join(" ");

/**
 * Starts connecting the owner's Spotify from the settings menu.
 *
 * Admin-only: whichever account completes this flow becomes the account the
 * whole dashboard reads, so a visitor must never be able to start it.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }
  if (!canStoreOwnerCredential()) {
    return NextResponse.json(
      {
        error:
          "Connecting from the menu needs a database and TOKEN_ENCRYPTION_KEY, so the token can be stored encrypted.",
      },
      { status: 503 }
    );
  }

  const config = await getActiveSiteConfig();
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || config.spotifyClientId;
  if (!clientId) {
    return NextResponse.json(
      { error: "Add your Spotify client id in the settings menu first." },
      { status: 503 }
    );
  }

  const verifier = createVerifier();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: `${requestOrigin(request)}/api/owner/spotify/callback`,
    scope: OWNER_SCOPES,
    code_challenge_method: "S256",
    code_challenge: challengeFor(verifier),
    // Always show the consent screen, so the owner can see which account
    // they are about to connect rather than silently reusing a session.
    show_dialog: "true",
  });

  const response = NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`);
  response.headers.append("Set-Cookie", ownerVerifierCookie(verifier));
  return response;
}
