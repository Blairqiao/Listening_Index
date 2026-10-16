import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdminRequest } from "@/lib/auth-utils";
import { getDb, isDbConfigured } from "@/lib/db";
import { CATALOG } from "@/lib/mock-listening-data";

export const dynamic = "force-dynamic";

interface AutoQueueTrack {
  id: string;
  name: string;
  artist: string;
  uri: string;
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json(
      { error: "Admin authentication required" },
      { status: 401 }
    );
  }

  let tracks: AutoQueueTrack[] = [];

  if (isDbConfigured()) {
    try {
      const sql = getDb();
      // Look at the past month of listening data, select from top 100 most played tracks
      const rows = (await sql`
        SELECT t.id, t.name, COALESCE(t.artist_name, a.name, 'Unknown Artist') as artist_name
        FROM plays p
        JOIN tracks t ON p.track_id = t.id
        LEFT JOIN artists a ON t.artist_id = a.id
        WHERE p.played_at >= NOW() - INTERVAL '30 days'
          AND t.id NOT LIKE 'synthetic:%'
        GROUP BY t.id, t.name, t.artist_name, a.name
        ORDER BY COUNT(*) DESC
        LIMIT 100;
      `) as Array<{ id: string; name: string; artist_name: string }>;

      if (rows && rows.length > 0) {
        tracks = rows.map((r) => ({
          id: r.id,
          name: r.name,
          artist: r.artist_name,
          uri: `spotify:track:${r.id}`,
        }));
      }
    } catch (error) {
      console.warn("[AUTO-QUEUE] Database query failed, using fallback catalog:", error);
    }
  }

  // Fallback to verified English catalog if database has fewer than 1 recent track
  if (tracks.length === 0) {
    tracks = Object.values(CATALOG).map((item) => ({
      id: item.id,
      name: item.name,
      artist: item.artist,
      uri: `spotify:track:${item.id}`,
    }));
  }

  const shuffled = shuffleArray(tracks);
  const uris = shuffled.map((t) => t.uri);

  return NextResponse.json({
    uris,
    tracks: shuffled,
  });
}
