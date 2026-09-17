import { NextRequest, NextResponse } from "next/server";
import { isConfigured, isDbConfigured } from "@/lib/db";
import {
  bulkUpsertTracks,
  bulkInsertPlays,
  TrackUpsertItem,
} from "@/lib/db/queries";
import { CompactPlayEvent } from "@/lib/history-parser";
import { clearServerCache } from "@/lib/db/server-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // 1. Enforce Preconditions (Only requires DB)
    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: "Database not configured. Ensure DATABASE_URL is set in environment." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as { plays?: CompactPlayEvent[] };
    const plays = body.plays;

    if (!Array.isArray(plays) || plays.length === 0) {
      return NextResponse.json({ success: true, processed: 0, newPlays: 0 });
    }

    // 2. Aggregate unique tracks in-memory
    const trackMap = new Map<string, TrackUpsertItem>();

    for (const p of plays) {
      const existingTrack = trackMap.get(p.trackId);
      if (!existingTrack) {
        trackMap.set(p.trackId, {
          id: p.trackId,
          name: p.trackName,
          artistName: p.artistName,
          albumName: p.albumName,
          artistGroupKey: p.artistGroupKey,
          albumGroupKey: p.albumGroupKey,
          durationMs: p.msPlayed,
          enrichmentStatus: "pending",
        });
      } else {
        existingTrack.durationMs = Math.max(existingTrack.durationMs, p.msPlayed);
      }
    }

    // 3. Direct Ingestion (Tracks -> Plays)
    await bulkUpsertTracks(Array.from(trackMap.values()));

    const { insertedCount } = await bulkInsertPlays(
      plays.map((p) => ({
        playedAt: p.playedAt,
        trackId: p.trackId,
        msPlayed: p.msPlayed,
      }))
    );

    // Purge server cache so subsequent queries across overview, session, and stream-log fetch fresh data
    clearServerCache();

    return NextResponse.json({
      success: true,
      processed: plays.length,
      newPlays: insertedCount,
    });
  } catch (error: unknown) {
    console.error("[API ERROR · /api/upload/history]", error);
    const message = error instanceof Error ? error.message : "History ingestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
