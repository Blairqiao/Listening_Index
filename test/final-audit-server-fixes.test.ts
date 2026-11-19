import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NextRequest } from 'next/server';
import { loadTs } from './helpers/load-ts';

const VALID_ID = '6orDsQsMy7BaqGoRWw3fVN';

// ---------------------------------------------------------------------------
// Fix 1: Track id validation
// ---------------------------------------------------------------------------
test('extractTrackId rejects malformed Track ids', () => {
  const { extractTrackId } = loadTs('src/lib/history-parser.ts');
  assert.equal(extractTrackId('spotify:track:bad'), null);
  assert.equal(extractTrackId(`spotify:track:${VALID_ID}x`), null, '23 characters');
  assert.equal(extractTrackId('spotify:track:6orDsQsMy7/aqGoRWw3fVN'), null, 'slash inside the id');
  assert.equal(extractTrackId(`https://open.spotify.com/track/${VALID_ID}x`), null, '23 characters in a URL');
  assert.equal(extractTrackId('https://open.spotify.com/track/short'), null);
});

test('extractTrackId accepts a valid URI and a valid URL with a query string', () => {
  const { extractTrackId } = loadTs('src/lib/history-parser.ts');
  assert.equal(extractTrackId(`spotify:track:${VALID_ID}`), VALID_ID);
  assert.equal(extractTrackId(` spotify:track:${VALID_ID} `), VALID_ID);
  assert.equal(extractTrackId(`https://open.spotify.com/track/${VALID_ID}?si=abc123`), VALID_ID);
  assert.equal(extractTrackId(`https://open.spotify.com/track/${VALID_ID}`), VALID_ID);
});

test('parseHistoryRecords drops Stream Events whose Track id is malformed', () => {
  const { parseHistoryRecords } = loadTs('src/lib/history-parser.ts');
  const record = (uri: string) => ({
    ts: '2026-11-03T12:00:00Z',
    ms_played: 60_000,
    master_metadata_track_name: 'Track',
    master_metadata_album_artist_name: 'Artist',
    master_metadata_album_album_name: 'Album',
    spotify_track_uri: uri,
  });
  const plays = parseHistoryRecords([record('spotify:track:bad'), record(`spotify:track:${VALID_ID}`)]);
  assert.deepEqual(plays.map((p: { trackId: string }) => p.trackId), [VALID_ID]);
});

test('upload/history counts an item with a malformed Track id as skipped', async () => {
  let upsertedTracks: Array<{ id: string }> = [];
  let insertedPlays: Array<{ trackId: string }> = [];
  const route = loadTs('src/app/api/upload/history/route.ts', {
    '@/lib/admin-auth': { isAuthorizedAdminRequest: () => true, isSameOriginRequest: () => true },
    '@/lib/db': { isDbConfigured: () => true },
    '@/lib/db/queries': {
      bulkUpsertTracks: async (tracks: Array<{ id: string }>) => { upsertedTracks = tracks; },
      bulkInsertPlays: async (plays: Array<{ trackId: string }>) => {
        insertedPlays = plays;
        return { insertedCount: plays.length };
      },
    },
    '@/lib/db/server-cache': { clearServerCache: () => {} },
  });
  const item = (trackId: string) => ({
    playedAt: '2026-11-03T12:00:00Z', trackId, trackName: 'Track', artistName: 'Artist', albumName: 'Album', msPlayed: 60_000,
  });
  const res = await route.POST(new NextRequest('http://127.0.0.1:8888/api/upload/history', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plays: [item(VALID_ID), item('bad'), item(`${VALID_ID}x`), item('6orDsQsMy7/aqGoRWw3fVN')] }),
  }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.processed, 1);
  assert.equal(data.skipped, 3);
  assert.deepEqual(upsertedTracks.map((t) => t.id), [VALID_ID]);
  assert.deepEqual(insertedPlays.map((p) => p.trackId), [VALID_ID]);
});

// ---------------------------------------------------------------------------
// Fix 2: sync runs enrichment when there are no new Stream Events
// ---------------------------------------------------------------------------
function loadSync(options: { enrich?: () => Promise<unknown> } = {}) {
  const counts = { enrichment: 0, recordLastSync: 0, ingestion: 0 };
  const ingest = async () => { counts.ingestion++; };
  const mod = loadTs('src/lib/spotify-sync.ts', {
    '@/lib/spotify': { fetchRecentlyPlayed: async () => ({ items: [] }) },
    '@/lib/db/queries': {
      recordLastSync: async () => { counts.recordLastSync++; },
      bulkUpsertArtists: ingest,
      bulkUpsertAlbums: ingest,
      bulkUpsertTracks: ingest,
      bulkInsertPlays: async () => { counts.ingestion++; return { insertedCount: 0 }; },
    },
    '@/lib/enrichment': {
      runEnrichmentBatch: async (args: { bucket: string }) => {
        counts.enrichment++;
        assert.equal(args.bucket, 'cron');
        return options.enrich ? options.enrich() : { enrichedCount: 0 };
      },
    },
  });
  return { mod, counts };
}

test('syncSpotify runs one enrichment batch when recently-played has no Stream Events', async () => {
  const { mod, counts } = loadSync();
  const result = await mod.syncSpotify();
  assert.equal(counts.enrichment, 1, 'pending Tracks must still make progress');
  assert.equal(counts.recordLastSync, 1);
  assert.equal(counts.ingestion, 0, 'ingestion is skipped when there is nothing to ingest');
  assert.equal(result.processed, 0);
  assert.equal(typeof result.durationMs, 'number');
  assert.deepEqual(Object.keys(result).sort(), ['durationMs', 'processed']);
});

test('syncSpotify with no Stream Events still records the sync when enrichment fails', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const { mod, counts } = loadSync({ enrich: async () => { throw new Error('quota'); } });
    const result = await mod.syncSpotify();
    assert.equal(result.processed, 0);
    assert.equal(counts.recordLastSync, 1);
  } finally {
    console.warn = warn;
  }
});

// ---------------------------------------------------------------------------
// Fix 3: read cache in-flight cap
// ---------------------------------------------------------------------------
test('server cache accepts 24 distinct concurrent keys without the overload error', async () => {
  const cache = loadTs('src/lib/db/server-cache.ts', { 'next/cache': { revalidateTag: () => {} } });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const pending = Array.from({ length: 24 }, (_, i) =>
    cache.getOrFetchStreamLog(50, 'UTC', async () => { await gate; return { marker: i }; }, { cursorId: `c${i}` })
  );
  // Attach handlers before releasing so an overload rejection is observed, not unhandled.
  const settled = Promise.allSettled(pending);
  release();
  const results = await settled;
  const rejected = results.filter((r) => r.status === 'rejected');
  assert.equal(rejected.length, 0, `no request may be refused: ${JSON.stringify(rejected)}`);
  assert.deepEqual(
    results.map((r) => (r as PromiseFulfilledResult<{ marker: number }>).value.marker),
    Array.from({ length: 24 }, (_, i) => i)
  );
  cache.clearServerCache();
});

// ---------------------------------------------------------------------------
// Fix 5: bare UTC offsets are not accepted as timezones
// ---------------------------------------------------------------------------
test('sanitizeTimezone falls back to UTC for bare offsets and keeps named zones', () => {
  const { sanitizeTimezone } = loadTs('src/lib/db/queries/helpers.ts');
  assert.equal(sanitizeTimezone('+08:00'), 'UTC');
  assert.equal(sanitizeTimezone('-05:00'), 'UTC');
  assert.equal(sanitizeTimezone(' +08:00 '), 'UTC');
  assert.equal(sanitizeTimezone('America/Chicago'), 'America/Chicago');
  assert.equal(sanitizeTimezone('UTC'), 'UTC');
});

test('isValidIanaTimezone rejects bare offsets and keeps named zones', () => {
  const { isValidIanaTimezone } = loadTs('src/lib/timezone-utils.ts');
  assert.equal(isValidIanaTimezone('+08:00'), false);
  assert.equal(isValidIanaTimezone('-05:00'), false);
  assert.equal(isValidIanaTimezone(' -05:00'), false);
  assert.equal(isValidIanaTimezone('America/Chicago'), true);
  assert.equal(isValidIanaTimezone('UTC'), true);
});

// ---------------------------------------------------------------------------
// Fix 6: scripts read the local env file first, as Next.js does
// ---------------------------------------------------------------------------
for (const script of ['scripts/migrate.ts', 'scripts/sync-spotify.ts']) {
  test(`${script} loads the local env file before the base env file`, () => {
    const source = fs.readFileSync(script, 'utf8');
    const configCalls = [...source.matchAll(/\.config\(([^)]*)\)/g)].map((m) => m[1]);
    assert.equal(configCalls.length, 2);
    assert.match(configCalls[0], /\.local/, 'first call must name the local env file');
    assert.doesNotMatch(configCalls[1], /\.local/, 'second call loads the base env file');
  });
}

// ---------------------------------------------------------------------------
// Fix 8: Track stats input bounds
// ---------------------------------------------------------------------------
function loadTrackStatsRoute() {
  const calls: unknown[] = [];
  const route = loadTs('src/app/api/listening/track-stats/route.ts', {
    '@/lib/db/queries': {
      getTrackTelemetryStats: async (params: unknown) => { calls.push(params); return { track: { plays: 1 }, artist: { plays: 2 } }; },
    },
  });
  const get = (params: Record<string, string>) =>
    route.GET(new Request(`http://127.0.0.1:8888/api/listening/track-stats?${new URLSearchParams(params)}`));
  return { get, calls };
}

test('track-stats rejects a malformed Track id and overlong title or artist without querying', async () => {
  const { get, calls } = loadTrackStatsRoute();
  const rejected: Array<Record<string, string>> = [
    { trackId: 'bad' },
    { trackId: `${VALID_ID}x` },
    { trackId: "6orDsQsMy7BaqGoRWw3fV'" },
    { title: 'a'.repeat(201) },
    { artist: 'a'.repeat(201) },
    { trackId: VALID_ID, title: 'ok', artist: 'a'.repeat(201) },
  ];
  for (const params of rejected) {
    const res = await get(params);
    assert.equal(res.status, 400, JSON.stringify(params).slice(0, 60));
    assert.equal(typeof (await res.json()).error, 'string');
  }
  assert.equal(calls.length, 0);
});

test('track-stats still serves valid requests, with or without a Track id', async () => {
  const { get, calls } = loadTrackStatsRoute();
  assert.equal((await get({ trackId: VALID_ID, title: 'a'.repeat(200), artist: 'b'.repeat(200) })).status, 200);
  assert.equal((await get({ title: 'Halo', artist: 'Beyoncé' })).status, 200);
  assert.equal((await get({})).status, 200);
  assert.deepEqual(calls[1], { trackId: undefined, title: 'Halo', artist: 'Beyoncé' });
  assert.equal(calls.length, 3);
});
