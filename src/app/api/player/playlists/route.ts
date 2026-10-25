import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/auth-utils";
import { getOwnerPlaybackToken } from "@/lib/db/queries";
import { getAccessToken } from "@/lib/spotify";

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

  try {
    const accessToken = await getAccessToken();

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
