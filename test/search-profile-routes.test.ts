import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { loadTs } from './helpers/load-ts';
import * as routeUtils from '../src/lib/route-utils';
import * as searchUtils from '../src/lib/search-utils';
import type { ProfileData, ProfileTarget, SearchResponse } from '../src/lib/search-types';
import type { RangeKey } from '../src/lib/types';

interface SearchRouteStubs {
  isDbConfigured?: () => boolean;
  searchCatalog?: (query: string, sort?: string, page?: number) => Promise<SearchResponse>;
  getMockSearch?: (query: string) => SearchResponse;
}

function loadSearchRoute(stubs: SearchRouteStubs = {}) {
  const searchCatalogCalls: string[] = [];
  const mockSearchCalls: string[] = [];

  const defaultSearchCatalog = async (query: string): Promise<SearchResponse> => {
    searchCatalogCalls.push(query);
    return { query, artists: [], tracks: [], hasMore: false };
  };

  const defaultMockSearch = (query: string): SearchResponse => {
    mockSearchCalls.push(query);
    return { query, artists: [], tracks: [], hasMore: false };
  };

  const mergedStubs = {
    '@/lib/db': { isDbConfigured: stubs.isDbConfigured ?? (() => true) },
    '@/lib/db/queries': {
      searchCatalog: stubs.searchCatalog ?? defaultSearchCatalog,
    },
    '@/lib/mock/search-profile': {
      getMockSearch: stubs.getMockSearch ?? defaultMockSearch,
    },
    '@/lib/route-utils': routeUtils,
    '@/lib/search-utils': searchUtils,
  };

  const route = loadTs('src/app/api/listening/search/route.ts', mergedStubs);
  return { route, searchCatalogCalls, mockSearchCalls };
}

interface ProfileRouteStubs {
  isDbConfigured?: () => boolean;
  getProfile?: (target: ProfileTarget, range: RangeKey, tz: string) => Promise<ProfileData | null>;
  getMockProfile?: (target: ProfileTarget, range: RangeKey, tz: string) => ProfileData | null;
}

function createDummyProfile(target: ProfileTarget, range: RangeKey): ProfileData {
  return {
    kind: target.kind,
    key: target.key,
    name: 'Sample Name',
    artistName: target.kind === 'track' ? 'Sample Artist' : null,
    albumName: target.kind === 'track' ? 'Sample Album' : null,
    imageUrl: null,
    range,
    firstPlayedAt: '2026-01-01T00:00:00.000Z',
    lastPlayedAt: '2026-01-02T00:00:00.000Z',
    plays: 5,
    rank: 1,
    rankedTotal: 10,
    activityCadence: [],
    topTracks: [],
    topAlbums: [],
    recentPlays: [],
  };
}

function loadProfileRoute(stubs: ProfileRouteStubs = {}) {
  const getProfileCalls: Array<{ target: ProfileTarget; range: RangeKey; tz: string }> = [];
  const mockProfileCalls: Array<{ target: ProfileTarget; range: RangeKey; tz: string }> = [];

  const defaultGetProfile = async (
    target: ProfileTarget,
    range: RangeKey,
    tz: string
  ): Promise<ProfileData | null> => {
    getProfileCalls.push({ target, range, tz });
    return createDummyProfile(target, range);
  };

  const defaultMockProfile = (
    target: ProfileTarget,
    range: RangeKey,
    tz: string
  ): ProfileData | null => {
    mockProfileCalls.push({ target, range, tz });
    return createDummyProfile(target, range);
  };

  const mergedStubs = {
    '@/lib/db': { isDbConfigured: stubs.isDbConfigured ?? (() => true) },
    '@/lib/db/queries': {
      getProfile: stubs.getProfile ?? defaultGetProfile,
    },
    '@/lib/mock/search-profile': {
      getMockProfile: stubs.getMockProfile ?? defaultMockProfile,
    },
    '@/lib/route-utils': routeUtils,
    '@/lib/search-utils': searchUtils,
  };

  const route = loadTs('src/app/api/listening/profile/route.ts', mergedStubs);
  return { route, getProfileCalls, mockProfileCalls };
}

test('search route accepts an empty query and passes sort and page through', async () => {
  const calls: unknown[][] = [];
  const { route } = loadSearchRoute({
    searchCatalog: async (query, sort, page) => {
      calls.push([query, sort, page]);
      return { query, artists: [], tracks: [], hasMore: false };
    },
  });

  const response = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/search?sort=oldest&page=2'));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [['', 'oldest', 2]]);
});

test('search route rejects overlong queries with 400 and exact error', async () => {
  const { route, searchCatalogCalls, mockSearchCalls } = loadSearchRoute();
  assert.equal(route.dynamic, 'force-dynamic');

  const cases: Array<{ param: string; expectedReason: string }> = [
    { param: `q=${'x'.repeat(101)}`, expectedReason: 'too_long' },
  ];

  for (const { param, expectedReason } of cases) {
    const url = `http://127.0.0.1:8888/api/listening/search${param ? `?${param}` : ''}`;
    const res = await route.GET(new NextRequest(url));
    assert.equal(res.status, 400, `Failed status for ${param}`);
    assert.equal(res.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');
    assert.deepEqual(await res.json(), { error: `Invalid query: ${expectedReason}` });
  }

  assert.equal(searchCatalogCalls.length, 0);
  assert.equal(mockSearchCalls.length, 0);
});

test('search route with configured database trims query and returns database results', async () => {
  const mockPayload: SearchResponse = {
    query: 'radio',
    hasMore: false,
    artists: [{ key: 'art_1', name: 'Radiohead', plays: 100, imageUrl: null }],
    tracks: [{ id: 'tr_1', name: 'Reckoner', artist: 'Radiohead', album: 'In Rainbows', plays: 50, albumImageUrl: null }],
  };

  const { route, searchCatalogCalls, mockSearchCalls } = loadSearchRoute({
    isDbConfigured: () => true,
    searchCatalog: async (query) => {
      searchCatalogCalls.push(query);
      return mockPayload;
    },
  });

  const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/search?q=%20radio%20'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');
  assert.deepEqual(await res.json(), mockPayload);
  assert.deepEqual(searchCatalogCalls, ['radio']);
  assert.equal(mockSearchCalls.length, 0);
});

test('search route falls back to mock when database is unconfigured', async () => {
  const mockResult: SearchResponse = {
    query: 'radio',
    hasMore: false,
    artists: [{ key: 'art_mock', name: 'Radiohead', plays: 10, imageUrl: null }],
    tracks: [],
  };

  const { route, searchCatalogCalls, mockSearchCalls } = loadSearchRoute({
    isDbConfigured: () => false,
    getMockSearch: (query) => {
      mockSearchCalls.push(query);
      return mockResult;
    },
  });

  const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/search?q=%20radio%20'));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), mockResult);
  assert.equal(searchCatalogCalls.length, 0);
  assert.deepEqual(mockSearchCalls, ['radio']);
});

test('search route forces mock when FORCE_MOCK_DATA is true despite configured database', async () => {
  const prevEnv = process.env.FORCE_MOCK_DATA;
  process.env.FORCE_MOCK_DATA = 'true';
  try {
    const mockResult: SearchResponse = {
      query: 'bjork',
      hasMore: false,
      artists: [],
      tracks: [],
    };

    const { route, searchCatalogCalls, mockSearchCalls } = loadSearchRoute({
      isDbConfigured: () => true,
      getMockSearch: (query) => {
        mockSearchCalls.push(query);
        return mockResult;
      },
    });

    const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/search?q=bjork'));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), mockResult);
    assert.equal(searchCatalogCalls.length, 0);
    assert.deepEqual(mockSearchCalls, ['bjork']);
  } finally {
    if (prevEnv === undefined) {
      delete process.env.FORCE_MOCK_DATA;
    } else {
      process.env.FORCE_MOCK_DATA = prevEnv;
    }
  }
});

test('search route handles unexpected runtime errors with 500', async () => {
  const { route } = loadSearchRoute({
    isDbConfigured: () => true,
    searchCatalog: async () => {
      throw new Error('Database connection failed');
    },
  });

  const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/search?q=radio'));
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: 'Internal Server Error' });
});

test('profile route rejects missing or empty target with 400', async () => {
  const { route, getProfileCalls, mockProfileCalls } = loadProfileRoute();
  assert.equal(route.dynamic, 'force-dynamic');

  const targets = [
    'http://127.0.0.1:8888/api/listening/profile',
    'http://127.0.0.1:8888/api/listening/profile?track=',
    'http://127.0.0.1:8888/api/listening/profile?artist=%20%20',
    'http://127.0.0.1:8888/api/listening/profile?track=%00',
  ];

  for (const url of targets) {
    const res = await route.GET(new NextRequest(url));
    assert.equal(res.status, 400, `Expected 400 for ${url}`);
    assert.equal(res.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');
    assert.deepEqual(await res.json(), { error: 'Missing track or artist.' });
  }

  assert.equal(getProfileCalls.length, 0);
  assert.equal(mockProfileCalls.length, 0);
});

test('profile route rejects invalid prange parameter with 400', async () => {
  const { route, getProfileCalls, mockProfileCalls } = loadProfileRoute();

  const invalidRanges = ['2w', 'week', '', 'ALL', '10y'];
  for (const r of invalidRanges) {
    const url = `http://127.0.0.1:8888/api/listening/profile?track=track_123&prange=${r}`;
    const res = await route.GET(new NextRequest(url));
    assert.equal(res.status, 400, `Expected 400 for range: "${r}"`);
    assert.deepEqual(await res.json(), { error: 'Invalid prange.' });
  }

  assert.equal(getProfileCalls.length, 0);
  assert.equal(mockProfileCalls.length, 0);
});

test('profile route defaults absent prange to 1w', async () => {
  const { route, getProfileCalls } = loadProfileRoute({ isDbConfigured: () => true });

  const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/profile?artist=art_1'));
  assert.equal(res.status, 200);
  assert.equal(getProfileCalls.length, 1);
  assert.equal(getProfileCalls[0].range, '1w');
  assert.deepEqual(getProfileCalls[0].target, { kind: 'artist', key: 'art_1' });
});

test('profile route returns 404 when target is not found', async () => {
  const { route } = loadProfileRoute({
    isDbConfigured: () => true,
    getProfile: async () => null,
  });

  const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/profile?track=nonexistent_track'));
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');
  assert.deepEqual(await res.json(), { error: 'Not found' });
});

test('profile route executes query with parsed target, explicit range, and query timezone', async () => {
  const { route, getProfileCalls } = loadProfileRoute({ isDbConfigured: () => true });

  const url = 'http://127.0.0.1:8888/api/listening/profile?artist=art_radiohead&prange=all&tz=Asia/Tokyo';
  const res = await route.GET(new NextRequest(url));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');

  assert.equal(getProfileCalls.length, 1);
  assert.deepEqual(getProfileCalls[0], {
    target: { kind: 'artist', key: 'art_radiohead' },
    range: 'all',
    tz: 'Asia/Tokyo',
  });
});

test('profile route evaluates cookie timezone and query parameter precedence with real NextRequest', async () => {
  const { route, getProfileCalls } = loadProfileRoute({ isDbConfigured: () => true });

  // Precedence 1: Cookie timezone used when query tz is absent
  const cookieOnlyReq = new NextRequest('http://127.0.0.1:8888/api/listening/profile?track=track_abc', {
    headers: { cookie: 'listening_timezone=America%2FNew_York' },
  });
  const resA = await route.GET(cookieOnlyReq);
  assert.equal(resA.status, 200);
  assert.equal(getProfileCalls.at(-1)?.tz, 'America/New_York');

  // Precedence 2: Query param tz overrides cookie timezone
  const overrideReq = new NextRequest('http://127.0.0.1:8888/api/listening/profile?track=track_abc&tz=Asia/Tokyo', {
    headers: { cookie: 'listening_timezone=America%2FNew_York' },
  });
  const resB = await route.GET(overrideReq);
  assert.equal(resB.status, 200);
  assert.equal(getProfileCalls.at(-1)?.tz, 'Asia/Tokyo');

  // Precedence 3: UTC fallback when neither query nor cookie is provided
  const fallbackReq = new NextRequest('http://127.0.0.1:8888/api/listening/profile?track=track_abc');
  const resC = await route.GET(fallbackReq);
  assert.equal(resC.status, 200);
  assert.equal(getProfileCalls.at(-1)?.tz, 'UTC');
});

test('profile route forces mock when FORCE_MOCK_DATA is true despite configured database', async () => {
  const prevEnv = process.env.FORCE_MOCK_DATA;
  process.env.FORCE_MOCK_DATA = 'true';
  try {
    const { route, getProfileCalls, mockProfileCalls } = loadProfileRoute({
      isDbConfigured: () => true,
    });

    const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/profile?artist=art_mock&prange=6m'));
    assert.equal(res.status, 200);
    assert.equal(getProfileCalls.length, 0);
    assert.equal(mockProfileCalls.length, 1);
    assert.deepEqual(mockProfileCalls[0].target, { kind: 'artist', key: 'art_mock' });
    assert.equal(mockProfileCalls[0].range, '6m');
  } finally {
    if (prevEnv === undefined) {
      delete process.env.FORCE_MOCK_DATA;
    } else {
      process.env.FORCE_MOCK_DATA = prevEnv;
    }
  }
});

test('profile route handles unexpected runtime errors with 500', async () => {
  const { route } = loadProfileRoute({
    isDbConfigured: () => true,
    getProfile: async () => {
      throw new Error('Database query failure');
    },
  });

  const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/profile?track=track_1'));
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: 'Internal Server Error' });
});

test('queries barrel exports searchCatalog and getProfile', async () => {
  const queries = await import('../src/lib/db/queries/index');
  assert.equal(typeof (queries as Record<string, unknown>).searchCatalog, 'function');
  assert.equal(typeof (queries as Record<string, unknown>).getProfile, 'function');
});
