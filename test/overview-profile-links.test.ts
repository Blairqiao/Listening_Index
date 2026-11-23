import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OverviewView } from "../src/components/views/OverviewView";
import type { AlbumSummary, TrackSummary } from "../src/lib/types";
import type { ProfileTarget } from "../src/lib/search-types";

const tracks: TrackSummary[] = [
  {
    id: "track-1",
    rank: "01",
    drift: "·",
    name: "Weird Fishes",
    artist: "Radiohead",
    artistId: "spotify-artist",
    artistKey: "artist-key",
    album: "In Rainbows",
    albumId: "spotify-album",
    albumKey: "album-key",
    duration: "5:18",
    plays: 12,
    swatchColor: "#000000",
  },
];
const artists = [
  { rank: "01", name: "Radiohead", count: 12, id: "spotify-artist", key: "artist-key" },
  { rank: "02", name: "Unenriched", count: 3, key: "unenriched::group" },
];
const albums: AlbumSummary[] = [
  {
    rank: "01",
    name: "In Rainbows",
    artist: "Radiohead",
    id: "spotify-album",
    key: "album-key",
    artistId: "spotify-artist",
    artistKey: "artist-key",
    count: 8,
  },
];

interface VNode {
  type?: unknown;
  props?: Record<string, unknown> & { children?: unknown; onClick?: (e: unknown) => void };
}

function collect(node: unknown, out: VNode[] = []): VNode[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out);
    return out;
  }
  const elem = node as VNode;
  if (elem.props?.onClick) out.push(elem);
  collect(elem.props?.children, out);
  return out;
}

function render(onOpenProfile: (target: ProfileTarget) => void) {
  const props = {
    granularity: "year" as const,
    rangeKey: "all" as const,
    topTracks: tracks,
    topArtists: artists,
    topAlbums: albums,
    onOpenProfile,
  };
  return {
    markup: renderToStaticMarkup(React.createElement(OverviewView, props)),
    clickable: collect(OverviewView(props)),
  };
}

function clickByLabel(clickable: VNode[], label: string) {
  const node = clickable.find((n) => n.props?.["aria-label"] === label);
  assert.ok(node, `expected a clickable element labelled "${label}"`);
  node.props!.onClick!({ stopPropagation() {} });
}

test("Overview links open profiles instead of Spotify", () => {
  const opened: ProfileTarget[] = [];
  const { markup, clickable } = render((target) => opened.push(target));

  assert.ok(!markup.includes("open.spotify.com"), "Overview must not link to Spotify");

  clickByLabel(clickable, "Open Track profile for Weird Fishes");
  clickByLabel(clickable, "Open Artist profile for Radiohead");
  clickByLabel(clickable, "Open Album profile for In Rainbows");

  assert.deepEqual(opened, [
    { kind: "track", key: "track-1" },
    { kind: "artist", key: "artist-key" },
    { kind: "album", key: "album-key" },
  ]);
});

test("Overview rows open the row's profile, using the Group Key before enrichment", () => {
  const opened: ProfileTarget[] = [];
  const { clickable } = render((target) => opened.push(target));

  const trackRow = clickable.find((n) => n.props?.role === "listitem" && n.props?.["data-profile-kind"] === "track");
  assert.ok(trackRow);
  trackRow.props!.onClick!({});

  const artistRows = clickable.filter((n) => n.props?.["data-profile-kind"] === "artist");
  for (const row of artistRows) row.props!.onClick!({});

  const albumRow = clickable.find((n) => n.props?.["data-profile-kind"] === "album");
  assert.ok(albumRow);
  albumRow.props!.onClick!({});

  assert.deepEqual(opened, [
    { kind: "track", key: "track-1" },
    { kind: "artist", key: "artist-key" },
    { kind: "artist", key: "unenriched::group" },
    { kind: "album", key: "album-key" },
  ]);
});
