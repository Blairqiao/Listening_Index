import type { OverviewData, StreamLogData, SessionData } from "@/lib/db/queries/types";
import type { RangeKey, SittingItem } from "@/lib/types";

export interface EnrichmentPatchData {
  albumImageUrl?: string | null;
  artistId?: string;
  albumId?: string;
  isDelisted?: boolean;
}

/**
 * Patches client-side Overview cache across all loaded ranges with newly resolved enrichment metadata.
 * Retains unchanged references to prevent unnecessary component re-renders.
 */
export function patchOverviewCacheWithEnrichment(
  cache: Partial<Record<RangeKey, OverviewData>>,
  enrichedMap: Map<string, EnrichmentPatchData>,
  delistedSet?: Set<string>
): { updatedCache: Partial<Record<RangeKey, OverviewData>>; changed: boolean } {
  if (enrichedMap.size === 0 && (!delistedSet || delistedSet.size === 0)) {
    return { updatedCache: cache, changed: false };
  }

  let cacheChanged = false;
  const nextCache: Partial<Record<RangeKey, OverviewData>> = {};

  for (const [key, data] of Object.entries(cache) as [RangeKey, OverviewData][]) {
    if (!data || !data.topTracks) {
      nextCache[key] = data;
      continue;
    }

    let tracksChanged = false;
    const nextTracks = data.topTracks.map((track) => {
      const match =
        enrichedMap.get(track.id) ||
        (track.spotifyTrackId ? enrichedMap.get(track.spotifyTrackId) : undefined);
      const isDelisted =
        Boolean(delistedSet?.has(track.id)) ||
        Boolean(track.spotifyTrackId && delistedSet?.has(track.spotifyTrackId));

      if (match || isDelisted) {
        tracksChanged = true;
        return {
          ...track,
          albumImageUrl: match ? (match.albumImageUrl ?? track.albumImageUrl) : track.albumImageUrl,
          artistId: match ? (match.artistId ?? track.artistId) : track.artistId,
          albumId: match ? (match.albumId ?? track.albumId) : track.albumId,
        };
      }
      return track;
    });

    if (tracksChanged) {
      cacheChanged = true;
      nextCache[key] = {
        ...data,
        topTracks: nextTracks,
      };
    } else {
      nextCache[key] = data;
    }
  }

  return {
    updatedCache: cacheChanged ? nextCache : cache,
    changed: cacheChanged,
  };
}

/**
 * Patches client-side StreamLog state entries with newly resolved enrichment metadata and delisted status.
 */
export function patchStreamLogWithEnrichment(
  streamLog: StreamLogData | null,
  enrichedMap: Map<string, EnrichmentPatchData>,
  delistedSet?: Set<string>
): StreamLogData | null {
  if (!streamLog || !streamLog.entries) return streamLog;
  if (enrichedMap.size === 0 && (!delistedSet || delistedSet.size === 0)) return streamLog;

  let entriesChanged = false;
  const nextEntries = streamLog.entries.map((entry) => {
    const trackId = entry.trackId || entry.id;
    const match = enrichedMap.get(trackId);
    const isDelisted = Boolean(delistedSet?.has(trackId));

    if (match || isDelisted) {
      entriesChanged = true;
      return {
        ...entry,
        albumImageUrl: match ? (match.albumImageUrl ?? entry.albumImageUrl) : entry.albumImageUrl,
        artistId: match ? (match.artistId ?? entry.artistId) : entry.artistId,
        albumId: match ? (match.albumId ?? entry.albumId) : entry.albumId,
        status: isDelisted ? "[DELISTED]" : entry.status,
      };
    }
    return entry;
  });

  if (!entriesChanged) return streamLog;
  return {
    ...streamLog,
    entries: nextEntries,
  };
}

/**
 * Patches client-side Session state tracks and session lists with newly resolved enrichment metadata.
 */
export function patchSessionWithEnrichment(
  session: SessionData | null,
  enrichedMap: Map<string, EnrichmentPatchData>,
  delistedSet?: Set<string>
): SessionData | null {
  if (!session) return session;
  if (enrichedMap.size === 0 && (!delistedSet || delistedSet.size === 0)) return session;

  let sessionChanged = false;

  const patchTrack = (track: SittingItem): SittingItem => {
    const trackId = track.trackId || track.id;
    const match = enrichedMap.get(trackId);
    const isDelisted = Boolean(delistedSet?.has(trackId));

    if (match || isDelisted) {
      sessionChanged = true;
      return {
        ...track,
        albumImageUrl: match ? (match.albumImageUrl ?? track.albumImageUrl) : track.albumImageUrl,
        artistId: match ? (match.artistId ?? track.artistId) : track.artistId,
        albumId: match ? (match.albumId ?? track.albumId) : track.albumId,
        status: isDelisted ? "[DELISTED]" : track.status,
      };
    }
    return track;
  };

  const nextSittingTracks = session.sittingTracks?.map(patchTrack) ?? [];
  const nextSittings = session.sittings?.map((sitting) => {
    if (!sitting.tracks) return sitting;
    let sittingTracksChanged = false;
    const patchedTracks = sitting.tracks.map((t) => {
      const patched = patchTrack(t);
      if (patched !== t) sittingTracksChanged = true;
      return patched;
    });
    return sittingTracksChanged ? { ...sitting, tracks: patchedTracks } : sitting;
  });

  if (!sessionChanged) return session;

  return {
    ...session,
    sittingTracks: nextSittingTracks,
    sittings: nextSittings,
  };
}
