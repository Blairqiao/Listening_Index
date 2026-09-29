import { NextRequest, NextResponse } from "next/server";
import { requestOrigin } from "@/lib/request-origin";
import { isConfigured } from "@/lib/db";
import { isAuthorizedAdminRequest, isSameOriginRequest } from "@/lib/auth-utils";
import { canStoreOwnerCredential, clearOwnerCredential, getOwnerCredential } from "@/lib/owner-spotify";
import { resetSpotifyTokenCache } from "@/lib/spotify";

export const dynamic = "force-dynamic";

/**
 * Connection status for the settings menu. Admin-only: which account the
 * dashboard reads is the owner's business, not a visitor's.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }

  // Environment variables take precedence over a menu connection, so say
  // which one is actually in use; otherwise "connected" could describe a
  // credential the dashboard is ignoring.
  const viaEnv =
    isConfigured(process.env.SPOTIFY_CLIENT_ID) && isConfigured(process.env.SPOTIFY_REFRESH_TOKEN);
  const stored = await getOwnerCredential();

  return NextResponse.json({
    connected: viaEnv || Boolean(stored),
    source: viaEnv ? "environment" : stored ? "menu" : null,
    displayName: stored?.displayName ?? null,
    canConnect: canStoreOwnerCredential(),
    redirectUri: `${requestOrigin(request)}/api/owner/spotify/callback`,
  });
}

/** Disconnects: deletes the stored credential, not merely hides it. */
export async function DELETE(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request not permitted." }, { status: 403 });
  }
  await clearOwnerCredential();
  resetSpotifyTokenCache();
  return NextResponse.json({ connected: false });
}
