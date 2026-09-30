import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/auth-utils";
import {
  getOwnerPlaybackToken,
  saveOwnerPlaybackToken,
  deleteOwnerPlaybackToken,
  getActiveSiteConfig,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

async function refreshSpotifyToken(
  refreshToken: string,
  clientId: string,
  clientSecret?: string
): Promise<Response> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", clientId);
  }

  return fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers,
    body: body.toString(),
  });
}

async function exchangeAuthCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret?: string,
  codeVerifier?: string
): Promise<Response> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  if (codeVerifier) {
    body.set("code_verifier", codeVerifier);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", clientId);
  }

  return fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers,
    body: body.toString(),
  });
}

/**
 * GET /api/player/token
 * Returns active Spotify access token for Web Playback SDK if owner playback token is linked.
 * Admin-only.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getOwnerPlaybackToken();
  if (!token) {
    return NextResponse.json({ linked: false });
  }

  const config = await getActiveSiteConfig();
  const clientId =
    process.env.SPOTIFY_CLIENT_ID ||
    process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ||
    config.spotifyClientId;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId) {
    return NextResponse.json(
      { error: "Spotify client ID not configured" },
      { status: 500 }
    );
  }

  const response = await refreshSpotifyToken(token, clientId, clientSecret);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: errorData.error_description || "Failed to refresh Spotify token" },
      { status: response.status >= 400 && response.status < 500 ? response.status : 502 }
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  if (data.refresh_token && data.refresh_token !== token) {
    await saveOwnerPlaybackToken(data.refresh_token);
  }

  return NextResponse.json({
    linked: true,
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  });
}

/**
 * POST /api/player/token
 * Links owner playback token via authorization code exchange or direct refresh token,
 * then returns the first active access token.
 * Admin-only.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { code, redirectUri, refreshToken } = body;
  const codeVerifier = body.codeVerifier || body.code_verifier;

  const config = await getActiveSiteConfig();
  const clientId =
    process.env.SPOTIFY_CLIENT_ID ||
    process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ||
    config.spotifyClientId;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId) {
    return NextResponse.json(
      { error: "Spotify client ID not configured" },
      { status: 500 }
    );
  }

  if (refreshToken) {
    const response = await refreshSpotifyToken(refreshToken, clientId, clientSecret);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error_description || "Failed to refresh Spotify token" },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 }
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    // Persist only after Spotify successfully validates the token
    const tokenToSave = data.refresh_token || refreshToken;
    await saveOwnerPlaybackToken(tokenToSave);

    return NextResponse.json({
      linked: true,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    });
  }

  if (code && redirectUri) {
    const response = await exchangeAuthCode(
      code,
      redirectUri,
      clientId,
      clientSecret,
      codeVerifier
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error_description || "Failed to exchange authorization code" },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 }
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    if (!data.refresh_token) {
      return NextResponse.json(
        { error: "Spotify response did not include a refresh token" },
        { status: 400 }
      );
    }

    await saveOwnerPlaybackToken(data.refresh_token);

    return NextResponse.json({
      linked: true,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    });
  }

  return NextResponse.json(
    { error: "Missing required parameters: code and redirectUri, or refreshToken" },
    { status: 400 }
  );
}

/**
 * DELETE /api/player/token
 * Clears owner playback token from Neon DB site_settings.
 * Admin-only.
 */
export async function DELETE(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteOwnerPlaybackToken();
  return NextResponse.json({ success: true });
}
