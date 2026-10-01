import { NextRequest, NextResponse } from "next/server";
import { syncSpotify } from "../../../../scripts/sync-spotify";
import { clearServerCache } from "@/lib/db/server-cache";
import { isDbConfigured } from "@/lib/db";
import { isOwnerSpotifyConfigured } from "@/lib/spotify";
import { isAuthorizedAdminRequest } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Up to 60s execution allowance for serverless

let isSyncInProgress = false;

function isAuthorized(request: NextRequest): boolean {
  // 1. External machine-to-machine calls via CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  const url = new URL(request.url);
  const keyParam = url.searchParams.get("key") || url.searchParams.get("secret");
  if (cronSecret && keyParam === cronSecret) {
    return true;
  }

  // 2. Browser-initiated requests from UI require admin authorization session
  if (isAuthorizedAdminRequest(request)) {
    return true;
  }

  return false;
}

async function handleSync(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized. Provide valid Bearer token or ?key= query parameter." },
      { status: 401 }
    );
  }

  // Gracefully handle unconfigured credentials/database when deployed in demo mode
  // Spotify may be connected by env var or from the settings menu.
  if (!isDbConfigured() || !(await isOwnerSpotifyConfigured())) {
    return NextResponse.json(
      {
        success: false,
        message: "Sync not executed: the database or Spotify is not connected yet. Connect your database, then connect Spotify from the settings menu (or set SPOTIFY_REFRESH_TOKEN).",
      },
      { status: 200 }
    );
  }

  if (isSyncInProgress) {
    return NextResponse.json(
      { error: "Sync operation already in progress" },
      { status: 429 }
    );
  }

  isSyncInProgress = true;
  try {
    const result = await syncSpotify();

    // Purge server cache so subsequent queries across all endpoints fetch fresh data
    clearServerCache();

    return NextResponse.json(
      {
        success: true,
        processed: result.processed,
        durationMs: result.durationMs,
        syncedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: unknown) {
    console.error("[API ERROR · /api/sync]", error);
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    isSyncInProgress = false;
  }
}

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}
