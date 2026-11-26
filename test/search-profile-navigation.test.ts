import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import ts from "typescript";
import * as timezoneUtils from "../src/lib/timezone-utils";
import * as searchUtils from "../src/lib/search-utils";
import * as rangeModule from "../src/lib/range";
import type { ProfileData, ProfileHistoryEntry, ProfileTarget } from "../src/lib/search-types";
import type { Mode, RangeKey } from "../src/lib/types";
import {
  buildHistoryState,
  buildListeningUrlSearch,
  formatProfileRibbonMetrics,
  getProfileCacheKey,
  parseModeParam,
  readHistoryState,
  resolveDisplayedProfileData,
} from "../src/components/listening-view/listening-helpers";
import { useSearchProfile } from "../src/components/listening-view/useSearchProfile";

before(() => mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-24T12:00:00.000Z") }));
after(() => mock.timers.reset());

function makeProfile(overrides: Partial<ProfileData> = {}): ProfileData {
  return {
    kind: "artist",
    key: "artist-1",
    name: "Radiohead",
    artistName: null,
    albumName: null,
    imageUrl: null,
    range: "1w",
    granularity: "block6h",
    firstPlayedAt: "2024-01-15T12:00:00.000Z",
    lastPlayedAt: "2024-11-18T18:30:00.000Z",
    plays: 12,
    rank: 2,
    rankedTotal: 40,
    activityCadence: [],
    topTracks: [],
    topAlbums: [],
    recentPlays: [],
    ...overrides,
  };
}

interface UseSearchProfileArgs {
  activeMode: Mode;
  visitorTimezone: string;
  initialProfile?: ProfileTarget | null;
  initialProfileRange?: rangeModule.RangeSelection | null;
  initialSearchQuery?: string;
  isSyncing?: boolean;
  onRequestPushHistory?: () => void;
}

function createProfileHookHarness() {
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
  let stateUpdated = false;

  const mockReact = {
    useState: <T>(initial: T | (() => T)): [T, (v: unknown) => void] => {
      const idx = stateCursor++;
      if (!(idx in stateValues)) {
        stateValues[idx] = typeof initial === "function" ? (initial as () => T)() : initial;
      }
      if (!stateSetters[idx]) {
        stateSetters[idx] = (value: unknown) => {
          const next =
            typeof value === "function"
              ? (value as (prev: unknown) => unknown)(stateValues[idx])
              : value;
          if (!Object.is(next, stateValues[idx])) {
            stateValues[idx] = next;
            stateUpdated = true;
          }
        };
      }
      return [stateValues[idx] as T, stateSetters[idx]];
    },
    useRef: <T>(initial: T): { current: T } => {
      const idx = refCursor++;
      if (!(idx in refValues)) {
        refValues[idx] = { current: initial };
      }
      return refValues[idx] as { current: T };
    },
    useCallback: <T>(fn: T, deps: unknown[]): T => {
      const idx = callbackCursor++;
      const prev = callbackValues[idx];
      if (!prev || deps.some((d, i) => !Object.is(d, prev.deps[i]))) {
        callbackValues[idx] = { fn, deps };
      }
      return callbackValues[idx].fn as T;
    },
    useEffect: (effect: () => (() => void) | void, deps: unknown[] = []) => {
      const idx = effectCursor++;
      const prev = effectDeps[idx];
      const hasChanged = !prev || deps.some((d, i) => !Object.is(d, prev[i]));
      if (hasChanged) {
        effectDeps[idx] = deps;
        effectPending.push({ idx, effect });
      }
    },
  };

  const renderOnce = (args: UseSearchProfileArgs) => {
    let result!: ReturnType<typeof useSearchProfile>;
    let passes = 0;
    do {
      stateUpdated = false;
      stateCursor = 0;
      refCursor = 0;
      callbackCursor = 0;
      effectCursor = 0;

      result = useSearchProfile(args);

      const pending = [...effectPending];
      effectPending = [];
      for (const item of pending) {
        const cleanup = effectCleanups[item.idx];
        if (typeof cleanup === "function") {
          cleanup();
        }
        effectCleanups[item.idx] = item.effect();
      }
      passes++;
      if (passes > 10) {
        throw new Error("Infinite render/effect loop detected in hook harness");
      }
    } while (stateUpdated);
    return result;
  };

  const cleanup = () => {
    for (const c of effectCleanups) {
      if (typeof c === "function") c();
    }
  };

  return { mockReact, renderOnce, cleanup };
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
}

function withHookReact<T>(fn: (harness: ReturnType<typeof createProfileHookHarness>) => Promise<T>): Promise<T> {
  const origUseState = React.useState;
  const origUseRef = React.useRef;
  const origUseCallback = React.useCallback;
  const origUseEffect = React.useEffect;

  const harness = createProfileHookHarness();
  (React as unknown as { useState: unknown }).useState = harness.mockReact.useState;
  (React as unknown as { useRef: unknown }).useRef = harness.mockReact.useRef;
  (React as unknown as { useCallback: unknown }).useCallback = harness.mockReact.useCallback;
  (React as unknown as { useEffect: unknown }).useEffect = harness.mockReact.useEffect;

  return fn(harness).finally(() => {
    harness.cleanup();
    (React as unknown as { useState: unknown }).useState = origUseState;
    (React as unknown as { useRef: unknown }).useRef = origUseRef;
    (React as unknown as { useCallback: unknown }).useCallback = origUseCallback;
    (React as unknown as { useEffect: unknown }).useEffect = origUseEffect;
  });
}

test("buildListeningUrlSearch manages mode=4 profile params and preserves unrelated params and mode=3", () => {
  const defaultOverview = rangeModule.DEFAULT_OVERVIEW_RANGE;

  // Mode 4 search (no target) clears track/artist/prange and keeps unrelated params
  assert.equal(
    buildListeningUrlSearch("?range=1w&foo=bar&track=t1&prange=all", {
      activeMode: 4,
      overviewRange: defaultOverview,
      profileTarget: null,
      profileRange: rangeModule.presetRange("1w"),
    }),
    "?range=1w&foo=bar&mode=4"
  );

  // Mode 4 track profile sets track + prange and removes stale artist
  assert.equal(
    buildListeningUrlSearch("?mode=4&artist=a1&range=1w&foo=bar", {
      activeMode: 4,
      overviewRange: defaultOverview,
      profileTarget: { kind: "track", key: "t1" },
      profileRange: rangeModule.presetRange("all"),
    }),
    "?mode=4&range=1w&foo=bar&track=t1&prange=all"
  );

  // Mode 4 artist profile sets artist + prange and removes stale track
  assert.equal(
    buildListeningUrlSearch("?mode=4&track=t1&prange=1w", {
      activeMode: 4,
      overviewRange: defaultOverview,
      profileTarget: { kind: "artist", key: "a1" },
      profileRange: rangeModule.presetRange("6m"),
    }),
    "?mode=4&prange=6m&artist=a1"
  );

  // Leaving mode 4 to Overview removes mode=4, track, artist, prange; omits default 1w range while keeping custom params
  assert.equal(
    buildListeningUrlSearch("?mode=4&track=t1&prange=all&range=1w&foo=bar", {
      activeMode: 0,
      overviewRange: defaultOverview,
      profileTarget: { kind: "track", key: "t1" },
      profileRange: rangeModule.presetRange("all"),
    }),
    "?foo=bar"
  );

  // Leaving mode 4 with nothing else left yields empty search (bare pathname)
  assert.equal(
    buildListeningUrlSearch("?mode=4", {
      activeMode: 0,
      overviewRange: defaultOverview,
      profileTarget: null,
      profileRange: rangeModule.presetRange("1w"),
    }),
    ""
  );

  // Preserves existing mode=3 when active or pending admin login intent, and clears stale mode=3 otherwise
  assert.equal(
    buildListeningUrlSearch("?mode=3&session=s1", {
      activeMode: 3,
      overviewRange: defaultOverview,
      profileTarget: null,
      profileRange: rangeModule.presetRange("1w"),
    }),
    "?mode=3&session=s1"
  );
  assert.equal(
    buildListeningUrlSearch("?mode=3", {
      activeMode: 0,
      overviewRange: defaultOverview,
      profileTarget: null,
      profileRange: rangeModule.presetRange("1w"),
      preservePendingMode3: true,
    }),
    "?mode=3"
  );
  assert.equal(
    buildListeningUrlSearch("?mode=3", {
      activeMode: 0,
      overviewRange: defaultOverview,
      profileTarget: null,
      profileRange: rangeModule.presetRange("1w"),
    }),
    ""
  );
});

test("buildListeningUrlSearch keeps only the active profile key, including Album keys", () => {
  const defaultOverview = rangeModule.DEFAULT_OVERVIEW_RANGE;
  const currentSearch = "?mode=4&track=t1&artist=a1&album=old";
  assert.equal(buildListeningUrlSearch(currentSearch, {
    activeMode: 4,
    overviewRange: defaultOverview,
    profileTarget: { kind: "album", key: "k" },
    profileRange: rangeModule.presetRange("1y"),
  }), "?mode=4&album=k&prange=1y");

  for (const kind of ["track", "artist"] as const) {
    assert.equal(buildListeningUrlSearch(currentSearch, {
      activeMode: 4,
      overviewRange: defaultOverview,
      profileTarget: { kind, key: "k" },
      profileRange: rangeModule.presetRange("1y"),
    }), `?mode=4&${kind}=k&prange=1y`);
  }

  assert.equal(buildListeningUrlSearch(`${currentSearch}&prange=1y`, {
    activeMode: 4, overviewRange: defaultOverview, profileTarget: null, profileRange: rangeModule.presetRange("1y"),
  }), "?mode=4");
  assert.equal(buildListeningUrlSearch(`${currentSearch}&prange=1y`, {
    activeMode: 0, overviewRange: defaultOverview, profileTarget: { kind: "album", key: "k" }, profileRange: rangeModule.presetRange("1y"),
  }), "");
});

test("window prange round-trips through buildListeningUrlSearch and readHistoryState", () => {
  const defaultOverview = rangeModule.DEFAULT_OVERVIEW_RANGE;
  const windowRange: rangeModule.RangeSelection = {
    kind: "window",
    from: "2025-11-01",
    to: "2025-11-30",
  };

  const urlSearch = buildListeningUrlSearch("?mode=4", {
    activeMode: 4,
    overviewRange: defaultOverview,
    profileTarget: { kind: "artist", key: "radiohead" },
    profileRange: windowRange,
  });
  assert.equal(urlSearch, "?mode=4&artist=radiohead&prange=2025-11-01..2025-11-30");

  const builtState = buildHistoryState({
    profileHistory: [
      {
        target: { kind: "artist", key: "radiohead" },
        range: windowRange,
        name: "Radiohead",
      },
    ],
  });

  const restored = readHistoryState(builtState);
  assert.ok(restored?.profileHistory);
  assert.equal(restored.profileHistory.length, 1);
  assert.deepEqual(restored.profileHistory[0].range, windowRange);
});

test("readHistoryState restores old history string as preset and falls back on invalid range", () => {
  // Legacy string "1y" restores as { kind: "preset", key: "1y" }
  const legacyState = {
    listeningIndex: {
      profileHistory: [
        {
          target: { kind: "artist", key: "radiohead" },
          range: "1y",
          name: "Radiohead",
        },
      ],
    },
  };
  const restoredLegacy = readHistoryState(legacyState);
  assert.deepEqual(restoredLegacy?.profileHistory?.[0].range, {
    kind: "preset",
    key: "1y",
  });

  // Invalid range string falls back to DEFAULT_PROFILE_RANGE
  const invalidState = {
    listeningIndex: {
      profileHistory: [
        {
          target: { kind: "artist", key: "radiohead" },
          range: "invalid-range-string",
          name: "Radiohead",
        },
      ],
    },
  };
  const restoredInvalid = readHistoryState(invalidState);
  assert.deepEqual(
    restoredInvalid?.profileHistory?.[0].range,
    { kind: "preset", key: "all" }
  );

  const malformedState = { listeningIndex: { profileHistory: [{ target: { kind: "artist", key: "radiohead" }, range: { kind: "window" } }] } };
  assert.deepEqual(readHistoryState(malformedState)?.profileHistory?.[0].range, { kind: "preset", key: "all" });

  // Decodes ONLY namespaced listeningIndex state; unnamespaced state is ignored
  const unnamespacedState = {
    profileHistory: [
      {
        target: { kind: "artist", key: "radiohead" },
        range: "1y",
      },
    ],
  };
  assert.equal(readHistoryState(unnamespacedState), null);

  // Drops malformed entries with invalid targets to prevent breadcrumb navigation crashes
  const malformedTargetState = {
    listeningIndex: {
      profileHistory: [
        {
          target: { kind: "artist", key: "radiohead" },
          range: "1w",
          name: "Radiohead",
        },
        {
          target: null,
          range: "1w",
          name: "Null Target",
        },
        {
          target: { kind: "unknown", key: "bad-kind" },
          range: "1w",
        },
        {
          target: { kind: "track", key: "   " },
          range: "1w",
        },
        null,
      ],
    },
  };
  const restoredMalformed = readHistoryState(malformedTargetState);
  assert.ok(restoredMalformed?.profileHistory);
  assert.equal(restoredMalformed.profileHistory.length, 1);
  assert.deepEqual(restoredMalformed.profileHistory[0], {
    target: { kind: "artist", key: "radiohead" },
    range: { kind: "preset", key: "1w" },
    name: "Radiohead",
  });
});

test("buildListeningUrlSearch syncs non-default search params in Mode 4 browse and clears them on profile or mode change", () => {
  const defaultOverview = rangeModule.DEFAULT_OVERVIEW_RANGE;

  // Mode 4 browse writes non-default q, type, sort, page
  assert.equal(
    buildListeningUrlSearch("?mode=4", {
      activeMode: 4,
      overviewRange: defaultOverview,
      profileTarget: null,
      profileRange: rangeModule.presetRange("1y"),
      search: { query: "  radiohead  ", filter: "albums", sort: "recent", page: 2 },
    }),
    "?mode=4&q=radiohead&type=albums&sort=recent&page=2"
  );

  // Mode 4 browse deletes default/empty search params
  assert.equal(
    buildListeningUrlSearch("?mode=4&q=old&type=tracks&sort=oldest&page=3", {
      activeMode: 4,
      overviewRange: defaultOverview,
      profileTarget: null,
      profileRange: rangeModule.presetRange("1y"),
      search: { query: "   ", filter: "all", sort: "most-plays", page: 1 },
    }),
    "?mode=4"
  );

  // Opening a profile clears q, type, sort, page
  assert.equal(
    buildListeningUrlSearch("?mode=4&q=radiohead&type=albums&sort=recent&page=2", {
      activeMode: 4,
      overviewRange: defaultOverview,
      profileTarget: { kind: "artist", key: "a1" },
      profileRange: rangeModule.presetRange("1y"),
      search: { query: "radiohead", filter: "albums", sort: "recent", page: 2 },
    }),
    "?mode=4&artist=a1&prange=1y"
  );

  // Leaving Mode 4 clears q, type, sort, page and omits default 1w overview range
  assert.equal(
    buildListeningUrlSearch("?mode=4&q=radiohead&type=albums&sort=recent&page=2&range=1w", {
      activeMode: 0,
      overviewRange: defaultOverview,
      profileTarget: null,
      profileRange: rangeModule.presetRange("1y"),
      search: { query: "radiohead", filter: "albums", sort: "recent", page: 2 },
    }),
    ""
  );
});

test("useSearchProfile supports multi-hop history stack, ping-pong dedupe, jump, syncFromLocation, and clearProfileCache", async () => {
  const origFetch = globalThis.fetch;
  const RealDate = globalThis.Date;
  const fixedTime = new RealDate("2026-11-24T12:00:00.000Z").getTime();
  class FixedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(fixedTime);
      } else {
        super(...(args as [number | string | Date]));
      }
    }
    static now() {
      return fixedTime;
    }
  }
  const requests: URLSearchParams[] = [];
  const artist: ProfileTarget = { kind: "artist", key: "radiohead" };
  const album: ProfileTarget = { kind: "album", key: "radiohead::in rainbows" };
  const track: ProfileTarget = { kind: "track", key: "weird-fishes" };
  const artist2: ProfileTarget = { kind: "artist", key: "thom-yorke" };
  const args = { activeMode: 4, visitorTimezone: "UTC", initialProfileRange: rangeModule.presetRange("6m"), initialSearchQuery: "in rainbows" } as const;

  try {
    (globalThis as unknown as { Date: unknown }).Date = FixedDate;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const params = new URL(String(input), "http://127.0.0.1:8888").searchParams;
      requests.push(params);
      const target = searchUtils.parseProfileTarget(params);
      assert.ok(target);
      return Response.json(
        makeProfile({
          ...target,
          name: `Name:${target.key}`,
          range: rangeModule.formatRangeParam(rangeModule.parseRangeParam(params.get("prange")) ?? rangeModule.presetRange("1w")),
        })
      );
    }) as typeof fetch;

    // Multi-hop: Artist -> Album -> Track -> Artist2 -> Back -> Back -> Jump to Search
    await withHookReact(async (harness) => {
      const render = () => harness.renderOnce({ ...args, initialProfile: artist });
      let state = render();
      assert.equal(state.searchQuery, "in rainbows");
      await flushMicrotasks();
      state = render();

      const todayKey = rangeModule.todayDateKey("UTC");
      const yearWindow = rangeModule.unitWindow(todayKey, "year");
      const monthWindow = rangeModule.unitWindow(todayKey, "month");

      // Artist -> Album
      state.handleOpenRelatedProfile(album);
      await flushMicrotasks();
      state = render();
      assert.deepEqual(state.profileTarget, album);
      assert.equal(state.returnsTo, "artist");
      assert.equal(state.profileHistory.length, 1);
      assert.deepEqual(state.profileHistory[0], {
        target: artist,
        range: yearWindow,
        name: "Name:radiohead",
      });

      // Ping-pong dedupe: navigating back to top of history (Artist) pops instead of pushing
      state.handleOpenRelatedProfile(artist);
      await flushMicrotasks();
      state = render();
      assert.deepEqual(state.profileTarget, artist);
      assert.equal(state.profileHistory.length, 0);

      // Re-traverse Artist -> Album (1m) -> Track -> Artist2
      state.handleOpenRelatedProfile(album);
      await flushMicrotasks();
      state = render();
      state.handleSelectProfileRange(rangeModule.presetRange("1m"));
      await flushMicrotasks();
      state = render();

      state.handleOpenRelatedProfile(track);
      await flushMicrotasks();
      state = render();
      assert.equal(state.profileHistory.length, 2);
      assert.equal(state.returnsTo, "album");

      state.handleOpenRelatedProfile(artist2);
      await flushMicrotasks();
      state = render();
      assert.equal(state.profileHistory.length, 3);
      assert.equal(state.returnsTo, "track");

      // Back -> Track (1m)
      state.handleProfileBack();
      state = render();
      assert.deepEqual(state.profileTarget, track);
      assert.deepEqual(state.profileRange, monthWindow);
      assert.equal(state.profileHistory.length, 2);

      // Back -> Album (1m)
      state.handleProfileBack();
      state = render();
      assert.deepEqual(state.profileTarget, album);
      assert.deepEqual(state.profileRange, monthWindow);
      assert.equal(state.profileHistory.length, 1);

      // Jump to index 0 -> Artist (6m)
      state.handleJumpToHistory(0);
      state = render();
      assert.deepEqual(state.profileTarget, artist);
      assert.deepEqual(state.profileRange, yearWindow);
      assert.equal(state.profileHistory.length, 0);

      // Jump to -1 -> Search
      state.handleOpenRelatedProfile(album);
      await flushMicrotasks();
      state = render();
      assert.equal(state.profileHistory.length, 1);
      state.handleJumpToHistory(-1);
      state = render();
      assert.equal(state.profileTarget, null);
      assert.equal(state.profileHistory.length, 0);

      // syncFromLocation: open Artist -> Album, then popstate back to Artist pops top, then null clears
      state.handleOpenProfile(artist);
      await flushMicrotasks();
      state = render();
      state.handleOpenRelatedProfile(album);
      await flushMicrotasks();
      state = render();
      assert.equal(state.profileHistory.length, 1);

      state.syncFromLocation(artist, rangeModule.presetRange("1y"));
      state = render();
      assert.deepEqual(state.profileTarget, artist);
      assert.deepEqual(state.profileRange, yearWindow);
      assert.equal(state.profileHistory.length, 0);

      state.syncFromLocation(null, null);
      state = render();
      assert.equal(state.profileTarget, null);
      assert.equal(state.profileHistory.length, 0);

      // clearProfileCache forces a fresh fetch for a previously cached profile
      state.handleOpenProfile(artist);
      state = render();
      const countBeforeClear = requests.length;
      state.clearProfileCache();
      state.handleReturnToSearch();
      state = render();
      state.handleOpenProfile(artist);
      render();
      assert.equal(requests.length, countBeforeClear + 1);
    });
  } finally {
    (globalThis as unknown as { Date: unknown }).Date = RealDate;
    globalThis.fetch = origFetch;
  }
});

test("formatProfileRibbonMetrics and resolveDisplayedProfileData prevent wrong entity and stale range leaks", () => {
  const artist1w = makeProfile({
    kind: "artist",
    key: "artist-1",
    range: "1w",
    plays: 42,
    rank: 3,
    rankedTotal: 50,
    firstPlayedAt: "2024-01-15T12:00:00.000Z",
    lastPlayedAt: "2024-11-18T18:30:00.000Z",
  });

  // Ready & matching target + range
  assert.deepEqual(
    formatProfileRibbonMetrics(
      artist1w,
      "ready",
      { kind: "artist", key: "artist-1" },
      rangeModule.presetRange("1w"),
      "America/Chicago"
    ),
    ["42", "3 / 50", "15 Jan 2024", "18 Nov 2024"]
  );

  assert.equal(
    formatProfileRibbonMetrics(
      artist1w, "ready", { kind: "artist", key: "artist-1" }, rangeModule.presetRange("1w"), "UTC", "percentile"
    )[1],
    "Top 6%"
  );

  // Zero rank formats as "--"
  assert.deepEqual(
    formatProfileRibbonMetrics(
      makeProfile({ plays: 0, rank: null }),
      "ready",
      { kind: "artist", key: "artist-1" },
      rangeModule.presetRange("1w"),
      "UTC"
    ),
    ["0", "--", "15 Jan 2024", "18 Nov 2024"]
  );

  // Plays formatted with toLocaleString()
  assert.equal(
    formatProfileRibbonMetrics(
      makeProfile({ plays: 12345 }),
      "ready",
      { kind: "artist", key: "artist-1" },
      rangeModule.presetRange("1w"),
      "UTC"
    )[0],
    (12345).toLocaleString()
  );

  // Same-target data stays displayed during loading (zero-flash range transition)
  assert.deepEqual(
    formatProfileRibbonMetrics(
      artist1w,
      "loading",
      { kind: "artist", key: "artist-1" },
      rangeModule.presetRange("all"),
      "UTC"
    ),
    ["42", "3 / 50", "15 Jan 2024", "18 Nov 2024"]
  );
  // Mismatched range when ready, or not_found/error status, must NOT leak
  assert.deepEqual(
    formatProfileRibbonMetrics(
      artist1w,
      "ready",
      { kind: "artist", key: "artist-1" },
      rangeModule.presetRange("all"),
      "UTC"
    ),
    ["--", "--", "--", "--"]
  );
  assert.deepEqual(
    formatProfileRibbonMetrics(
      artist1w,
      "not_found",
      { kind: "artist", key: "artist-1" },
      rangeModule.presetRange("1w"),
      "UTC"
    ),
    ["--", "--", "--", "--"]
  );
  assert.deepEqual(
    formatProfileRibbonMetrics(
      artist1w,
      "error",
      { kind: "artist", key: "artist-1" },
      rangeModule.presetRange("1w"),
      "UTC"
    ),
    ["--", "--", "--", "--"]
  );

  // Wrong entity must NOT leak
  assert.deepEqual(
    formatProfileRibbonMetrics(
      artist1w,
      "ready",
      { kind: "track", key: "track-1" },
      rangeModule.presetRange("1w"),
      "UTC"
    ),
    ["--", "--", "--", "--"]
  );
  assert.equal(
    resolveDisplayedProfileData(artist1w, { kind: "track", key: "track-1" }),
    null
  );
  // Same target retains data (for dimmed range transitions)
  assert.equal(
    resolveDisplayedProfileData(artist1w, { kind: "artist", key: "artist-1" }),
    artist1w
  );

  // Cache keys partition by timezone
  assert.notEqual(
    getProfileCacheKey({ kind: "artist", key: "a:1" }, rangeModule.presetRange("1w"), "UTC"),
    getProfileCacheKey({ kind: "artist", key: "a:1" }, rangeModule.presetRange("1w"), "America/Chicago")
  );

  // Cache keys differ between all and a window
  const allCacheKey = getProfileCacheKey(
    { kind: "artist", key: "radiohead" },
    rangeModule.presetRange("all"),
    "UTC"
  );
  const windowCacheKey = getProfileCacheKey(
    { kind: "artist", key: "radiohead" },
    { kind: "window", from: "2025-11-01", to: "2025-11-30" },
    "UTC"
  );
  assert.notEqual(allCacheKey, windowCacheKey);
  assert.equal(allCacheKey, "artist:all:UTC:radiohead");
  assert.equal(windowCacheKey, "artist:2025-11-01..2025-11-30:UTC:radiohead");
});

test("useSearchProfile: query persistence, default All, reload prange, dimmed range retention, and timezone cache", async () => {
  const origFetch = globalThis.fetch;
  const fetchCalls: Array<{ url: string; signal?: AbortSignal }> = [];

  try {
    await withHookReact(async (harness) => {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        fetchCalls.push({ url, signal: init?.signal ?? undefined });
        const parsed = new URL(url, "http://127.0.0.1:8888");
        const prange = (parsed.searchParams.get("prange") || "1w") as RangeKey;
        const track = parsed.searchParams.get("track");
        const artist = parsed.searchParams.get("artist");
        return {
          ok: true,
          status: 200,
          json: async () =>
            makeProfile({
              kind: track ? "track" : "artist",
              key: (track || artist)!,
              range: prange,
              plays: prange === "all" ? 99 : 12,
            }),
        } as unknown as Response;
      }) as typeof fetch;

      // 1. Deep-link mount restores initialProfile and initialProfileRange
      let state = harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
        initialProfile: { kind: "track", key: "track-deep" },
        initialProfileRange: rangeModule.presetRange("all"),
      });
      assert.equal(state.profileStatus, "loading");
      assert.deepEqual(state.profileTarget, { kind: "track", key: "track-deep" });
      assert.deepEqual(state.profileRange, rangeModule.presetRange("all"));
      await flushMicrotasks();

      state = harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
        initialProfile: { kind: "track", key: "track-deep" },
        initialProfileRange: rangeModule.presetRange("all"),
      });
      assert.equal(state.profileStatus, "ready");
      assert.equal(state.profileData?.plays, 99);
      assert.equal(fetchCalls.length, 1);

      // 2. Back to search preserves query; switching tabs preserves query
      state.setSearchQuery("radio");
      state.handleProfileBack();
      state = harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
      });
      assert.equal(state.profileTarget, null);
      assert.equal(state.profileData, null);
      assert.equal(state.searchQuery, "radio");

      // Switch to Overview (mode 0) and back to Search (mode 4)
      harness.renderOnce({
        activeMode: 0,
        visitorTimezone: "UTC",
      });
      state = harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
      });
      assert.equal(state.searchQuery, "radio");

      // 3. Opening from search starts at All
      state.handleOpenProfile({ kind: "artist", key: "artist-radio" });
      state = harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
      });
      assert.deepEqual(state.profileRange, rangeModule.presetRange("all"));
      assert.equal(state.profileStatus, "loading");
      assert.equal(state.profileData, null);
      await flushMicrotasks();

      state = harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
      });
      assert.equal(state.profileStatus, "ready");
      assert.equal(state.profileData?.key, "artist-radio");
      assert.equal(state.profileData?.range, "all");

      // 4. Range switch retains same-target data dimmed during loading
      const yearWindow = rangeModule.unitWindow(rangeModule.todayDateKey("UTC"), "year");
      const yearParam = rangeModule.formatRangeParam(yearWindow);
      state.handleSelectProfileRange(rangeModule.presetRange("6m"));
      state = harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
      });
      assert.deepEqual(state.profileRange, yearWindow);
      assert.equal(state.profileStatus, "loading");
      assert.equal(state.profileData?.key, "artist-radio");
      assert.equal(state.profileData?.range, "all");
      await flushMicrotasks();
      state = harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
      });
      assert.equal(state.profileStatus, "ready");
      assert.equal(state.profileData?.range, yearParam);

      // 5. Opening a top Track from the artist profile keeps the profile's range and clears artist data
      state.handleOpenRelatedProfile({ kind: "track", key: "top-track-1" });
      state = harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
      });
      assert.deepEqual(state.profileRange, yearWindow);
      assert.equal(state.profileStatus, "loading");
      assert.equal(state.profileData, null);
      await flushMicrotasks();
      state = harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
      });
      assert.equal(state.profileStatus, "ready");
      assert.equal(state.profileData?.key, "top-track-1");

      // 6. Switching back to cached range hits cache without fetch; timezone change misses cache and fetches
      const callsBeforeCached = fetchCalls.length;
      state.handleProfileBack();
      state = harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
      });
      assert.equal(state.profileTarget?.key, "artist-radio");
      assert.deepEqual(state.profileRange, yearWindow);
      assert.equal(state.profileStatus, "ready");
      assert.equal(fetchCalls.length, callsBeforeCached);

      state = harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "America/Chicago",
      });
      assert.equal(state.profileStatus, "loading");
      assert.equal(fetchCalls.length, callsBeforeCached + 1);
      assert.ok(fetchCalls[fetchCalls.length - 1].url.includes("tz=America%2FChicago"));
    });
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("useSearchProfile: canonical alias swap caches first without extra fetch or loop, aborts stale requests, distinguishes 404 vs error", async () => {
  const origFetch = globalThis.fetch;

  try {
    // Part A: Canonical alias swap & aborting stale requests
    await withHookReact(async (harness) => {
      const requests: Array<{
        url: string;
        signal?: AbortSignal;
        resolve: (res: Response) => void;
      }> = [];

      globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((resolve) => {
          requests.push({
            url: String(input),
            signal: init?.signal ?? undefined,
            resolve,
          });
        });
      }) as typeof fetch;

      let state = harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
        initialProfile: { kind: "artist", key: "stale-artist" },
        initialProfileRange: rangeModule.presetRange("1w"),
      });
      assert.equal(requests.length, 1);

      // Switch to alias key before stale-artist finishes
      state.handleOpenProfile({ kind: "artist", key: "radiohead-alias" });
      harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
      });
      assert.equal(requests[0].signal?.aborted, true, "Stale request must be aborted");
      assert.equal(requests.length, 2);

      // Resolving stale request out-of-order must be ignored
      requests[0].resolve({
        ok: true,
        status: 200,
        json: async () => makeProfile({ kind: "artist", key: "stale-artist", name: "Wrong" }),
      } as unknown as Response);
      await flushMicrotasks();
      state = harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
      });
      assert.equal(state.profileStatus, "loading");
      assert.equal(state.profileData, null);

      // Resolving alias request returns canonical key -> must update target without extra fetch or loop
      requests[1].resolve({
        ok: true,
        status: 200,
        json: async () =>
          makeProfile({ kind: "artist", key: "4Z8W4fKeB5YxbusRsdQVPb", name: "Radiohead" }),
      } as unknown as Response);
      await flushMicrotasks();

      state = harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
      });
      assert.deepEqual(state.profileTarget, {
        kind: "artist",
        key: "4Z8W4fKeB5YxbusRsdQVPb",
      });
      assert.equal(state.profileStatus, "ready");
      assert.equal(state.profileData?.key, "4Z8W4fKeB5YxbusRsdQVPb");
      assert.equal(requests.length, 2, "Canonical alias swap must NOT trigger an extra fetch");

      // Re-rendering multiple turns must not loop or fetch
      harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
      });
      assert.equal(requests.length, 2);
    });

    // Part B: 404 -> not_found, 500 -> error
    await withHookReact(async (harness) => {
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("track=nope")) {
          return {
            ok: false,
            status: 404,
            json: async () => ({ error: "Not found" }),
          } as unknown as Response;
        }
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: "Server error" }),
        } as unknown as Response;
      }) as typeof fetch;

      harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
        initialProfile: { kind: "track", key: "nope" },
        initialProfileRange: rangeModule.presetRange("1w"),
      });
      await flushMicrotasks();
      const notFoundState = harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
      });
      assert.equal(notFoundState.profileStatus, "not_found");
      assert.equal(notFoundState.profileData, null);

      notFoundState.handleSelectProfileRange(rangeModule.presetRange("1w"));
      assert.equal(harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
      }).profileStatus, "not_found");

      notFoundState.handleOpenProfile({ kind: "track", key: "boom" });
      harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
      });
      await flushMicrotasks();
      const errorState = harness.renderOnce({
        activeMode: 4,
        visitorTimezone: "UTC",
      });
      assert.equal(errorState.profileStatus, "error");
      assert.equal(errorState.profileData, null);
    });
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("src/app/page.tsx passes initialProfile and initialProfileRange only when initialMode === 4", async () => {
  const deps: Record<string, unknown> = {
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
    "@/components/ListeningView": { ListeningView: "view" },
    "@/components/listening-view/listening-helpers": { parseModeParam },
    "@/lib/mock/overview-data": {
      MOCK_DATA: { overview: { "1w": {}, all: {} }, streamLog: {}, session: {} },
      getMockOverview: () => ({ range: "1w", granularity: "block6h" }),
    },
    "@/lib/config-utils": { DEFAULT_SITE_CONFIG: {} },
    "@/lib/types": { RANGE_KEYS: ["1d", "1w", "1m", "6m", "1y", "all"] },
    "@/lib/range": rangeModule,
    "@/lib/db/queries": {
      getActiveSiteConfig: async () => ({}),
      getInitialMusicData: async () => ({ overview: {}, streamLog: {}, session: {} }),
    },
    "@/lib/db": { isDbConfigured: () => false },
    "@/lib/admin-auth": { ADMIN_COOKIE_NAME: "admin_session", verifySessionToken: () => false },
    "@/lib/timezone-utils": timezoneUtils,
    "@/lib/search-utils": searchUtils,
  };

  const js = ts.transpileModule(readFileSync("src/app/page.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;

  const mod = {
    exports: {} as { default: (props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) => Promise<{ props: Record<string, unknown> }> },
  };
  new Function("require", "module", "exports", "React", js)(
    (id: string) => {
      if (!(id in deps)) throw new Error(`Missing stubbed dependency: ${id}`);
      return deps[id];
    },
    mod,
    mod.exports,
    { createElement: (_type: unknown, props: object) => ({ props }) }
  );

  const todayKey = rangeModule.todayDateKey("UTC");
  const expectedWeek = rangeModule.unitWindow(todayKey, "week");
  const expectedYear = rangeModule.unitWindow(todayKey, "year");

  // Mode 4 track deep link
  const mode4Track = await mod.exports.default({
    searchParams: Promise.resolve({ mode: "4", track: "4clD00s1c0rVqP9Ld0vV48", prange: "all", range: "1w" }),
  });
  assert.equal(mode4Track.props.initialMode, 4);
  assert.deepEqual(mode4Track.props.initialRange, expectedWeek);
  assert.deepEqual(mode4Track.props.initialProfile, { kind: "track", key: "4clD00s1c0rVqP9Ld0vV48" });
  assert.deepEqual(mode4Track.props.initialProfileRange, { kind: "preset", key: "all" });

  // Mode 4 artist deep link without prange
  const mode4Artist = await mod.exports.default({
    searchParams: Promise.resolve({ mode: "4", artist: "4Z8W4fKeB5YxbusRsdQVPb" }),
  });
  assert.equal(mode4Artist.props.initialMode, 4);
  assert.deepEqual(mode4Artist.props.initialProfile, { kind: "artist", key: "4Z8W4fKeB5YxbusRsdQVPb" });
  assert.equal(mode4Artist.props.initialProfileRange, null);

  const mode4Album = await mod.exports.default({
    searchParams: Promise.resolve({ mode: "4", album: "radiohead::in rainbows", prange: "1y" }),
  });
  assert.deepEqual(mode4Album.props.initialProfile, { kind: "album", key: "radiohead::in rainbows" });
  assert.deepEqual(mode4Album.props.initialProfileRange, expectedYear);

  // Mode 4 window prange
  const mode4Window = await mod.exports.default({
    searchParams: Promise.resolve({ mode: "4", artist: "4Z8W4fKeB5YxbusRsdQVPb", prange: "2025-11-01..2025-11-30" }),
  });
  assert.deepEqual(mode4Window.props.initialProfileRange, {
    kind: "window",
    from: "2025-11-01",
    to: "2025-11-30",
  });

  // Mode 4 invalid prange falls back to null
  const mode4InvalidPrange = await mod.exports.default({
    searchParams: Promise.resolve({ mode: "4", artist: "4Z8W4fKeB5YxbusRsdQVPb", prange: "invalid-range" }),
  });
  assert.equal(mode4InvalidPrange.props.initialProfileRange, null);

  // Non-4 mode ignores profile params
  const mode0 = await mod.exports.default({
    searchParams: Promise.resolve({ mode: "0", album: "k", prange: "all" }),
  });
  assert.equal(mode0.props.initialMode, 0);
  assert.equal(mode0.props.initialProfile, null);
  assert.equal(mode0.props.initialProfileRange, null);

  // Mode 3 stays excluded from SSR initialMode and ignores profile params
  const mode3 = await mod.exports.default({
    searchParams: Promise.resolve({ mode: "3", track: "t1", prange: "all" }),
  });
  assert.equal(mode3.props.initialMode, 0);
  assert.equal(mode3.props.initialProfile, null);
  assert.equal(mode3.props.initialProfileRange, null);

  // Mode 5 (Calendar) is accepted at SSR
  const mode5 = await mod.exports.default({
    searchParams: Promise.resolve({ mode: "5" }),
  });
  assert.equal(mode5.props.initialMode, 5);

  // Mode 4 browse (no profile target) passes parsed search params
  const mode4Search = await mod.exports.default({
    searchParams: Promise.resolve({
      mode: "4",
      q: "  radiohead  ",
      type: "albums",
      sort: "recent",
      page: "3",
    }),
  });
  assert.equal(mode4Search.props.initialMode, 4);
  assert.equal(mode4Search.props.initialProfile, null);
  assert.equal(mode4Search.props.initialSearchQuery, "radiohead");
  assert.equal(mode4Search.props.initialSearchFilter, "albums");
  assert.equal(mode4Search.props.initialSearchSort, "recent");
  assert.equal(mode4Search.props.initialSearchPage, 3);

  // Mode 4 browse with invalid/too-long query falls back to defaults
  const mode4InvalidSearch = await mod.exports.default({
    searchParams: Promise.resolve({
      mode: "4",
      q: "a".repeat(200),
      type: "invalid",
      sort: "bogus",
      page: "0",
    }),
  });
  assert.equal(mode4InvalidSearch.props.initialSearchQuery, "");
  assert.equal(mode4InvalidSearch.props.initialSearchFilter, "all");
  assert.equal(mode4InvalidSearch.props.initialSearchSort, "most-plays");
  assert.equal(mode4InvalidSearch.props.initialSearchPage, 1);

  // Mode 4 with a profile target does not pass browse search params
  assert.equal(mode4Track.props.initialSearchQuery, undefined);
  assert.equal(mode4Track.props.initialSearchFilter, undefined);
  assert.equal(mode4Track.props.initialSearchSort, undefined);
  assert.equal(mode4Track.props.initialSearchPage, undefined);
});

test("useSearchProfile: clearProfileCache invalidates in-flight requests and refreshes mounted profile while retaining same-target data", async () => {
  const origFetch = globalThis.fetch;

  try {
    await withHookReact(async (harness) => {
      const requests: Array<{
        url: string;
        signal?: AbortSignal;
        resolve: (res: Response) => void;
      }> = [];

      globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((resolve) => {
          requests.push({
            url: String(input),
            signal: init?.signal ?? undefined,
            resolve,
          });
        });
      }) as typeof fetch;

      const args = {
        activeMode: 4 as const,
        visitorTimezone: "UTC",
        initialProfile: { kind: "artist" as const, key: "radiohead" },
        initialProfileRange: rangeModule.presetRange("1y"),
      };

      // Initial mount loads profile (plays = 12)
      harness.renderOnce(args);
      assert.equal(requests.length, 1);
      requests[0].resolve(
        Response.json(makeProfile({ kind: "artist", key: "radiohead", range: "1y", plays: 12 }))
      );
      await flushMicrotasks();
      let state = harness.renderOnce(args);
      assert.equal(state.profileStatus, "ready");
      assert.equal(state.profileData?.plays, 12);

      // Start a range switch to 1m (in-flight pre-sync request)
      state.handleSelectProfileRange(rangeModule.presetRange("1m"));
      state = harness.renderOnce(args);
      assert.equal(requests.length, 2);
      assert.equal(state.profileStatus, "loading");
      assert.equal(state.profileData?.plays, 12);

      // Clear cache while request #2 is in-flight
      state.clearProfileCache();
      state = harness.renderOnce(args);
      assert.equal(requests[1].signal?.aborted, true, "Pre-sync in-flight request must be aborted");
      assert.equal(requests.length, 3, "Fresh request must be triggered immediately");
      assert.equal(state.profileStatus, "loading");
      assert.equal(
        state.profileData?.plays,
        12,
        "Same-target data must be retained during refresh"
      );

      // Resolving stale pre-sync request must be ignored and not repopulate cache
      requests[1].resolve(
        Response.json(makeProfile({ kind: "artist", key: "radiohead", range: "6m", plays: 999 }))
      );
      await flushMicrotasks();
      state = harness.renderOnce(args);
      assert.equal(state.profileStatus, "loading");
      assert.equal(state.profileData?.plays, 12);

      // Resolving fresh post-sync request updates mounted profile
      requests[2].resolve(
        Response.json(makeProfile({ kind: "artist", key: "radiohead", range: "6m", plays: 42 }))
      );
      await flushMicrotasks();
      state = harness.renderOnce(args);
      assert.equal(state.profileStatus, "ready");
      assert.equal(state.profileData?.plays, 42);

      // Calling clearProfileCache while ready refreshes mounted profile in place
      state.clearProfileCache();
      state = harness.renderOnce(args);
      assert.equal(requests.length, 4, "clearProfileCache must refresh currently mounted profile");
      assert.equal(state.profileStatus, "loading");
      assert.equal(
        state.profileData?.plays,
        42,
        "Same-target data must stay visible while refreshing"
      );

      requests[3].resolve(
        Response.json(makeProfile({ kind: "artist", key: "radiohead", range: "6m", plays: 55 }))
      );
      await flushMicrotasks();
      state = harness.renderOnce(args);
      assert.equal(state.profileStatus, "ready");
      assert.equal(state.profileData?.plays, 55);
    });
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("useSearchProfile: syncFromLocation restores exact bounded history stack when provided and keeps two-arg fallback", async () => {
  const origFetch = globalThis.fetch;

  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const params = new URL(String(input), "http://127.0.0.1:8888").searchParams;
      const target = searchUtils.parseProfileTarget(params);
      assert.ok(target);
      return Response.json(
        makeProfile({
          ...target,
          name: `Name:${target.key}`,
          range: rangeModule.formatRangeParam(rangeModule.parseRangeParam(params.get("prange")) ?? rangeModule.presetRange("1y")),
        })
      );
    }) as typeof fetch;

    await withHookReact(async (harness) => {
      const args = { activeMode: 4 as const, visitorTimezone: "UTC" };
      const artist: ProfileTarget = { kind: "artist", key: "radiohead" };
      const album: ProfileTarget = { kind: "album", key: "radiohead::in rainbows" };
      const track: ProfileTarget = { kind: "track", key: "weird-fishes" };

      const artistEntry: ProfileHistoryEntry = { target: artist, range: rangeModule.presetRange("6m"), name: "Name:radiohead" };
      const albumEntry: ProfileHistoryEntry = { target: album, range: rangeModule.presetRange("1m"), name: "Name:radiohead::in rainbows" };

      // Start on Search (empty history)
      let state = harness.renderOnce(args);
      assert.equal(state.profileTarget, null);
      assert.equal(state.profileHistory.length, 0);

      const todayKey = rangeModule.todayDateKey("UTC");
      const yearWindow = rangeModule.unitWindow(todayKey, "year");
      const monthWindow = rangeModule.unitWindow(todayKey, "month");

      // Native Forward from Search directly to Track with saved history stack
      state.syncFromLocation(track, rangeModule.presetRange("1m"), [artistEntry, albumEntry]);
      await flushMicrotasks();
      state = harness.renderOnce(args);
      assert.deepEqual(state.profileTarget, track);
      assert.deepEqual(state.profileRange, monthWindow);
      assert.deepEqual(state.profileHistory, [artistEntry, albumEntry]);
      assert.equal(state.returnsTo, "album");

      // Native Back after SEARCH reset / non-top jump restores exact ancestry
      state.handleReturnToSearch();
      state = harness.renderOnce(args);
      assert.equal(state.profileHistory.length, 0);

      state.syncFromLocation(album, rangeModule.presetRange("6m"), [artistEntry]);
      await flushMicrotasks();
      state = harness.renderOnce(args);
      assert.deepEqual(state.profileTarget, album);
      assert.deepEqual(state.profileRange, yearWindow);
      assert.deepEqual(state.profileHistory, [artistEntry]);

      // Provided history stack is bounded to 20 entries (keeps most recent 20)
      const oversized: ProfileHistoryEntry[] = Array.from({ length: 25 }, (_, i) => ({
        target: { kind: "artist", key: `artist-${i}` },
        range: rangeModule.presetRange("1y"),
        name: `Artist ${i}`,
      }));
      state.syncFromLocation(track, rangeModule.presetRange("1y"), oversized);
      await flushMicrotasks();
      state = harness.renderOnce(args);
      assert.equal(state.profileHistory.length, 20);
      assert.equal(state.profileHistory[0].target.key, "artist-5");
      assert.equal(state.profileHistory[19].target.key, "artist-24");

      // Two-argument fallback still pops top when landing on top of stack
      state.syncFromLocation({ kind: "artist", key: "artist-24" }, rangeModule.presetRange("1y"));
      await flushMicrotasks();
      state = harness.renderOnce(args);
      assert.equal(state.profileHistory.length, 19);
      assert.equal(state.profileHistory[18].target.key, "artist-23");
    });
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("useSearchProfile: canonical alias swap preserves window range in cache key and target", async () => {
  const origFetch = globalThis.fetch;
  const windowRange: rangeModule.RangeSelection = {
    kind: "window",
    from: "2025-11-01",
    to: "2025-11-30",
  };

  try {
    await withHookReact(async (harness) => {
      const requests: Array<{ url: string; resolve: (res: Response) => void }> = [];

      globalThis.fetch = ((input: RequestInfo | URL) => {
        return new Promise<Response>((resolve) => {
          requests.push({ url: String(input), resolve });
        });
      }) as typeof fetch;

      const args = {
        activeMode: 4 as const,
        visitorTimezone: "UTC",
        initialProfile: { kind: "artist" as const, key: "alias-artist" },
        initialProfileRange: windowRange,
      };

      let state = harness.renderOnce(args);
      assert.equal(state.profileStatus, "loading");
      assert.equal(requests.length, 1);
      assert.ok(requests[0].url.includes("prange=2025-11-01..2025-11-30"));

      // Resolving alias returns canonical key
      requests[0].resolve({
        ok: true,
        status: 200,
        json: async () =>
          makeProfile({
            kind: "artist",
            key: "canonical-artist",
            range: "2025-11-01..2025-11-30",
            name: "Canonical Artist",
          }),
      } as unknown as Response);
      await flushMicrotasks();

      state = harness.renderOnce(args);
      assert.deepEqual(state.profileTarget, { kind: "artist", key: "canonical-artist" });
      assert.deepEqual(state.profileRange, windowRange);
      assert.equal(state.profileStatus, "ready");
      assert.equal(requests.length, 1, "Canonical alias swap must not make second request");

      // Opening canonical target at windowRange hits cache without fetching
      state.handleOpenProfile({ kind: "artist", key: "canonical-artist" });
      state = harness.renderOnce(args);
      // When handleOpenProfile is called, it resets to DEFAULT_PROFILE_RANGE ("all")
      assert.deepEqual(state.profileRange, { kind: "preset", key: "all" });

      // Selecting window range again on canonical target hits canonicalCacheKey
      state.handleSelectProfileRange(windowRange);
      state = harness.renderOnce(args);
      assert.deepEqual(state.profileRange, windowRange);
      assert.equal(state.profileStatus, "ready");
      assert.equal(requests.length, 2); // 1 for "all" fetch when handleOpenProfile was called, none for windowRange
    });
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("useSearchProfile: handleSelectProfileRange with push flag triggers onRequestPushHistory without polluting breadcrumb history", async () => {
  const origFetch = globalThis.fetch;
  const window1: rangeModule.RangeSelection = { kind: "window", from: "2025-11-01", to: "2025-11-30" };
  const window2: rangeModule.RangeSelection = { kind: "window", from: "2025-12-01", to: "2025-12-31" };

  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const params = new URL(String(input), "http://127.0.0.1:8888").searchParams;
      const targetKind = params.has("album") ? "album" : "artist";
      const targetKey = params.get(targetKind) || "radiohead";
      return Response.json(
        makeProfile({
          kind: targetKind as "artist" | "album",
          key: targetKey,
          range: params.get("prange") || "all",
          name: targetKind === "album" ? "In Rainbows" : "Radiohead",
        })
      );
    }) as typeof fetch;

    await withHookReact(async (harness) => {
      let pushRequestedCount = 0;
      const args = {
        activeMode: 4 as const,
        visitorTimezone: "UTC",
        initialProfile: { kind: "artist" as const, key: "radiohead" },
        initialProfileRange: rangeModule.presetRange("all"),
        onRequestPushHistory: () => {
          pushRequestedCount++;
        },
      };

      let state = harness.renderOnce(args);
      assert.equal(state.profileStatus, "loading");
      await flushMicrotasks();
      state = harness.renderOnce(args);
      assert.equal(state.profileHistory.length, 0);

      // Same range with push: true -> does NOT push history or trigger push request
      state.handleSelectProfileRange(rangeModule.presetRange("all"), { push: true });
      state = harness.renderOnce(args);
      assert.equal(state.profileHistory.length, 0, "Push flag with unchanged range must not push breadcrumb history");
      assert.equal(pushRequestedCount, 0, "Push flag with unchanged range must not request browser push");

      // Different range with push: true -> requests browser push, but does NOT pollute breadcrumb history
      state.handleSelectProfileRange(window1, { push: true });
      await flushMicrotasks();
      state = harness.renderOnce(args);
      assert.equal(state.profileHistory.length, 0, "Window drill must not add duplicate entity to breadcrumb history");
      assert.equal(pushRequestedCount, 1, "Window drill must request browser history push");
      assert.deepEqual(state.profileRange, window1);

      // Selecting window1 again with push: true -> does NOT push history or request push
      state.handleSelectProfileRange(window1, { push: true });
      state = harness.renderOnce(args);
      assert.equal(state.profileHistory.length, 0);
      assert.equal(pushRequestedCount, 1);

      // Selecting window2 with push: true -> requests browser push, still zero breadcrumbs
      state.handleSelectProfileRange(window2, { push: true });
      await flushMicrotasks();
      state = harness.renderOnce(args);
      assert.equal(state.profileHistory.length, 0);
      assert.equal(pushRequestedCount, 2);
      assert.deepEqual(state.profileRange, window2);

      // Cross-entity navigation DOES push to breadcrumb history
      state.handleOpenRelatedProfile({ kind: "album", key: "in-rainbows" });
      await flushMicrotasks();
      state = harness.renderOnce(args);
      assert.equal(state.profileHistory.length, 1, "Cross-entity hop must push to breadcrumb history");
      assert.deepEqual(state.profileHistory[0], {
        target: { kind: "artist", key: "radiohead" },
        range: window2,
        name: "Radiohead",
      });

      // handleProfileBack restores ancestor from breadcrumb history
      state.handleProfileBack();
      await flushMicrotasks();
      state = harness.renderOnce(args);
      assert.deepEqual(state.profileRange, window2);
      assert.deepEqual(state.profileTarget, { kind: "artist", key: "radiohead" });
      assert.equal(state.profileHistory.length, 0);
    });
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("useSearchProfile manages searchScrollY via rememberSearchScroll, clearSearchScroll, and non-search opens", async () => {
  const origFetch = globalThis.fetch;
  const origWindow = (globalThis as unknown as { window?: unknown }).window;

  try {
    let mockScrollY = 325;
    (globalThis as unknown as { window: unknown }).window = {
      get scrollY() {
        return mockScrollY;
      },
    };
    globalThis.fetch = (async () =>
      Response.json(makeProfile({ kind: "artist", key: "radiohead", range: "all" }))) as typeof fetch;

    await withHookReact(async (harness) => {
      const args = { activeMode: 4 as const, visitorTimezone: "UTC" };

      let state = harness.renderOnce(args);
      assert.equal(state.searchScrollY, null, "Initial searchScrollY must be null");

      // Opening from Search calls rememberSearchScroll() before handleOpenProfile()
      state.rememberSearchScroll();
      state.handleOpenProfile({ kind: "artist", key: "radiohead" });
      state = harness.renderOnce(args);
      assert.equal(state.searchScrollY, 325, "handleOpenProfile after rememberSearchScroll must keep stored Y");

      // clearSearchScroll resets stored Y
      state.clearSearchScroll();
      state = harness.renderOnce(args);
      assert.equal(state.searchScrollY, null, "clearSearchScroll must reset searchScrollY to null");

      // Opening from Overview/Live Player calls handleOpenProfile without rememberSearchScroll -> clears stale scrollY
      mockScrollY = 180;
      state.rememberSearchScroll();
      state.handleOpenProfile({ kind: "artist", key: "radiohead" });
      state = harness.renderOnce(args);
      assert.equal(state.searchScrollY, 180);

      state.handleOpenProfile({ kind: "track", key: "track-1" });
      state = harness.renderOnce(args);
      assert.equal(state.searchScrollY, null, "Direct handleOpenProfile without rememberSearchScroll must clear stale scrollY");
    });
  } finally {
    globalThis.fetch = origFetch;
    if (origWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = origWindow;
    }
  }
});
