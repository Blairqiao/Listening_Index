import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { isDbConfigured } from "@/lib/db";
import { runEnrichmentBatch } from "@/lib/enrichment";
import { isOwnerSpotifyConfigured } from "@/lib/spotify";
import { isSameOriginRequest } from "@/lib/admin-auth";
import { getEnrichmentProgress } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {

  try {
    // 1. Enforce Preconditions
    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: "Database not configured. Ensure DATABASE_URL is set in environment." },
        { status: 500 }
      );
    }

    let trackIds: string[] | undefined = undefined;
    let source: "cron" | "dynamic" | undefined = undefined;

    try {
      const body = (await request.json()) as { trackIds?: string[]; source?: "cron" | "dynamic" };
      if (body?.source === "cron" || body?.source === "dynamic") {
        source = body.source;
      }
      if (body?.trackIds !== undefined) {
        if (
          !Array.isArray(body.trackIds) ||
          body.trackIds.length === 0 ||
          body.trackIds.length > 10 ||
          !body.trackIds.every(
            (id: unknown) => typeof id === "string" && /^[A-Za-z0-9]{22}$/.test(id)
          )
        ) {
          return NextResponse.json(
            { error: "Invalid trackIds: must be an array of up to 10 22-character Spotify track IDs." },
            { status: 400 }
          );
        }
        trackIds = body.trackIds;
      }
    } catch {
      // Use default parameters if no body
    }

    const bucket = source || (trackIds ? "dynamic" : "cron");
    if (bucket === "dynamic") {
      if (!isSameOriginRequest(request)) {
        return NextResponse.json(
          { error: "Forbidden: cross-origin requests are not permitted." },
          { status: 403 }
        );
      }
      if (!trackIds?.length) {
        return NextResponse.json({ error: "Dynamic enrichment requires Track IDs." }, { status: 400 });
      }
    }
    if (bucket === "cron" && !(await isAuthorizedCronRequest(request))) {
      return NextResponse.json({ error: "Unauthorized. Provide the current cron key." }, { status: 401 });
    }

    if (!(await isOwnerSpotifyConfigured())) {
      return NextResponse.json(
        {
          error:
            "Spotify API credentials not configured. Connect your Spotify account from the settings menu before enriching.",
        },
        { status: 400 }
      );
    }

    // 2. Delegate to unified Stage 2 engine
    const result = await runEnrichmentBatch({
      trackIds,
      bucket,
    });

    return NextResponse.json({
      success: true,
      remaining: result.progress.pending,
      ...result,
    });
  } catch (error: unknown) {
    console.error("[API ERROR · /api/upload/enrich]", error);
    return NextResponse.json({ error: "Metadata enrichment failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: "Database not configured. Ensure DATABASE_URL is set in environment." },
        { status: 500 }
      );
    }
    const progress = await getEnrichmentProgress();
    return NextResponse.json({
      success: true,
      progress,
    });
  } catch (error: unknown) {
    console.error("[API ERROR · GET /api/upload/enrich]", error);
    return NextResponse.json({ error: "Failed to fetch enrichment progress" }, { status: 500 });
  }
}

