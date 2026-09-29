import { NextRequest, NextResponse } from "next/server";
import { configRepository } from "@/lib/db/repositories";
import { userRepository } from "@/lib/db/repositories";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  decryptToken,
  encryptToken,
  isGuestAuthConfigured,
  readGuestSession,
} from "@/lib/user-auth";

export const dynamic = "force-dynamic";

/** Who is signed in, and is the browser flow even available. */
export async function GET(request: NextRequest) {
  const available = isGuestAuthConfigured();
  const userId = readGuestSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) {
    return NextResponse.json({ available, signedIn: false, displayName: null });
  }
  const user = await userRepository().getUser(userId);
  if (!user) {
    // Session outlived the stored credential (signed out elsewhere, or the
    // record was removed). Clear the cookie so the UI stops claiming otherwise.
    const res = NextResponse.json({ available, signedIn: false, displayName: null });
    res.headers.append("Set-Cookie", clearSessionCookie());
    return res;
  }
  return NextResponse.json({
    available,
    signedIn: true,
    displayName: user.displayName,
  });
}

/**
 * Signing out discards the stored refresh token as well as the cookie, so
 * this app stops holding a credential for someone who has left.
 */
export async function DELETE(request: NextRequest) {
  const userId = readGuestSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (userId) {
    try {
      await userRepository().deleteUser(userId);
    } catch {
      // Clearing the cookie still matters even if the delete failed.
    }
  }
  const res = NextResponse.json({ signedIn: false });
  res.headers.append("Set-Cookie", clearSessionCookie());
  return res;
}

/**
 * Mints a short-lived access token for the Web Playback SDK.
 *
 * This is the whole point of moving custody server-side: the browser asks
 * for a token when it needs one and receives something that expires within
 * the hour, while the refresh token that could mint tokens forever stays
 * encrypted on this side.
 */
export async function POST(request: NextRequest) {
  const userId = readGuestSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const user = await userRepository().getUser(userId);
  if (!user) return NextResponse.json({ error: "Session no longer valid." }, { status: 401 });

  const refreshToken = decryptToken(user.encryptedRefreshToken);
  if (!refreshToken) {
    return NextResponse.json({ error: "Stored credential unreadable." }, { status: 500 });
  }

  const config = await configRepository().getActiveSiteConfig();
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || config.spotifyClientId;
  if (!clientId) return NextResponse.json({ error: "No client id." }, { status: 503 });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    // Only invalid_grant means the guest revoked access (or the token expired
    // for good). Other 400s, such as invalid_client after the owner changes
    // the client id, are configuration problems: deleting every guest's
    // credential over one would log them all out for nothing.
    if (json.error === "invalid_grant") {
      await userRepository().deleteUser(userId).catch(() => {});
      const gone = NextResponse.json(
        { error: "Spotify access was revoked. Sign in again." },
        { status: 401 }
      );
      gone.headers.append("Set-Cookie", clearSessionCookie());
      return gone;
    }
    return NextResponse.json({ error: "Could not refresh token." }, { status: 502 });
  }

  // PKCE refreshes can rotate the refresh token. Keep the new one, or the
  // next refresh presents a token Spotify has retired.
  if (json.refresh_token && json.refresh_token !== refreshToken) {
    await userRepository()
      .upsertUser({
        id: user.id,
        displayName: user.displayName,
        encryptedRefreshToken: encryptToken(json.refresh_token),
      })
      .catch(() => {});
  }

  return NextResponse.json({
    accessToken: json.access_token,
    expiresIn: json.expires_in ?? 3600,
  });
}
