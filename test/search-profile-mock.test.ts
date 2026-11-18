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

test('getMockProfile calculates activityCadence with expected bucket lengths', () => {
  const weirdFishesId = CATALOG.radiohead_weird_fishes.id;

  const profile1d = getMockProfile(
    { kind: 'track', key: weirdFishesId },
    '1d',
    'UTC'
  );
  assert.ok(profile1d);
  assert.equal(profile1d.activityCadence.length, 24);

  const profile1w = getMockProfile(
    { kind: 'track', key: weirdFishesId },
    '1w',
    'UTC'
  );
  assert.ok(profile1w);
  assert.equal(profile1w.activityCadence.length, 28);

  const profile1m = getMockProfile(
    { kind: 'track', key: weirdFishesId },
    '1m',
    'UTC'
  );
  assert.ok(profile1m);
  assert.equal(profile1m.activityCadence.length, 30);
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
