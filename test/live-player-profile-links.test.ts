import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readModuleSource } from "./helpers/module-source";
import path from "node:path";
import { resolvePlayerProfileLinks } from "../src/components/views/live-player-view/player-profile-links";
import { PlayerTrackMeta } from "../src/components/views/live-player-view/PlayerTrackMeta";

const sdkTrack = {
  id: "trk1",
  name: "Archangel",
  artists: [
    { name: "Burial", uri: "spotify:artist:art1" },
    { name: "Four Tet", uri: "spotify:artist:art2" },
  ],
  album: { name: "Untrue", uri: "spotify:album:alb1" },
};

test("SDK Track ids become Track, Artist and Album profile targets", () => {
  const links = resolvePlayerProfileLinks({ currentTrack: sdkTrack, latestPlay: null });
  assert.deepEqual(links.track, { kind: "track", key: "trk1" });
  assert.deepEqual(links.artists, [
    { name: "Burial", target: { kind: "artist", key: "art1" } },
    { name: "Four Tet", target: { kind: "artist", key: "art2" } },
  ]);
  assert.deepEqual(links.album, { kind: "album", key: "alb1" });
});

test("the server fallback Track borrows Artist and Album ids from the matching latest Stream Event", () => {
  const fallback = {
    id: "trk1",
    name: "Archangel",
    artists: [{ name: "Burial", uri: "" }],
    album: { name: "Untrue", uri: "" },
  };
  const latestPlay = { trackId: "trk1", artistId: "art1", albumId: "alb1", title: "Archangel", artist: "Burial", album: "Untrue" };
  const links = resolvePlayerProfileLinks({ currentTrack: fallback, latestPlay });
  assert.deepEqual(links.artists, [{ name: "Burial", target: { kind: "artist", key: "art1" } }]);
  assert.deepEqual(links.album, { kind: "album", key: "alb1" });
});

test("a different latest Stream Event does not lend its ids", () => {
  const fallback = { id: "trk9", name: "Other", artists: [{ name: "X", uri: "" }], album: { name: "Y", uri: "" } };
  const latestPlay = { trackId: "trk1", artistId: "art1", albumId: "alb1", title: "Archangel", artist: "Burial", album: "Untrue" };
  const links = resolvePlayerProfileLinks({ currentTrack: fallback, latestPlay });
  assert.deepEqual(links.track, { kind: "track", key: "trk9" });
  assert.deepEqual(links.artists, [{ name: "X", target: null }]);
  assert.equal(links.album, null);
});

test("with no player Track, the latest Stream Event supplies all three targets", () => {
  const latestPlay = { trackId: "trk1", artistId: "art1", albumId: "alb1", title: "Archangel", artist: "Burial", album: "Untrue" };
  const links = resolvePlayerProfileLinks({ currentTrack: null, latestPlay });
  assert.deepEqual(links.track, { kind: "track", key: "trk1" });
  assert.deepEqual(links.artists, [{ name: "Burial", target: { kind: "artist", key: "art1" } }]);
  assert.deepEqual(links.album, { kind: "album", key: "alb1" });
});

test("PlayerTrackMeta renders linked names as buttons and plain text otherwise", () => {
  const html = renderToStaticMarkup(
    React.createElement(PlayerTrackMeta, {
      name: "Archangel",
      album: "Untrue",
      links: {
        track: { kind: "track", key: "trk1" },
        artists: [
          { name: "Burial", target: { kind: "artist", key: "art1" } },
          { name: "Four Tet", target: null },
        ],
        album: null,
      },
      onOpenProfile: () => {},
    })
  );
  assert.match(html, /<button[^>]*aria-label="Open Track profile: Archangel"/);
  assert.match(html, /<button[^>]*aria-label="Open Artist profile: Burial"/);
  assert.doesNotMatch(html, /Artist profile: Four Tet/);
  assert.doesNotMatch(html, /Album profile/);
  assert.match(html, /Four Tet/);
  assert.match(html, /Untrue/);
});

test("PlayerTrackMeta without a handler renders no buttons", () => {
  const html = renderToStaticMarkup(
    React.createElement(PlayerTrackMeta, {
      name: "Archangel",
      album: "Untrue",
      links: { track: { kind: "track", key: "trk1" }, artists: [{ name: "Burial", target: null }], album: null },
    })
  );
  assert.doesNotMatch(html, /<button/);
});

test("ListeningView opens player profiles in Search mode", () => {
  const source = readModuleSource(path.resolve(__dirname, "../src/components/ListeningView.tsx"));
  const idx = source.indexOf("<LivePlayerView");
  assert.ok(idx > 0);
  assert.match(source.slice(idx, idx + 600), /onOpenProfile=\{/);
});
