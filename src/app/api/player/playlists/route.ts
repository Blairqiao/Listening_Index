import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/auth-utils";
import { getOwnerPlaybackToken, getActiveSiteConfig } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

interface SpotifyPlaylistResponseItem {
  id: string;
  name: string;
  uri: string;
  tracks?: {
    total?: number;
  };
  items?: {
    total?: number;
  };
  images?: Array<{ url: string }>;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json(
      { error: "Admin authentication required" },
      { status: 401 }
    );
  }

  const token = await getOwnerPlaybackToken();
  if (!token) {
    return NextResponse.json({ playlists: [] });
  }

  const config = await getActiveSiteConfig();
  const clientId =
    process.env.SPOTIFY_CLIENT_ID ||
    process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ||
    config.spotifyClientId;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId) {
    return NextResponse.json({ playlists: [] });
  }

  try {
    // Refresh access token using owner refresh token
    const tokenParams = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token,
    });
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (clientSecret) {
      headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
    } else {
      tokenParams.set("client_id", clientId);
    }

    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers,
      body: tokenParams.toString(),
    });

    if (!tokenRes.ok) {
      return NextResponse.json({ playlists: [] });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const playlistsRes = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!playlistsRes.ok) {
      return NextResponse.json({ playlists: [] });
    }

    const data = await playlistsRes.json();
    const items: SpotifyPlaylistResponseItem[] = data.items || [];

    const playlists = items.map((item) => ({
      id: item.id,
      name: item.name,
      uri: item.uri,
      trackCount: item.items?.total ?? item.tracks?.total ?? 0,
      imageUrl: item.images?.[0]?.url || undefined,
    }));

    return NextResponse.json({ playlists });
  } catch (error) {
    console.warn("[PLAYER PLAYLISTS] Failed to fetch playlists:", error);
    return NextResponse.json({ playlists: [] });
  }
}
