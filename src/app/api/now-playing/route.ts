import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/spotify";

export const dynamic = "force-dynamic";

/**
 * What the owner is playing right now.
 *
 * The rest of the dashboard reads plays the cron job has already synced,
 * which can be half an hour behind. This asks Spotify directly, so the page
 * can show the actual current track and pause state.
 *
 * Cached for a few seconds so that every open tab polling at once still
 * costs Spotify a single request.
 */

export interface NowPlaying {
  configured: boolean;
  isPlaying: boolean;
  track: {
    id: string | null;
    name: string;
    artists: string;
    album: string;
    albumImageUrl: string | null;
    url: string | null;
    durationMs: number;
  } | null;
  progressMs: number;
  /** Server time the snapshot was taken, so clients can interpolate. */
  fetchedAt: number;
}

const CACHE_MS = 4000;
let cache: { at: number; value: NowPlaying } | null = null;
let inFlight: Promise<NowPlaying> | null = null;

const EMPTY = (configured: boolean): NowPlaying => ({
  configured,
  isPlaying: false,
  track: null,
  progressMs: 0,
  fetchedAt: Date.now(),
});

async function fetchNowPlaying(): Promise<NowPlaying> {
  let token: string;
  try {
    token = await getAccessToken();
  } catch {
    // No credentials in this environment: report that rather than erroring,
    // so the page can simply hide the panel.
    return EMPTY(false);
  }

  const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  // 204 means nothing is playing on any device.
  if (res.status === 204) return EMPTY(true);
  if (!res.ok) throw new Error(`Spotify responded ${res.status}`);

  const data = await res.json();
  const item = data?.item;
  // Podcasts and ads arrive with a different shape (or none); treat them as
  // nothing we can describe rather than guessing at fields.
  if (!item || data.currently_playing_type !== "track") return EMPTY(true);

  return {
    configured: true,
    isPlaying: Boolean(data.is_playing),
    track: {
      id: item.id ?? null,
      name: item.name,
      artists: (item.artists ?? []).map((a: { name: string }) => a.name).join(", "),
      album: item.album?.name ?? "",
      albumImageUrl: item.album?.images?.[0]?.url ?? null,
      url: item.external_urls?.spotify ?? null,
      durationMs: item.duration_ms ?? 0,
    },
    progressMs: data.progress_ms ?? 0,
    fetchedAt: Date.now(),
  };
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    return NextResponse.json(cache.value);
  }
  if (!inFlight) {
    inFlight = fetchNowPlaying().finally(() => {
      inFlight = null;
    });
  }
  try {
    const value = await inFlight;
    cache = { at: Date.now(), value };
    return NextResponse.json(value);
  } catch {
    return NextResponse.json({ error: "Could not reach Spotify." }, { status: 502 });
  }
}
