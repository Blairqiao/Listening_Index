import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { loadTs } from './helpers/load-ts';
import * as routeUtils from '../src/lib/route-utils';
import * as searchUtils from '../src/lib/search-utils';
import * as range from '../src/lib/range';
import type { ProfileData, ProfileTarget, SearchResponse } from '../src/lib/search-types';
import type { OverviewData } from '../src/lib/types';
import type { RangeSelection } from '../src/lib/range';

interface SearchRouteStubs {
  isDbConfigured?: () => boolean;
  searchCatalog?: (query: string, sort?: string, page?: number, filter?: string) => Promise<SearchResponse>;
  getMockSearch?: (query: string, sort?: string, page?: number, filter?: string) => SearchResponse;
}

function loadSearchRoute(stubs: SearchRouteStubs = {}) {
  const searchCatalogCalls: string[] = [];
  const mockSearchCalls: string[] = [];

  const defaultSearchCatalog = async (query: string): Promise<SearchResponse> => {
    searchCatalogCalls.push(query);
    return { query, artists: [], albums: [], tracks: [], hasMore: false };
  };

  const defaultMockSearch = (query: string): SearchResponse => {
    mockSearchCalls.push(query);
    return { query, artists: [], albums: [], tracks: [], hasMore: false };
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

interface RandomRouteStubs {
  isDbConfigured?: () => boolean;
  getRandomProfileTarget?: (filter: string) => Promise<ProfileTarget | null>;
  getMockRandomProfileTarget?: (filter: string) => ProfileTarget | null;
}

function loadRandomRoute(stubs: RandomRouteStubs = {}) {
  const getRandomProfileTargetCalls: string[] = [];
  const mockRandomCalls: string[] = [];

  const defaultGetRandomProfileTarget = async (filter: string): Promise<ProfileTarget | null> => {
    getRandomProfileTargetCalls.push(filter);
    return { kind: 'track', key: 'track_123' };
  };

  const defaultGetMockRandomProfileTarget = (filter: string): ProfileTarget | null => {
    mockRandomCalls.push(filter);
    return { kind: 'artist', key: 'art_mock' };
  };

  const mergedStubs = {
    '@/lib/db': { isDbConfigured: stubs.isDbConfigured ?? (() => true) },
    '@/lib/db/queries': {
      getRandomProfileTarget: stubs.getRandomProfileTarget ?? defaultGetRandomProfileTarget,
    },
    '@/lib/mock/search-profile': {
      getMockRandomProfileTarget: stubs.getMockRandomProfileTarget ?? defaultGetMockRandomProfileTarget,
    },
    '@/lib/route-utils': routeUtils,
    '@/lib/search-utils': searchUtils,
  };

  const route = loadTs('src/app/api/listening/random/route.ts', mergedStubs);
  return { route, getRandomProfileTargetCalls, mockRandomCalls };
}

interface ProfileRouteStubs {
  isDbConfigured?: () => boolean;
  getProfile?: (target: ProfileTarget, range: RangeSelection, tz: string) => Promise<ProfileData | null>;
  getMockProfile?: (target: ProfileTarget, range: RangeSelection, tz: string) => ProfileData | null;
}

function createDummyProfile(target: ProfileTarget, sel: RangeSelection): ProfileData {
  const window = range.resolveRangeWindow(sel, { now: new Date(), tz: "UTC", logStart: null });
  const granularity = range.rangeGranularity(sel, window);
  return {
    kind: target.kind,
    key: target.key,
    name: 'Sample Name',
    artistName: target.kind === 'track' || target.kind === 'album' ? 'Sample Artist' : null,
    albumName: target.kind === 'track' ? 'Sample Album' : null,
    imageUrl: null,
    range: range.formatRangeParam(sel),
    granularity,
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
  const getProfileCalls: Array<{ target: ProfileTarget; range: RangeSelection; tz: string }> = [];
  const mockProfileCalls: Array<{ target: ProfileTarget; range: RangeSelection; tz: string }> = [];

  const defaultGetProfile = async (
    target: ProfileTarget,
    rangeSel: RangeSelection,
    tz: string
  ): Promise<ProfileData | null> => {
    getProfileCalls.push({ target, range: rangeSel, tz });
    return createDummyProfile(target, rangeSel);
  };

  const defaultMockProfile = (
    target: ProfileTarget,
    rangeSel: RangeSelection,
    tz: string
  ): ProfileData | null => {
    mockProfileCalls.push({ target, range: rangeSel, tz });
    return createDummyProfile(target, rangeSel);
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
    '@/lib/range': range,
  };

  const route = loadTs('src/app/api/listening/profile/route.ts', mergedStubs);
  return { route, getProfileCalls, mockProfileCalls };
}

interface OverviewRouteStubs {
  isDbConfigured?: () => boolean;
  getOverviewData?: (sel: RangeSelection, tz?: string) => Promise<OverviewData>;
  getMockOverview?: (sel: RangeSelection, tz: string) => OverviewData;
  getOrFetchOverview?: (sel: RangeSelection, tz: string, fetcher: () => Promise<OverviewData>) => Promise<OverviewData>;
}

function loadOverviewRoute(stubs: OverviewRouteStubs = {}) {
  const getOverviewCalls: Array<{ sel: RangeSelection; tz?: string }> = [];
  const mockOverviewCalls: Array<{ sel: RangeSelection; tz: string }> = [];
  const getOrFetchOverviewCalls: Array<{ sel: RangeSelection; tz: string }> = [];

  const defaultGetOverviewData = async (sel: RangeSelection, tz?: string): Promise<OverviewData> => {
    getOverviewCalls.push({ sel, tz });
    const window = range.resolveRangeWindow(sel, { now: new Date(), tz: tz ?? "UTC", logStart: null });
    return {
      range: range.formatRangeParam(sel),
      granularity: range.rangeGranularity(sel, window),
      logStartDate: "08 SEP 2026",
      rawMetrics: { totalMs: 12900000, trackCount: 42, artistCount: 20, elapsedDays: 1 },
      metrics: ["215", "42", "20", "3.6h"],
      topTracks: [],
      topArtists: [],
      topAlbums: [],
      activityCadence: [],
    };
  };

  const defaultMockOverview = (sel: RangeSelection, tz: string): OverviewData => {
    mockOverviewCalls.push({ sel, tz });
    const window = range.resolveRangeWindow(sel, { now: new Date(), tz, logStart: null });
    return {
      range: range.formatRangeParam(sel),
      granularity: range.rangeGranularity(sel, window),
      logStartDate: "08 SEP 2026",
      rawMetrics: { totalMs: 12900000, trackCount: 42, artistCount: 20, elapsedDays: 1 },
      metrics: ["215", "42", "20", "3.6h"],
      topTracks: [],
      topArtists: [],
      topAlbums: [],
      activityCadence: [],
    };
  };

  const defaultGetOrFetchOverview = async (sel: RangeSelection, tz: string, fetcher: () => Promise<OverviewData>): Promise<OverviewData> => {
    getOrFetchOverviewCalls.push({ sel, tz });
    return fetcher();
  };

  const mergedStubs = {
    '@/lib/db': { isDbConfigured: stubs.isDbConfigured ?? (() => true) },
    '@/lib/db/queries': {
      getOverviewData: stubs.getOverviewData ?? defaultGetOverviewData,
    },
    '@/lib/db/server-cache': {
      getOrFetchOverview: stubs.getOrFetchOverview ?? defaultGetOrFetchOverview,
    },
    '@/lib/mock/overview-data': {
      getMockOverview: stubs.getMockOverview ?? defaultMockOverview,
      MOCK_DATA: { overview: {} },
    },
    '@/lib/route-utils': routeUtils,
    '@/lib/range': range,
  };

  const route = loadTs('src/app/api/listening/overview/route.ts', mergedStubs);
  return { route, getOverviewCalls, mockOverviewCalls, getOrFetchOverviewCalls };
}

test('search route accepts an empty query and passes sort and page through', async () => {
  const calls: unknown[][] = [];
  const { route } = loadSearchRoute({
    searchCatalog: async (query, sort, page, filter) => {
      calls.push([query, sort, page, filter]);
      return { query, artists: [], albums: [], tracks: [], hasMore: false };
    },
  });

  const response = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/search?sort=oldest&page=2'));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [['', 'oldest', 2, 'all']]);
});

test('search route forwards type parameter to database query and mock search', async () => {
  const dbCalls: unknown[][] = [];
  const { route: dbRoute } = loadSearchRoute({
    isDbConfigured: () => true,
    searchCatalog: async (query, sort, page, filter) => {
      dbCalls.push([query, sort, page, filter]);
      return { query, artists: [], albums: [], tracks: [], hasMore: false };
    },
  });

  const dbRes = await dbRoute.GET(new NextRequest('http://127.0.0.1:8888/api/listening/search?q=test&type=albums&sort=recent&page=3'));
  assert.equal(dbRes.status, 200);
  assert.deepEqual(dbCalls, [['test', 'recent', 3, 'albums']]);

  const mockCalls: unknown[][] = [];
  const { route: mockRoute } = loadSearchRoute({
    isDbConfigured: () => false,
    getMockSearch: (query, sort, page, filter) => {
      mockCalls.push([query, sort, page, filter]);
      return { query, artists: [], albums: [], tracks: [], hasMore: false };
    },
  });

  const mockRes = await mockRoute.GET(new NextRequest('http://127.0.0.1:8888/api/listening/search?q=test&type=tracks&sort=most-plays&page=1'));
  assert.equal(mockRes.status, 200);
  assert.deepEqual(mockCalls, [['test', 'most-plays', 1, 'tracks']]);
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
    albums: [],
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
    albums: [],
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
      albums: [],
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
    'http://127.0.0.1:8888/api/listening/profile?album=',
    'http://127.0.0.1:8888/api/listening/profile?album=%20%20',
    'http://127.0.0.1:8888/api/listening/profile?track=%00',
  ];

  for (const url of targets) {
    const res = await route.GET(new NextRequest(url));
    assert.equal(res.status, 400, `Expected 400 for ${url}`);
    assert.equal(res.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');
    assert.deepEqual(await res.json(), { error: 'Missing track, artist, or album.' });
  }

  assert.equal(getProfileCalls.length, 0);
  assert.equal(mockProfileCalls.length, 0);
});

test('profile route rejects invalid prange parameter with 400', async () => {
  const { route, getProfileCalls, mockProfileCalls } = loadProfileRoute();

  const invalidRanges = ['2w', 'week', '', 'ALL', '10y', 'junk'];
  for (const r of invalidRanges) {
    const url = `http://127.0.0.1:8888/api/listening/profile?track=track_123&prange=${r}`;
    const res = await route.GET(new NextRequest(url));
    assert.equal(res.status, 400, `Expected 400 for range: "${r}"`);
    assert.deepEqual(await res.json(), { error: 'Invalid prange.' });
  }

  assert.equal(getProfileCalls.length, 0);
  assert.equal(mockProfileCalls.length, 0);
});

test('profile route defaults absent prange to All', async () => {
  const { route, getProfileCalls } = loadProfileRoute({ isDbConfigured: () => true });

  const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/profile?artist=art_1'));
  assert.equal(res.status, 200);
  assert.equal(getProfileCalls.length, 1);
  assert.deepEqual(getProfileCalls[0].range, { kind: 'preset', key: 'all' });
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
    range: { kind: 'preset', key: 'all' },
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
    assert.deepEqual(mockProfileCalls[0].range, { kind: 'preset', key: '6m' });
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

test('profile route passes album target through to database query and returns profile shape', async () => {
  const { route, getProfileCalls } = loadProfileRoute({ isDbConfigured: () => true });

  const url = 'http://127.0.0.1:8888/api/listening/profile?album=alb_in_rainbows&prange=6m&tz=America/Chicago';
  const res = await route.GET(new NextRequest(url));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');

  const expectedProfile = createDummyProfile({ kind: 'album', key: 'alb_in_rainbows' }, { kind: 'preset', key: '6m' });
  assert.deepEqual(await res.json(), expectedProfile);

  assert.equal(getProfileCalls.length, 1);
  assert.deepEqual(getProfileCalls[0], {
    target: { kind: 'album', key: 'alb_in_rainbows' },
    range: { kind: 'preset', key: '6m' },
    tz: 'America/Chicago',
  });
});

test('profile route passes album target through to mock profile when database is unconfigured', async () => {
  const { route, getProfileCalls, mockProfileCalls } = loadProfileRoute({ isDbConfigured: () => false });

  const url = 'http://127.0.0.1:8888/api/listening/profile?album=alb_mock&prange=1m&tz=UTC';
  const res = await route.GET(new NextRequest(url));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');

  const expectedProfile = createDummyProfile({ kind: 'album', key: 'alb_mock' }, { kind: 'preset', key: '1m' });
  assert.deepEqual(await res.json(), expectedProfile);

  assert.equal(getProfileCalls.length, 0);
  assert.equal(mockProfileCalls.length, 1);
  assert.deepEqual(mockProfileCalls[0], {
    target: { kind: 'album', key: 'alb_mock' },
    range: { kind: 'preset', key: '1m' },
    tz: 'UTC',
  });
});

test('queries barrel exports searchCatalog and getProfile', async () => {
  const queries = await import('../src/lib/db/queries/index');
  assert.equal(typeof (queries as Record<string, unknown>).searchCatalog, 'function');
  assert.equal(typeof (queries as Record<string, unknown>).getProfile, 'function');
  assert.equal(typeof (queries as Record<string, unknown>).getRandomProfileTarget, 'function');
});

test('random route returns profile target from database when db configured', async () => {
  const { route, getRandomProfileTargetCalls } = loadRandomRoute({
    isDbConfigured: () => true,
    getRandomProfileTarget: async (filter) => {
      getRandomProfileTargetCalls.push(filter);
      return { kind: 'album', key: 'alb_ok_computer' };
    },
  });

  assert.equal(route.dynamic, 'force-dynamic');
  const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/random?type=albums'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');
  assert.deepEqual(await res.json(), { kind: 'album', key: 'alb_ok_computer' });
  assert.deepEqual(getRandomProfileTargetCalls, ['albums']);
});

test('random route defaults absent or invalid type to all', async () => {
  const { route, getRandomProfileTargetCalls } = loadRandomRoute({
    isDbConfigured: () => true,
  });

  const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/random?type=invalid_type'));
  assert.equal(res.status, 200);
  const withoutType = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/random'));
  assert.equal(withoutType.status, 200);
  assert.deepEqual(getRandomProfileTargetCalls, ['all', 'all']);
});

test('random route falls back to mock when database is unconfigured', async () => {
  const { route, mockRandomCalls, getRandomProfileTargetCalls } = loadRandomRoute({
    isDbConfigured: () => false,
    getMockRandomProfileTarget: (filter) => {
      mockRandomCalls.push(filter);
      return { kind: 'artist', key: 'art_radiohead' };
    },
  });

  const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/random?type=artists'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');
  assert.deepEqual(await res.json(), { kind: 'artist', key: 'art_radiohead' });
  assert.equal(getRandomProfileTargetCalls.length, 0);
  assert.deepEqual(mockRandomCalls, ['artists']);
});

test('random route forces mock when FORCE_MOCK_DATA is true despite configured database', async () => {
  const prevEnv = process.env.FORCE_MOCK_DATA;
  process.env.FORCE_MOCK_DATA = 'true';
  try {
    const { route, mockRandomCalls, getRandomProfileTargetCalls } = loadRandomRoute({
      isDbConfigured: () => true,
      getMockRandomProfileTarget: (filter) => {
        mockRandomCalls.push(filter);
        return { kind: 'track', key: 'track_creep' };
      },
    });

    const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/random?type=tracks'));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { kind: 'track', key: 'track_creep' });
    assert.equal(getRandomProfileTargetCalls.length, 0);
    assert.deepEqual(mockRandomCalls, ['tracks']);
  } finally {
    if (prevEnv === undefined) {
      delete process.env.FORCE_MOCK_DATA;
    } else {
      process.env.FORCE_MOCK_DATA = prevEnv;
    }
  }
});

test('random route returns 404 when archive is empty', async () => {
  const { route } = loadRandomRoute({
    isDbConfigured: () => true,
    getRandomProfileTarget: async () => null,
  });

  const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/random'));
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');
  assert.deepEqual(await res.json(), { error: 'Archive is empty.' });
});

test('random route handles unexpected runtime errors with 500', async () => {
  const { route } = loadRandomRoute({
    isDbConfigured: () => true,
    getRandomProfileTarget: async () => {
      throw new Error('Database connection failed');
    },
  });

  const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/random'));
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: 'Internal Server Error' });
});

test('overview route accepts a valid window parameter and returns 200 with range and granularity in body', async () => {
  const { route, getOverviewCalls } = loadOverviewRoute({ isDbConfigured: () => true });

  const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/overview?range=2025-11-01..2025-11-30'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const body = await res.json();
  assert.equal(body.range, '2025-11-01..2025-11-30');
  assert.equal(body.granularity, 'day');
  assert.equal(getOverviewCalls.length, 1);
  assert.deepEqual(getOverviewCalls[0].sel, { kind: 'window', from: '2025-11-01', to: '2025-11-30' });

  // Mock mode
  const { route: mockRoute, mockOverviewCalls: mockCalls } = loadOverviewRoute({ isDbConfigured: () => false });
  const mockRes = await mockRoute.GET(new NextRequest('http://127.0.0.1:8888/api/listening/overview?range=2025-11-01..2025-11-30'));
  assert.equal(mockRes.status, 200);
  const mockBody = await mockRes.json();
  assert.equal(mockBody.range, '2025-11-01..2025-11-30');
  assert.equal(mockBody.granularity, 'day');
  assert.equal(mockCalls.length, 1);
});

test('overview route rejects invalid range window parameters with 400', async () => {
  const { route } = loadOverviewRoute({ isDbConfigured: () => true });

  const invalidDateRes = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/overview?range=2025-02-30..2025-03-01'));
  assert.equal(invalidDateRes.status, 400);
  assert.deepEqual(await invalidDateRes.json(), {
    error: "Invalid range parameter: '2025-02-30..2025-03-01'. Use a preset (1d, 1w, 1m, 6m, 1y, all) or YYYY-MM-DD..YYYY-MM-DD.",
  });

  const invertedRes = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/overview?range=2025-12-01..2025-11-01'));
  assert.equal(invertedRes.status, 400);
  assert.deepEqual(await invertedRes.json(), {
    error: "Invalid range parameter: '2025-12-01..2025-11-01'. Use a preset (1d, 1w, 1m, 6m, 1y, all) or YYYY-MM-DD..YYYY-MM-DD.",
  });
});

test('overview route preserves presets unchanged', async () => {
  const { route } = loadOverviewRoute({ isDbConfigured: () => true });

  for (const preset of ['1d', '1w', '1m', '6m', '1y', 'all'] as const) {
    const res = await route.GET(new NextRequest(`http://127.0.0.1:8888/api/listening/overview?range=${preset}`));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.range, preset);
  }
});

test('profile route accepts a valid window prange and returns 200 with range and granularity in body', async () => {
  const { route, getProfileCalls } = loadProfileRoute({ isDbConfigured: () => true });

  const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/profile?artist=art_radiohead&prange=2025-11-01..2025-11-30'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const body = await res.json();
  assert.equal(body.range, '2025-11-01..2025-11-30');
  assert.equal(body.granularity, 'day');
  assert.equal(getProfileCalls.length, 1);
  assert.deepEqual(getProfileCalls[0].range, { kind: 'window', from: '2025-11-01', to: '2025-11-30' });
});

test('profile route rejects prange=junk with 400', async () => {
  const { route } = loadProfileRoute({ isDbConfigured: () => true });
  const res = await route.GET(new NextRequest('http://127.0.0.1:8888/api/listening/profile?artist=art_radiohead&prange=junk'));
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'Invalid prange.' });
});
