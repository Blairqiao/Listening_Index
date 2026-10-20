"use client";

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";

let sdkPromise: Promise<void> | null = null;

/**
 * Loads the Spotify Web Playback SDK script idempotently.
 * Uses a single-flight in-memory promise to prevent duplicate script tags.
 */
export function loadSpotifySdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Spotify) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const tag = document.createElement("script");
    tag.src = SDK_SRC;
    tag.async = true;
    tag.onerror = () => reject(new Error("Could not load the Spotify SDK script"));
    document.body.appendChild(tag);
  });

  return sdkPromise;
}

export function useSpotifySdk() {
  return {
    loadSpotifySdk,
  };
}
