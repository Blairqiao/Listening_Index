import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { getOwnerSpotifyStatus } from "@/lib/db/queries";
import { canStoreOwnerCredential } from "@/lib/owner-spotify";
import { calculateTokenExpiration, getRedirectUri } from "@/lib/spotify-auth";

export const dynamic = "force-dynamic";

/**
 * Connection status for the settings menu and admin Spotify modal.
 * Admin-only: which account the dashboard reads is the owner's business, not a visitor's.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }

  const status = await getOwnerSpotifyStatus();

  const { daysRemaining, isExpiringSoon } = status.updatedAt
    ? calculateTokenExpiration(status.updatedAt)
    : { daysRemaining: null, isExpiringSoon: false };

  return NextResponse.json({
    connected: status.connected,
    source: status.connected ? "database" : null,
    displayName: status.displayName,
    profileUrl: status.profileUrl,
    connectedAt: status.updatedAt,
    daysRemaining,
    isExpiringSoon,
    redirectUri: getRedirectUri(request),
    canConnect: canStoreOwnerCredential(),
  });
}
