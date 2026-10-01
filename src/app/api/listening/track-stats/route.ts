import { NextResponse } from "next/server";
import { getTrackTelemetryStats } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const trackId = searchParams.get("trackId") || undefined;
    const title = searchParams.get("title") || undefined;
    const artist = searchParams.get("artist") || undefined;

    const stats = await getTrackTelemetryStats({ trackId, title, artist });

    return NextResponse.json(stats, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    });
  } catch (error: unknown) {
    console.error("[API ERROR · /api/listening/track-stats]", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
