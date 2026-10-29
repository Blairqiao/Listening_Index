import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import crypto from "node:crypto";
import { requestOrigin } from "@/lib/request-origin";
import { beginOwnerAuthorization } from "@/lib/db/queries/config";
import { canStoreOwnerCredential } from "@/lib/owner-spotify";
import { challengeFor, createVerifier, playerVerifierCookie, sealOwnerAuthorization } from "@/lib/user-auth";
import { getRedirectUri, TOKEN_SCOPES, AUTH_MESSAGE } from "@/lib/spotify-auth";
import { closePopup as renderPopup } from "@/lib/popup-response";

export const dynamic = "force-dynamic";

/**
 * Starts connecting Spotify for the Web Playback SDK player.
 * Admin-only: Live playback is strictly single-user for the authenticated admin.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }

  const origin = requestOrigin(request, false);
  const wantsHtml = request.headers.get("accept")?.includes("text/html");

  if (!canStoreOwnerCredential()) {
    const errorMsg = "A database is required to connect Spotify.";
    if (wantsHtml) {
      return renderPopup(origin, false, errorMsg, AUTH_MESSAGE, `${origin}/`);
    }
    return NextResponse.json({ error: errorMsg }, { status: 503 });
  }

  const clientId =
    process.env.SPOTIFY_CLIENT_ID ||
    process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;

  if (!clientId) {
    const errorMsg = "Configure SPOTIFY_CLIENT_ID in your environment variables first.";
    if (wantsHtml) {
      return renderPopup(origin, false, errorMsg, AUTH_MESSAGE, `${origin}/`);
    }
    return NextResponse.json({ error: errorMsg }, { status: 503 });
  }

  try {
    const verifier = createVerifier();
    const nonce = crypto.randomBytes(32).toString("hex");
    const revision = await beginOwnerAuthorization(nonce);
    const redirectUri = getRedirectUri(request);
    const state = sealOwnerAuthorization({
      verifier, nonce, revision, redirectUri,
      returnOrigin: origin,
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
  } catch (error: unknown) {
    console.error("[PLAYER LOGIN ERROR]", error);
    const errorMsg = error instanceof Error ? error.message : "Failed to initiate Spotify authorization.";
    if (wantsHtml) {
      return renderPopup(origin, false, errorMsg, AUTH_MESSAGE, `${origin}/`);
    }
    return NextResponse.json({ error: errorMsg }, { status: 503 });
  }
}
