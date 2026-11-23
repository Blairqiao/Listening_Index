import type { ProfileTarget } from "@/lib/search-types";

export interface PlayerArtistLink {
  name: string;
  target: ProfileTarget | null;
}

export interface PlayerProfileLinks {
  track: ProfileTarget | null;
  artists: PlayerArtistLink[];
  album: ProfileTarget | null;
}

interface PlayerTrackLike {
  id?: string | null;
  artists?: Array<{ name: string; uri?: string }>;
  album?: { name?: string; uri?: string };
}

interface LatestPlayLike {
  trackId?: string;
  artistId?: string;
  albumId?: string;
  artist?: string;
}

/** "spotify:artist:abc" → "abc"; anything else → null. */
function idFromUri(uri: string | undefined, kind: "artist" | "album"): string | null {
  const prefix = `spotify:${kind}:`;
  return uri && uri.startsWith(prefix) && uri.length > prefix.length ? uri.slice(prefix.length) : null;
}

function target(kind: ProfileTarget["kind"], key: string | null | undefined): ProfileTarget | null {
  return key ? { kind, key } : null;
}

/**
 * Profile targets for the Track on the player deck. Spotify ids double as profile
 * keys. The server fallback Track has no Artist or Album uris, so it borrows them
 * from the latest Stream Event when that event is the same Track.
 */
export function resolvePlayerProfileLinks(params: {
  currentTrack?: PlayerTrackLike | null;
  latestPlay?: LatestPlayLike | null;
}): PlayerProfileLinks {
  const { currentTrack, latestPlay } = params;

  if (!currentTrack) {
    return {
      track: target("track", latestPlay?.trackId),
      artists: latestPlay?.artist
        ? [{ name: latestPlay.artist, target: target("artist", latestPlay.artistId) }]
        : [],
      album: target("album", latestPlay?.albumId),
    };
  }

  const sameAsLatest = Boolean(currentTrack.id && latestPlay?.trackId === currentTrack.id);
  const sdkArtists = currentTrack.artists ?? [];
  const artists = sdkArtists.map((artist, index) => {
    const fromUri = idFromUri(artist.uri, "artist");
    const borrowed = sameAsLatest && index === 0 ? latestPlay?.artistId : null;
    return { name: artist.name, target: target("artist", fromUri ?? borrowed) };
  });

  return {
    track: target("track", currentTrack.id),
    artists,
    album: target(
      "album",
      idFromUri(currentTrack.album?.uri, "album") ?? (sameAsLatest ? latestPlay?.albumId : null)
    ),
  };
}
