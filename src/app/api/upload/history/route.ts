import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isAuthorizedAdminRequest, isSameOriginRequest } from "@/lib/admin-auth";
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
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Admin authorization required to import streaming history." },
      { status: 401 }
    );
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Cross-origin request not permitted." },
      { status: 403 }
    );
  }

  try {
    // 1. Enforce Preconditions (Only requires DB)
    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: "Database not configured. Ensure DATABASE_URL is set in environment." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as { plays?: CompactPlayEvent[] };
    const plays = body?.plays;

    if (!Array.isArray(plays) || plays.length === 0) {
      return NextResponse.json({ success: true, processed: 0, newPlays: 0, skipped: 0 });
    }

    if (plays.length > 5000) {
      return NextResponse.json(
        { error: "Batch size exceeds maximum limit of 5000 items." },
        { status: 413 }
      );
    }

    let skipped = 0;
    const validPlays: CompactPlayEvent[] = [];

    for (const p of plays) {
      if (
        !p ||
        typeof p.playedAt !== "string" ||
        isNaN(Date.parse(p.playedAt)) ||
        typeof p.trackId !== "string" ||
        p.trackId.trim() === "" ||
        typeof p.trackName !== "string" ||
        typeof p.artistName !== "string" ||
        typeof p.albumName !== "string" ||
        typeof p.msPlayed !== "number" ||
        !Number.isFinite(p.msPlayed) ||
        p.msPlayed < 0
      ) {
        skipped++;
        continue;
      }
      validPlays.push(p);
    }

    if (validPlays.length === 0) {
      return NextResponse.json({ success: true, processed: 0, newPlays: 0, skipped });
    }

    // 2. Aggregate unique tracks in-memory
    const trackMap = new Map<string, TrackUpsertItem>();

    for (const p of validPlays) {
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
      validPlays.map((p) => ({
        playedAt: p.playedAt,
        trackId: p.trackId,
        msPlayed: p.msPlayed,
      }))
    );

    // Purge server cache so subsequent queries across overview, session, and stream-log fetch fresh data
    clearServerCache();

    return NextResponse.json({
      success: true,
      processed: validPlays.length,
      newPlays: insertedCount,
      skipped,
    });
  } catch (error: unknown) {
    console.error("[API ERROR · /api/upload/history]", error);
    return NextResponse.json({ error: "History ingestion failed" }, { status: 500 });
  }
}
