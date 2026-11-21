import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RANGE_KEYS,
  checkSearchQuery,
  normalizeForSearch,
  parseRangeKey,
  parseProfileTarget,
  parseSearchFilter,
  parseSearchSort,
  parseSearchPage,
  resolveDisplayFilter,
  getSearchStatusText,
} from '../src/lib/search-utils';
import { SEARCH_SINGLE_TYPE_ROWS } from '../src/lib/search-types';

test('RANGE_KEYS contains the six canonical overview range keys', () => {
  assert.deepEqual(RANGE_KEYS, ['1d', '1w', '1m', '6m', '1y', 'all']);
});

test('checkSearchQuery validates lengths and trims search queries', () => {
  assert.deepEqual(checkSearchQuery('a'), { ok: true, query: 'a' });
  assert.deepEqual(checkSearchQuery(' ab '), { ok: true, query: 'ab' });
  assert.deepEqual(checkSearchQuery('嵐'), { ok: true, query: '嵐' });
  assert.deepEqual(checkSearchQuery('𠮷'), { ok: true, query: '𠮷' });
  assert.deepEqual(checkSearchQuery('  嵐  '), { ok: true, query: '嵐' });
  assert.deepEqual(checkSearchQuery('a'.repeat(100)), { ok: true, query: 'a'.repeat(100) });
  assert.deepEqual(checkSearchQuery('a'.repeat(101)), { ok: false, reason: 'too_long' });
  assert.deepEqual(checkSearchQuery('𠮷'.repeat(100)), { ok: true, query: '𠮷'.repeat(100) });
  assert.deepEqual(checkSearchQuery('𠮷'.repeat(101)), { ok: false, reason: 'too_long' });
  assert.deepEqual(checkSearchQuery('   '), { ok: true, query: '' });
  assert.deepEqual(checkSearchQuery(''), { ok: true, query: '' });
});

test('normalizeForSearch strips accents, converts full-width chars, and lowercases', () => {
  assert.equal(normalizeForSearch('cö shu Nie'), 'co shu nie');
  assert.equal(normalizeForSearch('Beyoncé'), 'beyonce');
  assert.equal(normalizeForSearch('ＲＡＤ'), 'rad');
  assert.equal(normalizeForSearch('o\u0308'), 'o');
});

test('parseRangeKey validates membership in RANGE_KEYS', () => {
  for (const range of RANGE_KEYS) {
    assert.equal(parseRangeKey(range), range);
  }
  assert.equal(parseRangeKey('2w'), null);
  assert.equal(parseRangeKey('10d'), null);
  assert.equal(parseRangeKey(''), null);
  assert.equal(parseRangeKey(null), null);
  assert.equal(parseRangeKey(undefined), null);
  assert.equal(parseRangeKey('all '), null);
});

test('parseProfileTarget handles URLSearchParams and records with track/artist precedence and validation', () => {
  // Track only
  assert.deepEqual(
    parseProfileTarget(new URLSearchParams('track=4Z8W4fKeB5YxbusRsdQVPb')),
    { kind: 'track', key: '4Z8W4fKeB5YxbusRsdQVPb' }
  );
  assert.deepEqual(
    parseProfileTarget({ track: '4Z8W4fKeB5YxbusRsdQVPb' }),
    { kind: 'track', key: '4Z8W4fKeB5YxbusRsdQVPb' }
  );

  // Artist only
  assert.deepEqual(
    parseProfileTarget(new URLSearchParams('artist=radiohead')),
    { kind: 'artist', key: 'radiohead' }
  );
  assert.deepEqual(
    parseProfileTarget({ artist: 'radiohead' }),
    { kind: 'artist', key: 'radiohead' }
  );

  // Both: track wins
  assert.deepEqual(
    parseProfileTarget(new URLSearchParams('track=track123&artist=artist123')),
    { kind: 'track', key: 'track123' }
  );
  assert.deepEqual(
    parseProfileTarget({ track: 'track123', artist: 'artist123' }),
    { kind: 'track', key: 'track123' }
  );

  // Empty and whitespace
  assert.equal(parseProfileTarget(new URLSearchParams()), null);
  assert.equal(parseProfileTarget({}), null);
  assert.equal(parseProfileTarget({ track: '' }), null);
  assert.equal(parseProfileTarget({ artist: '' }), null);
  assert.equal(parseProfileTarget({ track: '   ' }), null);
  assert.equal(parseProfileTarget({ artist: ' \t\n ' }), null);

  // Trimming
  assert.deepEqual(
    parseProfileTarget({ track: '  track123  ' }),
    { kind: 'track', key: 'track123' }
  );
  assert.deepEqual(
    parseProfileTarget({ artist: '  artist123  ' }),
    { kind: 'artist', key: 'artist123' }
  );

  // Length boundary: 200 ok, 201 invalid
  assert.deepEqual(
    parseProfileTarget({ track: 'a'.repeat(200) }),
    { kind: 'track', key: 'a'.repeat(200) }
  );
  assert.equal(parseProfileTarget({ track: 'a'.repeat(201) }), null);
  // Track invalid due to length falls back to valid artist
  assert.deepEqual(
    parseProfileTarget({ track: 'a'.repeat(201), artist: 'valid_artist' }),
    { kind: 'artist', key: 'valid_artist' }
  );

  // Control characters: reject 0x00-0x1F and 0x7F
  assert.equal(parseProfileTarget({ track: 'bad\u0000id' }), null);
  assert.equal(parseProfileTarget({ track: 'bad\u001fid' }), null);
  assert.equal(parseProfileTarget({ track: 'bad\u007fid' }), null);
  assert.deepEqual(
    parseProfileTarget({ track: 'bad\u0000id', artist: 'good_artist' }),
    { kind: 'artist', key: 'good_artist' }
  );

  // Array values: take first element
  assert.deepEqual(
    parseProfileTarget({ track: ['first_track', 'second_track'] }),
    { kind: 'track', key: 'first_track' }
  );
  assert.equal(parseProfileTarget({ track: [] }), null);
  assert.equal(parseProfileTarget({ track: ['', 'second_track'] }), null);
});

test('parseProfileTarget accepts Album keys and trims record values', () => {
  assert.deepEqual(
    parseProfileTarget(new URLSearchParams('album=x')),
    { kind: 'album', key: 'x' },
  );
  assert.deepEqual(
    parseProfileTarget({ album: ['  artist::album  ', 'other'] }),
    { kind: 'album', key: 'artist::album' },
  );
});

test('parseProfileTarget prefers valid Track and Artist targets over Album', () => {
  assert.deepEqual(
    parseProfileTarget(new URLSearchParams('track=t&artist=a&album=x')),
    { kind: 'track', key: 't' },
  );
  assert.deepEqual(
    parseProfileTarget(new URLSearchParams('track=t&album=x')),
    { kind: 'track', key: 't' },
  );
  assert.deepEqual(
    parseProfileTarget({ track: '', artist: 'a', album: 'x' }),
    { kind: 'artist', key: 'a' },
  );
  assert.deepEqual(
    parseProfileTarget({ track: 'bad\u0000id', artist: ' ', album: 'x' }),
    { kind: 'album', key: 'x' },
  );
});

test('parseProfileTarget rejects blank, oversized, and control-character Album keys', () => {
  for (const album of ['', '  ', 'a'.repeat(201), 'bad\u0000key', 'bad\u007fkey']) {
    assert.equal(parseProfileTarget(new URLSearchParams({ album })), null);
  }
});

test('parseSearchFilter accepts known filters and defaults to all', () => {
  assert.equal(parseSearchFilter('all'), 'all');
  assert.equal(parseSearchFilter('tracks'), 'tracks');
  assert.equal(parseSearchFilter('artists'), 'artists');
  assert.equal(parseSearchFilter('albums'), 'albums');

  assert.equal(parseSearchFilter(null), 'all');
  assert.equal(parseSearchFilter(undefined), 'all');
  assert.equal(parseSearchFilter(''), 'all');
  assert.equal(parseSearchFilter('   '), 'all');
  assert.equal(parseSearchFilter('TRACKS'), 'all');
  assert.equal(parseSearchFilter('Artists'), 'all');
  assert.equal(parseSearchFilter('unknown'), 'all');
});

test('parseSearchSort handles valid, invalid, null, and undefined values', () => {
  assert.equal(parseSearchSort('most-plays'), 'most-plays');
  assert.equal(parseSearchSort('least-plays'), 'least-plays');
  assert.equal(parseSearchSort('recent'), 'recent');
  assert.equal(parseSearchSort('oldest'), 'oldest');

  assert.equal(parseSearchSort(null), 'most-plays');
  assert.equal(parseSearchSort(undefined), 'most-plays');
  assert.equal(parseSearchSort('invalid'), 'most-plays');
});

test('parseSearchPage defaults invalid pages and enforces the 16-row limit', () => {
  assert.equal(parseSearchPage(null), 1);
  assert.equal(parseSearchPage(undefined), 1);
  assert.equal(parseSearchPage(''), 1);
  assert.equal(parseSearchPage('0'), 1);
  assert.equal(parseSearchPage('-5'), 1);
  assert.equal(parseSearchPage('abc'), 1);
  assert.equal(parseSearchPage('1'), 1);
  assert.equal(parseSearchPage('42'), 42);

  const maxSafePage = Math.floor(Number.MAX_SAFE_INTEGER / SEARCH_SINGLE_TYPE_ROWS);
  assert.equal(parseSearchPage(String(maxSafePage)), maxSafePage);
  assert.equal(parseSearchPage(String(maxSafePage + 1)), 1);
  assert.equal(parseSearchPage('999999999999999999999999'), 1);
});

test('resolveDisplayFilter resolves display filter based on status and dataFilter', () => {
  // loading with dataFilter set returns dataFilter
  assert.equal(resolveDisplayFilter('loading', 'tracks', 'artists'), 'artists');
  assert.equal(resolveDisplayFilter('loading', 'all', 'albums'), 'albums');

  // ready returns requested filter
  assert.equal(resolveDisplayFilter('ready', 'tracks', 'artists'), 'tracks');
  assert.equal(resolveDisplayFilter('ready', 'all', null), 'all');

  // loading with null dataFilter returns requested filter
  assert.equal(resolveDisplayFilter('loading', 'tracks', null), 'tracks');
  assert.equal(resolveDisplayFilter('loading', 'all', null), 'all');

  // idle and error return requested filter
  assert.equal(resolveDisplayFilter('idle', 'tracks', 'artists'), 'tracks');
  assert.equal(resolveDisplayFilter('error', 'albums', 'tracks'), 'albums');
});

test('getSearchStatusText returns appropriate status text or null', () => {
  // loading: null for both empty and non-empty queries
  assert.equal(getSearchStatusText({ status: 'loading', query: '', hasResults: false }), null);
  assert.equal(getSearchStatusText({ status: 'loading', query: 'radio', hasResults: false }), null);
  assert.equal(getSearchStatusText({ status: 'loading', query: 'radio', hasResults: true }), null);

  // error: "SEARCH FAILED"
  assert.equal(getSearchStatusText({ status: 'error', query: '', hasResults: false }), 'SEARCH FAILED');
  assert.equal(getSearchStatusText({ status: 'error', query: 'radio', hasResults: false }), 'SEARCH FAILED');

  // idle: "QUERY TOO LONG"
  assert.equal(getSearchStatusText({ status: 'idle', query: 'a'.repeat(101), hasResults: false }), 'QUERY TOO LONG');

  // ready without results: empty vs non-empty queries
  assert.equal(getSearchStatusText({ status: 'ready', query: '', hasResults: false }), '[ NO PLAYS IN ARCHIVE ]');
  assert.equal(getSearchStatusText({ status: 'ready', query: '   ', hasResults: false }), '[ NO PLAYS IN ARCHIVE ]');
  assert.equal(getSearchStatusText({ status: 'ready', query: 'radio', hasResults: false }), '[ NO MATCHES ]');

  // ready with results: null
  assert.equal(getSearchStatusText({ status: 'ready', query: '', hasResults: true }), null);
  assert.equal(getSearchStatusText({ status: 'ready', query: 'radio', hasResults: true }), null);
});
