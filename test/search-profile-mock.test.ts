import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../src/lib/mock/catalog';
import { ALL_MOCK_STREAM_LOG_ENTRIES } from '../src/lib/mock/stream-log';
import { getMockSearch, getMockProfile, getMockRandomProfileTarget } from '../src/lib/mock/search-profile';
import {
  SEARCH_TRACK_ROWS,
  SEARCH_SIDE_ROWS,
  SEARCH_SINGLE_TYPE_ROWS,
  PROFILE_ALBUM_PROFILE_TRACKS_LIMIT,
  PROFILE_RELATED_TRACKS_LIMIT,
  PROFILE_MORE_ALBUMS_LIMIT,
} from '../src/lib/search-types';
import { computeSearchTotalPages } from '../src/lib/search-layout';
import { countFullAlbumSessions } from '../src/lib/profile-stats';

test('getMockSearch matches query against tracks and artists with ranking and limits', () => {
  const res = getMockSearch('radio');

  assert.equal(res.query, 'radio');
  assert.ok(res.artists.length > 0 && res.artists.length <= 8);
  assert.ok(res.tracks.length > 0 && res.tracks.length <= 8);

  // First artist is Radiohead
  assert.equal(res.artists[0].name, 'Radiohead');
  assert.equal(res.artists[0].key, CATALOG.radiohead_weird_fishes.artistId);
  assert.ok(res.artists[0].imageUrl);

  // Tracks are all Radiohead
  for (const track of res.tracks) {
    assert.equal(track.artist, 'Radiohead');
  }

  // Plays are non-increasing (plays DESC)
  for (let i = 1; i < res.artists.length; i++) {
    assert.ok(res.artists[i - 1].plays >= res.artists[i].plays);
  }
  for (let i = 1; i < res.tracks.length; i++) {
    assert.ok(res.tracks[i - 1].plays >= res.tracks[i].plays);
  }
});

test('getMockSearch normalizes full-width characters matching ASCII search', () => {
  const asciiRes = getMockSearch('radio');
  const fullWidthRes = getMockSearch('ＲＡＤＩＯ');

  assert.equal(asciiRes.query, 'radio');
  assert.equal(fullWidthRes.query, 'ＲＡＤＩＯ');
  assert.deepEqual(fullWidthRes.artists, asciiRes.artists);
  assert.deepEqual(fullWidthRes.tracks, asciiRes.tracks);
  assert.deepEqual(fullWidthRes.albums, asciiRes.albums);
});

test('getMockProfile for track provides all-time counts, lifetime bounds, and recent plays', () => {
  const weirdFishesId = CATALOG.radiohead_weird_fishes.id;
  const expectedTotalPlays = ALL_MOCK_STREAM_LOG_ENTRIES.filter(
    (e) => e.title === 'Weird Fishes / Arpeggi'
  ).length;

  const allProfile = getMockProfile(
    { kind: 'track', key: weirdFishesId },
    'all',
    'UTC'
  );
  assert.ok(allProfile);
  assert.equal(allProfile.kind, 'track');
  assert.equal(allProfile.key, weirdFishesId);
  assert.equal(allProfile.name, 'Weird Fishes / Arpeggi');
  assert.equal(allProfile.artistName, 'Radiohead');
  assert.equal(allProfile.albumName, 'In Rainbows');
  assert.equal(allProfile.imageUrl, CATALOG.radiohead_weird_fishes.albumImageUrl);
  assert.equal(allProfile.plays, expectedTotalPlays);
  assert.ok(allProfile.rankedTotal > 0);
  assert.ok(allProfile.rank !== null && allProfile.rank >= 1);

  // Recent plays in range, newest first, bounded by limit
  assert.ok(allProfile.recentPlays.length > 0 && allProfile.recentPlays.length <= 20);
  assert.equal(allProfile.recentPlays.length, expectedTotalPlays);
  for (let i = 1; i < allProfile.recentPlays.length; i++) {
    const prev = new Date(allProfile.recentPlays[i - 1].playedAt).getTime();
    const curr = new Date(allProfile.recentPlays[i].playedAt).getTime();
    assert.ok(prev >= curr, 'Recent plays must be ordered newest first');
  }

  // Lifetime bounds remain unchanged regardless of active range window
  const oneDayProfile = getMockProfile(
    { kind: 'track', key: weirdFishesId },
    '1d',
    'UTC'
  );
  assert.ok(oneDayProfile);
  assert.equal(oneDayProfile.firstPlayedAt, allProfile.firstPlayedAt);
  assert.equal(oneDayProfile.lastPlayedAt, allProfile.lastPlayedAt);
  assert.equal(oneDayProfile.plays, 1);
  assert.equal(oneDayProfile.recentPlays.length, 1);
});

test('getMockProfile activityCadence matches buildActivityCadence buckets and range plays', () => {
  const radioheadId = CATALOG.radiohead_weird_fishes.artistId;
  // The mock anchor is newest play + 1 minute, never on an hour or day boundary,
  // so buildActivityCadence adds the partial leading bucket (25 hours, 8 days, 31 days).
  const expectedLengths: Record<string, number> = { '1d': 25, '1w': 32, '1m': 31 };
  for (const range of ['1d', '1w', '1m', '6m', '1y', 'all'] as const) {
    for (const tz of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles']) {
      const profile = getMockProfile({ kind: 'artist', key: radioheadId }, range, tz);
      assert.ok(profile);
      if (expectedLengths[range]) {
        assert.equal(profile.activityCadence.length, expectedLengths[range], `${range} ${tz} length`);
      }
      const total = profile.activityCadence.reduce((sum, b) => sum + b.count, 0);
      assert.equal(total, profile.plays, `${range} ${tz} cadence total equals plays in range`);
    }
  }
});

test('getMockProfile separates artist top lists from track profiles', () => {
  const artistId = CATALOG.radiohead_weird_fishes.artistId;
  const trackId = CATALOG.radiohead_weird_fishes.id;

  const artistProfile = getMockProfile(
    { kind: 'artist', key: artistId },
    'all',
    'UTC'
  );
  assert.ok(artistProfile);
  assert.equal(artistProfile.kind, 'artist');
  assert.equal(artistProfile.name, 'Radiohead');
  assert.equal(artistProfile.artistName, null);
  assert.equal(artistProfile.albumName, null);
  assert.ok(artistProfile.imageUrl);
  assert.ok(artistProfile.topTracks.length > 0 && artistProfile.topTracks.length <= 10);
  assert.ok(artistProfile.topAlbums.length > 0 && artistProfile.topAlbums.length <= 5);

  const trackProfile = getMockProfile(
    { kind: 'track', key: trackId },
    'all',
    'UTC'
  );
  assert.ok(trackProfile);
  assert.deepEqual(trackProfile.topTracks, []);
  assert.deepEqual(trackProfile.topAlbums, []);
});

test('getMockProfile returns null for unknown targets', () => {
  assert.equal(
    getMockProfile({ kind: 'track', key: 'nonexistent_track_id' }, 'all', 'UTC'),
    null
  );
  assert.equal(
    getMockProfile({ kind: 'artist', key: 'nonexistent_artist_id' }, 'all', 'UTC'),
    null
  );
});

test('empty search pages through the catalog with global sort order', () => {
  const first = getMockSearch('');
  const next = getMockSearch('', 'most-plays', 2);
  const least = getMockSearch('', 'least-plays');
  assert.ok(first.tracks.length > 0 && next.tracks.length > 0);
  assert.ok(first.tracks.every(track => !next.tracks.some(other => other.id === track.id)));
  assert.ok(first.tracks.at(-1)!.plays >= next.tracks[0].plays);
  assert.ok(least.tracks[0].plays < first.tracks[0].plays);

  for (const sort of ['recent', 'oldest'] as const) {
    const data = getMockSearch('', sort);
    for (const kind of ['track', 'artist', 'album'] as const) {
      const keys =
        kind === 'track'
          ? data.tracks.map((row) => row.id)
          : kind === 'artist'
            ? data.artists.map((row) => row.key)
            : data.albums.map((row) => row.key);
      const dates = keys.map((key) => Date.parse(getMockProfile({ kind, key }, 'all', 'UTC')!.lastPlayedAt!));
      assert.ok(dates.length > 1);
      assert.ok(dates.every((date, index) => index === 0 ||
        (sort === 'recent' ? date <= dates[index - 1] : date >= dates[index - 1])));
    }
  }
});

test("All profile cadence includes monthly counts", () => {
  const track = getMockSearch("").tracks[0];
  const profile = getMockProfile({ kind: "track", key: track.id }, "all", "America/Chicago")!;
  assert.ok(profile.artistKey);
  assert.equal(profile.monthlyCadence?.reduce((sum, month) => sum + month.count, 0), profile.plays);
  assert.equal(profile.activityCadence.reduce((sum, year) => sum + year.count, 0), profile.plays);
});

test("Track stats and album siblings follow the profile range and timezone", () => {
  const track = getMockSearch("").tracks[0];
  const target = { kind: "track", key: track.id } as const;
  const utc = getMockProfile(target, "all", "UTC")!;
  const tokyo = getMockProfile(target, "all", "Asia/Tokyo")!;
  assert.ok(utc.trackStats);
  assert.ok(utc.hourOfDay && tokyo.hourOfDay);
  assert.equal(utc.hourOfDay.length, 24);
  assert.equal(utc.hourOfDay.reduce((sum, count) => sum + count, 0), utc.plays);
  assert.deepEqual(tokyo.hourOfDay, [...utc.hourOfDay.slice(15), ...utc.hourOfDay.slice(0, 15)]);
  assert.notDeepEqual(tokyo.hourOfDay, utc.hourOfDay);
  assert.ok(utc.trackStats.longestStreakDays >= 1);
  const sampledDays = new Set(utc.recentPlays.map((play) => play.playedAt.slice(0, 10)));
  assert.ok(utc.trackStats.longestStreakDays <= sampledDays.size + utc.plays - utc.recentPlays.length);
  assert.ok(utc.trackStats.artistPlays >= utc.plays);
  assert.ok(utc.trackStats.artistShare && utc.trackStats.artistShare <= 1);
  assert.ok(utc.albumTracks);
  assert.ok(utc.albumTracks.some((row) => row.id === track.id && row.isCurrent));
  assert.deepEqual(utc.albumTracks, [...utc.albumTracks].sort((a, b) =>
    b.plays - a.plays || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  ));

  const day = getMockProfile(target, "1d", "UTC")!;
  assert.ok(day.plays < utc.plays);
  assert.equal(day.hourOfDay?.reduce((sum, count) => sum + count, 0), day.plays);
});

test("Artist hours follow the timezone and match the Track share denominator", () => {
  const key = getMockSearch("").artists[0].key;
  const target = { kind: "artist", key } as const;
  const utc = getMockProfile(target, "all", "UTC")!;
  const tokyo = getMockProfile(target, "all", "Asia/Tokyo")!;
  assert.ok(utc.plays > 0);
  assert.ok(utc.hourOfDay && tokyo.hourOfDay);
  for (const counts of [utc.hourOfDay, tokyo.hourOfDay]) {
    assert.equal(counts.length, 24);
    assert.equal(counts.reduce((sum, count) => sum + count, 0), utc.plays);
  }
  assert.notDeepEqual(utc.hourOfDay, tokyo.hourOfDay);

  const track = getMockProfile({ kind: "track", key: utc.topTracks[0].id }, "all", "UTC");
  assert.equal(track?.trackStats?.artistPlays, utc.plays);
});

test("Artist hours are zero when the range has no Plays", () => {
  const artist = Object.values(CATALOG)
    .map(({ artistId: key }) => getMockProfile({ kind: "artist", key }, "1d", "UTC"))
    .find((profile) => profile?.plays === 0);
  assert.ok(artist);
  assert.deepEqual(artist.hourOfDay, Array(24).fill(0));
});

test('getMockSearch matches query against album name and artist and returns albums array', () => {
  const rainbowsRes = getMockSearch('In Rainbows');
  assert.ok(rainbowsRes.albums.length > 0);
  assert.equal(rainbowsRes.albums[0].name, 'In Rainbows');
  assert.equal(rainbowsRes.albums[0].artist, 'Radiohead');
  assert.equal(rainbowsRes.albums[0].key, CATALOG.radiohead_weird_fishes.albumId);
  assert.ok(rainbowsRes.albums[0].plays > 0);
  assert.ok(rainbowsRes.albums[0].imageUrl);

  const radioRes = getMockSearch('Radiohead');
  assert.ok(radioRes.artists.some((artist) => artist.name === 'Radiohead'));
  assert.ok(radioRes.albums.length > 0);
  assert.ok(radioRes.albums.every((album) => album.artist === 'Radiohead'));
});

test('getMockSearch limits tracks to SEARCH_TRACK_ROWS and side column to SEARCH_SIDE_ROWS', () => {
  const res = getMockSearch('', 'most-plays', 1);
  assert.ok(res.tracks.length > 0 && res.tracks.length <= SEARCH_TRACK_ROWS);
  assert.ok(res.artists.length > 0);
  assert.ok(res.albums.length > 0);
  assert.ok(res.artists.length + res.albums.length <= SEARCH_SIDE_ROWS);
});

test('getMockSearch album paging without duplicates and sort orders', () => {
  const albumKeys = new Set<string>();
  let hasMore = true;
  for (let page = 1; page <= 40 && hasMore; page++) {
    const result = getMockSearch('', 'most-plays', page);
    for (const album of result.albums) {
      assert.ok(!albumKeys.has(album.key), `Duplicate Album key ${album.key}`);
      albumKeys.add(album.key);
    }
    hasMore = result.hasMore;
  }
  assert.equal(hasMore, false);
  assert.ok(albumKeys.size > SEARCH_SIDE_ROWS);
  const firstAlbumKey = [...albumKeys][0];
  const firstAlbum = getMockProfile({ kind: 'album', key: firstAlbumKey }, 'all', 'UTC');
  assert.equal(albumKeys.size, firstAlbum?.rankedTotal);

  for (const sort of ['most-plays', 'least-plays'] as const) {
    const res = getMockSearch('', sort, 1);
    for (let i = 1; i < res.albums.length; i++) {
      if (sort === 'most-plays') {
        assert.ok(res.albums[i - 1].plays >= res.albums[i].plays);
      } else {
        assert.ok(res.albums[i - 1].plays <= res.albums[i].plays);
      }
    }
  }
});

test('getMockProfile for album round-trip from search, totals and topTracks sum', () => {
  const searchRes = getMockSearch('', 'most-plays', 1);
  assert.ok(searchRes.albums.length > 0);

  for (const albumItem of searchRes.albums) {
    const profile = getMockProfile({ kind: 'album', key: albumItem.key }, 'all', 'UTC');
    assert.ok(profile, `Profile should exist for album key ${albumItem.key}`);
    assert.equal(profile.kind, 'album');
    assert.equal(profile.key, albumItem.key);
    assert.equal(profile.name, albumItem.name);
    assert.equal(profile.artistName, albumItem.artist);
    assert.equal(profile.albumName, null);
    assert.deepEqual(profile.topAlbums, []);
    assert.ok(profile.plays > 0);
    assert.equal(profile.plays, albumItem.plays);
    assert.ok(profile.rankedTotal > 0);
    assert.ok(profile.rank !== null && profile.rank >= 1);
    assert.ok(profile.firstPlayedAt);
    assert.ok(profile.lastPlayedAt);
    assert.ok(profile.artistKey);

    // topTracks capped at PROFILE_ALBUM_PROFILE_TRACKS_LIMIT
    assert.ok(profile.topTracks.length > 0 && profile.topTracks.length <= PROFILE_ALBUM_PROFILE_TRACKS_LIMIT);
    // topTracks plays sum to profile.plays
    const topTracksPlaySum = profile.topTracks.reduce((sum, t) => sum + t.plays, 0);
    assert.equal(topTracksPlaySum, profile.plays, `topTracks sum should equal plays for ${profile.name}`);

    // hours of day sum to profile.plays
    assert.ok(profile.hourOfDay);
    assert.equal(profile.hourOfDay.length, 24);
    assert.equal(profile.hourOfDay.reduce((sum, c) => sum + c, 0), profile.plays);

    // activity cadence sums to profile.plays
    assert.equal(profile.activityCadence.reduce((sum, b) => sum + b.count, 0), profile.plays);
  }
});

test('Track profile gains albumKey and Artist topAlbums gain key preserving id', () => {
  const weirdFishesId = CATALOG.radiohead_weird_fishes.id;
  const trackProfile = getMockProfile({ kind: 'track', key: weirdFishesId }, 'all', 'UTC');
  assert.ok(trackProfile);
  assert.equal(trackProfile.albumKey, CATALOG.radiohead_weird_fishes.albumId);

  const artistId = CATALOG.radiohead_weird_fishes.artistId;
  const artistProfile = getMockProfile({ kind: 'artist', key: artistId }, 'all', 'UTC');
  assert.ok(artistProfile);
  assert.ok(artistProfile.topAlbums.length > 0);
  for (const topAlbum of artistProfile.topAlbums) {
    assert.ok(topAlbum.key, 'topAlbum must have key');
    assert.ok(topAlbum.id, 'topAlbum must preserve id');
  }
});

test('getMockProfile returns null for unknown album target', () => {
  assert.equal(
    getMockProfile({ kind: 'album', key: 'nonexistent_album_key' }, 'all', 'UTC'),
    null
  );
});

test('getMockSearch filter modes and totals/totalPages/hasMore', () => {
  const catalogEntries = Object.values(CATALOG);
  const streamTrackIds = new Set<string>();
  const streamArtistIds = new Set<string>();
  const streamAlbumKeys = new Set<string>();

  for (const entry of ALL_MOCK_STREAM_LOG_ENTRIES) {
    const catalogItem = catalogEntries.find(
      (c) => c.id === entry.trackId || (c.name === entry.title && c.artist === entry.artist),
    );
    const trackId = entry.trackId ?? catalogItem?.id ?? entry.id;
    const artistId = entry.artistId ?? catalogItem?.artistId ?? '';
    const albumId = entry.albumId ?? catalogItem?.albumId;
    const albumKey = albumId || `${entry.artist.toLowerCase().trim()}::${entry.album.toLowerCase().trim()}`;
    streamTrackIds.add(trackId);
    streamArtistIds.add(artistId);
    streamAlbumKeys.add(albumKey);
  }

  const expectedTotals = {
    tracks: streamTrackIds.size,
    artists: streamArtistIds.size,
    albums: streamAlbumKeys.size,
  };

  const allRes = getMockSearch('', 'most-plays', 1, 'all');
  assert.ok(allRes.totals);
  assert.deepEqual(allRes.totals, expectedTotals);
  assert.ok(allRes.totalPages !== undefined && allRes.totalPages >= 1);
  assert.equal(allRes.hasMore, 1 < allRes.totalPages);

  // Single-type tracks: exact size page 1 and page 2
  const tracksPage1 = getMockSearch('', 'most-plays', 1, 'tracks');
  const expectedTracksPage1 = Math.min(SEARCH_SINGLE_TYPE_ROWS, expectedTotals.tracks);
  assert.equal(tracksPage1.tracks.length, expectedTracksPage1);
  assert.deepEqual(tracksPage1.artists, []);
  assert.deepEqual(tracksPage1.albums, []);
  assert.deepEqual(tracksPage1.totals, expectedTotals);
  assert.equal(
    tracksPage1.totalPages,
    computeSearchTotalPages({
      filter: 'tracks',
      trackTotal: expectedTotals.tracks,
      artistTotal: expectedTotals.artists,
      albumTotal: expectedTotals.albums,
    }),
  );
  assert.equal(tracksPage1.hasMore, 1 < tracksPage1.totalPages!);

  const tracksPage2 = getMockSearch('', 'most-plays', 2, 'tracks');
  const expectedTracksPage2 = Math.min(
    SEARCH_SINGLE_TYPE_ROWS,
    Math.max(0, expectedTotals.tracks - SEARCH_SINGLE_TYPE_ROWS),
  );
  assert.equal(tracksPage2.tracks.length, expectedTracksPage2);
  assert.equal(tracksPage2.hasMore, 2 < tracksPage2.totalPages!);

  // Single-type artists: exact size page 1 and page 2
  const artistsPage1 = getMockSearch('', 'most-plays', 1, 'artists');
  const expectedArtistsPage1 = Math.min(SEARCH_SINGLE_TYPE_ROWS, expectedTotals.artists);
  assert.equal(artistsPage1.artists.length, expectedArtistsPage1);
  assert.deepEqual(artistsPage1.tracks, []);
  assert.deepEqual(artistsPage1.albums, []);
  assert.deepEqual(artistsPage1.totals, expectedTotals);

  const artistsPage2 = getMockSearch('', 'most-plays', 2, 'artists');
  const expectedArtistsPage2 = Math.min(
    SEARCH_SINGLE_TYPE_ROWS,
    Math.max(0, expectedTotals.artists - SEARCH_SINGLE_TYPE_ROWS),
  );
  assert.equal(artistsPage2.artists.length, expectedArtistsPage2);
  assert.equal(artistsPage2.hasMore, 2 < artistsPage2.totalPages!);

  // Single-type albums: exact size page 1 and page 2
  const albumsPage1 = getMockSearch('', 'most-plays', 1, 'albums');
  const expectedAlbumsPage1 = Math.min(SEARCH_SINGLE_TYPE_ROWS, expectedTotals.albums);
  assert.equal(albumsPage1.albums.length, expectedAlbumsPage1);
  assert.deepEqual(albumsPage1.tracks, []);
  assert.deepEqual(albumsPage1.artists, []);
  assert.deepEqual(albumsPage1.totals, expectedTotals);

  const albumsPage2 = getMockSearch('', 'most-plays', 2, 'albums');
  const expectedAlbumsPage2 = Math.min(
    SEARCH_SINGLE_TYPE_ROWS,
    Math.max(0, expectedTotals.albums - SEARCH_SINGLE_TYPE_ROWS),
  );
  assert.equal(albumsPage2.albums.length, expectedAlbumsPage2);
  assert.equal(albumsPage2.hasMore, 2 < albumsPage2.totalPages!);
});

test('getMockSearch includes lastPlayedAt on every returned Track, Artist, and Album', () => {
  const res = getMockSearch('', 'most-plays', 1, 'all');
  for (const track of res.tracks) {
    assert.ok(track.lastPlayedAt, `Track ${track.name} must have lastPlayedAt`);
    assert.ok(!Number.isNaN(Date.parse(track.lastPlayedAt)));
  }
  for (const artist of res.artists) {
    assert.ok(artist.lastPlayedAt, `Artist ${artist.name} must have lastPlayedAt`);
    assert.ok(!Number.isNaN(Date.parse(artist.lastPlayedAt)));
  }
  for (const album of res.albums) {
    assert.ok(album.lastPlayedAt, `Album ${album.name} must have lastPlayedAt`);
    assert.ok(!Number.isNaN(Date.parse(album.lastPlayedAt)));
  }
});

test('getMockSearch cross-entity matching matches across name, artist, and album', () => {
  // Querying an album name matches both the album and tracks on that album
  const albumQueryRes = getMockSearch('In Rainbows', 'most-plays', 1, 'all');
  assert.ok(albumQueryRes.albums.some((a) => a.name === 'In Rainbows'));
  assert.ok(albumQueryRes.tracks.some((t) => t.album === 'In Rainbows'));

  // Querying artist name matches artist, tracks by artist, and albums by artist
  const artistQueryRes = getMockSearch('Radiohead', 'most-plays', 1, 'all');
  assert.ok(artistQueryRes.artists.some((a) => a.name === 'Radiohead'));
  assert.ok(artistQueryRes.tracks.every((t) => t.artist === 'Radiohead'));
  assert.ok(artistQueryRes.albums.every((a) => a.artist === 'Radiohead'));
});

test('getMockRandomProfileTarget selects valid played target for each filter', () => {
  for (let i = 0; i < 20; i++) {
    const allTarget = getMockRandomProfileTarget('all');
    assert.ok(allTarget);
    assert.ok(['track', 'artist', 'album'].includes(allTarget.kind));
    const allProfile = getMockProfile(allTarget, 'all', 'UTC');
    assert.ok(allProfile, 'Random target must be resolvable via getMockProfile');
  }

  const trackTarget = getMockRandomProfileTarget('tracks');
  assert.ok(trackTarget && trackTarget.kind === 'track');
  const trackProfile = getMockProfile(trackTarget, 'all', 'UTC');
  assert.ok(trackProfile && trackProfile.kind === 'track');

  const artistTarget = getMockRandomProfileTarget('artists');
  assert.ok(artistTarget && artistTarget.kind === 'artist');
  const artistProfile = getMockProfile(artistTarget, 'all', 'UTC');
  assert.ok(artistProfile && artistProfile.kind === 'artist');

  const albumTarget = getMockRandomProfileTarget('albums');
  assert.ok(albumTarget && albumTarget.kind === 'album');
  const albumProfile = getMockProfile(albumTarget, 'all', 'UTC');
  assert.ok(albumProfile && albumProfile.kind === 'album');
});

test('getMockProfile provides dayOfWeek and stats for Track, Artist, and Album', () => {
  const trackId = CATALOG.radiohead_weird_fishes.id;
  const artistId = CATALOG.radiohead_weird_fishes.artistId;
  const albumId = CATALOG.radiohead_weird_fishes.albumId!;

  // 1. Track Profile
  const trackProfile = getMockProfile({ kind: 'track', key: trackId }, 'all', 'UTC')!;
  assert.ok(trackProfile);
  assert.ok(trackProfile.dayOfWeek);
  assert.equal(trackProfile.dayOfWeek.length, 7);
  assert.equal(trackProfile.dayOfWeek.reduce((sum, c) => sum + c, 0), trackProfile.plays);

  assert.ok(trackProfile.stats);
  assert.equal(typeof trackProfile.stats.totalMs, 'number');
  assert.ok(trackProfile.stats.totalMs > 0);
  assert.ok(trackProfile.stats.activeDays > 0);
  assert.ok(trackProfile.stats.longestStreakDays > 0);
  assert.ok(trackProfile.stats.peakDay);
  assert.equal(typeof trackProfile.stats.completionRate, 'number');
  assert.ok(trackProfile.stats.completionRate! > 0 && trackProfile.stats.completionRate! <= 1);
  assert.ok(trackProfile.stats.artistPlays! >= trackProfile.plays);
  assert.ok(trackProfile.stats.artistShare! > 0 && trackProfile.stats.artistShare! <= 1);
  assert.ok(trackProfile.stats.albumPlays! >= trackProfile.plays);
  assert.ok(trackProfile.stats.albumShare! > 0 && trackProfile.stats.albumShare! <= 1);

  // recentPlays msPlayed
  assert.ok(trackProfile.recentPlays.length > 0);
  for (const play of trackProfile.recentPlays) {
    assert.equal(typeof play.msPlayed, 'number');
    assert.ok(play.msPlayed! > 0);
  }

  // 2. Artist Profile
  const artistProfile = getMockProfile({ kind: 'artist', key: artistId }, 'all', 'UTC')!;
  assert.ok(artistProfile);
  assert.ok(artistProfile.dayOfWeek);
  assert.equal(artistProfile.dayOfWeek.length, 7);
  assert.equal(artistProfile.dayOfWeek.reduce((sum, c) => sum + c, 0), artistProfile.plays);

  assert.ok(artistProfile.stats);
  assert.equal(typeof artistProfile.stats.totalMs, 'number');
  assert.ok(artistProfile.stats.totalMs > 0);
  assert.ok(artistProfile.stats.activeDays > 0);
  assert.ok(artistProfile.stats.longestStreakDays > 0);
  assert.ok(artistProfile.stats.peakDay);
  for (const play of artistProfile.recentPlays) {
    assert.equal(typeof play.msPlayed, 'number');
    assert.ok(play.msPlayed! > 0);
  }

  // 3. Album Profile
  const albumProfile = getMockProfile({ kind: 'album', key: albumId }, 'all', 'UTC')!;
  assert.ok(albumProfile);
  assert.ok(albumProfile.dayOfWeek);
  assert.equal(albumProfile.dayOfWeek.length, 7);
  assert.equal(albumProfile.dayOfWeek.reduce((sum, c) => sum + c, 0), albumProfile.plays);

  assert.ok(albumProfile.stats);
  assert.equal(typeof albumProfile.stats.totalMs, 'number');
  assert.ok(albumProfile.stats.totalMs > 0);
  assert.ok(albumProfile.stats.activeDays > 0);
  assert.ok(albumProfile.stats.longestStreakDays > 0);
  assert.ok(albumProfile.stats.peakDay);
  assert.ok(albumProfile.stats.artistPlays! >= albumProfile.plays);
  assert.ok(albumProfile.stats.artistShare! > 0 && albumProfile.stats.artistShare! <= 1);
  assert.ok(albumProfile.stats.tracksHeardInRange! > 0);
  assert.ok(albumProfile.stats.tracksHeardLifetime! >= albumProfile.stats.tracksHeardInRange!);
  assert.equal(typeof albumProfile.stats.fullAlbumSessions, 'number');
  for (const play of albumProfile.recentPlays) {
    assert.equal(typeof play.msPlayed, 'number');
    assert.ok(play.msPlayed! > 0);
  }
});

test('Album artistShare divides current album plays by selected artist by that artist total plays', () => {
  const albumId = CATALOG.radiohead_weird_fishes.albumId!;
  const albumProfile = getMockProfile({ kind: 'album', key: albumId }, 'all', 'UTC')!;
  const artistProfile = getMockProfile({ kind: 'artist', key: albumProfile.artistKey! }, 'all', 'UTC')!;

  assert.ok(albumProfile.stats?.artistShare);
  assert.equal(albumProfile.stats.artistPlays, artistProfile.plays);
  // In Rainbows plays divided by Radiohead plays
  assert.equal(albumProfile.stats.artistShare, albumProfile.plays / artistProfile.plays);
});

test('Track relatedTracks returns up to 4 adjacent tracks within <= 30 mins excluding self', () => {
  const trackId = CATALOG.radiohead_weird_fishes.id;
  const profile = getMockProfile({ kind: 'track', key: trackId }, 'all', 'UTC')!;
  assert.ok(profile.relatedTracks);
  assert.ok(profile.relatedTracks.length > 0 && profile.relatedTracks.length <= PROFILE_RELATED_TRACKS_LIMIT);
  assert.ok(profile.relatedTracks.every((r) => r.id !== trackId));
  assert.ok(profile.relatedTracks.every((r) => r.coPlays > 0));

  // Compare exact co-play and sibling data from actual mock stream plays
  assert.equal(profile.relatedTracks[0].name, '15 Step');
  assert.equal(profile.relatedTracks[0].artist, 'Radiohead');
  assert.equal(profile.relatedTracks[0].coPlays, 3);

  // Check ordering: coPlays DESC, name ASC, id ASC
  for (let i = 1; i < profile.relatedTracks.length; i++) {
    const prev = profile.relatedTracks[i - 1];
    const curr = profile.relatedTracks[i];
    if (prev.coPlays === curr.coPlays) {
      assert.ok(prev.name.localeCompare(curr.name) <= 0);
    } else {
      assert.ok(prev.coPlays > curr.coPlays);
    }
  }
});

test('Album moreAlbums returns sibling albums by same artist in range excluding current', () => {
  const albumId = CATALOG.radiohead_weird_fishes.albumId!;
  const profile = getMockProfile({ kind: 'album', key: albumId }, 'all', 'UTC')!;
  assert.ok(profile.moreAlbums);
  assert.ok(profile.moreAlbums.length > 0 && profile.moreAlbums.length <= PROFILE_MORE_ALBUMS_LIMIT);
  assert.ok(profile.moreAlbums.every((a) => a.key !== albumId));

  // Compare exact sibling data from actual mock stream plays (OK Computer with 6 plays)
  assert.equal(profile.moreAlbums[0].name, 'OK Computer');
  assert.equal(profile.moreAlbums[0].plays, 6);

  for (let i = 1; i < profile.moreAlbums.length; i++) {
    const prev = profile.moreAlbums[i - 1];
    const curr = profile.moreAlbums[i];
    assert.ok(prev.plays >= curr.plays);
  }
});

test('Album fullAlbumSessions matches countFullAlbumSessions', () => {
  const albumId = CATALOG.radiohead_weird_fishes.albumId!;
  const profile = getMockProfile({ kind: 'album', key: albumId }, 'all', 'UTC')!;
  assert.ok(profile.stats);
  assert.ok(profile.stats.fullAlbumSessions !== undefined);

  const inRainbowsPlays = ALL_MOCK_STREAM_LOG_ENTRIES.filter(
    (e) => e.album === 'In Rainbows' || e.albumId === albumId,
  ).map((p) => {
    const cat = Object.values(CATALOG).find(
      (c) => c.id === p.trackId || (c.name === p.title && c.artist === p.artist),
    );
    return {
      trackId: p.trackId ?? cat?.id ?? p.id,
      playedAt: p.playedAt,
    };
  });

  const expectedSessions = countFullAlbumSessions(inRainbowsPlays);
  assert.ok(expectedSessions > 0, 'In Rainbows must have at least one full album session');
  assert.equal(profile.stats.fullAlbumSessions, expectedSessions);
  assert.equal(profile.stats.fullAlbumSessions, 2);
});
