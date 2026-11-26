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
  granularity: "day",
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
      date: "01 Nov",
      isMarker: true,
      markerLabel: "01 Nov",
    },
    {
      startTime: "2024-11-02T00:00:00.000Z",
      endTime: "2024-11-03T00:00:00.000Z",
      count: 10,
      date: "02 Nov",
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
  granularity: "day",
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
      date: "01 Nov",
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

  assert.match(markup, />Album</);
  assert.match(markup, /<a href="https:\/\/open\.spotify\.com\/album\/5vkqYmiPBYLaalcmjujWxK" target="_blank" rel="noopener noreferrer"[^>]*><span[^>]*>In Rainbows<\/span>/);
  assert.match(markup, /w-\[88px\]|width="88"/);
  assert.match(markup, /Artist · <\/span><button[^>]*>Radiohead<\/button>/);
  assert.match(markup, />Over time</);
  assert.match(markup, />Share of plays</);
  assert.match(markup, />Top tracks</);
  assert.match(markup, /w-\[34px\][^>]*>50%<\/span>/);
  assert.match(markup, />Recent plays</);
  assert.doesNotMatch(markup, />Album stats</);
  assert.match(markup, /Artist share.*?50%/);
  assert.match(markup, /Tracks heard.*?8 \/ 10/);
  assert.match(markup, /Full-album sessions.*?3/);
  assert.doesNotMatch(markup, /MORE BY/);
  assert.doesNotMatch(markup, /Kid A/);

  const recentPlays = markup.slice(markup.indexOf(">Recent plays<"), markup.indexOf(">Top tracks<"));
  assert.match(recentPlays, /aria-label="Open Track profile for Weird Fishes \/ Arpeggi"/);
  assert.match(recentPlays, /h-8/);
  assert.match(recentPlays, /5:18/);
  assert.doesNotMatch(recentPlays, /<img/);
  assert.doesNotMatch(recentPlays, />In Rainbows</);

  const topTracks = markup.slice(markup.indexOf(">Top tracks<"));
  assert.doesNotMatch(topTracks, /<img/);
  assert.match(topTracks, /md:h-\(--box-h\)/);
  assert.match(topTracks, /overflow-y-auto scrollbar-hidden/);
  assert.match(topTracks, /h-8/);

  assert.doesNotMatch(markup, />Top albums<|>Share of Radiohead</);

  const groupKeyMarkup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      ...props,
      data: { ...mockAlbumProfile, key: "radiohead::in rainbows", artistKey: undefined },
    })
  );
  assert.match(groupKeyMarkup, />In Rainbows</);
  assert.match(groupKeyMarkup, /Artist · <\/span>Radiohead/);
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
  const albumRows = keyedArtist.slice(keyedArtist.indexOf(">Top albums<"));
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
  assert.match(keyedTrack, /Album · <\/span><button[^>]*>In Rainbows<\/button>/);
  assert.match(unkeyedTrack, /Album · <\/span>In Rainbows<\/div>/);
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

  assert.match(markup, />Artist</);
  assert.match(markup, /w-\[88px\]|width="88"/);
  assert.match(markup, /<a href="https:\/\/open\.spotify\.com\/artist\/4Z8W4fKeB5YxbusRsdQVPb" target="_blank" rel="noopener noreferrer"[^>]*><span[^>]*>Radiohead<\/span>/);
  assert.ok(markup.includes(">Over time<"), "Chart must use Over time toggle heading");
  assert.doesNotMatch(markup, />Plays<\/div>|When it plays|Plays \/ 1m/);
  assert.ok(markup.includes('role="img"'), "Chart must retain role=img accessibility attribute");
  assert.ok(
    markup.includes('aria-label="Activity cadence histogram"'),
    "Chart must retain aria-label"
  );
  assert.match(markup, /<button[^>]*aria-label="Open Track profile for Weird Fishes \/ Arpeggi"/);
  assert.ok(markup.includes(">Recent plays<"), "Must render Recent plays section");
  assert.ok(markup.includes("Weird Fishes / Arpeggi"), "Must render recent play title");
  assert.ok(markup.includes("In Rainbows"), "Must render album name for artist profile");
  assert.ok(markup.includes("18:30"), "Must render formatted play time in UTC");
  assert.match(markup, />Share of plays</);
  assert.match(markup, /<button type="button"[^>]*class="[^"]*text-music-accent[^"]*"[^>]*>Over time<span class="sr-only">, switch to plays by hour<\/span><\/button>/);
  assert.doesNotMatch(markup, /By hour|aria-pressed/);
  assert.match(markup, /<div class="min-w-0 md:col-span-full">(?:(?!<\/div>).)*?>Share of plays</);
  assert.ok(markup.indexOf(">Share of plays<") < markup.indexOf(">Top tracks<"));
  assert.match(markup, /title="Other tracks"/);
  assert.match(markup, /w-\[34px\][^>]*>50%<\/span>/);
  assert.match(markup, /w-\[34px\][^>]*>34%<\/span>/);
  assert.ok(markup.indexOf(">Share of plays<") < markup.indexOf(">Recent plays<"));
  assert.ok(markup.includes(">Top tracks<"), "Artist profile must render Top tracks");
  assert.ok(markup.includes("Reckoner"), "Must render top Track Reckoner");
  assert.match(markup, /<button type="button" (?!role="listitem")[^>]*>.*?Reckoner.*?<\/button>/);
  assert.doesNotMatch(markup, /<button[^>]*role="listitem"/);
  assert.ok(markup.includes(">Top albums<"), "Artist profile must render Top albums");
  assert.doesNotMatch(markup, />Artist stats<|PEAK DAY/);
  assert.match(markup, /Listening time.*?4h/);
  assert.match(markup, /Active days.*?18/);
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

  assert.match(markup, />Track</);
  assert.ok(markup.includes("Weird Fishes / Arpeggi"), "Must include track title");
  assert.ok(markup.includes("Radiohead"), "Must include artist name");
  assert.ok(markup.includes("In Rainbows"), "Must include album name");
  assert.match(markup, /<a href="https:\/\/open\.spotify\.com\/track\/4clD00s1c0rVqP9Ld0vV48" target="_blank" rel="noopener noreferrer"[^>]*><span[^>]*>Weird Fishes \/ Arpeggi<\/span>/);
  assert.doesNotMatch(markup, /SPOTIFY ↗|BEST MONTH|<dt/);
  assert.match(markup, />Share of Radiohead</);
  assert.match(markup, /50% · 25 plays/);
  assert.match(markup, /of 50/);
  assert.doesNotMatch(markup, />Track stats</);
  assert.match(markup, /Completion.*?92%/);
  assert.match(markup, /Album share.*?63%/);
  assert.match(markup, /Longest streak: 5 days \(Nov 13–17, 2024\)/);
  assert.match(markup, />Often played with</);
  assert.match(markup, /Nude.*?Radiohead.*?7×/);
  assert.match(markup, /<div class="min-w-0 md:col-span-full">(?:(?!<\/div>).)*?>Share of Radiohead</);
  assert.ok(markup.indexOf("Share of Radiohead") < markup.indexOf("From this album"));
  assert.match(markup, /From this album/);
  assert.equal(markup.match(/aria-current="true"/g)?.length, 1);
  assert.match(markup, /<div[^>]*aria-current="true"[^>]*>.*?text-music-accent[^>]*>Weird Fishes \/ Arpeggi/);
  assert.match(markup, /<button[^>]*>(?:(?!<\/button>).)*House of Cards.*?<\/button>/);
  assert.match(markup, /w-\[88px\]|width="88"/);
  assert.match(markup, /Artist · <\/span><button[^>]*>Radiohead<\/button>/);
  assert.doesNotMatch(markup, /FIRST PLAYED|LAST PLAYED|LIFETIME/);

  const fromAlbum = markup.slice(markup.indexOf("From this album"), markup.indexOf("Often played with"));
  assert.doesNotMatch(fromAlbum, /<img/);
  assert.match(fromAlbum, /md:h-\(--box-h\)/);
  assert.match(fromAlbum, /overflow-y-auto scrollbar-hidden/);
  assert.match(fromAlbum, /h-8/);

  const recent = markup.slice(markup.indexOf("Recent plays"), markup.indexOf("From this album"));
  assert.doesNotMatch(recent, /<img|Weird Fishes/);
  assert.ok(recent.includes("12:30"), "Must format recent play time in America/Chicago");
  assert.ok(recent.includes("5:10"), "Must render full play duration");
  assert.ok(recent.includes("2:00"), "Must render partial play duration");
  assert.ok(recent.includes("Partial"), "Must tag partial plays");
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

  assert.match(markup, />Over time<.*?Activity cadence histogram/);
  assert.doesNotMatch(markup, /Longest streak/);
  const recent = markup.slice(markup.indexOf("Recent plays"), markup.indexOf("From this album"));
  assert.doesNotMatch(recent, /0:00|Partial/);
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
        date: "01 Nov",
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
  assert.ok(markup.includes(">Plays<"), "Must keep chart header");
  assert.ok(markup.includes('role="img"'), "Must retain chart img role");
  assert.equal(markup.split(">No plays in this range<").length - 1, 1);
  assert.ok(
    !markup.includes(">Recent plays<"),
    "Must NOT render Recent plays header when plays === 0"
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
  assert.match(trackSkeleton, />From this album</);
  assert.match(trackSkeleton, />Often played with</);
  assert.doesNotMatch(trackSkeleton, />Track stats</);

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
  assert.match(artistSkeleton, />Top tracks</);
  assert.match(artistSkeleton, />Top albums</);
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

  assert.ok(notFoundMarkup.includes(">Not in archive<"), "Must display Not in archive");

  const errorMarkup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: null,
      status: "error",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );

  assert.ok(
    errorMarkup.includes(">Couldn&#x27;t load profile<") ||
      errorMarkup.includes("Couldn't load profile"),
    "Must display Couldn't load profile"
  );
});

test("ActivityChart: default label is ACTIVITY and accessible semantics preserved", () => {
  const defaultMarkup = renderToStaticMarkup(
    React.createElement(ActivityChart, {
      granularity: "hour",
      rangeKey: "1d",
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

  assert.ok(defaultMarkup.includes(">Activity / 1d<"), "Default label must be Activity");
  assert.ok(defaultMarkup.includes('role="img"'), "Chart container must have role=img");
  assert.ok(
    defaultMarkup.includes('aria-label="Activity cadence histogram"'),
    "Chart container must have aria-label"
  );
  assert.ok(defaultMarkup.includes("-24h"), "1d range must render -24h marker");
  assert.ok(defaultMarkup.includes("Now"), "1d range must render Now marker");
});

test("ActivityChart: window payload uses rangeLabel and bucket dates without relative ticks", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ActivityChart, {
      granularity: "hour",
      rangeLabel: "Nov 3, 2025",
      activityCadence: [
        {
          startTime: "2025-11-03T00:00:00.000Z",
          endTime: "2025-11-03T00:59:59.999Z",
          count: 2,
          date: "00:00",
        },
        {
          startTime: "2025-11-03T12:00:00.000Z",
          endTime: "2025-11-03T12:59:59.999Z",
          count: 5,
          date: "12:00",
        },
        {
          startTime: "2025-11-03T23:00:00.000Z",
          endTime: "2025-11-03T23:59:59.999Z",
          count: 1,
          date: "23:00",
        },
      ],
      isLoading: false,
    })
  );

  assert.ok(markup.includes(">Activity / Nov 3, 2025<"), "Heading must include rangeLabel");
  assert.ok(markup.includes("<span>00:00</span>"), "Window axis must include start date span");
  assert.ok(markup.includes("<span>12:00</span>"), "Window axis must include middle date span");
  assert.ok(markup.includes("<span>23:00</span>"), "Window axis must include end date span");
  assert.ok(markup.includes("00:00"), "Window axis must include start date");
  assert.ok(markup.includes("12:00"), "Window axis must include middle date");
  assert.ok(markup.includes("23:00"), "Window axis must include end date");
  assert.ok(!markup.includes("-24h"), "Window axis must not include relative ticks");
  assert.ok(!markup.includes("Now"), "Window axis must not include Now");
});

test("ProfileView always renders From this album for a single ranked Track with placeholder rows", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: { ...mockTrackProfile, albumTracks: mockTrackProfile.albumTracks?.slice(0, 1) },
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );
  assert.match(markup, />From this album</);
  const fromAlbum = markup.slice(markup.indexOf(">From this album<"), markup.indexOf(">Often played with<"));
  assert.equal(fromAlbum.match(/data-profile-placeholder/g)?.length ?? 0, 4);
  assert.match(markup, />Over time</);
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
  assert.match(markup, /No plays in this range/);
  assert.match(markup, /Weird Fishes/);
  assert.doesNotMatch(markup, /Longest streak|When it plays|Over time|Share of|From this album|Recent plays/);
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
  const recent = markup.slice(markup.indexOf(">Recent plays<"), markup.indexOf(">From this album<"));
  assert.equal(recent.match(/>18 Nov</g)?.length ?? 0, 1);
  assert.equal(recent.match(/data-profile-placeholder/g)?.length ?? 0, 5);

  const fromAlbum = markup.slice(markup.indexOf(">From this album<"), markup.indexOf(">Often played with<"));
  assert.equal(fromAlbum.match(/data-profile-placeholder/g)?.length ?? 0, 5);

  const related = markup.slice(markup.indexOf(">Often played with<"));
  assert.equal(related.match(/data-profile-placeholder/g)?.length ?? 0, 5);
});

test("ProfileHeader: Artist markup contains PLAYS, RANK, Listening time, Active days, Play share, Tracks heard, Completion and no PEAK DAY", () => {
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

  assert.match(markup, /Plays/);
  assert.match(markup, /Rank/);
  assert.match(markup, /Listening time/);
  assert.match(markup, /Active days/);
  assert.match(markup, /Play share/);
  assert.match(markup, /25%/);
  assert.match(markup, /Tracks heard/);
  assert.match(markup, /12 \/ 20/);
  assert.match(markup, /Completion/);
  assert.match(markup, /88%/);
  assert.doesNotMatch(markup, /PEAK DAY/);
  assert.doesNotMatch(markup, />Artist stats</);
});

test("ProfileHeader: Album markup contains Full-album sessions; Track markup contains Album share but not Play share", () => {
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

  assert.match(albumMarkup, /Full-album sessions/);
  assert.match(albumMarkup, /Artist share/);
  assert.doesNotMatch(albumMarkup, />Album stats</);

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

  assert.match(trackMarkup, /Album share/);
  assert.match(trackMarkup, /Completion/);
  assert.doesNotMatch(trackMarkup, /Play share/);
  assert.doesNotMatch(trackMarkup, />Track stats</);
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

  assert.match(percentileMarkup, /Top 2%/);
  assert.match(percentileMarkup, /aria-label="Rank Top 2%\. Toggle between rank position and percentile"/);
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
  assert.doesNotMatch(markup, /First play 15 Jan 2024 · LAST/);
  const statsStart = markup.indexOf("data-profile-stats");
  assert.ok(statsStart > markup.indexOf("Radiohead"), "stats row renders after the title");
  const statsRow = markup.slice(statsStart, markup.indexOf(">Over time<"));
  assert.match(statsRow, /Plays.*Rank.*Listening time.*Active days.*First play<\/span><span[^>]*>15 Jan 2024<\/span>.*Last play<\/span><span[^>]*>18 Nov 2024<\/span>/);
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

  const topTracks = markup.slice(markup.indexOf(">Top tracks<"), markup.indexOf(">Top albums<"));
  assert.equal(topTracks.match(/data-profile-placeholder/g)?.length ?? 0, 4);
  assert.match(topTracks, /--box-h:275px/);

  const topAlbums = markup.slice(markup.indexOf(">Top albums<"));
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
  const topTracks = markup.slice(markup.indexOf(">Top tracks<"));
  assert.equal(topTracks.match(/data-profile-placeholder/g)?.length ?? 0, 7);
  assert.match(topTracks, /--box-h:320px/);
  const recent = markup.slice(markup.indexOf(">Recent plays<"), markup.indexOf(">Top tracks<"));
  assert.match(recent, /--box-h:320px/);
});

test("ProfileBox: Track with empty relatedTracks renders Often played with and 5 placeholders", () => {
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

  assert.match(markup, />Often played with</);
  const related = markup.slice(markup.indexOf(">Often played with<"));
  assert.equal(related.match(/data-profile-placeholder/g)?.length ?? 0, 5);
  assert.match(related, /--box-h:160px/);
  const fromAlbum = markup.slice(markup.indexOf(">From this album<"), markup.indexOf(">Often played with<"));
  assert.match(fromAlbum, /--box-h:160px/);
  // 5 + 1 heading row + 5 = 11 rows, so both columns end level.
  const recent = markup.slice(markup.indexOf(">Recent plays<"), markup.indexOf(">From this album<"));
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

  const recent = markup.slice(markup.indexOf(">Recent plays<"), markup.indexOf(">Top tracks<"));
  assert.doesNotMatch(recent, /border-\[#1C1C1A\]/);
  assert.match(recent, /<button[^>]*aria-label="Open Track profile for Weird Fishes \/ Arpeggi"[^>]*>(?:(?!<\/button>).)*>18 Nov<(?:(?!<\/button>).)*>18:30</);
  const reckonerButton = recent.match(/<button[^>]*aria-label="Open Track profile for Reckoner"[^>]*>.*?<\/button>/)?.[0] ?? "";
  assert.ok(reckonerButton.length > 0);
  assert.doesNotMatch(reckonerButton, /18 Nov/);
  assert.match(reckonerButton, /17:15/);
  assert.match(recent, /<button[^>]*aria-label="Open Track profile for Nude"[^>]*>(?:(?!<\/button>).)*>17 Nov<(?:(?!<\/button>).)*>21:00</);
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

  const topTracksSection = markup.slice(markup.indexOf(">Top tracks<"), markup.indexOf(">Top albums<"));
  assert.match(topTracksSection, /max-md:\[&amp;&gt;\[data-mobile-collapsed\]\]:hidden/);
  assert.equal(topTracksSection.match(/data-mobile-collapsed="true"/g)?.length ?? 0, 2);
  assert.match(topTracksSection, /Show all 6/);
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

  const related = markup.slice(markup.indexOf(">Often played with<"));
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
  assert.match(reloading, />Artist</);
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

test("ProfileView loading skeleton includes entry animation, share-bar placeholder, and reserved stats height", () => {
  const skeleton = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: null,
      status: "loading",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
      pendingKind: "artist",
    })
  );

  const rootTag = skeleton.slice(0, skeleton.indexOf(">") + 1);
  assert.doesNotMatch(rootTag, /animate-view-enter/, "views and their content appear without a fade");
  assert.match(skeleton, /\bmin-h-\[168px\]/, "Stats/streak skeleton block must reserve mobile min-h");
  assert.match(skeleton, /\bmd:min-h-\[80px\]/, "Stats/streak skeleton block must reserve desktop min-h");
  assert.match(skeleton, /h-\[10px\] w-full bg-\[#191917\] animate-pulse/, "Skeleton must include 10px share-bar placeholder");
});

test("ProfileView ready markup applies view/content enter, focus-ring, press, and hit-area classes", () => {
  const artistMarkup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: mockArtistProfile,
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );

  const rootTag = artistMarkup.slice(0, artistMarkup.indexOf(">") + 1);
  assert.doesNotMatch(rootTag, /animate-view-enter/, "views and their content appear without a fade");
  assert.doesNotMatch(artistMarkup, /animate-content-enter/, "views and their content appear without a fade");
  assert.doesNotMatch(artistMarkup, /focus-visible:bg-\[#111110\]/, "Profile rows must use focus-ring instead of bare focus-visible:bg");

  const toggleBtn = artistMarkup.match(/<button\b[^>]*title="Click to switch chart view"[^>]*>/)?.[0] ?? "";
  assert.ok(toggleBtn, "ProfileChart toggle button must render");
  assert.match(toggleBtn, /\bfocus-ring\b/);
  assert.match(toggleBtn, /\bpress\b/);
  assert.match(toggleBtn, /\bhit-area\b/);
  assert.doesNotMatch(toggleBtn, /\bfocus-visible:outline-none\b/);

  const trackMarkup = renderToStaticMarkup(
    React.createElement(ProfileView, {
      data: { ...mockTrackProfile, albumKey: "radiohead::in rainbows" },
      status: "ready",
      visitorTimezone: "UTC",
      onOpenProfile: () => {},
    })
  );
  const artistLinkBtn = trackMarkup.match(/Artist · <\/span>(<button\b[^>]*>)/)?.[1] ?? "";
  assert.ok(artistLinkBtn, "ProfileHeader Artist button must render");
  assert.match(artistLinkBtn, /\bfocus-ring\b/);
  assert.match(artistLinkBtn, /\bhit-area\b/);

  const albumLinkBtn = trackMarkup.match(/Album · <\/span>(<button\b[^>]*>)/)?.[1] ?? "";
  assert.ok(albumLinkBtn, "ProfileHeader Album button must render");
  assert.match(albumLinkBtn, /\bfocus-ring\b/);
  assert.match(albumLinkBtn, /\bhit-area\b/);
});
