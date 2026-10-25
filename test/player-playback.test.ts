import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolvePlayRequest,
  shouldToggleInPlace,
  PlaybackContextSelection,
} from "../src/lib/player-playback";

test("AC-1: resolvePlayRequest prioritizes playlist context_uri when no explicit track is given", async () => {
  const playlistContext: PlaybackContextSelection = {
    type: "playlist",
    id: "pl123",
    uri: "spotify:playlist:pl123",
    name: "My Indie Favorites",
    trackCount: 42,
  };

  const req = await resolvePlayRequest({
    selectedContext: playlistContext,
    fallbackTrackUri: "spotify:track:fallback999",
  });

  assert.deepEqual(req, {
    context_uri: "spotify:playlist:pl123",
  });
});

test("AC-2a: resolvePlayRequest uses multi-track URIs when selectedContext is auto", async () => {
  const autoContext: PlaybackContextSelection = {
    type: "auto",
    name: "Auto Play (Top 100)",
  };

  const mockQueueUris = [
    "spotify:track:track1",
    "spotify:track:track2",
    "spotify:track:track3",
  ];

  const req = await resolvePlayRequest({
    selectedContext: autoContext,
    fallbackTrackUri: "spotify:track:fallback999",
    fetchAutoQueue: async () => mockQueueUris,
  });

  assert.deepEqual(req, {
    uris: mockQueueUris,
  });
});

test("AC-2b: resolvePlayRequest falls back to fallbackTrackUri when auto-queue is empty or fails", async () => {
  const autoContext: PlaybackContextSelection = {
    type: "auto",
    name: "Auto Play (Top 100)",
  };

  const reqEmpty = await resolvePlayRequest({
    selectedContext: autoContext,
    fallbackTrackUri: "spotify:track:fallback999",
    fetchAutoQueue: async () => [],
  });

  assert.deepEqual(reqEmpty, {
    uris: ["spotify:track:fallback999"],
  });

  const reqFail = await resolvePlayRequest({
    selectedContext: autoContext,
    fallbackTrackUri: "raw_track_id",
    fetchAutoQueue: async () => {
      throw new Error("Network error");
    },
  });

  assert.deepEqual(reqFail, {
    uris: ["spotify:track:raw_track_id"],
  });
});

test("AC-3: resolvePlayRequest plays single track when explicit trackIdOrUri is provided", async () => {
  const playlistContext: PlaybackContextSelection = {
    type: "playlist",
    uri: "spotify:playlist:pl123",
    name: "My Playlist",
  };

  const reqWithRawId = await resolvePlayRequest({
    trackIdOrUri: "explicit_track_id",
    selectedContext: playlistContext,
  });

  assert.deepEqual(reqWithRawId, {
    uris: ["spotify:track:explicit_track_id"],
  });

  const reqWithSpotifyUri = await resolvePlayRequest({
    trackIdOrUri: "spotify:track:explicit_track_id_2",
    selectedContext: playlistContext,
  });

  assert.deepEqual(reqWithSpotifyUri, {
    uris: ["spotify:track:explicit_track_id_2"],
  });
});

test("AC-4: shouldToggleInPlace determines in-place pause/resume vs new playback", () => {
  // When actively playing, clicking toggle MUST pause in-place even if context is armed
  assert.equal(
    shouldToggleInPlace({
      isContextArmed: true,
      hasPlayer: true,
      hasLoadedTrack: true,
      isPlaying: true,
      trackIdOrUri: undefined,
    }),
    true,
    "Actively playing track must toggle in-place (pause) even if context is marked armed"
  );

  // When context is not armed, player is available, track is loaded, and no trackId passed -> toggle in place
  assert.equal(
    shouldToggleInPlace({
      isContextArmed: false,
      hasPlayer: true,
      hasLoadedTrack: true,
      isPlaying: false,
      trackIdOrUri: undefined,
    }),
    true
  );

  // When idle and context is newly armed (e.g. user selected another playlist) -> false (must start new playback)
  assert.equal(
    shouldToggleInPlace({
      isContextArmed: true,
      hasPlayer: true,
      hasLoadedTrack: true,
      isPlaying: false,
      trackIdOrUri: undefined,
    }),
    false
  );

  // When trackIdOrUri is explicitly provided -> false (must start specified track)
  assert.equal(
    shouldToggleInPlace({
      isContextArmed: false,
      hasPlayer: true,
      hasLoadedTrack: true,
      isPlaying: false,
      trackIdOrUri: "some_track",
    }),
    false
  );

  // When no track is currently loaded in the player -> false (must initiate playback)
  assert.equal(
    shouldToggleInPlace({
      isContextArmed: false,
      hasPlayer: true,
      hasLoadedTrack: false,
      isPlaying: false,
      trackIdOrUri: undefined,
    }),
    false
  );
});

test("AC-5: isSameContext determines if newly selected context matches active context", async () => {
  const { isSameContext } = await import("../src/lib/player-playback");

  const autoCtx: PlaybackContextSelection = { type: "auto", name: "Recent Favorites" };
  const autoCtx2: PlaybackContextSelection = { type: "auto", name: "Auto Play (Top 100)" };
  assert.equal(isSameContext(autoCtx, autoCtx2), true, "Both auto contexts match");

  const pl1: PlaybackContextSelection = {
    type: "playlist",
    name: "My Jams",
    uri: "spotify:playlist:123",
  };
  const pl1Duplicate: PlaybackContextSelection = {
    type: "playlist",
    name: "My Jams Renamed",
    uri: "spotify:playlist:123",
  };
  const pl2: PlaybackContextSelection = {
    type: "playlist",
    name: "Other Jams",
    uri: "spotify:playlist:456",
  };

  assert.equal(isSameContext(pl1, pl1Duplicate), true, "Matching URI means same context");
  assert.equal(isSameContext(pl1, pl2), false, "Different URI means different context");
  assert.equal(isSameContext(pl1, autoCtx), false, "Different type means different context");
});
