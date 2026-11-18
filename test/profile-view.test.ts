import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileView } from "../src/components/views/search-view/ProfileView";
import { ActivityChart } from "../src/components/views/ActivityChart";
import type { ProfileData } from "../src/lib/search-types";

const mockArtistProfile: ProfileData = {
  kind: "artist",
  key: "radiohead-key",
  name: "Radiohead",
  artistName: null,
  albumName: null,
  imageUrl: "https://example.com/radiohead.jpg",
  range: "1m",
  firstPlayedAt: "2024-01-15T12:00:00.000Z",
  lastPlayedAt: "2024-11-18T18:30:00.000Z",
  plays: 42,
  rank: 1,
  rankedTotal: 50,
  activityCadence: [
    {
      startTime: "2024-11-01T00:00:00.000Z",
      endTime: "2024-11-02T00:00:00.000Z",
      count: 5,
      date: "01 NOV",
      isMarker: true,
      markerLabel: "01 NOV",
    },
    {
      startTime: "2024-11-02T00:00:00.000Z",
      endTime: "2024-11-03T00:00:00.000Z",
      count: 10,
      date: "02 NOV",
      isMarker: false,
    },
  ],
  topTracks: [
    {
      id: "track-1",
      name: "Weird Fishes / Arpeggi",
      plays: 25,
      albumImageUrl: "https://example.com/in-rainbows.jpg",
    },
    {
      id: "track-2",
      name: "Reckoner",
      plays: 17,
      albumImageUrl: "https://example.com/in-rainbows.jpg",
    },
  ],
  topAlbums: [
    {
      id: "album-1",
      name: "In Rainbows",
      plays: 42,
      imageUrl: "https://example.com/in-rainbows.jpg",
    },
  ],
  recentPlays: [
    {
      id: "play-1",
      trackId: "track-1",
      playedAt: "2024-11-18T18:30:00.000Z",
      title: "Weird Fishes / Arpeggi",
      artist: "Radiohead",
      album: "In Rainbows",
      durationMs: 318000,
      albumImageUrl: "https://example.com/in-rainbows.jpg",
    },
  ],
};

const mockTrackProfile: ProfileData = {
  kind: "track",
  key: "track-1",
  name: "Weird Fishes / Arpeggi",
  artistName: "Radiohead",
  albumName: "In Rainbows",
  imageUrl: "https://example.com/in-rainbows.jpg",
  range: "1m",
  firstPlayedAt: "2024-01-15T12:00:00.000Z",
  lastPlayedAt: "2024-11-18T18:30:00.000Z",
  plays: 25,
  rank: 3,
  rankedTotal: 120,
  activityCadence: [
    {
      startTime: "2024-11-01T00:00:00.000Z",
      endTime: "2024-11-02T00:00:00.000Z",
      count: 2,
      date: "01 NOV",
    },
  ],
  topTracks: [],
  topAlbums: [],
  recentPlays: [
    {
      id: "play-1",
      trackId: "track-1",
      playedAt: "2024-11-18T18:30:00.000Z",
      title: "Weird Fishes / Arpeggi",
      artist: "Radiohead",
      album: "In Rainbows",
      durationMs: 318000,
      albumImageUrl: "https://example.com/in-rainbows.jpg",
    },
  ],
};

test("ProfileView: SSR ready state for artist profile", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: mockArtistProfile,
      status: "ready",
      visitorTimezone: "UTC",
      onBack: () => {},
      onOpenProfile: () => {},
    })
  );

  assert.ok(markup.includes("[ ← SEARCH ]"), "Must include back button [ ← SEARCH ]");
  assert.ok(markup.includes("Radiohead"), "Must include artist name");
  assert.ok(markup.includes("[ PLAYS / 1M ]"), "Chart must use PLAYS label with range");
  assert.ok(markup.includes('role="img"'), "Chart must retain role=img accessibility attribute");
  assert.ok(
    markup.includes('aria-label="Activity cadence histogram"'),
    "Chart must retain aria-label"
  );
  assert.ok(markup.includes("[ RECENT PLAYS ]"), "Must render [ RECENT PLAYS ] section");
  assert.ok(markup.includes("Weird Fishes / Arpeggi"), "Must render recent play title");
  assert.ok(markup.includes("In Rainbows"), "Must render album name for artist profile");
  assert.ok(markup.includes("18:30"), "Must render formatted play time in UTC");
  assert.ok(markup.includes("[ TOP TRACKS ]"), "Artist profile must render [ TOP TRACKS ]");
  assert.ok(markup.includes("Reckoner"), "Must render top Track Reckoner");
  assert.match(markup, /<button type="button" (?!role="listitem")[^>]*>.*?Reckoner.*?<\/button>/);
  assert.doesNotMatch(markup, /<button[^>]*role="listitem"/);
  assert.ok(markup.includes("[ TOP ALBUMS ]"), "Artist profile must render [ TOP ALBUMS ]");
});

test("ProfileView: SSR ready state for track profile with lifetime block", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: mockTrackProfile,
      status: "ready",
      visitorTimezone: "America/Chicago",
      onBack: () => {},
      onOpenProfile: () => {},
    })
  );

  assert.ok(markup.includes("[ ← SEARCH ]"), "Must include back button [ ← SEARCH ]");
  assert.ok(markup.includes("Weird Fishes / Arpeggi"), "Must include track title");
  assert.ok(markup.includes("Radiohead"), "Must include artist name");
  assert.ok(markup.includes("In Rainbows"), "Must include album name");
  assert.ok(markup.includes("[ LIFETIME ]"), "Track profile must include [ LIFETIME ] block");
  assert.ok(markup.includes("FIRST PLAYED"), "Must include FIRST PLAYED label");
  assert.ok(markup.includes("LAST PLAYED"), "Must include LAST PLAYED label");
  // 2024-01-15T12:00:00Z in America/Chicago (CST = UTC-6) is 06:00 on 15 JAN 2024
  assert.ok(markup.includes("15 JAN 2024"), "Must format lifetime firstPlayedAt in visitorTimezone");
  // 2024-11-18T18:30:00Z in America/Chicago (CST = UTC-6) is 12:30 on 18 NOV 2024
  assert.ok(markup.includes("18 NOV 2024"), "Must format lifetime lastPlayedAt in visitorTimezone");
  assert.ok(markup.includes("12:30"), "Must format recent play time in America/Chicago");
});

test("ProfileView: SSR zero plays state renders empty message and retains chart", () => {
  const zeroProfile: ProfileData = {
    ...mockArtistProfile,
    plays: 0,
    rank: null,
    activityCadence: [
      {
        startTime: "2024-11-01T00:00:00.000Z",
        endTime: "2024-11-02T00:00:00.000Z",
        count: 0,
        date: "01 NOV",
      },
    ],
    topTracks: [],
    topAlbums: [],
    recentPlays: [],
  };

  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: zeroProfile,
      status: "ready",
      visitorTimezone: "UTC",
      onBack: () => {},
      onOpenProfile: () => {},
    })
  );

  assert.ok(markup.includes("[ ← SEARCH ]"), "Must keep header back button");
  assert.ok(markup.includes("Radiohead"), "Must keep header artist name");
  assert.ok(markup.includes("[ PLAYS / 1M ]"), "Must keep chart header");
  assert.ok(markup.includes('role="img"'), "Must retain chart img role");
  assert.equal(markup.split("[ NO PLAYS IN THIS RANGE ]").length - 1, 1);
  assert.ok(
    !markup.includes("[ RECENT PLAYS ]"),
    "Must NOT render [ RECENT PLAYS ] header when plays === 0"
  );
});

test("ProfileView: SSR error and not_found states", () => {
  const notFoundMarkup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: null,
      status: "not_found",
      visitorTimezone: "UTC",
      onBack: () => {},
      onOpenProfile: () => {},
    })
  );

  assert.ok(notFoundMarkup.includes("[ ← SEARCH ]"), "not_found must include back button");
  assert.ok(notFoundMarkup.includes("[ NOT IN ARCHIVE ]"), "Must display [ NOT IN ARCHIVE ]");

  const errorMarkup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: null,
      status: "error",
      visitorTimezone: "UTC",
      onBack: () => {},
      onOpenProfile: () => {},
    })
  );

  assert.ok(errorMarkup.includes("[ ← SEARCH ]"), "error must include back button");
  assert.ok(
    errorMarkup.includes("[ COULDN&#x27;T LOAD PROFILE ]") ||
      errorMarkup.includes("[ COULDN'T LOAD PROFILE ]"),
    "Must display [ COULDN'T LOAD PROFILE ]"
  );
});

test("ActivityChart: default label is ACTIVITY and accessible semantics preserved", () => {
  const defaultMarkup = renderToStaticMarkup(
    React.createElement(ActivityChart, {
      range: "1d",
      activityCadence: [
        {
          startTime: "2024-11-18T10:00:00.000Z",
          endTime: "2024-11-18T11:00:00.000Z",
          count: 3,
          date: "10:00",
        },
      ],
      isLoading: false,
    })
  );

  assert.ok(defaultMarkup.includes("[ ACTIVITY / 1D ]"), "Default label must be ACTIVITY");
  assert.ok(defaultMarkup.includes('role="img"'), "Chart container must have role=img");
  assert.ok(
    defaultMarkup.includes('aria-label="Activity cadence histogram"'),
    "Chart container must have aria-label"
  );
  assert.ok(defaultMarkup.includes("-24H"), "1d range must render -24H marker");
  assert.ok(defaultMarkup.includes("NOW"), "1d range must render NOW marker");
});
