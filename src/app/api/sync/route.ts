import { NextRequest, NextResponse } from "next/server";
import { syncSpotify } from "@/lib/spotify-sync";
import { clearServerCache } from "@/lib/db/server-cache";
import { isDbConfigured } from "@/lib/db";
import { isOwnerSpotifyConfigured } from "@/lib/spotify";
import { isAuthorizedAdminRequest } from "@/lib/auth-utils";
import { getCronKey } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Up to 60s execution allowance for serverless

import crypto from "crypto";

function safeCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

let isSyncInProgress = false;

async function isAuthorized(request: NextRequest): Promise<boolean> {
  // 1. Browser-initiated requests from UI require admin authorization session
  if (isAuthorizedAdminRequest(request)) {
    return true;
  }

  // 2. Machine-to-machine calls via Bearer token or ?key= / ?secret= query param
  let token: string | null = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  }
  if (!token) {
    const url = new URL(request.url);
    const param = url.searchParams.get("key") || url.searchParams.get("secret");
    if (param) token = param.trim();
  }

  if (!token) {
    return false;
  }

  // Check against database cron_key
  const cronKey = await getCronKey();
  if (cronKey && safeCompare(token, cronKey)) {
    return true;
  }

  // Backward-compatibility fallback: check against process.env.CRON_SECRET if defined
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && safeCompare(token, cronSecret)) {
    return true;
  }

  return false;
}

async function handleSync(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json(
      { error: "Unauthorized. Provide valid Bearer token or ?key= query parameter." },
      { status: 401 }
    );
  }

  // Gracefully handle unconfigured credentials/database when deployed in demo mode
  // Spotify may be connected from the settings menu or admin prompt.
  if (!isDbConfigured() || !(await isOwnerSpotifyConfigured())) {
    return NextResponse.json(
      {
        success: false,
        message: "Sync not executed: the database or Spotify is not connected yet. Connect your database, then connect Spotify from the settings menu or admin prompt.",
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
