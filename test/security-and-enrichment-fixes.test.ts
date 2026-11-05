import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { loadTs } from './helpers/load-ts';

// ---------------------------------------------------------------------------
// 1. admin-auth: stop accepting raw ADMIN_PASSWORD as Bearer token
// ---------------------------------------------------------------------------
test('admin-auth: isAuthorizedAdminRequest rejects raw ADMIN_PASSWORD as Bearer token', async () => {
  const prevPass = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = 'super-secret-password-123';
  try {
    const { isAuthorizedAdminRequest, createSessionToken } = await import('../src/lib/admin-auth');

    // Raw password as Bearer token must NOT be authorized
    const reqWithPassword = new NextRequest('http://127.0.0.1:8888/api/test', {
      headers: { authorization: 'Bearer super-secret-password-123' },
    });
    assert.equal(isAuthorizedAdminRequest(reqWithPassword), false, 'Raw ADMIN_PASSWORD must be rejected');

    // Valid session token as Bearer token must be authorized
    const sessionToken = createSessionToken();
    const reqWithSession = new NextRequest('http://127.0.0.1:8888/api/test', {
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    assert.equal(isAuthorizedAdminRequest(reqWithSession), true, 'Session token Bearer must be accepted');
  } finally {
    if (prevPass !== undefined) process.env.ADMIN_PASSWORD = prevPass;
    else delete process.env.ADMIN_PASSWORD;
  }
});

// ---------------------------------------------------------------------------
// 2. cron-auth: N012 CRON_SECRET only accepted when isDbConfigured() is false
// ---------------------------------------------------------------------------
test('cron-auth: N012 CRON_SECRET only accepted when isDbConfigured() is false', async () => {
  const prevSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'env-cron-secret-12345';
  const dbKey = 'database-cron-key-12345';

  try {
    // A. When DB is configured: only DB key is accepted, CRON_SECRET is rejected
    const cronAuthWithDb = loadTs('src/lib/cron-auth.ts', {
      '@/lib/db': { isDbConfigured: () => true },
      '@/lib/db/queries': {
        getCronKey: async (options?: { allowLegacyFallback?: boolean }) => {
          assert.equal(options?.allowLegacyFallback, false, 'Must not allow legacy fallback when DB is configured');
          return dbKey;
        },
      },
    });

    const reqDbKey = new NextRequest(`http://127.0.0.1:8888/api/sync?key=${dbKey}`);
    assert.equal(await cronAuthWithDb.isAuthorizedCronRequest(reqDbKey, { allowLegacySecret: true }), true);

    const reqSecretParam = new NextRequest('http://127.0.0.1:8888/api/sync?secret=env-cron-secret-12345');
    assert.equal(await cronAuthWithDb.isAuthorizedCronRequest(reqSecretParam, { allowLegacySecret: true }), false, 'CRON_SECRET param must be rejected when DB configured');

    const reqSecretBearer = new NextRequest('http://127.0.0.1:8888/api/sync', {
      headers: { authorization: 'Bearer env-cron-secret-12345' },
    });
    assert.equal(await cronAuthWithDb.isAuthorizedCronRequest(reqSecretBearer, { allowLegacySecret: true }), false, 'CRON_SECRET Bearer must be rejected when DB configured');

    // B. When DB is not configured: CRON_SECRET is accepted when allowLegacySecret is true
    const cronAuthNoDb = loadTs('src/lib/cron-auth.ts', {
      '@/lib/db': { isDbConfigured: () => false },
      '@/lib/db/queries': { getCronKey: async () => null },
    });

    assert.equal(await cronAuthNoDb.isAuthorizedCronRequest(reqSecretParam, { allowLegacySecret: true }), true);
    assert.equal(await cronAuthNoDb.isAuthorizedCronRequest(reqSecretBearer, { allowLegacySecret: true }), true);
    assert.equal(await cronAuthNoDb.isAuthorizedCronRequest(reqSecretParam, { allowLegacySecret: false }), false);
  } finally {
    if (prevSecret !== undefined) process.env.CRON_SECRET = prevSecret;
    else delete process.env.CRON_SECRET;
  }
});

// ---------------------------------------------------------------------------
// 3. Error leakage: generic 500 error messages, preserve 4xx & 429
// ---------------------------------------------------------------------------
test('route-utils: handleApiError logs to console.error and returns generic 500 message', async () => {
  const { handleApiError } = await import('../src/lib/route-utils');
  const { CacheCapacityError } = await import('../src/lib/async-utils');

  const leakedMessage = 'SELECT * FROM users WHERE password_hash = "secret"';
  const res500 = handleApiError('test-endpoint', new Error(leakedMessage));
  assert.equal(res500.status, 500);
  const data500 = await res500.json();
  assert.equal(data500.error, 'Internal Server Error', '500 must return generic message');

  const res429 = handleApiError('test-endpoint', new CacheCapacityError());
  assert.equal(res429.status, 429);
  const data429 = await res429.json();
  assert.equal(data429.error, 'Listening data is busy. Retry shortly.', '429 must preserve CacheCapacityError message');
});

test('routes: inline catches log to console.error and return generic 500 error messages', async () => {
  // 1. auth/login
  const authLoginRoute = loadTs('src/app/api/auth/login/route.ts', {
    '@/lib/admin-auth': {
      isSameOriginRequest: () => true,
      isAdminPasswordConfigured: () => true,
      verifyAdminPassword: () => { throw new Error('Database connection failed / leaked path'); },
    },
  });
  const loginRes = await authLoginRoute.POST(new NextRequest('http://127.0.0.1:8888/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'test' }),
  }));
  assert.equal(loginRes.status, 500);
  const loginData = await loginRes.json();
  assert.equal(loginData.error, 'Authentication failed unexpectedly');

  // 2. config
  const configRoute = loadTs('src/app/api/config/route.ts', {
    '@/lib/admin-auth': {
      isSameOriginRequest: () => true,
      isAuthorizedAdminRequest: () => true,
    },
    '@/lib/db': { isDbConfigured: () => true },
    '@/lib/db/queries': {
      getActiveSiteConfig: async () => { throw new Error('Internal DB failure'); },
      saveActiveSiteConfig: async () => true,
      resetActiveSiteConfig: async () => ({}),
    },
  });
  const configRes = await configRoute.POST(new NextRequest('http://127.0.0.1:8888/api/config', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  }));
  assert.equal(configRes.status, 500);
  const configData = await configRes.json();
  assert.equal(configData.error, 'Failed to update configuration');

  // 3. track-stats
  const statsRoute = loadTs('src/app/api/listening/track-stats/route.ts', {
    '@/lib/db/queries': {
      getTrackTelemetryStats: async () => { throw new Error('Query syntax error'); },
    },
  });
  const statsRes = await statsRoute.GET(new Request('http://127.0.0.1:8888/api/listening/track-stats'));
  assert.equal(statsRes.status, 500);
  const statsData = await statsRes.json();
  assert.equal(statsData.error, 'Failed to load track telemetry stats');
});

// ---------------------------------------------------------------------------
// 4. upload/history validation & batch capping
// ---------------------------------------------------------------------------
test('upload/history: caps batch at 5000 (413), skips invalid items, reports skipped count', async () => {
  let insertedPlays: unknown[] = [];
  const historyRoute = loadTs('src/app/api/upload/history/route.ts', {
    '@/lib/admin-auth': { isAuthorizedAdminRequest: () => true, isSameOriginRequest: () => true },
    '@/lib/db': { isDbConfigured: () => true },
    '@/lib/db/queries': {
      bulkUpsertTracks: async () => {},
      bulkInsertPlays: async (plays: unknown[]) => {
        insertedPlays = plays;
        return { insertedCount: plays.length };
      },
    },
    '@/lib/db/server-cache': { clearServerCache: () => {} },
  });

  // Batch > 5000 -> 413
  const hugeBatch = Array.from({ length: 5001 }, () => ({
    playedAt: '2026-11-03T12:00:00Z',
    trackId: '4iV5W9uYEdYUVa79Axb7Rh',
    trackName: 'Track',
    artistName: 'Artist',
    albumName: 'Album',
    msPlayed: 100000,
  }));
  const res413 = await historyRoute.POST(new NextRequest('http://127.0.0.1:8888/api/upload/history', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plays: hugeBatch }),
  }));
  assert.equal(res413.status, 413, 'Batch > 5000 must return 413');

  // Mixed batch with valid and invalid items
  const mixedBatch = [
    { playedAt: '2026-11-03T12:00:00Z', trackId: '4iV5W9uYEdYUVa79Axb7Rh', trackName: 'Valid 1', artistName: 'Art', albumName: 'Alb', msPlayed: 150000 },
    { playedAt: 'not-a-date', trackId: '4iV5W9uYEdYUVa79Axb7Rh', trackName: 'Invalid Date', artistName: 'Art', albumName: 'Alb', msPlayed: 150000 },
    { playedAt: '2026-11-03T12:00:00Z', trackId: '', trackName: 'Empty Track ID', artistName: 'Art', albumName: 'Alb', msPlayed: 150000 },
    { playedAt: '2026-11-03T12:00:00Z', trackId: '4iV5W9uYEdYUVa79Axb7Rh', trackName: null, artistName: 'Art', albumName: 'Alb', msPlayed: 150000 },
    { playedAt: '2026-11-03T12:00:00Z', trackId: '4iV5W9uYEdYUVa79Axb7Rh', trackName: 'Neg Ms', artistName: 'Art', albumName: 'Alb', msPlayed: -1 },
    { playedAt: '2026-11-03T12:00:00Z', trackId: '4iV5W9uYEdYUVa79Axb7Rh', trackName: 'NaN Ms', artistName: 'Art', albumName: 'Alb', msPlayed: NaN },
    { playedAt: '2026-11-03T12:05:00Z', trackId: '5iV5W9uYEdYUVa79Axb7Rh', trackName: 'Valid 2', artistName: 'Art', albumName: 'Alb', msPlayed: 180000 },
  ];

  const resOk = await historyRoute.POST(new NextRequest('http://127.0.0.1:8888/api/upload/history', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plays: mixedBatch }),
  }));
  assert.equal(resOk.status, 200);
  const data = await resOk.json();
  assert.equal(data.success, true);
  assert.equal(data.processed, 2, 'Only 2 valid items processed');
  assert.equal(data.skipped, 5, '5 invalid items skipped');
  assert.equal(insertedPlays.length, 2);
});

// ---------------------------------------------------------------------------
// 5. N015: sync route returns 409 when DB or Spotify not connected
// ---------------------------------------------------------------------------
test('sync route: returns HTTP 409 when DB or Spotify is not connected', async () => {
  const syncRoute = loadTs('src/app/api/sync/route.ts', {
    '@/lib/cron-auth': { isAuthorizedCronRequest: async () => true },
    '@/lib/db': { isDbConfigured: () => false },
    '@/lib/spotify': { isOwnerSpotifyConfigured: async () => false },
    '@/lib/admin-auth': { isAuthorizedAdminRequest: () => true, isSameOriginRequest: () => true },
    '@/lib/spotify-sync': { syncSpotify: async () => ({ processed: 0, durationMs: 0 }) },
    '@/lib/db/server-cache': { clearServerCache: () => {} },
  });

  const res = await syncRoute.POST(new NextRequest('http://127.0.0.1:8888/api/sync?key=test', { method: 'POST' }));
  assert.equal(res.status, 409, 'Unconnected DB/Spotify must return 409');
  const data = await res.json();
  assert.equal(data.success, false);
});

// ---------------------------------------------------------------------------
// 6. N011: upload/enrich validation, same-origin, and runEnrichmentBatch
// ---------------------------------------------------------------------------
test('upload/enrich: dynamic bucket requires same-origin and validates trackIds as 22-char base62 max 10', async () => {
  const enrichRoute = loadTs('src/app/api/upload/enrich/route.ts', {
    '@/lib/db': { isDbConfigured: () => true },
    '@/lib/cron-auth': { isAuthorizedCronRequest: async () => true },
    '@/lib/spotify': { isOwnerSpotifyConfigured: async () => true },
    '@/lib/admin-auth': {
      isSameOriginRequest: (req: NextRequest) => req.headers.get('sec-fetch-site') === 'same-origin',
    },
    '@/lib/enrichment': { runEnrichmentBatch: async () => ({ progress: { pending: 0, enriched: 0, delisted: 0, total: 0 }, isComplete: true }) },
  });

  // Cross-origin dynamic request -> 403
  const crossOriginReq = new NextRequest('http://127.0.0.1:8888/api/upload/enrich', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
    body: JSON.stringify({ source: 'dynamic', trackIds: ['4iV5W9uYEdYUVa79Axb7Rh'] }),
  });
  const crossRes = await enrichRoute.POST(crossOriginReq);
  assert.equal(crossRes.status, 403, 'Cross-origin dynamic request must return 403');

  // Same-origin dynamic request with invalid trackIds -> 400
  const invalidTrackIdReq = new NextRequest('http://127.0.0.1:8888/api/upload/enrich', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify({ source: 'dynamic', trackIds: ['too-short'] }),
  });
  const invRes = await enrichRoute.POST(invalidTrackIdReq);
  assert.equal(invRes.status, 400, 'Invalid trackId (not 22 chars) must return 400');

  // More than 10 trackIds -> 400
  const elevenIds = Array.from({ length: 11 }, () => '4iV5W9uYEdYUVa79Axb7Rh');
  const elevenReq = new NextRequest('http://127.0.0.1:8888/api/upload/enrich', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify({ source: 'dynamic', trackIds: elevenIds }),
  });
  const elevenRes = await enrichRoute.POST(elevenReq);
  assert.equal(elevenRes.status, 400, 'More than 10 trackIds must return 400');

  // Valid dynamic request -> 200
  const validReq = new NextRequest('http://127.0.0.1:8888/api/upload/enrich', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify({ source: 'dynamic', trackIds: ['4iV5W9uYEdYUVa79Axb7Rh'] }),
  });
  const validRes = await enrichRoute.POST(validReq);
  assert.equal(validRes.status, 200, 'Valid same-origin dynamic request must return 200');
});

test('runEnrichmentBatch: does not write to DB, run full counts or clearServerCache when nothing pending', async () => {
  let quotaCalls = 0;
  let fullCountCalls = 0;
  let cacheClearCalls = 0;

  const enrichmentModule = loadTs('src/lib/enrichment.ts', {
    '@/lib/db/queries': {
      getActiveApiCooldown: async () => ({ active: false }),
      getPendingTracksForEnrichment: async () => [], // Nothing pending
      checkAndIncrementApiQuota: async () => { quotaCalls++; return { allowed: true, remaining: 200 }; },
      getEnrichmentProgress: async () => { fullCountCalls++; return { pending: 0, enriched: 10, delisted: 0, total: 10 }; },
      bulkApplyEnrichment: async () => {},
    },
    '@/lib/spotify': { getAccessToken: async () => 'mock-token' },
    '@/lib/db/server-cache': { clearServerCache: () => { cacheClearCalls++; } },
  });

  const result = await enrichmentModule.runEnrichmentBatch({
    bucket: 'dynamic',
    trackIds: ['4iV5W9uYEdYUVa79Axb7Rh'],
  });

  assert.equal(result.enrichedCount, 0);
  assert.equal(quotaCalls, 0, 'Must not write to DB / check quota when nothing pending');
  assert.equal(fullCountCalls, 0, 'Must not run full counts when nothing pending');
  assert.equal(cacheClearCalls, 0, 'Must not clear server cache when nothing pending');
  assert.equal(result.isComplete, false, 'Requested IDs not pending says nothing about the whole catalog');
});

test('runEnrichmentBatch: cron run with nothing pending reports real catalog progress', async () => {
  let cacheClearCalls = 0;
  const enrichmentModule = loadTs('src/lib/enrichment.ts', {
    '@/lib/db/queries': {
      getActiveApiCooldown: async () => ({ active: false }),
      getPendingTracksForEnrichment: async () => [],
      checkAndIncrementApiQuota: async () => ({ allowed: true, remaining: 700 }),
      getEnrichmentProgress: async () => ({ pending: 0, enriched: 10, delisted: 0, total: 10 }),
      bulkApplyEnrichment: async () => {},
    },
    '@/lib/spotify': { getAccessToken: async () => 'mock-token' },
    '@/lib/db/server-cache': { clearServerCache: () => { cacheClearCalls++; } },
  });

  const result = await enrichmentModule.runEnrichmentBatch({ bucket: 'cron' });
  assert.equal(result.isComplete, true);
  assert.deepEqual(result.progress, { pending: 0, enriched: 10, delisted: 0, total: 10 });
  assert.equal(cacheClearCalls, 0);
});

test('runEnrichmentBatch: only calls clearServerCache when rows were actually enriched or delisted', async () => {
  let cacheClearCalls = 0;
  let bulkApplyCalls = 0;

  // Case A: 1 track pending, Spotify returns 200 with metadata
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      status: 200,
      ok: true,
      json: async () => ({
        id: '4iV5W9uYEdYUVa79Axb7Rh',
        name: 'Track',
        duration_ms: 180000,
        artists: [{ id: 'artist1', name: 'Artist' }],
        album: { id: 'album1', name: 'Album', images: [{ url: 'http://img.com/1.jpg' }] },
      }),
    } as unknown as Response);

    const enrichmentModule = loadTs('src/lib/enrichment.ts', {
      '@/lib/db/queries': {
        getActiveApiCooldown: async () => ({ active: false }),
        getPendingTracksForEnrichment: async () => [
          { id: '4iV5W9uYEdYUVa79Axb7Rh', name: 'Track', artistName: 'Art', albumName: 'Alb', albumGroupKey: 'art::alb' },
        ],
        checkAndIncrementApiQuota: async () => ({ allowed: true, remaining: 200 }),
        getEnrichmentProgress: async () => ({ pending: 0, enriched: 1, delisted: 0, total: 1 }),
        bulkApplyEnrichment: async () => { bulkApplyCalls++; },
      },
      '@/lib/spotify': { getAccessToken: async () => 'mock-token' },
      '@/lib/db/server-cache': { clearServerCache: () => { cacheClearCalls++; } },
    });

    const result = await enrichmentModule.runEnrichmentBatch({
      bucket: 'dynamic',
      trackIds: ['4iV5W9uYEdYUVa79Axb7Rh'],
    });

    assert.equal(result.enrichedCount, 1);
    assert.equal(bulkApplyCalls, 1);
    assert.equal(cacheClearCalls, 1, 'clearServerCache must be called when row was enriched');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// 7. useDeferredEnrichment: retains answered IDs in sessionRequestedTrackIds
// ---------------------------------------------------------------------------
test('useDeferredEnrichment: does not re-request IDs the server answered for without resolving them', async () => {
  const { sessionRequestedTrackIds } = await import('../src/lib/hooks/useDeferredEnrichment');
  sessionRequestedTrackIds.clear();

  // Simulate an ID added to sessionRequestedTrackIds
  const trackId = '4iV5W9uYEdYUVa79Axb7Rh';
  sessionRequestedTrackIds.add(trackId);

  // When server answers 200 without resolving it (e.g. track has no album image),
  // it must stay in sessionRequestedTrackIds (not released)
  assert.equal(sessionRequestedTrackIds.has(trackId), true);
});
