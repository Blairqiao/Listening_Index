import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/auth-utils";
import {
  getAccessToken,
  resetSpotifyTokenCache,
  SpotifyApiError,
} from "@/lib/spotify";
import {
  getOwnerPlaybackToken,
  deleteOwnerPlaybackToken,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/player/token
 * Returns active Spotify access token for Web Playback SDK if owner playback token is linked.
 * Utilizes the centralized in-memory tokenCache from src/lib/spotify.ts.
 * Admin-only.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json(
      { error: "Admin authentication required", code: "ADMIN_AUTH_REQUIRED" },
      { status: 401 }
    );
  }

  const token = await getOwnerPlaybackToken();
  if (!token) {
    return NextResponse.json({ linked: false });
  }

  try {
    const accessToken = await getAccessToken();
    return NextResponse.json({
      linked: true,
      accessToken,
      expiresIn: 3600,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to refresh Spotify token";
    const status = err instanceof SpotifyApiError && err.status ? err.status : 502;
    return NextResponse.json(
      { error: message },
      { status: status >= 400 && status < 500 ? status : 502 }
    );
  }
}

/**
 * DELETE /api/player/token
 * Clears owner playback token from Neon DB site_settings.
 * Admin-only.
 */
export async function DELETE(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json(
      { error: "Admin authentication required", code: "ADMIN_AUTH_REQUIRED" },
      { status: 401 }
    );
  }

  await deleteOwnerPlaybackToken();
  resetSpotifyTokenCache();
  return NextResponse.json({ success: true });
}
