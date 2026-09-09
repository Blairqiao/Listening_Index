import { NextRequest, NextResponse } from "next/server";
import { syncSpotify } from "../../../../scripts/sync-spotify";
import { clearServerCache } from "@/lib/db/server-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Up to 60s execution allowance for serverless

let isSyncInProgress = false;

function isAuthorized(request: NextRequest): boolean {
  // 1. Allow same-origin requests from our own application UI
  const secFetchSite = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host") || request.nextUrl.host;

  const isSameOrigin =
    secFetchSite === "same-origin" ||
    (origin && host && origin.includes(host)) ||
    (referer && host && referer.includes(host));

  if (isSameOrigin && request.method === "POST") {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET;

  // In local development, bypass check if CRON_SECRET is not yet configured
  if (!cronSecret) {
    if (process.env.NODE_ENV === "development") {
      return true;
    }
    console.error("[AUTH ERROR · /api/sync] CRON_SECRET environment variable is missing on server.");
    return false;
  }

  // 2. Check Bearer token (Standard for cron-job.org / external webcrons)
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // 3. Check query parameter fallback (?key=... or ?secret=...)
  const url = new URL(request.url);
  const keyParam = url.searchParams.get("key") || url.searchParams.get("secret");
  if (keyParam === cronSecret) {
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
