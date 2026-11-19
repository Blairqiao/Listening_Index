import { test, mock } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useSearch } from "../src/components/views/search-view/useSearch";
import { SearchView } from "../src/components/views/search-view/SearchView";
import type { SearchResponse, SearchSort } from "../src/lib/search-types";

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

  const runTurn = (q: string, sort?: SearchSort, page?: number) => {
    let result: ReturnType<typeof useSearch> | undefined;
    let passes = 0;
    do {
      stateChangedDuringRender = false;
      stateCursor = 0;
      effectCursor = 0;
      isRendering = true;
      try {
        result = useSearch(q, sort, page);
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

  return { mockReact, runTurn, cleanup };
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

async function primeSearch(query: string, response: SearchResponse) {
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
    harness.runTurn(query);
    mock.timers.tick(250);
    await flushMicrotasks();
    harness.runTurn(query);
  } finally {
    harness.cleanup();
    (React as unknown as { useState: unknown }).useState = origUseState;
    (React as unknown as { useEffect: unknown }).useEffect = origUseEffect;
    globalThis.fetch = origFetch;
    mock.timers.reset();
  }
}

test("SearchView SSR: renders named input, placeholder, maxLength, and desktop scroll area", () => {
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
    html.includes('placeholder="SEARCH TRACKS OR ARTISTS"'),
    "Must render correct placeholder"
  );
  assert.ok(
    html.includes('maxlength="200"') || html.includes('maxLength="200"'),
    "Must render maxLength 200 (SEARCH_MAX_CHARS * 2)"
  );
  assert.ok(
    html.includes('aria-label="Search tracks or artists"'),
    "Must render aria-label for accessibility"
  );

  // Scroll container and desktop styling
  assert.ok(
    html.includes("scrollbar-hidden"),
    "Must include scrollbar-hidden class"
  );
  assert.ok(
    html.includes("overflow-y-auto"),
    "Must include overflow-y-auto class for vertical scrolling"
  );
  assert.ok(
    html.includes("md:h-[560px]") || html.includes("md:h-"),
    "Must include desktop bounded height styling"
  );
});

test("SearchView browses on empty input and accepts a single character", async () => {
  await primeSearch("", {
    query: "",
    hasMore: true,
    artists: [{ key: "artist-1", name: "Default Artist", plays: 10, imageUrl: null }],
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
  assert.doesNotMatch(browseHtml, /<select\b/);
  assert.match(browseHtml, /aria-haspopup="listbox"/);
  assert.match(browseHtml, /aria-label="Sort by"/);
  assert.match(browseHtml, />MOST PLAYS</);
  assert.match(browseHtml, /aria-label="Previous page"[^>]*>← PREV</);
  assert.match(browseHtml, /aria-label="Next page"[^>]*>NEXT →</);
  assert.match(browseHtml, />PAGE<\/span> 01</);
  const shortHtml = render("r");
  assert.match(shortHtml, /SEARCHING/);
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
    longHtml.includes("QUERY TOO LONG"),
    "Query >100 chars must show QUERY TOO LONG"
  );

  // 4. Loading query (valid query, not yet cached)
  const loadingHtml = renderToStaticMarkup(
    React.createElement(SearchView, {
      query: "uncached-band",
      onQueryChange: () => {},
      onOpenProfile: () => {},
    })
  );
  assert.ok(
    loadingHtml.includes("SEARCHING…"),
    "Uncached valid query must show SEARCHING…"
  );

  // 5. Ready with no results -> [ NO MATCHES ] (cached via hook execution)
  await primeSearch("noresults", {
    query: "noresults",
    hasMore: false,
    artists: [],
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
    noMatchesHtml.includes("[ NO MATCHES ]"),
    "Empty response must show [ NO MATCHES ]"
  );
});

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
  assert.ok(html.includes("[ ARTISTS ]"), "Must render [ ARTISTS ] header");
  assert.ok(html.includes("[ TRACKS ]"), "Must render [ TRACKS ] header");

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

  // Status line is clean when results exist
  assert.ok(!html.includes("[ NO MATCHES ]"), "Should not show no matches");
  assert.ok(!html.includes("SEARCHING…"), "Should not show searching when cached");
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
          tracks: [],
        }),
      } as unknown as Response);
    }
    await flushMicrotasks();

    // Turn for fast-q must remain fast-q data (not overwritten by stale response)
    res = harness.runTurn("fast-q");
    assert.equal(res.status, "ready");
    assert.equal(res.data?.artists[0]?.name, "Artist fast-q", "Stale response must not overwrite current ready data");

    // Clearing the search returns to the catalog instead of keeping the previous matches.
    res = harness.runTurn("", "oldest", 2);
    assert.equal(res.status, "loading");
    assert.equal(res.data, null);
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
