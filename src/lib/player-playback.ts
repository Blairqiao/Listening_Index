export interface PlaybackContextSelection {
  type: "auto" | "playlist";
  name: string;
  uri?: string;
  id?: string;
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
  isPlaying?: boolean;
  trackIdOrUri?: string;
}

export function shouldToggleInPlace(params: ShouldToggleInPlaceParams): boolean {
  // 1. Actively streaming audio always toggles in place (pauses) on the loaded track
  if (params.isPlaying && params.hasPlayer && !params.trackIdOrUri) {
    return true;
  }

  // 2. Idle player resumes in place only if context has not been armed with a new source
  return (
    !params.isContextArmed &&
    params.hasPlayer &&
    params.hasLoadedTrack &&
    !params.trackIdOrUri
  );
}

export function isSameContext(
  current: PlaybackContextSelection,
  incoming: PlaybackContextSelection
): boolean {
  if (current.type !== incoming.type) return false;
  if (current.type === "auto") return true;
  return Boolean(current.uri && incoming.uri && current.uri === incoming.uri);
}
