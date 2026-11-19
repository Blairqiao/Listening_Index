import { NextResponse } from "next/server";
import { getTrackTelemetryStats } from "@/lib/db/queries";
import { isSpotifyTrackId } from "@/lib/history-parser";

export const dynamic = "force-dynamic";

const MAX_NAME_LENGTH = 200;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const trackId = searchParams.get("trackId") || undefined;
    const title = searchParams.get("title") || undefined;
    const artist = searchParams.get("artist") || undefined;

    // These values feed several aggregate queries, so bound them first.
    if (
      (trackId !== undefined && !isSpotifyTrackId(trackId)) ||
      (title !== undefined && title.length > MAX_NAME_LENGTH) ||
      (artist !== undefined && artist.length > MAX_NAME_LENGTH)
    ) {
      return NextResponse.json({ error: "Invalid track stats parameters" }, { status: 400 });
    }

    const stats = await getTrackTelemetryStats({ trackId, title, artist });

    return NextResponse.json(stats, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    });
  } catch (error: unknown) {
    console.error("[API ERROR · /api/listening/track-stats]", error);
    return NextResponse.json({ error: "Failed to load track telemetry stats" }, { status: 500 });
  }
}
