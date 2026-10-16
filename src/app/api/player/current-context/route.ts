import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/auth-utils";
import { isDbConfigured } from "@/lib/db";
import { getStreamLog } from "@/lib/db/queries/stream-log";
import { DEFAULT_FALLBACK_TRACK } from "@/components/LivePlayerView";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json(
      { error: "Admin authentication required" },
      { status: 401 }
    );
  }

  let latestTrack = {
    id: "4clD00s1c0rVqP9Ld0vV48",
    trackId: "4clD00s1c0rVqP9Ld0vV48",
    name: DEFAULT_FALLBACK_TRACK.name,
    artist: DEFAULT_FALLBACK_TRACK.artist,
    album: DEFAULT_FALLBACK_TRACK.album,
    imageUrl: DEFAULT_FALLBACK_TRACK.imageUrl,
    durationMs: DEFAULT_FALLBACK_TRACK.durationMs,
  };

  if (isDbConfigured()) {
    try {
      const streamLog = await getStreamLog(1);
      if (streamLog.entries && streamLog.entries.length > 0) {
        const entry = streamLog.entries[0];
        latestTrack = {
          id: entry.trackId || entry.id,
          trackId: entry.trackId || entry.id,
          name: entry.title,
          artist: entry.artist,
          album: entry.album,
          imageUrl: entry.albumImageUrl || DEFAULT_FALLBACK_TRACK.imageUrl,
          durationMs: entry.durationMs || DEFAULT_FALLBACK_TRACK.durationMs,
        };
      }
    } catch (error) {
      console.warn("[CURRENT-CONTEXT] Failed to read stream log, using fallback:", error);
    }
  }

  return NextResponse.json({
    isPlaying: false,
    track: latestTrack,
    context: {
      type: "auto",
      name: "Recent Favorites",
    },
  });
}
