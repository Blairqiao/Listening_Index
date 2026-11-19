import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../src/lib/mock/catalog';
import { ALL_MOCK_STREAM_LOG_ENTRIES } from '../src/lib/mock/stream-log';
import { getMockSearch, getMockProfile } from '../src/lib/mock/search-profile';

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
    for (const kind of ['track', 'artist'] as const) {
      const keys = kind === 'track' ? data.tracks.map(row => row.id) : data.artists.map(row => row.key);
      const dates = keys.map(key => Date.parse(getMockProfile({ kind, key }, 'all', 'UTC')!.lastPlayedAt!));
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
