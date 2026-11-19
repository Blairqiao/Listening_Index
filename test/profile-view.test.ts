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
  plays: 50,
  hourOfDay: Array.from({ length: 24 }, (_, hour) => hour === 18 ? 50 : 0),
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
  key: "4clD00s1c0rVqP9Ld0vV48",
  artistKey: "radiohead-key",
  trackStats: { artistShare: 0.5, artistPlays: 50, longestStreakDays: 5 },
  hourOfDay: Array.from({ length: 24 }, (_, hour) => hour === 22 ? 12 : 0),
  albumTracks: [
    { id: "4clD00s1c0rVqP9Ld0vV48", name: "Weird Fishes / Arpeggi", plays: 20, isCurrent: true },
    { id: "other-track", name: "House of Cards", plays: 8, isCurrent: false },
    { id: "third-track", name: "Reckoner", plays: 6, isCurrent: false },
  ],
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
      onOpenProfile: () => {},
    })
  );

  assert.ok(markup.includes("Radiohead"), "Must include artist name");
  assert.ok(markup.includes("[ OVER TIME ]"), "Chart must use [ OVER TIME ] toggle heading");
  assert.doesNotMatch(markup, /\[ PLAYS \]|WHEN IT PLAYS|PLAYS \/ 1M/);
  assert.ok(markup.includes('role="img"'), "Chart must retain role=img accessibility attribute");
  assert.ok(
    markup.includes('aria-label="Activity cadence histogram"'),
    "Chart must retain aria-label"
  );
  assert.match(markup, /<button[^>]*aria-label="Open Track profile for Weird Fishes \/ Arpeggi"/);
  assert.ok(markup.includes("[ RECENT PLAYS ]"), "Must render [ RECENT PLAYS ] section");
  assert.ok(markup.includes("Weird Fishes / Arpeggi"), "Must render recent play title");
  assert.ok(markup.includes("In Rainbows"), "Must render album name for artist profile");
  assert.ok(markup.includes("18:30"), "Must render formatted play time in UTC");
  assert.match(markup, /\[ SHARE OF PLAYS \]/);
  assert.match(markup, /<button type="button"[^>]*class="[^"]*text-music-accent[^"]*"[^>]*>\[ OVER TIME \]<span class="sr-only">, switch to plays by hour<\/span><\/button>/);
  assert.doesNotMatch(markup, /BY HOUR|aria-pressed/);
  assert.match(markup, /<div class="min-w-0 md:col-span-full">(?:(?!<\/div>).)*?\[ SHARE OF PLAYS \]/);
  assert.ok(markup.indexOf("SHARE OF PLAYS") < markup.indexOf("TOP TRACKS"));
  assert.match(markup, /title="Other Tracks"/);
  assert.match(markup, /w-\[34px\][^>]*>50%<\/span>/);
  assert.match(markup, /w-\[34px\][^>]*>34%<\/span>/);
  assert.ok(markup.indexOf("SHARE OF PLAYS") < markup.indexOf("RECENT PLAYS"));
  assert.ok(markup.includes("[ TOP TRACKS ]"), "Artist profile must render [ TOP TRACKS ]");
  assert.ok(markup.includes("Reckoner"), "Must render top Track Reckoner");
  assert.match(markup, /<button type="button" (?!role="listitem")[^>]*>.*?Reckoner.*?<\/button>/);
  assert.doesNotMatch(markup, /<button[^>]*role="listitem"/);
  assert.ok(markup.includes("[ TOP ALBUMS ]"), "Artist profile must render [ TOP ALBUMS ]");
});

test("ProfileView: SSR ready state for track profile without duplicated lifetime dates", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: mockTrackProfile,
      status: "ready",
      visitorTimezone: "America/Chicago",
      onOpenProfile: () => {},
    })
  );

  assert.ok(markup.includes("Weird Fishes / Arpeggi"), "Must include track title");
  assert.ok(markup.includes("Radiohead"), "Must include artist name");
  assert.ok(markup.includes("In Rainbows"), "Must include album name");
  assert.match(markup, /<a href="https:\/\/open\.spotify\.com\/track\/4clD00s1c0rVqP9Ld0vV48" target="_blank" rel="noopener noreferrer"[^>]*><span[^>]*>Weird Fishes \/ Arpeggi<\/span>/);
  assert.doesNotMatch(markup, /SPOTIFY ↗|BEST MONTH|<dt/);
  assert.match(markup, /\[ SHARE OF RADIOHEAD \]/);
  assert.match(markup, /50% · 25 PLAYS/);
  assert.match(markup, /OF 50/);
  assert.match(markup, /\[ OVER TIME \].*?Activity cadence histogram.*?LONGEST STREAK · 5 DAYS/);
  assert.doesNotMatch(markup, /\[ PLAYS \]|WHEN IT PLAYS|PEAK 22:00/);
  assert.match(markup, /<div class="min-w-0 md:col-span-full">(?:(?!<\/div>).)*?\[ SHARE OF RADIOHEAD \]/);
  assert.ok(markup.indexOf("SHARE OF RADIOHEAD") < markup.indexOf("FROM THIS ALBUM"));
  assert.match(markup, /FROM THIS ALBUM/);
  assert.equal(markup.match(/aria-current="true"/g)?.length, 1);
  assert.match(markup, /<div[^>]*aria-current="true"[^>]*>.*?text-music-accent[^>]*>Weird Fishes \/ Arpeggi/);
  assert.match(markup, /<button[^>]*>(?:(?!<\/button>).)*House of Cards.*?<\/button>/);
  assert.match(markup, /w-\[88px\]|width="88"/);
  assert.match(markup, /<button[^>]*>Radiohead<\/button>/);
  assert.doesNotMatch(markup, /FIRST PLAYED|LAST PLAYED|LIFETIME/);
  assert.match(markup, /md:col-span-full/);
  const recent = markup.slice(markup.indexOf("RECENT PLAYS"));
  assert.doesNotMatch(recent, /<img|Weird Fishes/);
  assert.ok(recent.includes("12:30"), "Must format recent play time in America/Chicago");
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
      onOpenProfile: () => {},
    })
  );

  assert.ok(markup.includes("Radiohead"), "Must keep header artist name");
  assert.ok(markup.includes("[ PLAYS ]"), "Must keep chart header");
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
      onOpenProfile: () => {},
    })
  );

  assert.ok(notFoundMarkup.includes("[ NOT IN ARCHIVE ]"), "Must display [ NOT IN ARCHIVE ]");

  const errorMarkup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: null,
      status: "error",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );

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


test("ProfileView hides the album section for a single ranked Track", () => {
  const markup = renderToStaticMarkup(React.createElement(ProfileView, {
    data: { ...mockTrackProfile, albumTracks: mockTrackProfile.albumTracks?.slice(0, 1) },
    status: "ready",
    visitorTimezone: "UTC",
    onOpenProfile: () => {},
  }));
  assert.doesNotMatch(markup, /FROM THIS ALBUM/);
  assert.match(markup, /\[ OVER TIME \]/);
});

test("ProfileView hides the Track story sections at zero plays", () => {
  const markup = renderToStaticMarkup(React.createElement(ProfileView, {
    data: { ...mockTrackProfile, plays: 0, rank: null, recentPlays: [] },
    status: "ready",
    visitorTimezone: "UTC",
    onOpenProfile: () => {},
  }));
  assert.match(markup, /NO PLAYS IN THIS RANGE/);
  assert.match(markup, /Weird Fishes/);
  assert.doesNotMatch(markup, /LONGEST STREAK|WHEN IT PLAYS|OVER TIME|SHARE OF|FROM THIS ALBUM|RECENT PLAYS/);
});

test("ProfileView lets the Track album list and recent plays run their full height on desktop", () => {
  const markup = renderToStaticMarkup(React.createElement(ProfileView, {
    data: mockTrackProfile,
    status: "ready",
    visitorTimezone: "UTC",
    onOpenProfile: () => {},
  }));
  const album = markup.slice(markup.indexOf("FROM THIS ALBUM"), markup.indexOf("House of Cards"));
  assert.doesNotMatch(album, /md:max-h-/);
  assert.match(album, /max-md:\[&amp;&gt;\*:nth-child\(n\+4\)\]:hidden/);
  const recentStart = markup.lastIndexOf("<div", markup.indexOf("[ RECENT PLAYS ]") - 200);
  assert.doesNotMatch(markup.slice(recentStart, markup.indexOf("[ RECENT PLAYS ]")), /md:max-h-/);
});

test("ProfileView spreads Track recent plays over two columns when there is no album list", () => {
  const recentPlays = Array.from({ length: 6 }, (_, i) => ({
    ...mockTrackProfile.recentPlays[0],
    id: `play-${i}`,
    playedAt: new Date(Date.UTC(2024, 10, 18, 20 - i)).toISOString(),
  }));
  const markup = renderToStaticMarkup(React.createElement(ProfileView, {
    data: { ...mockTrackProfile, albumTracks: [], recentPlays },
    status: "ready",
    visitorTimezone: "UTC",
    onOpenProfile: () => {},
  }));
  assert.doesNotMatch(markup, /FROM THIS ALBUM/);
  assert.match(markup, /md:col-span-full"><div><div[^>]*><span[^>]*>\[ RECENT PLAYS \]/);
  assert.match(markup, /md:grid-cols-2/);
  const columns = markup.slice(markup.indexOf("md:grid-cols-2"));
  // One date label for the day, plus a desktop-only repeat at the top of the second column.
  assert.equal(columns.match(/>18 NOV</g)?.length, 2);
  assert.match(columns, /hidden md:inline[^>]*>18 NOV</);
  assert.equal(columns.match(/h-8/g)?.length, 6);
});
