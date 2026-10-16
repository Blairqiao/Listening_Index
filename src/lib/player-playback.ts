export interface PlaybackContextSelection {
  type: "auto" | "playlist" | "album" | "artist";
  id?: string;
  uri?: string;
  name: string;
  trackCount?: number;
}

export interface ResolvePlayRequestParams {
  trackIdOrUri?: string;
  selectedContext: PlaybackContextSelection;
  fallbackTrackUri?: string | null;
  fetchAutoQueue?: () => Promise<string[] | null | undefined>;
}

export interface PlayRequestBody {
  uris?: string[];
  context_uri?: string;
}

export async function resolvePlayRequest(
  params: ResolvePlayRequestParams
): Promise<PlayRequestBody | null> {
  // 1. Explicit trackIdOrUri has highest priority
  if (params.trackIdOrUri) {
    const targetUri = params.trackIdOrUri.startsWith("spotify:")
      ? params.trackIdOrUri
      : `spotify:track:${params.trackIdOrUri}`;
    return { uris: [targetUri] };
  }

  // 2. Playlist context
  if (params.selectedContext.type === "playlist" && params.selectedContext.uri) {
    return { context_uri: params.selectedContext.uri };
  }

  // 3. Auto play context
  if (params.selectedContext.type === "auto") {
    if (params.fetchAutoQueue) {
      try {
        const queueUris = await params.fetchAutoQueue();
        if (Array.isArray(queueUris) && queueUris.length > 0) {
          return { uris: queueUris };
        }
      } catch (err) {
        console.warn("[PLAYER] Failed to fetch auto queue:", err);
      }
    }
  }

  // 4. Fallback track
  if (params.fallbackTrackUri) {
    const targetUri = params.fallbackTrackUri.startsWith("spotify:")
      ? params.fallbackTrackUri
      : `spotify:track:${params.fallbackTrackUri}`;
    return { uris: [targetUri] };
  }

  return null;
}

export interface ShouldToggleInPlaceParams {
  isContextArmed: boolean;
  hasPlayer: boolean;
  hasLoadedTrack: boolean;
  trackIdOrUri?: string;
}

export function shouldToggleInPlace(params: ShouldToggleInPlaceParams): boolean {
  return (
    !params.isContextArmed &&
    params.hasPlayer &&
    params.hasLoadedTrack &&
    !params.trackIdOrUri
  );
}
