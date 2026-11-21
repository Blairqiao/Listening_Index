import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileView } from "../src/components/views/search-view/ProfileView";
import { ActivityChart } from "../src/components/views/ActivityChart";
import type { ProfileData } from "../src/lib/search-types";

const mockArtistProfile: ProfileData = {
  kind: "artist",
  key: "4Z8W4fKeB5YxbusRsdQVPb",
  name: "Radiohead",
  artistName: null,
  albumName: null,
  imageUrl: "https://example.com/radiohead.jpg",
  range: "1m",
  firstPlayedAt: "2024-01-15T12:00:00.000Z",
  lastPlayedAt: "2024-11-18T18:30:00.000Z",
  plays: 50,
  hourOfDay: Array.from({ length: 24 }, (_, hour) => (hour === 18 ? 50 : 0)),
  dayOfWeek: [5, 8, 10, 7, 12, 4, 4],
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
  artistKey: "4Z8W4fKeB5YxbusRsdQVPb",
  trackStats: { artistShare: 0.5, artistPlays: 50, longestStreakDays: 5 },
  hourOfDay: Array.from({ length: 24 }, (_, hour) => (hour === 22 ? 12 : 0)),
  dayOfWeek: [2, 3, 4, 5, 6, 3, 2],
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

const mockAlbumProfile: ProfileData = {
  ...mockArtistProfile,
  kind: "album",
  key: "5vkqYmiPBYLaalcmjujWxK",
  name: "In Rainbows",
  artistName: "Radiohead",
  artistKey: mockArtistProfile.key,
  imageUrl: mockArtistProfile.topAlbums[0].imageUrl,
  topAlbums: [],
};

test("ProfileView: Album header, Track shares, no repeated artwork, and Recent Plays", () => {
  const props = { status: "ready", visitorTimezone: "UTC", onOpenProfile: () => {} } as const;
  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      ...props,
      data: {
        ...mockAlbumProfile,
        recentPlays: [
          {
            ...mockAlbumProfile.recentPlays[0],
            msPlayed: 318000,
          },
        ],
        stats: {
          totalMs: 7_200_000,
          activeDays: 12,
          longestStreakDays: 4,
          longestStreakStart: "2024-11-08",
          longestStreakEnd: "2024-11-11",
          peakDay: { date: "2024-11-10", plays: 9 },
          artistPlays: 100,
          artistShare: 0.5,
          tracksHeardInRange: 8,
          tracksHeardLifetime: 10,
          fullAlbumSessions: 3,
        },
        moreAlbums: [
          {
            key: "kid-a-key",
            name: "Kid A",
            plays: 31,
            imageUrl: "https://example.com/kid-a.jpg",
          },
        ],
      },
    })
  );

  assert.match(markup, /\[ ALBUM \]/);
  assert.match(markup, /<a href="https:\/\/open\.spotify\.com\/album\/5vkqYmiPBYLaalcmjujWxK" target="_blank" rel="noopener noreferrer"[^>]*><span[^>]*>In Rainbows<\/span>/);
  assert.match(markup, /w-\[88px\]|width="88"/);
  assert.match(markup, /ARTIST · <\/span><button[^>]*>Radiohead<\/button>/);
  assert.match(markup, /\[ OVER TIME \]/);
  assert.match(markup, /\[ SHARE OF PLAYS \]/);
  assert.match(markup, /\[ TOP TRACKS \]/);
  assert.match(markup, /w-\[34px\][^>]*>50%<\/span>/);
  assert.match(markup, /\[ RECENT PLAYS \]/);
  assert.doesNotMatch(markup, /\[ ALBUM STATS \]/);
  assert.match(markup, /ARTIST SHARE.*?50%/);
  assert.match(markup, /TRACKS HEARD.*?8 \/ 10/);
  assert.match(markup, /FULL-ALBUM SESSIONS.*?3/);
  assert.doesNotMatch(markup, /MORE BY/);
  assert.doesNotMatch(markup, /Kid A/);

  const recentPlays = markup.slice(markup.indexOf("[ RECENT PLAYS ]"), markup.indexOf("[ TOP TRACKS ]"));
  assert.match(recentPlays, /aria-label="Open Track profile for Weird Fishes \/ Arpeggi"/);
  assert.match(recentPlays, /h-8/);
  assert.match(recentPlays, /5:18/);
  assert.doesNotMatch(recentPlays, /<img/);
  assert.doesNotMatch(recentPlays, />In Rainbows</);

  const topTracks = markup.slice(markup.indexOf("[ TOP TRACKS ]"));
  assert.doesNotMatch(topTracks, /<img/);
  assert.match(topTracks, /md:h-\(--box-h\)/);
  assert.match(topTracks, /overflow-y-auto scrollbar-hidden/);
  assert.match(topTracks, /h-8/);

  assert.doesNotMatch(markup, /\[ TOP ALBUMS \]|\[ SHARE OF RADIOHEAD \]/);

  const groupKeyMarkup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      ...props,
      data: { ...mockAlbumProfile, key: "radiohead::in rainbows", artistKey: undefined },
    })
  );
  assert.match(groupKeyMarkup, />In Rainbows</);
  assert.match(groupKeyMarkup, /ARTIST · <\/span>Radiohead/);
  assert.doesNotMatch(groupKeyMarkup, /open\.spotify\.com|<button[^>]*>Radiohead/);
});

test("ProfileView links Artist and Track Album names only when keyed", () => {
  const props = { status: "ready", visitorTimezone: "UTC", onOpenProfile: () => {} } as const;
  const keyedArtist = renderToStaticMarkup(
    React.createElement(ProfileView, {
      ...props,
      data: {
        ...mockArtistProfile,
        topAlbums: [
          { ...mockArtistProfile.topAlbums[0], key: "radiohead::in rainbows" },
          { name: "Unkeyed Album", plays: 8, imageUrl: null },
        ],
      },
    })
  );
  const albumRows = keyedArtist.slice(keyedArtist.indexOf("[ TOP ALBUMS ]"));
  assert.match(albumRows, /<button[^>]*>(?:(?!<\/button>).)*>In Rainbows<\/span>.*?<\/button>/);
  assert.match(albumRows, />Unkeyed Album<\/span>/);
  assert.doesNotMatch(albumRows, /<button[^>]*>(?:(?!<\/button>).)*>Unkeyed Album<\/span>/);

  const keyedTrack = renderToStaticMarkup(
    React.createElement(ProfileView, {
      ...props,
      data: { ...mockTrackProfile, albumKey: "radiohead::in rainbows" },
    })
  );
  const unkeyedTrack = renderToStaticMarkup(
    React.createElement(ProfileView, { ...props, data: mockTrackProfile })
  );
  assert.match(keyedTrack, /ALBUM · <\/span><button[^>]*>In Rainbows<\/button>/);
  assert.match(unkeyedTrack, /ALBUM · <\/span>In Rainbows<\/div>/);
  assert.doesNotMatch(unkeyedTrack, /<button[^>]*>In Rainbows/);
});

test("ProfileView: SSR ready state for artist profile with 88px header, Spotify link, and stats", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: {
        ...mockArtistProfile,
        stats: {
          totalMs: 14_400_000,
          activeDays: 18,
          longestStreakDays: 6,
          longestStreakStart: "2024-11-09",
          longestStreakEnd: "2024-11-14",
          peakDay: { date: "2024-11-12", plays: 11 },
        },
      },
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );

  assert.match(markup, /\[ ARTIST \]/);
  assert.match(markup, /w-\[88px\]|width="88"/);
  assert.match(markup, /<a href="https:\/\/open\.spotify\.com\/artist\/4Z8W4fKeB5YxbusRsdQVPb" target="_blank" rel="noopener noreferrer"[^>]*><span[^>]*>Radiohead<\/span>/);
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
  assert.doesNotMatch(markup, /\[ ARTIST STATS \]|PEAK DAY/);
  assert.match(markup, /LISTENING TIME.*?4H/);
  assert.match(markup, /ACTIVE DAYS.*?18/);
  assert.match(markup, /Longest streak: 6 days \(Nov 9–14, 2024\)/);
  assert.doesNotMatch(markup, /md:row-start-4/);
});

test("ProfileView: SSR ready state for track profile with stats, duration/partial, and related tracks", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: {
        ...mockTrackProfile,
        recentPlays: [
          {
            ...mockTrackProfile.recentPlays[0],
            id: "play-full",
            msPlayed: 310000,
          },
          {
            ...mockTrackProfile.recentPlays[0],
            id: "play-partial",
            playedAt: "2024-11-18T17:30:00.000Z",
            msPlayed: 120000,
          },
        ],
        stats: {
          totalMs: 4_500_000,
          activeDays: 9,
          longestStreakDays: 5,
          longestStreakStart: "2024-11-13",
          longestStreakEnd: "2024-11-17",
          peakDay: { date: "2024-11-15", plays: 4 },
          completionRate: 0.92,
          artistPlays: 50,
          artistShare: 0.5,
          albumPlays: 40,
          albumShare: 0.625,
        },
        relatedTracks: [
          {
            id: "related-1",
            name: "Nude",
            artist: "Radiohead",
            albumImageUrl: "https://example.com/in-rainbows.jpg",
            coPlays: 7,
          },
        ],
      },
      status: "ready",
      visitorTimezone: "America/Chicago",
      onOpenProfile: () => {},
    })
  );

  assert.match(markup, /\[ TRACK \]/);
  assert.ok(markup.includes("Weird Fishes / Arpeggi"), "Must include track title");
  assert.ok(markup.includes("Radiohead"), "Must include artist name");
  assert.ok(markup.includes("In Rainbows"), "Must include album name");
  assert.match(markup, /<a href="https:\/\/open\.spotify\.com\/track\/4clD00s1c0rVqP9Ld0vV48" target="_blank" rel="noopener noreferrer"[^>]*><span[^>]*>Weird Fishes \/ Arpeggi<\/span>/);
  assert.doesNotMatch(markup, /SPOTIFY ↗|BEST MONTH|<dt/);
  assert.match(markup, /\[ SHARE OF RADIOHEAD \]/);
  assert.match(markup, /50% · 25 PLAYS/);
  assert.match(markup, /OF 50/);
  assert.doesNotMatch(markup, /\[ TRACK STATS \]/);
  assert.match(markup, /COMPLETION.*?92%/);
  assert.match(markup, /ALBUM SHARE.*?63%/);
  assert.match(markup, /Longest streak: 5 days \(Nov 13–17, 2024\)/);
  assert.match(markup, /\[ OFTEN PLAYED WITH \]/);
  assert.match(markup, /Nude.*?Radiohead.*?7×/);
  assert.match(markup, /<div class="min-w-0 md:col-span-full">(?:(?!<\/div>).)*?\[ SHARE OF RADIOHEAD \]/);
  assert.ok(markup.indexOf("SHARE OF RADIOHEAD") < markup.indexOf("FROM THIS ALBUM"));
  assert.match(markup, /FROM THIS ALBUM/);
  assert.equal(markup.match(/aria-current="true"/g)?.length, 1);
  assert.match(markup, /<div[^>]*aria-current="true"[^>]*>.*?text-music-accent[^>]*>Weird Fishes \/ Arpeggi/);
  assert.match(markup, /<button[^>]*>(?:(?!<\/button>).)*House of Cards.*?<\/button>/);
  assert.match(markup, /w-\[88px\]|width="88"/);
  assert.match(markup, /ARTIST · <\/span><button[^>]*>Radiohead<\/button>/);
  assert.doesNotMatch(markup, /FIRST PLAYED|LAST PLAYED|LIFETIME/);

  const fromAlbum = markup.slice(markup.indexOf("FROM THIS ALBUM"), markup.indexOf("OFTEN PLAYED WITH"));
  assert.doesNotMatch(fromAlbum, /<img/);
  assert.match(fromAlbum, /md:h-\(--box-h\)/);
  assert.match(fromAlbum, /overflow-y-auto scrollbar-hidden/);
  assert.match(fromAlbum, /h-8/);

  const recent = markup.slice(markup.indexOf("RECENT PLAYS"), markup.indexOf("FROM THIS ALBUM"));
  assert.doesNotMatch(recent, /<img|Weird Fishes/);
  assert.ok(recent.includes("12:30"), "Must format recent play time in America/Chicago");
  assert.ok(recent.includes("5:10"), "Must render full play duration");
  assert.ok(recent.includes("2:00"), "Must render partial play duration");
  assert.ok(recent.includes("PARTIAL"), "Must tag partial plays");
});

test("ProfileView: Track without stats omits the streak and renders cleanly without msPlayed", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: mockTrackProfile,
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );

  assert.match(markup, /\[ OVER TIME \].*?Activity cadence histogram/);
  assert.doesNotMatch(markup, /LONGEST STREAK/);
  const recent = markup.slice(markup.indexOf("RECENT PLAYS"), markup.indexOf("FROM THIS ALBUM"));
  assert.doesNotMatch(recent, /0:00|PARTIAL/);
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

test("ProfileView: SSR loading skeleton respects pendingKind with 88px header", () => {
  const trackSkeleton = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: null,
      status: "loading",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
      pendingKind: "track",
    })
  );
  assert.match(trackSkeleton, /w-\[88px\] h-\[88px\]/);
  assert.match(trackSkeleton, /\[ FROM THIS ALBUM \]/);
  assert.match(trackSkeleton, /\[ OFTEN PLAYED WITH \]/);
  assert.doesNotMatch(trackSkeleton, /\[ TRACK STATS \]/);

  const artistSkeleton = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: null,
      status: "loading",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
      pendingKind: "artist",
    })
  );
  assert.match(artistSkeleton, /w-\[88px\] h-\[88px\]/);
  assert.match(artistSkeleton, /\[ TOP TRACKS \]/);
  assert.match(artistSkeleton, /\[ TOP ALBUMS \]/);
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

test("ProfileView always renders FROM THIS ALBUM for a single ranked Track with placeholder rows", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: { ...mockTrackProfile, albumTracks: mockTrackProfile.albumTracks?.slice(0, 1) },
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );
  assert.match(markup, /\[ FROM THIS ALBUM \]/);
  const fromAlbum = markup.slice(markup.indexOf("[ FROM THIS ALBUM ]"), markup.indexOf("[ OFTEN PLAYED WITH ]"));
  assert.equal(fromAlbum.match(/data-profile-placeholder/g)?.length ?? 0, 4);
  assert.match(markup, /\[ OVER TIME \]/);
});

test("ProfileView hides the Track story sections at zero plays", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: { ...mockTrackProfile, plays: 0, rank: null, recentPlays: [] },
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );
  assert.match(markup, /NO PLAYS IN THIS RANGE/);
  assert.match(markup, /Weird Fishes/);
  assert.doesNotMatch(markup, /LONGEST STREAK|WHEN IT PLAYS|OVER TIME|SHARE OF|FROM THIS ALBUM|RECENT PLAYS/);
});

test("ProfileView keeps two-column layout for Track even when right-column lists are empty", () => {
  const recentPlays = Array.from({ length: 6 }, (_, i) => ({
    ...mockTrackProfile.recentPlays[0],
    id: `play-${i}`,
    playedAt: new Date(Date.UTC(2024, 10, 18, 20 - i)).toISOString(),
  }));
  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: { ...mockTrackProfile, albumTracks: [], relatedTracks: [], recentPlays },
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );
  assert.doesNotMatch(markup, /md:grid-cols-2/);
  const recent = markup.slice(markup.indexOf("[ RECENT PLAYS ]"), markup.indexOf("[ FROM THIS ALBUM ]"));
  assert.equal(recent.match(/>18 NOV</g)?.length ?? 0, 1);
  assert.equal(recent.match(/data-profile-placeholder/g)?.length ?? 0, 5);

  const fromAlbum = markup.slice(markup.indexOf("[ FROM THIS ALBUM ]"), markup.indexOf("[ OFTEN PLAYED WITH ]"));
  assert.equal(fromAlbum.match(/data-profile-placeholder/g)?.length ?? 0, 5);

  const related = markup.slice(markup.indexOf("[ OFTEN PLAYED WITH ]"));
  assert.equal(related.match(/data-profile-placeholder/g)?.length ?? 0, 5);
});

test("ProfileHeader: Artist markup contains PLAYS, RANK, LISTENING TIME, ACTIVE DAYS, PLAY SHARE, TRACKS HEARD, COMPLETION and no PEAK DAY", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: {
        ...mockArtistProfile,
        stats: {
          totalMs: 14_400_000,
          activeDays: 18,
          longestStreakDays: 6,
          longestStreakStart: "2024-11-09",
          longestStreakEnd: "2024-11-14",
          peakDay: { date: "2024-11-12", plays: 11 },
          playShare: 0.25,
          tracksHeardInRange: 12,
          tracksHeardLifetime: 20,
          completionRate: 0.88,
        },
      },
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );

  assert.match(markup, /PLAYS/);
  assert.match(markup, /RANK/);
  assert.match(markup, /LISTENING TIME/);
  assert.match(markup, /ACTIVE DAYS/);
  assert.match(markup, /PLAY SHARE/);
  assert.match(markup, /25%/);
  assert.match(markup, /TRACKS HEARD/);
  assert.match(markup, /12 \/ 20/);
  assert.match(markup, /COMPLETION/);
  assert.match(markup, /88%/);
  assert.doesNotMatch(markup, /PEAK DAY/);
  assert.doesNotMatch(markup, /\[ ARTIST STATS \]/);
});

test("ProfileHeader: Album markup contains FULL-ALBUM SESSIONS; Track markup contains ALBUM SHARE but not PLAY SHARE", () => {
  const albumMarkup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: {
        ...mockAlbumProfile,
        stats: {
          totalMs: 7_200_000,
          activeDays: 12,
          longestStreakDays: 4,
          longestStreakStart: "2024-11-08",
          longestStreakEnd: "2024-11-11",
          peakDay: null,
          artistShare: 0.5,
          tracksHeardInRange: 8,
          tracksHeardLifetime: 10,
          fullAlbumSessions: 3,
        },
      },
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );

  assert.match(albumMarkup, /FULL-ALBUM SESSIONS/);
  assert.match(albumMarkup, /ARTIST SHARE/);
  assert.doesNotMatch(albumMarkup, /\[ ALBUM STATS \]/);

  const trackMarkup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: {
        ...mockTrackProfile,
        stats: {
          totalMs: 4_500_000,
          activeDays: 9,
          longestStreakDays: 5,
          longestStreakStart: "2024-11-13",
          longestStreakEnd: "2024-11-17",
          peakDay: null,
          completionRate: 0.92,
          albumShare: 0.625,
        },
      },
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );

  assert.match(trackMarkup, /ALBUM SHARE/);
  assert.match(trackMarkup, /COMPLETION/);
  assert.doesNotMatch(trackMarkup, /PLAY SHARE/);
  assert.doesNotMatch(trackMarkup, /\[ TRACK STATS \]/);
});

test("ProfileHeader: streak sentence formats for 2+ days and is absent for 1 day", () => {
  const sixDayMarkup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: {
        ...mockArtistProfile,
        stats: {
          totalMs: 14_400_000,
          activeDays: 18,
          longestStreakDays: 6,
          longestStreakStart: "2024-11-07",
          longestStreakEnd: "2024-11-12",
          peakDay: null,
        },
      },
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );

  assert.match(sixDayMarkup, /Longest streak: 6 days \(Nov 7–12, 2024\)/);

  const oneDayMarkup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: {
        ...mockArtistProfile,
        stats: {
          totalMs: 14_400_000,
          activeDays: 1,
          longestStreakDays: 1,
          longestStreakStart: "2024-11-12",
          longestStreakEnd: "2024-11-12",
          peakDay: null,
        },
      },
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );

  assert.doesNotMatch(oneDayMarkup, /Longest streak/);
});

test("ProfileHeader: rank renders 1 / 50 by default and percentile with rankFormat='percentile'", () => {
  const defaultMarkup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: mockArtistProfile,
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
      onToggleRankFormat: () => {},
    })
  );

  assert.match(defaultMarkup, /1 \/ 50/);
  assert.match(defaultMarkup, /aria-label="Rank 1 \/ 50\. Toggle between rank position and percentile"/);

  const percentileMarkup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: mockArtistProfile,
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
      rankFormat: "percentile",
      onToggleRankFormat: () => {},
    })
  );

  assert.match(percentileMarkup, /TOP 2%/);
  assert.match(percentileMarkup, /aria-label="Rank TOP 2%\. Toggle between rank position and percentile"/);
});

test("ProfileHeader: FIRST PLAY subline is present with formatted dates in visitor timezone", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: mockArtistProfile,
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );

  assert.doesNotMatch(markup, /→/);
  assert.doesNotMatch(markup, /FIRST PLAY 15 JAN 2024 · LAST/);
  const statsStart = markup.indexOf("data-profile-stats");
  assert.ok(statsStart > markup.indexOf("Radiohead"), "stats row renders after the title");
  const statsRow = markup.slice(statsStart, markup.indexOf("[ OVER TIME ]"));
  assert.match(statsRow, /PLAYS.*RANK.*LISTENING TIME.*ACTIVE DAYS.*FIRST PLAY<\/span><span[^>]*>15 JAN 2024<\/span>.*LAST PLAY<\/span><span[^>]*>18 NOV 2024<\/span>/);
  assert.doesNotMatch(markup, /grid-cols-4/);
  assert.match(markup, /data-profile-stats="" class="[^"]*\bflex-wrap\b[^"]*\bmd:justify-between\b/);
});

test("ProfileBox: Artist with 1 top Track renders 4 placeholders in TOP TRACKS", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: {
        ...mockArtistProfile,
        topTracks: mockArtistProfile.topTracks.slice(0, 1),
      },
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );

  const topTracks = markup.slice(markup.indexOf("[ TOP TRACKS ]"), markup.indexOf("[ TOP ALBUMS ]"));
  assert.equal(topTracks.match(/data-profile-placeholder/g)?.length ?? 0, 4);
  assert.match(topTracks, /--box-h:275px/);

  const topAlbums = markup.slice(markup.indexOf("[ TOP ALBUMS ]"));
  assert.equal(topAlbums.match(/data-profile-placeholder/g)?.length ?? 0, 3);
  assert.match(topAlbums, /--box-h:220px/);
});

test("ProfileBox: Album with 3 top Tracks renders 7 placeholders in TOP TRACKS and no MORE BY", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: {
        ...mockAlbumProfile,
        topTracks: [
          ...mockAlbumProfile.topTracks,
          { id: "track-3", name: "Nude", plays: 8, albumImageUrl: null },
        ],
        moreAlbums: [
          { key: "kid-a-key", name: "Kid A", plays: 31, imageUrl: null },
        ],
      },
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );

  assert.doesNotMatch(markup, /MORE BY/);
  const topTracks = markup.slice(markup.indexOf("[ TOP TRACKS ]"));
  assert.equal(topTracks.match(/data-profile-placeholder/g)?.length ?? 0, 7);
  assert.match(topTracks, /--box-h:320px/);
  const recent = markup.slice(markup.indexOf("[ RECENT PLAYS ]"), markup.indexOf("[ TOP TRACKS ]"));
  assert.match(recent, /--box-h:320px/);
});

test("ProfileBox: Track with empty relatedTracks renders [ OFTEN PLAYED WITH ] and 5 placeholders", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: {
        ...mockTrackProfile,
        relatedTracks: [],
      },
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );

  assert.match(markup, /\[ OFTEN PLAYED WITH \]/);
  const related = markup.slice(markup.indexOf("[ OFTEN PLAYED WITH ]"));
  assert.equal(related.match(/data-profile-placeholder/g)?.length ?? 0, 5);
  assert.match(related, /--box-h:160px/);
  const fromAlbum = markup.slice(markup.indexOf("[ FROM THIS ALBUM ]"), markup.indexOf("[ OFTEN PLAYED WITH ]"));
  assert.match(fromAlbum, /--box-h:160px/);
  // 5 + 1 heading row + 5 = 11 rows, so both columns end level.
  const recent = markup.slice(markup.indexOf("[ RECENT PLAYS ]"), markup.indexOf("[ FROM THIS ALBUM ]"));
  assert.match(recent, /--box-h:352px/);
});

test("ProfileView: Artist recent plays show day label inside first row of each day without separate day-group headers", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: {
        ...mockArtistProfile,
        recentPlays: [
          {
            ...mockArtistProfile.recentPlays[0],
            id: "play-1",
            playedAt: "2024-11-18T18:30:00.000Z",
            title: "Weird Fishes / Arpeggi",
          },
          {
            ...mockArtistProfile.recentPlays[0],
            id: "play-2",
            playedAt: "2024-11-18T17:15:00.000Z",
            title: "Reckoner",
          },
          {
            ...mockArtistProfile.recentPlays[0],
            id: "play-3",
            playedAt: "2024-11-17T21:00:00.000Z",
            title: "Nude",
          },
        ],
      },
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );

  const recent = markup.slice(markup.indexOf("[ RECENT PLAYS ]"), markup.indexOf("[ TOP TRACKS ]"));
  assert.doesNotMatch(recent, /border-\[#1C1C1A\]/);
  assert.match(recent, /<button[^>]*aria-label="Open Track profile for Weird Fishes \/ Arpeggi"[^>]*>(?:(?!<\/button>).)*>18 NOV<(?:(?!<\/button>).)*>18:30</);
  const reckonerButton = recent.match(/<button[^>]*aria-label="Open Track profile for Reckoner"[^>]*>.*?<\/button>/)?.[0] ?? "";
  assert.ok(reckonerButton.length > 0);
  assert.doesNotMatch(reckonerButton, /18 NOV/);
  assert.match(reckonerButton, /17:15/);
  assert.match(recent, /<button[^>]*aria-label="Open Track profile for Nude"[^>]*>(?:(?!<\/button>).)*>17 NOV<(?:(?!<\/button>).)*>21:00</);
  assert.equal(recent.match(/data-profile-placeholder/g)?.length ?? 0, 7);
});

test("ProfileBox: mobileLimit collapses extra rows with static selector and renders SHOW ALL toggle", () => {
  const topTracks = Array.from({ length: 6 }, (_, i) => ({
    id: `track-${i + 1}`,
    name: `Track ${i + 1}`,
    plays: 20 - i,
    albumImageUrl: null,
  }));

  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: {
        ...mockArtistProfile,
        topTracks,
      },
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );

  const topTracksSection = markup.slice(markup.indexOf("[ TOP TRACKS ]"), markup.indexOf("[ TOP ALBUMS ]"));
  assert.match(topTracksSection, /max-md:\[&amp;&gt;\[data-mobile-collapsed\]\]:hidden/);
  assert.equal(topTracksSection.match(/data-mobile-collapsed="true"/g)?.length ?? 0, 2);
  assert.match(topTracksSection, /SHOW ALL 6/);
});

test("ProfileView: Track renders all relatedTracks without slice(0, 4) cap", () => {
  const relatedTracks = Array.from({ length: 6 }, (_, i) => ({
    id: `rel-${i + 1}`,
    name: `Related ${i + 1}`,
    artist: "Radiohead",
    albumImageUrl: null,
    coPlays: 10 - i,
  }));

  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: {
        ...mockTrackProfile,
        relatedTracks,
      },
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );

  const related = markup.slice(markup.indexOf("[ OFTEN PLAYED WITH ]"));
  assert.match(related, /Related 5/);
  assert.match(related, /Related 6/);
  assert.equal(related.match(/data-profile-placeholder/g)?.length ?? 0, 0);
});

test("ProfileView keeps a reloading profile visible, dimmed, busy and blocked to input", () => {
  const reloading = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: mockArtistProfile,
      status: "loading",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );
  const rootTag = reloading.slice(0, reloading.indexOf(">") + 1);
  assert.match(rootTag, /opacity-60/);
  assert.match(rootTag, /pointer-events-none/);
  assert.match(rootTag, /aria-busy="true"/);
  assert.match(reloading, /\[ ARTIST \]/);
  assert.doesNotMatch(reloading, /LOADING|SEARCHING/);

  const ready = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: mockArtistProfile,
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );
  const readyRoot = ready.slice(0, ready.indexOf(">") + 1);
  assert.doesNotMatch(readyRoot, /pointer-events-none|aria-busy="true"|opacity-60/);
});
