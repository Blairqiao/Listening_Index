import { test, mock } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useSearch, clearSearchCache } from "../src/components/views/search-view/useSearch";
import { SearchView, type SearchViewProps } from "../src/components/views/search-view/SearchView";
import { SegmentedShareBar } from "../src/components/views/search-view/ShareBar";
import { buildShareSegments } from "../src/lib/profile-stats";
import type { SearchFilter, SearchResponse, SearchSort } from "../src/lib/search-types";

function createHookHarness() {
  const stateValues: unknown[] = [];
  const stateSetters: Array<(v: unknown) => void> = [];
  const effectDeps: unknown[][] = [];
  const effectCleanups: Array<(() => void) | void> = [];
  let effectPending: Array<{ idx: number; effect: () => (() => void) | void }> = [];

  let stateCursor = 0;
  let effectCursor = 0;
  let isRendering = false;
  let stateChangedDuringRender = false;

  const mockReact = {
    useState: <T>(initial: T | (() => T)): [T, (v: unknown) => void] => {
      const idx = stateCursor++;
      if (!(idx in stateValues)) {
        stateValues[idx] = typeof initial === "function" ? (initial as () => T)() : initial;
      }
      if (!stateSetters[idx]) {
        stateSetters[idx] = (value: unknown) => {
          const next = typeof value === "function" ? (value as (prev: unknown) => unknown)(stateValues[idx]) : value;
          if (next !== stateValues[idx]) {
            stateValues[idx] = next;
            if (isRendering) {
              stateChangedDuringRender = true;
            }
          }
        };
      }
      return [stateValues[idx] as T, stateSetters[idx]];
    },
    useEffect: (effect: () => (() => void) | void, deps: unknown[] = []) => {
      const idx = effectCursor++;
      const prev = effectDeps[idx];
      const hasChanged = !prev || deps.some((d, i) => d !== prev[i]);
      if (hasChanged) {
        effectDeps[idx] = deps;
        effectPending.push({ idx, effect });
      }
    },
  };

  const runTurn = (q: string, sort?: SearchSort, page?: number, filter?: SearchFilter) => {
    let result: ReturnType<typeof useSearch> | undefined;
    let passes = 0;
    do {
      stateChangedDuringRender = false;
      stateCursor = 0;
      effectCursor = 0;
      isRendering = true;
      try {
        result = useSearch(q, sort, page, filter);
      } finally {
        isRendering = false;
      }
    } while (stateChangedDuringRender && ++passes < 10);

    const pending = [...effectPending];
    effectPending = [];
    for (const item of pending) {
      const cleanup = effectCleanups[item.idx];
      if (typeof cleanup === "function") {
        cleanup();
      }
      effectCleanups[item.idx] = item.effect();
    }
    return result!;
  };

  const cleanup = () => {
    for (const c of effectCleanups) {
      if (typeof c === "function") c();
    }
  };

  const resetCursor = () => {
    stateCursor = 0;
    effectCursor = 0;
  };

  return { mockReact, runTurn, cleanup, resetCursor };
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

async function primeSearch(
  query: string,
  response: SearchResponse,
  sort?: SearchSort,
  page?: number,
  filter?: SearchFilter,
) {
  mock.timers.enable({ apis: ["setTimeout"] });
  const origFetch = globalThis.fetch;
  const origUseState = React.useState;
  const origUseEffect = React.useEffect;

  const harness = createHookHarness();
  (React as unknown as { useState: unknown }).useState = harness.mockReact.useState;
  (React as unknown as { useEffect: unknown }).useEffect = harness.mockReact.useEffect;

  globalThis.fetch = (async () => {
    return {
      ok: true,
      json: async () => response,
    } as unknown as Response;
  }) as typeof fetch;

  try {
    harness.runTurn(query, sort, page, filter);
    mock.timers.tick(250);
    await flushMicrotasks();
    harness.runTurn(query, sort, page, filter);
  } finally {
    harness.cleanup();
    (React as unknown as { useState: unknown }).useState = origUseState;
    (React as unknown as { useEffect: unknown }).useEffect = origUseEffect;
    globalThis.fetch = origFetch;
    mock.timers.reset();
  }
}

test("SearchView SSR: renders named input, placeholder, maxLength, and page scrolling", () => {
  const html = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "",
      onQueryChange: () => {},
      onOpenProfile: () => {},
    })
  );

  // Input attributes
  assert.ok(html.includes('type="search"'), 'Must render type="search"');
  assert.ok(html.includes('name="search"'), 'Must render name="search"');
  assert.ok(
    html.includes('placeholder="Search tracks, artists or albums"'),
    "Must render correct placeholder"
  );
  assert.ok(
    html.includes('maxlength="200"') || html.includes('maxLength="200"'),
    "Must render maxLength 200 (SEARCH_MAX_CHARS * 2)"
  );
  assert.ok(
    html.includes('aria-label="Search tracks, artists or albums"'),
    "Must render aria-label for accessibility"
  );

  assert.doesNotMatch(html, /overflow-y-auto|scrollbar-hidden|md:h-\[560px\]/);
  assert.doesNotMatch(html, /mt-4 md:mt-6/, "Root must not add duplicate top margin");
});

test("SearchView browses on empty input and accepts a single character", async () => {
  await primeSearch("", {
    query: "",
    hasMore: true,
    artists: [{ key: "artist-1", name: "Default Artist", plays: 10, imageUrl: null }],
    albums: [],
    tracks: [],
  });
  const render = (query: string) => renderToStaticMarkup(
    React.createElement(SearchView, {
      query,
      onQueryChange: () => {},
      onOpenProfile: () => {},
    })
  );
  const browseHtml = render("");
  assert.match(browseHtml, /Default Artist/);
  assert.doesNotMatch(browseHtml, /text-\[#5A5A55\]">Albums</);
  assert.doesNotMatch(browseHtml, /<select\b/);
  assert.match(browseHtml, /aria-haspopup="listbox"/);
  assert.match(browseHtml, /aria-label="Sort by"/);
  assert.match(browseHtml, />Most plays</);
  assert.match(browseHtml, /aria-label="Previous page"[^>]*>← Prev</);
  assert.match(browseHtml, /aria-label="Next page"[^>]*>Next →</);
  assert.match(browseHtml, />Page<\/span> 01</);
  const shortHtml = render("r");
  assert.doesNotMatch(shortHtml, /SEARCHING/);
  assert.doesNotMatch(shortHtml, /TYPE 2/);

  // 3. Too long query (>100 characters)
  const longHtml = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "a".repeat(101),
      onQueryChange: () => {},
      onOpenProfile: () => {},
    })
  );
  assert.ok(
    longHtml.includes("Query too long"),
    "Query >100 chars must show Query too long"
  );

  // 4. Loading query (valid query, not yet cached)
  const loadingHtml = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "uncached-band",
      onQueryChange: () => {},
      onOpenProfile: () => {},
    })
  );
  assert.doesNotMatch(
    loadingHtml,
    /SEARCHING/,
    "Uncached valid query must not show SEARCHING"
  );

  // 5. Ready with no results -> [ NO MATCHES ] (cached via hook execution)
  await primeSearch("noresults", {
    query: "noresults",
    hasMore: false,
    artists: [],
    albums: [],
    tracks: [],
  });
  const noMatchesHtml = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "noresults",
      onQueryChange: () => {},
      onOpenProfile: () => {},
    })
  );
  assert.ok(
    noMatchesHtml.includes("No matches"),
    "Empty response must show No matches"
  );
});

const albumResult = {
  key: "radiohead::amnesiac",
  name: "Amnesiac",
  artist: "Radiohead",
  plays: 124,
  imageUrl: "https://example.com/amnesiac.jpg",
};

test("SearchView results rendering: columns, row style, artwork, and buttons without wrapper role", async () => {
  const mockResponse: SearchResponse = {
    query: "radio",
    hasMore: false,
    artists: [
      {
        key: "4Z8W4fKeB5YxbusRsdQVPb",
        name: "Radiohead",
        plays: 1420,
        imageUrl: "https://example.com/radiohead.jpg",
      },
    ],
    albums: [albumResult],
    tracks: [
      {
        id: "4clD00s1c0rVqP9Ld0vV48",
        name: "Weird Fishes / Arpeggi",
        artist: "Radiohead",
        album: "In Rainbows",
        plays: 320,
        albumImageUrl: "https://example.com/in-rainbows.jpg",
      },
    ],
  };

  await primeSearch("radio", mockResponse);

  const html = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "radio",
      onQueryChange: () => {},
      onOpenProfile: () => {},
    })
  );

  // Column headers
  assert.ok(html.includes('text-[#5A5A55]">Artists<'), "Must render Artists header");
  assert.ok(html.includes('text-[#5A5A55]">Tracks<'), "Must render Tracks header");
  assert.match(html, /text-\[#5A5A55\]">Tracks<.*text-\[#5A5A55\]">Artists<.*text-\[#5A5A55\]">Albums</);
  assert.match(html, /md:h-\[55px\][^>]*><span[^>]*>Albums</);

  // Verify role="list" was removed from column containers
  assert.ok(
    !html.includes('role="list"'),
    "Column containers must not have role='list' wrapping buttons or empty rows"
  );

  // Artist row details
  assert.ok(html.includes("Radiohead"), "Must render artist name");
  assert.ok(html.includes("1,420"), "Must render formatted artist plays");
  assert.ok(
    html.includes("<button") && html.includes('type="button"'),
    "Rows must be <button type=\"button\">"
  );

  // Track row details
  assert.ok(
    html.includes("Weird Fishes / Arpeggi"),
    "Must render track title"
  );
  assert.ok(html.includes("In Rainbows"), "Must render track album");
  assert.ok(html.includes("320"), "Must render track plays");

  const albumButton = html.match(/<button\b[^>]*>.*?<\/button>/g)
    ?.find((button) => button.includes(">Amnesiac</span>"));
  assert.ok(albumButton, "Must render the Album as a button");
  assert.match(albumButton, /type="button"/);
  assert.match(albumButton, /src="https:\/\/example.com\/amnesiac.jpg"/);
  assert.match(albumButton, />Radiohead<\/div>/);
  assert.match(albumButton, />124<\/span>/);

  // Status line is clean when results exist
  assert.ok(!html.includes("No matches"), "Should not show no matches");
  assert.ok(!html.includes("SEARCHING…"), "Should not show searching when cached");
});

test("SearchView shows album-only results with a standard heading", async () => {
  await primeSearch("amnesiac", {
    query: "amnesiac",
    hasMore: false,
    artists: [],
    albums: [albumResult],
    tracks: [],
  });

  const html = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "amnesiac",
      onQueryChange: () => {},
      onOpenProfile: () => {},
    })
  );

  assert.match(html, /No tracks/);
  assert.match(html, /text-\[#5A5A55\]">Albums<.*>Amnesiac</);
  assert.doesNotMatch(html, /text-\[#5A5A55\]">Artists<|No artists|No matches/);
  assert.doesNotMatch(html, /md:h-\[55px\][^>]*><span[^>]*>Albums</);
});

test("useSearch hook behavior: debounce, abort, stale response, error-whitespace regression, and cache hit", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const origFetch = globalThis.fetch;
  const origUseState = React.useState;
  const origUseEffect = React.useEffect;

  const harness = createHookHarness();
  (React as unknown as { useState: unknown }).useState = harness.mockReact.useState;
  (React as unknown as { useEffect: unknown }).useEffect = harness.mockReact.useEffect;

  const fetchCalls: Array<{ url: string; signal: AbortSignal }> = [];
  let slowResolve: ((v: Response) => void) | null = null;

  globalThis.fetch = ((url: string, opts?: RequestInit) => {
    const signal = opts?.signal as AbortSignal;
    const u = new URL(url, "http://localhost");
    const q = u.searchParams.get("q") ?? "";

    if (q === "fail-q") {
      fetchCalls.push({ url, signal });
      return Promise.resolve({ ok: false, status: 500 } as unknown as Response);
    }

    if (q === "slow-q") {
      fetchCalls.push({ url, signal });
      return new Promise<Response>((resolve) => {
        slowResolve = resolve;
      });
    }

    fetchCalls.push({ url, signal });
    return Promise.resolve({
      ok: true,
      json: async () => ({
        query: q,
        artists: [{ key: `a-${q}`, name: `Artist ${q}`, plays: 100, imageUrl: null }],
        albums: [],
        tracks: [{ id: `t-${q}`, name: `Track ${q}`, artist: `Artist ${q}`, album: "Alb", plays: 50, albumImageUrl: null }],
      }),
    } as unknown as Response);
  }) as typeof fetch;

  try {
    // 1. Overlong queries do not start a request
    let res = harness.runTurn("a".repeat(101));
    assert.equal(res.status, "idle");
    assert.equal(res.data, null);
    assert.equal(fetchCalls.length, 0);

    // 2. Query "ra" -> status loading, 250ms debounce
    res = harness.runTurn("ra");
    assert.equal(res.status, "loading");
    assert.equal(res.data, null);
    assert.equal(fetchCalls.length, 0, "Fetch must not be called immediately (250ms debounce)");

    // Advance 250ms
    mock.timers.tick(250);
    await flushMicrotasks();
    assert.equal(fetchCalls.length, 1, "Fetch should be called after 250ms");
    assert.ok(fetchCalls[0].url.includes("q=ra"));

    // Turn after fetch resolved
    res = harness.runTurn("ra");
    assert.equal(res.status, "ready");
    assert.equal(res.data?.artists[0]?.name, "Artist ra");

    // 3. Keystroke to "rad" (not yet cached) -> loading, but previous "ra" data is retained!
    res = harness.runTurn("rad");
    assert.equal(res.status, "loading");
    assert.equal(res.data?.artists[0]?.name, "Artist ra", "Must retain prior results while loading");

    // 4. Backspace back to "ra" -> cached hit immediate!
    const fetchCountBefore = fetchCalls.length;
    res = harness.runTurn("ra");
    assert.equal(res.status, "ready", "Cached hit must be ready immediately");
    assert.equal(res.data?.artists[0]?.name, "Artist ra");
    assert.equal(fetchCalls.length, fetchCountBefore, "Cache hit must not make a network request");

    // 5. Abort and stale response verification:
    // Start slow-q fetch which remains in-flight
    res = harness.runTurn("slow-q");
    assert.equal(res.status, "loading");
    mock.timers.tick(250);
    await flushMicrotasks();

    const slowCall = fetchCalls.find((c) => c.url.includes("q=slow-q"))!;
    assert.ok(slowCall, "slow-q fetch must have been initiated");
    assert.equal(slowCall.signal.aborted, false, "signal must not be aborted while in-flight");

    // Switch to another query before slow-q resolves -> aborts slow-q
    res = harness.runTurn("fast-q");
    assert.equal(slowCall.signal.aborted, true, "Previous fetch signal must be aborted on query change");

    // Resolve fast-q
    mock.timers.tick(250);
    await flushMicrotasks();
    res = harness.runTurn("fast-q");
    assert.equal(res.status, "ready");
    assert.equal(res.data?.artists[0]?.name, "Artist fast-q");

    // Now resolve the aborted slow-q response (stale response)
    const resolveSlow = slowResolve as ((v: Response) => void) | null;
    if (resolveSlow) {
      resolveSlow({
        ok: true,
        json: async () => ({
          query: "slow-q",
          artists: [{ key: "slow", name: "Slow", plays: 1, imageUrl: null }],
          albums: [],
          tracks: [],
        }),
      } as unknown as Response);
    }
    await flushMicrotasks();

    // Turn for fast-q must remain fast-q data (not overwritten by stale response)
    res = harness.runTurn("fast-q");
    assert.equal(res.status, "ready");
    assert.equal(res.data?.artists[0]?.name, "Artist fast-q", "Stale response must not overwrite current ready data");

    // Clearing the search keeps the previous matches (dimmed) instead of flashing null.
    res = harness.runTurn("", "oldest", 2);
    assert.equal(res.status, "loading");
    assert.equal(res.data?.artists[0]?.name, "Artist fast-q", "Prior results must be retained during clearing to browse");
    mock.timers.tick(250);
    await flushMicrotasks();
    const browseUrl = new URL(fetchCalls.at(-1)!.url, "http://localhost");
    assert.equal(browseUrl.searchParams.get("q"), "");
    assert.equal(browseUrl.searchParams.get("sort"), "oldest");
    assert.equal(browseUrl.searchParams.get("page"), "2");
    assert.equal(harness.runTurn("", "oldest", 2).status, "ready");

    // 7. Regression for Finding (1): non-OK fetch then surrounding whitespace
    res = harness.runTurn("fail-q");
    assert.equal(res.status, "loading");
    mock.timers.tick(250);
    await flushMicrotasks();
    res = harness.runTurn("fail-q");
    assert.equal(res.status, "error");

    // Typing surrounding whitespace around errored query must remain in error state
    res = harness.runTurn("  fail-q  ");
    assert.equal(res.status, "error", "Editing surrounding whitespace after error must not hang in loading");
  } finally {
    harness.cleanup();
    (React as unknown as { useState: unknown }).useState = origUseState;
    (React as unknown as { useEffect: unknown }).useEffect = origUseEffect;
    globalThis.fetch = origFetch;
    mock.timers.reset();
  }
});

test("useSearch production cache FIFO eviction at 50 entries", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const origFetch = globalThis.fetch;
  const origUseState = React.useState;
  const origUseEffect = React.useEffect;

  const harness = createHookHarness();
  (React as unknown as { useState: unknown }).useState = harness.mockReact.useState;
  (React as unknown as { useEffect: unknown }).useEffect = harness.mockReact.useEffect;

  const fetchCalls: string[] = [];
  globalThis.fetch = ((url: string) => {
    const u = new URL(url, "http://localhost");
    const q = u.searchParams.get("q") ?? "";
    fetchCalls.push(q);
    return Promise.resolve({
      ok: true,
      json: async () => ({
        query: q,
        artists: [{ key: `k-${q}`, name: `Artist ${q}`, plays: 1, imageUrl: null }],
        albums: [],
        tracks: [],
      }),
    } as unknown as Response);
  }) as typeof fetch;

  try {
    // Fill cache with 50 distinct queries (ev-01 to ev-50) entirely through the production hook
    for (let i = 1; i <= 50; i++) {
      const q = `ev-${String(i).padStart(2, "0")}`;
      harness.runTurn(q);
      mock.timers.tick(250);
      await flushMicrotasks();
      harness.runTurn(q);
    }
    assert.equal(fetchCalls.length, 50, "All 50 distinct queries must have been fetched and cached");

    // Add 51st entry (ev-51) through production hook -> triggers FIFO eviction of oldest entry (ev-01)
    harness.runTurn("ev-51");
    mock.timers.tick(250);
    await flushMicrotasks();
    let res = harness.runTurn("ev-51");
    assert.equal(res.status, "ready");
    assert.equal(fetchCalls.length, 51, "ev-51 must have been fetched");

    // ev-50 and ev-51 are still in cache
    res = harness.runTurn("ev-50");
    assert.equal(res.status, "ready");
    assert.equal(fetchCalls.length, 51, "ev-50 must still be cached (no fetch)");

    res = harness.runTurn("ev-51");
    assert.equal(res.status, "ready");
    assert.equal(fetchCalls.length, 51, "ev-51 must still be cached (no fetch)");

    // Oldest entry (ev-01) was evicted: querying it is a cache miss (returns loading, initiates fetch)
    res = harness.runTurn("ev-01");
    assert.equal(res.status, "loading", "Evicted entry must not be in cache (returns loading)");
    mock.timers.tick(250);
    await flushMicrotasks();
    assert.equal(fetchCalls.length, 52, "Querying evicted entry must trigger a new fetch");
  } finally {
    harness.cleanup();
    (React as unknown as { useState: unknown }).useState = origUseState;
    (React as unknown as { useEffect: unknown }).useEffect = origUseEffect;
    globalThis.fetch = origFetch;
    mock.timers.reset();
  }
});

test("useSearch hook: filter-specific cache keys, clearSearchCache invalidation, stale pre-clear discard, and retention", async () => {
  clearSearchCache();
  mock.timers.enable({ apis: ["setTimeout"] });
  const origFetch = globalThis.fetch;
  const origUseState = React.useState;
  const origUseEffect = React.useEffect;

  const harness = createHookHarness();
  (React as unknown as { useState: unknown }).useState = harness.mockReact.useState;
  (React as unknown as { useEffect: unknown }).useEffect = harness.mockReact.useEffect;

  const fetchUrls: string[] = [];
  let pendingResolve: ((res: Response) => void) | null = null;

  globalThis.fetch = ((url: string, _opts?: RequestInit) => {
    fetchUrls.push(url);
    const u = new URL(url, "http://localhost");
    const q = u.searchParams.get("q") ?? "";
    const filterType = u.searchParams.get("type") ?? "all";

    if (q === "hang-pre-clear") {
      return new Promise<Response>((resolve) => {
        pendingResolve = resolve;
      });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        query: q,
        artists: [{ key: `art-${q}-${filterType}`, name: `Artist ${q} ${filterType}`, plays: 10, imageUrl: null }],
        albums: [],
        tracks: [],
      }),
    } as unknown as Response);
  }) as typeof fetch;

  try {
    // 1. Filter-specific cache key: initial fetch with tracks
    let res = harness.runTurn("radiohead", "most-plays", 1, "tracks");
    assert.equal(res.status, "loading");
    assert.equal(res.dataFilter, null, "dataFilter must be null when data is null");
    mock.timers.tick(250);
    await flushMicrotasks();
    assert.equal(fetchUrls.length, 1);
    assert.ok(fetchUrls[0].includes("type=tracks"), "URL must include type=tracks");

    res = harness.runTurn("radiohead", "most-plays", 1, "tracks");
    assert.equal(res.status, "ready");
    assert.equal(res.dataFilter, "tracks", "dataFilter must be tracks for ready response");
    assert.equal(res.data?.artists[0]?.name, "Artist radiohead tracks");

    // 2. Switching filter to 'artists' for same query is a cache miss
    res = harness.runTurn("radiohead", "most-plays", 1, "artists");
    assert.equal(res.status, "loading");
    assert.equal(res.dataFilter, "tracks", "dataFilter must remain tracks while loading new filter");
    assert.equal(res.data?.artists[0]?.name, "Artist radiohead tracks", "Retains prior ready results while loading");
    mock.timers.tick(250);
    await flushMicrotasks();
    assert.equal(fetchUrls.length, 2);
    assert.ok(fetchUrls[1].includes("type=artists"), "URL must include type=artists");

    res = harness.runTurn("radiohead", "most-plays", 1, "artists");
    assert.equal(res.status, "ready");
    assert.equal(res.dataFilter, "artists", "dataFilter must be artists when ready");
    assert.equal(res.data?.artists[0]?.name, "Artist radiohead artists");

    // 3. clearSearchCache invalidates cache and triggers refetch on same query
    clearSearchCache();
    res = harness.runTurn("radiohead", "most-plays", 1, "artists");
    assert.equal(res.status, "loading", "After clearSearchCache, entry must not hit cache");
    assert.equal(res.dataFilter, "artists", "dataFilter remains artists while previous data is retained");
    assert.equal(res.data?.artists[0]?.name, "Artist radiohead artists");
    mock.timers.tick(250);
    await flushMicrotasks();
    assert.equal(fetchUrls.length, 3, "Refetch must occur after clearSearchCache");

    res = harness.runTurn("radiohead", "most-plays", 1, "artists");
    assert.equal(res.status, "ready");
    assert.equal(res.dataFilter, "artists");

    // 4. Stale pre-clear in-flight response must be discarded after clearSearchCache
    res = harness.runTurn("hang-pre-clear", "most-plays", 1, "all");
    assert.equal(res.status, "loading");
    mock.timers.tick(250);
    await flushMicrotasks();
    assert.ok(pendingResolve, "hang-pre-clear fetch must be initiated");

    // Clear cache while request is in-flight
    clearSearchCache();

    // Now resolve the hung request
    const resolve = pendingResolve as ((r: Response) => void) | null;
    if (resolve) {
      resolve({
        ok: true,
        json: async () => ({
          query: "hang-pre-clear",
          artists: [{ key: "stale", name: "Stale Artist", plays: 1, imageUrl: null }],
          albums: [],
          tracks: [],
        }),
      } as unknown as Response);
    }
    await flushMicrotasks();

    // Rerender after resolve - must NOT be ready with stale data
    res = harness.runTurn("hang-pre-clear", "most-plays", 1, "all");
    assert.notEqual(res.data?.artists[0]?.name, "Stale Artist", "Stale pre-clear response must be discarded");

    // 5. Clear-to-browse retention: transitioning query to "" retains prior results while loading
    res = harness.runTurn("cleartest", "most-plays", 1, "all");
    mock.timers.tick(250);
    await flushMicrotasks();
    res = harness.runTurn("cleartest", "most-plays", 1, "all");
    assert.equal(res.status, "ready");

    res = harness.runTurn("", "most-plays", 1, "all");
    assert.equal(res.status, "loading");
    assert.ok(res.data !== null, "Prior data must be retained during clearing to browse");
    assert.equal(res.data?.artists[0]?.name, "Artist cleartest all");
  } finally {
    clearSearchCache();
    harness.cleanup();
    (React as unknown as { useState: unknown }).useState = origUseState;
    (React as unknown as { useEffect: unknown }).useEffect = origUseEffect;
    globalThis.fetch = origFetch;
    mock.timers.reset();
  }
});

test("SearchView top control strip: filter pills with totals, bracket sort trigger, and optional random button", async () => {
  clearSearchCache();
  await primeSearch("radio", {
    query: "radio",
    hasMore: false,
    artists: [{ key: "a1", name: "Radiohead", plays: 100, imageUrl: null }],
    albums: [],
    tracks: [],
    totals: { tracks: 42, artists: 12, albums: 5 },
  }, "most-plays", 1, "tracks");

  const html = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "radio",
      onQueryChange: () => {},
      onOpenProfile: () => {},
      filter: "tracks",
      sort: "most-plays",
      onRandomProfile: () => {},
    })
  );

  // Filter group & accessibility
  assert.match(html, /role="group"/);
  assert.match(html, /aria-label="Filter by type"/);
  assert.match(html, /aria-pressed="true"[^>]*>[^<]*<span>Tracks<\/span>/);
  assert.match(html, /aria-pressed="false"[^>]*>[^<]*<span>All<\/span>/);
  assert.match(html, /aria-pressed="false"[^>]*>[^<]*<span>Artists<\/span>/);
  assert.match(html, /aria-pressed="false"[^>]*>[^<]*<span>Albums<\/span>/);
  assert.match(html, />All<\/span>/);
  assert.match(html, />Tracks<\/span>/);
  assert.match(html, />Artists<\/span>/);
  assert.match(html, />Albums<\/span>/);

  // Pill totals counts with hidden sm:inline markup
  assert.match(
    html,
    /<span class="hidden sm:inline ml-1 font-mono text-\[11px\] text-\[#5A5A55\] tabular-nums">42<\/span>/
  );
  assert.match(
    html,
    /<span class="hidden sm:inline ml-1 font-mono text-\[11px\] text-\[#5A5A55\] tabular-nums">12<\/span>/
  );
  assert.match(
    html,
    /<span class="hidden sm:inline ml-1 font-mono text-\[11px\] text-\[#5A5A55\] tabular-nums">5<\/span>/
  );

  // Filter pill styling: ControlRow padding and visible focus-visible outline
  assert.match(html, /px-1 sm:px-2\.5/);
  assert.match(html, /focus-visible:outline-music-accent/);

  // Active filter styling: tracks is active -> border-music-accent text-music-accent
  assert.match(html, /border-music-accent text-music-accent[^>]*>[^<]*<span>Tracks<\/span>/);

  // Bracketed sort trigger with a chevron icon
  assert.match(html, /Sort:<\/span><span>Most plays<\/span><svg\b[^>]*lucide-chevron-down[^>]*>.*?<\/svg>/);
  assert.match(html, /aria-label="Sort by"/);

  // Random button
  assert.match(html, /Random/);
  assert.match(html, /aria-label="Open random profile"/);

  // When onRandomProfile is omitted, [ RANDOM ] is not rendered
  const noRandomHtml = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "radio",
      onQueryChange: () => {},
      onOpenProfile: () => {},
    })
  );
  assert.doesNotMatch(noRandomHtml, /Random/);
});

test("SearchView single-filter layout: balanced 2-column grid, recency headers, and lastPlayedAt formatting", async () => {
  clearSearchCache();
  const sampleTracks = Array.from({ length: 16 }, (_, i) => ({
    id: `track-${i + 1}`,
    name: `Track Number ${String(i + 1).padStart(2, "0")}`,
    artist: "Sample Artist",
    album: "Sample Album",
    plays: 100 - i * 5,
    albumImageUrl: null,
    lastPlayedAt: "2026-11-20T01:30:00Z",
  }));

  await primeSearch("sample", {
    query: "sample",
    hasMore: false,
    artists: [],
    albums: [],
    tracks: sampleTracks,
  }, "recent", 1, "tracks");

  const recentHtml = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "sample",
      onQueryChange: () => {},
      onOpenProfile: () => {},
      filter: "tracks",
      sort: "recent",
      visitorTimezone: "America/New_York",
    })
  );

  // Heading for single filter
  assert.match(recentHtml, /text-\[#5A5A55\]">Tracks</);
  assert.doesNotMatch(recentHtml, /text-\[#5A5A55\]">Artists</);
  assert.doesNotMatch(recentHtml, /text-\[#5A5A55\]">Albums</);

  // Recency header on recent sort
  assert.match(recentHtml, /Last played · plays/);

  // Balanced 2-column grid
  assert.match(recentHtml, /md:grid-cols-2/);
  assert.match(recentHtml, /md:gap-x-\[26px\]/);

  // Last played date formatting: 2026-11-20T01:30:00Z in America/New_York formatted as "19 NOV 26"
  assert.match(recentHtml, /19 Nov 26/);

  // Column wrappers must not have role="list"
  assert.ok(!recentHtml.includes('role="list"'));

  // Split verification: first 8 tracks in left column, next 8 in right column
  const columns = recentHtml.split('<div class="min-w-0 flex flex-col">').slice(1);
  assert.deepEqual(columns.map((column) => [...column.matchAll(/Track Number \d+/g)].length), [8, 8]);
  const track1Index = recentHtml.indexOf("Track Number 01");
  const track8Index = recentHtml.indexOf("Track Number 08");
  const track9Index = recentHtml.indexOf("Track Number 09");
  const track16Index = recentHtml.indexOf("Track Number 16");
  assert.ok(track1Index !== -1 && track8Index !== -1 && track9Index !== -1 && track16Index !== -1);
  assert.ok(track1Index < track8Index, "Track 01 appears before Track 08");
  assert.ok(track8Index < track9Index, "Left column items appear before right column items");
  assert.ok(track9Index < track16Index, "Track 09 appears before Track 16");

  // Cover both recency sorts: oldest sort also displays recency header and formatted timestamp
  await primeSearch("sample", {
    query: "sample",
    hasMore: false,
    artists: [],
    albums: [],
    tracks: sampleTracks,
  }, "oldest", 1, "tracks");

  const oldestHtml = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "sample",
      onQueryChange: () => {},
      onOpenProfile: () => {},
      filter: "tracks",
      sort: "oldest",
      visitorTimezone: "America/New_York",
    })
  );
  assert.match(oldestHtml, /Last played · plays/);
  assert.match(oldestHtml, /19 Nov 26/);
});

test("SearchView Tracks-only mixed layout when filter is 'all'", async () => {
  clearSearchCache();
  const sampleTracks = Array.from({ length: 4 }, (_, i) => ({
    id: `t-${i + 1}`,
    name: `Mixed Track ${i + 1}`,
    artist: "Solo Artist",
    album: "Solo Album",
    plays: 20,
    albumImageUrl: null,
  }));

  await primeSearch("tracks-only", {
    query: "tracks-only",
    hasMore: false,
    artists: [],
    albums: [],
    tracks: sampleTracks,
  });

  const html = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "tracks-only",
      onQueryChange: () => {},
      onOpenProfile: () => {},
      filter: "all",
    })
  );

  assert.match(html, /text-\[#5A5A55\]">Tracks</);
  assert.doesNotMatch(html, /text-\[#5A5A55\]">Artists</);
  assert.doesNotMatch(html, /text-\[#5A5A55\]">Albums</);
  // Full width split into 2 columns
  assert.match(html, /md:grid-cols-2/);
});

test("SearchView bottom hairline pagination: totalPages, divider, and DOM order", async () => {
  clearSearchCache();
  await primeSearch("pagetest", {
    query: "pagetest",
    hasMore: true,
    totalPages: 12,
    artists: [{ key: "a1", name: "Page Artist", plays: 5, imageUrl: null }],
    albums: [],
    tracks: [],
  });

  const html = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "pagetest",
      onQueryChange: () => {},
      onOpenProfile: () => {},
      page: 1,
    })
  );

  // Bottom hairline pagination with hairlines
  assert.match(html, /flex-1 h-\[1px\] bg-\[#1C1C1A\]/);
  assert.match(html, /aria-label="Search results pages"/);
  assert.match(html, /Page<\/span> 01 \/ 12/);

  // Position: pagination must appear after results
  const artistIndex = html.indexOf("Page Artist");
  const paginationIndex = html.indexOf('aria-label="Search results pages"');
  assert.ok(artistIndex < paginationIndex, "Pagination must be rendered below search results");
});

test("SearchView input: filter-specific placeholder and aria-label", () => {
  // Filter-specific placeholders
  const tracksHtml = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "",
      onQueryChange: () => {},
      onOpenProfile: () => {},
      filter: "tracks",
    })
  );
  assert.match(tracksHtml, /placeholder="Search tracks"/);
  assert.match(tracksHtml, /aria-label="Search tracks"/);

  const artistsHtml = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "",
      onQueryChange: () => {},
      onOpenProfile: () => {},
      filter: "artists",
    })
  );
  assert.match(artistsHtml, /placeholder="Search artists"/);
  assert.match(artistsHtml, /aria-label="Search artists"/);

  const albumsHtml = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "",
      onQueryChange: () => {},
      onOpenProfile: () => {},
      filter: "albums",
    })
  );
  assert.match(albumsHtml, /placeholder="Search albums"/);
  assert.match(albumsHtml, /aria-label="Search albums"/);

  const allHtml = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "",
      onQueryChange: () => {},
      onOpenProfile: () => {},
      filter: "all",
    })
  );
  assert.match(allHtml, /placeholder="Search tracks, artists or albums"/);
  assert.match(allHtml, /aria-label="Search tracks, artists or albums"/);
});

test("SearchView renders dimmed previous artist rows with pointer-events-none and aria-busy when loading uncached tracks", async () => {
  clearSearchCache();
  const mockArtistResponse: SearchResponse = {
    query: "radio",
    hasMore: false,
    artists: [
      {
        key: "radiohead",
        name: "Radiohead",
        plays: 1420,
        imageUrl: null,
      },
    ],
    albums: [],
    tracks: [],
  };

  await primeSearch("radio", mockArtistResponse, undefined, undefined, "artists");

  const origUseState = React.useState;
  const origUseEffect = React.useEffect;
  const harness = createHookHarness();
  (React as unknown as { useState: unknown }).useState = harness.mockReact.useState;
  (React as unknown as { useEffect: unknown }).useEffect = harness.mockReact.useEffect;

  try {
    // 1. First render with cached artists
    harness.resetCursor();
    renderToStaticMarkup(
      React.createElement(SearchView, {
        query: "radio",
        filter: "artists",
        onQueryChange: () => {},
        onOpenProfile: () => {},
      })
    );

    // 2. Second render with tracks (uncached -> loading, retains artists data)
    harness.resetCursor();
    const html = renderToStaticMarkup(
      React.createElement(SearchView, {
        query: "radio",
        filter: "tracks",
        onQueryChange: () => {},
        onOpenProfile: () => {},
      })
    );

    assert.match(html, /Radiohead/, "Must render previous Artist row name while loading tracks");
    assert.match(html, /aria-busy="true"/, "Must render aria-busy='true' on results wrapper");
    assert.match(html, /pointer-events-none/, "Must render pointer-events-none on results wrapper");
    assert.match(html, /opacity-60/, "Must render opacity-60 on results wrapper");
    const staleButton = html.match(/<button\b[^>]*>.*?<\/button>/g)?.find((button) => button.includes(">Radiohead</span>"));
    assert.ok(staleButton, "Must render stale Artist button");
    assert.match(staleButton, /^<button\b[^>]*\sdisabled=""/, "Stale Artist button must be disabled");

    // 3. Prime empty tracks response and verify transition to ready with [ NO MATCHES ]
    await primeSearch(
      "radio",
      {
        query: "radio",
        hasMore: false,
        artists: [],
        albums: [],
        tracks: [],
      },
      undefined,
      undefined,
      "tracks"
    );

    harness.resetCursor();
    const readyHtml = renderToStaticMarkup(
      React.createElement(SearchView, {
        query: "radio",
        filter: "tracks",
        onQueryChange: () => {},
        onOpenProfile: () => {},
      })
    );

    assert.match(readyHtml, /No matches/, "Empty tracks response must show No matches");
    assert.doesNotMatch(readyHtml, /Radiohead/, "Stale artist must be gone once tracks response resolves");
    assert.doesNotMatch(readyHtml, /aria-busy="true"/, "Must not render aria-busy when ready");
    assert.doesNotMatch(readyHtml, /pointer-events-none/, "Must not render pointer-events-none when ready");
  } finally {
    harness.cleanup();
    (React as unknown as { useState: unknown }).useState = origUseState;
    (React as unknown as { useEffect: unknown }).useEffect = origUseEffect;
  }
});

test("SearchView first load renders 8 skeleton rows when uncached and data is null", () => {
  clearSearchCache();
  const html = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "uncached-first-load",
      onQueryChange: () => {},
      onOpenProfile: () => {},
    })
  );

  // Must not render loading text
  assert.doesNotMatch(html, /SEARCHING…/);
  assert.doesNotMatch(html, /LOADING CATALOG…/);

  // Must render aria-busy and pointer-events-none
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /pointer-events-none/);

  // Must render 8 skeleton rows
  const skeletonSquareMatches = html.match(/w-\[38px\] h-\[38px\] rounded bg-\[#141413\]/g);
  assert.equal(skeletonSquareMatches?.length, 8, "Must render 8 skeleton row artwork squares");

  const skeletonRowMatches = html.match(/h-\[54px\] md:h-\[55px\] border-b border-\[#191917\] animate-pulse/g);
  assert.equal(skeletonRowMatches?.length, 8, "Must render 8 skeleton rows");
});

test("SegmentedShareBar renders segments as <button type=\"button\"> with focus-ring", () => {
  const segments = buildShareSegments([{ id: "t1", name: "Track 1", plays: 30 }], 50);
  const markup = renderToStaticMarkup(
    React.createElement(SegmentedShareBar, {
      heading: "Share of plays",
      segments,
      total: 50,
      activeId: null,
      onActiveChange: () => {},
    })
  );

  const trackBtn = markup.match(/<button\b[^>]*title="Track 1"[^>]*>/)?.[0] ?? "";
  assert.ok(trackBtn, "Track segment must render as a <button>");
  assert.match(trackBtn, /type="button"/);
  assert.match(trackBtn, /\bfocus-ring\b/);

  const otherBtn = markup.match(/<button\b[^>]*title="Other tracks"[^>]*>/)?.[0] ?? "";
  assert.ok(otherBtn, "Other tracks segment must render as a <button>");
  assert.match(otherBtn, /type="button"/);
  assert.match(otherBtn, /\bfocus-ring\b/);

  const barContainer = markup.match(/<div\b[^>]*class="flex h-\[10px\] gap-\[2px\]"[^>]*>/)?.[0] ?? "";
  assert.ok(barContainer, "Share bar flex container must exist");
  assert.doesNotMatch(barContainer, /aria-hidden="true"/);
});

test("SearchView UX polish: entry animation, reserved status height, and focus/press/hit-area controls", async () => {
  clearSearchCache();
  await primeSearch("polish", {
    query: "polish",
    hasMore: false,
    artists: [{ key: "a1", name: "Radiohead", plays: 20, imageUrl: null }],
    albums: [],
    tracks: [],
  });

  const html = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "polish",
      onQueryChange: () => {},
      onOpenProfile: () => {},
      onRandomProfile: () => {},
    })
  );

  const rootTag = html.slice(0, html.indexOf(">") + 1);
  assert.match(rootTag, /\banimate-view-enter\b/, "SearchView root must include animate-view-enter");
  assert.match(html, /\banimate-content-enter\b/, "Results wrapper must include animate-content-enter");

  const statusTag = html.match(/<div\b[^>]*role="status"[^>]*>/)?.[0] ?? "";
  assert.ok(statusTag, "Status container must render");
  assert.doesNotMatch(statusTag, /\bempty:hidden\b/, "Status container must reserve height without empty:hidden");
  assert.match(statusTag, /\bmin-h-/, "Status container must reserve explicit min-h");

  const sortBtn = html.match(/<button\b[^>]*aria-label="Sort by"[^>]*>/)?.[0] ?? "";
  assert.ok(sortBtn, "Sort trigger must render");
  assert.match(sortBtn, /\bfocus-ring\b/);
  assert.match(sortBtn, /\bpress\b/);
  assert.match(sortBtn, /\bhit-area\b/);
  assert.doesNotMatch(sortBtn, /\bfocus:outline-none\b/);

  const randomBtn = html.match(/<button\b[^>]*aria-label="Open random profile"[^>]*>/)?.[0] ?? "";
  assert.ok(randomBtn, "Random button must render");
  assert.match(randomBtn, /\bfocus-ring\b/);
  assert.match(randomBtn, /\bpress\b/);
  assert.match(randomBtn, /\bhit-area\b/);
  assert.doesNotMatch(randomBtn, /\bfocus:outline-none\b/);
});

test("SearchView restores scroll position via requestAnimationFrame when ready with restoreScrollY", async () => {
  clearSearchCache();
  await primeSearch("restore-test", {
    query: "restore-test",
    hasMore: false,
    artists: [{ key: "a1", name: "Restore Artist", plays: 15, imageUrl: null }],
    albums: [],
    tracks: [],
  });

  const origUseState = React.useState;
  const origUseRef = React.useRef;
  const origUseCallback = React.useCallback;
  const origUseEffect = React.useEffect;
  const origWindow = (globalThis as unknown as { window?: unknown }).window;
  const origRaf = globalThis.requestAnimationFrame;
  const origCancelRaf = globalThis.cancelAnimationFrame;

  const stateValues: unknown[] = [];
  const stateSetters: Array<(v: unknown) => void> = [];
  const refValues: Array<{ current: unknown }> = [];
  const callbackValues: Array<{ fn: unknown; deps: unknown[] }> = [];
  const effectDeps: unknown[][] = [];
  const effectCleanups: Array<(() => void) | void> = [];
  let effectPending: Array<{ idx: number; effect: () => (() => void) | void }> = [];
  let stateCursor = 0;
  let refCursor = 0;
  let callbackCursor = 0;
  let effectCursor = 0;

  (React as unknown as { useState: unknown }).useState = <T>(initial: T | (() => T)) => {
    const idx = stateCursor++;
    if (!(idx in stateValues)) {
      stateValues[idx] = typeof initial === "function" ? (initial as () => T)() : initial;
    }
    if (!stateSetters[idx]) {
      stateSetters[idx] = (value: unknown) => {
        stateValues[idx] = typeof value === "function" ? (value as (p: unknown) => unknown)(stateValues[idx]) : value;
      };
    }
    return [stateValues[idx] as T, stateSetters[idx]];
  };
  (React as unknown as { useRef: unknown }).useRef = <T>(initial: T) => {
    const idx = refCursor++;
    if (!(idx in refValues)) refValues[idx] = { current: initial };
    return refValues[idx] as { current: T };
  };
  (React as unknown as { useCallback: unknown }).useCallback = <T>(fn: T, deps: unknown[]) => {
    const idx = callbackCursor++;
    const prev = callbackValues[idx];
    if (!prev || deps.some((d, i) => !Object.is(d, prev.deps[i]))) {
      callbackValues[idx] = { fn, deps };
    }
    return callbackValues[idx].fn as T;
  };
  (React as unknown as { useEffect: unknown }).useEffect = (effect: () => (() => void) | void, deps: unknown[] = []) => {
    const idx = effectCursor++;
    const prev = effectDeps[idx];
    if (!prev || deps.some((d, i) => !Object.is(d, prev[i]))) {
      effectDeps[idx] = deps;
      effectPending.push({ idx, effect });
    }
  };

  const scrollCalls: Array<[number, number]> = [];
  const rafQueue: Array<{ id: number; cb: FrameRequestCallback }> = [];
  let nextRafId = 1;

  (globalThis as unknown as { window: unknown }).window = {
    scrollTo: (x: number, y: number) => {
      scrollCalls.push([x, y]);
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    const id = nextRafId++;
    rafQueue.push({ id, cb });
    return id;
  };
  globalThis.cancelAnimationFrame = () => {};

  const renderComponent = (props: SearchViewProps) => {
    stateCursor = 0;
    refCursor = 0;
    callbackCursor = 0;
    effectCursor = 0;
    (SearchView as React.FC<SearchViewProps>)(props);
    const pending = [...effectPending];
    effectPending = [];
    for (const item of pending) {
      const cleanup = effectCleanups[item.idx];
      if (typeof cleanup === "function") cleanup();
      effectCleanups[item.idx] = item.effect();
    }
  };

  try {
    let restoredCount = 0;
    const onScrollRestored = () => {
      restoredCount++;
    };

    // Uncached loading state must not trigger scroll restore yet
    renderComponent({
      query: "restore-uncached",
      onQueryChange: () => {},
      onOpenProfile: () => {},
      restoreScrollY: 420,
      onScrollRestored,
    });
    assert.equal(rafQueue.length, 0, "Must not schedule scroll restore while loading");

    // Ready state with restoreScrollY schedules RAF and calls scrollTo + onScrollRestored inside RAF
    renderComponent({
      query: "restore-test",
      onQueryChange: () => {},
      onOpenProfile: () => {},
      restoreScrollY: 420,
      onScrollRestored,
    });
    assert.equal(rafQueue.length, 1, "Must schedule requestAnimationFrame when ready with restoreScrollY");
    assert.equal(scrollCalls.length, 0, "Must not call window.scrollTo synchronously before RAF");
    assert.equal(restoredCount, 0, "Must not call onScrollRestored before RAF");

    rafQueue[0].cb(16);
    assert.deepEqual(scrollCalls, [[0, 420]], "Must scroll to (0, restoreScrollY) inside RAF");
    assert.equal(restoredCount, 1, "Must call onScrollRestored once after scrolling");

    // Null restoreScrollY must not schedule RAF
    renderComponent({
      query: "restore-test",
      onQueryChange: () => {},
      onOpenProfile: () => {},
      restoreScrollY: null,
      onScrollRestored,
    });
    assert.equal(rafQueue.length, 1, "Must not schedule RAF when restoreScrollY is null");
  } finally {
    for (const c of effectCleanups) {
      if (typeof c === "function") c();
    }
    (React as unknown as { useState: unknown }).useState = origUseState;
    (React as unknown as { useRef: unknown }).useRef = origUseRef;
    (React as unknown as { useCallback: unknown }).useCallback = origUseCallback;
    (React as unknown as { useEffect: unknown }).useEffect = origUseEffect;
    if (origWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = origWindow;
    }
    globalThis.requestAnimationFrame = origRaf;
    globalThis.cancelAnimationFrame = origCancelRaf;
  }
});
