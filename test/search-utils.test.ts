import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RANGE_KEYS,
  checkSearchQuery,
  normalizeForSearch,
  parseRangeKey,
  parseProfileTarget,
} from '../src/lib/search-utils';

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
