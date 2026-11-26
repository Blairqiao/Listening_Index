import { test, mock } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {
  useEpochJson,
  prefetchEpochJson,
  peekEpochJson,
  clearEpochJsonCache,
} from "../src/components/listening-view/useEpochJson";
import { useSearch, prefetchSearch, clearSearchCache } from "../src/components/views/search-view/useSearch";
import { prefetchKindsForMode } from "../src/components/listening-view/listening-helpers";
import type { SearchResponse } from "../src/lib/search-types";

type Hooks = { useState: unknown; useEffect: unknown; useRef: unknown };

/** Runs a hook outside React: state and refs persist across turns, effects run after each turn. */
function withHookHarness<R>(render: () => R) {
  const state: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const deps: unknown[][] = [];
  const cleanups: Array<(() => void) | void> = [];
  let s = 0, r = 0, e = 0;
  let pending: Array<{ idx: number; fn: () => (() => void) | void }> = [];
  let dirty = false;
  const fake: Hooks = {
    useState: (init: unknown) => {
      const i = s++;
      if (!(i in state)) state[i] = typeof init === "function" ? (init as () => unknown)() : init;
      return [state[i], (v: unknown) => {
        const next = typeof v === "function" ? (v as (p: unknown) => unknown)(state[i]) : v;
        if (next !== state[i]) { state[i] = next; dirty = true; }
      }];
    },
    useRef: (init: unknown) => {
      const i = r++;
      refs[i] ??= { current: init };
      return refs[i];
    },
    useEffect: (fn: () => (() => void) | void, d: unknown[] = []) => {
      const i = e++;
      if (!deps[i] || d.some((x, k) => x !== deps[i][k])) { deps[i] = d; pending.push({ idx: i, fn }); }
    },
  };
  const real: Hooks = { useState: React.useState, useEffect: React.useEffect, useRef: React.useRef };
  const turn = (): R => {
    Object.assign(React, fake);
    let out: R;
    let passes = 0;
    try {
      do {
        dirty = false; s = 0; r = 0; e = 0;
        out = render();
      } while (dirty && ++passes < 10);
    } finally {
      Object.assign(React, real);
    }
    const run = pending; pending = [];
    for (const { idx, fn } of run) {
      const c = cleanups[idx];
      if (typeof c === "function") c();
      cleanups[idx] = fn();
    }
    return out!;
  };
  const dispose = () => { for (const c of cleanups) if (typeof c === "function") c(); };
  return { turn, dispose };
}

async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

function deferredFetch() {
  const calls: string[] = [];
  const resolvers: Array<(body: unknown) => void> = [];
  const fetchImpl = ((url: string) => {
    calls.push(url);
    return new Promise<Response>((resolve) => {
      resolvers.push((body) => resolve({ ok: true, json: async () => body } as unknown as Response));
    });
  }) as typeof fetch;
  return { calls, resolvers, fetchImpl };
}

test("prefetchEpochJson shares one request per path, timezone and refresh key", async () => {
  clearEpochJsonCache();
  const original = globalThis.fetch;
  const f = deferredFetch();
  globalThis.fetch = f.fetchImpl;
  try {
    prefetchEpochJson("/api/listening/taste", "UTC", 1);
    prefetchEpochJson("/api/listening/taste", "UTC", 1);
    assert.equal(f.calls.length, 1, "a repeated hover does not refetch");
    assert.equal(peekEpochJson("/api/listening/taste", "UTC", 1), undefined);

    f.resolvers[0]({ phases: ["a"] });
    await flush();
    assert.deepEqual(peekEpochJson("/api/listening/taste", "UTC", 1), { phases: ["a"] });

    prefetchEpochJson("/api/listening/taste", "UTC", 2);
    assert.equal(f.calls.length, 2, "a sync (new refresh key) refetches");
    assert.equal(peekEpochJson("/api/listening/taste", "UTC", 1), undefined, "the old epoch is dropped");
  } finally {
    globalThis.fetch = original;
    clearEpochJsonCache();
  }
});

test("prefetchEpochJson forgets a failed request so the next one retries", async () => {
  clearEpochJsonCache();
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return { ok: false, status: 500 } as unknown as Response;
  }) as typeof fetch;
  try {
    prefetchEpochJson("/api/listening/taste", "UTC", 0);
    await flush();
    assert.equal(peekEpochJson("/api/listening/taste", "UTC", 0), undefined);
    prefetchEpochJson("/api/listening/taste", "UTC", 0);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
    clearEpochJsonCache();
  }
});

test("useEpochJson renders prefetched data on its first enabled render", async () => {
  clearEpochJsonCache();
  const original = globalThis.fetch;
  const f = deferredFetch();
  globalThis.fetch = f.fetchImpl;
  let enabled = false;
  const h = withHookHarness(() =>
    useEpochJson<{ phases: string[] }>("/api/listening/taste", { enabled, timezone: "UTC", refreshKey: 0 }, "[T]"),
  );
  try {
    assert.equal(h.turn().status, "idle");
    prefetchEpochJson("/api/listening/taste", "UTC", 0);
    f.resolvers[0]({ phases: ["warm"] });
    await flush();

    enabled = true;
    const first = h.turn();
    assert.equal(first.status, "ready", "no skeleton frame when the data is already here");
    assert.deepEqual(first.data, { phases: ["warm"] });
    assert.equal(f.calls.length, 1, "the hook reuses the prefetch");
  } finally {
    h.dispose();
    globalThis.fetch = original;
    clearEpochJsonCache();
  }
});

test("useEpochJson joins a prefetch that is still in flight", async () => {
  clearEpochJsonCache();
  const original = globalThis.fetch;
  const f = deferredFetch();
  globalThis.fetch = f.fetchImpl;
  const h = withHookHarness(() =>
    useEpochJson<{ phases: string[] }>("/api/listening/taste", { enabled: true, timezone: "UTC", refreshKey: 0 }, "[T]"),
  );
  try {
    prefetchEpochJson("/api/listening/taste", "UTC", 0);
    assert.equal(h.turn().status, "idle");
    assert.equal(h.turn().status, "loading");
    assert.equal(f.calls.length, 1, "clicking during the prefetch does not start a second request");

    f.resolvers[0]({ phases: ["joined"] });
    await flush();
    const done = h.turn();
    assert.equal(done.status, "ready");
    assert.deepEqual(done.data, { phases: ["joined"] });
  } finally {
    h.dispose();
    globalThis.fetch = original;
    clearEpochJsonCache();
  }
});

function searchBody(label: string): SearchResponse {
  return {
    query: "",
    artists: [{ key: `a-${label}`, name: label, plays: 1, imageUrl: null }],
    albums: [],
    tracks: [],
  } as unknown as SearchResponse;
}

test("prefetchSearch fills the Search cache so the tab opens on results", async () => {
  clearSearchCache();
  const original = globalThis.fetch;
  const f = deferredFetch();
  globalThis.fetch = f.fetchImpl;
  const h = withHookHarness(() => useSearch("", "most-plays", 1, "all"));
  try {
    prefetchSearch("", "most-plays", 1, "all");
    prefetchSearch("", "most-plays", 1, "all");
    assert.equal(f.calls.length, 1);
    f.resolvers[0](searchBody("browse"));
    await flush();

    const res = h.turn();
    assert.equal(res.status, "ready");
    assert.equal(res.data?.artists[0]?.name, "browse");
    assert.equal(f.calls.length, 1);
  } finally {
    h.dispose();
    globalThis.fetch = original;
    clearSearchCache();
  }
});

test("useSearch joins a Search prefetch that is still in flight", async () => {
  clearSearchCache();
  mock.timers.enable({ apis: ["setTimeout"] });
  const original = globalThis.fetch;
  const f = deferredFetch();
  globalThis.fetch = f.fetchImpl;
  const h = withHookHarness(() => useSearch("", "most-plays", 1, "all"));
  try {
    prefetchSearch("", "most-plays", 1, "all");
    assert.equal(h.turn().status, "loading");
    mock.timers.tick(0);
    await flush();
    assert.equal(f.calls.length, 1, "the hook waits on the prefetch instead of fetching again");

    f.resolvers[0](searchBody("joined"));
    await flush();
    const res = h.turn();
    assert.equal(res.status, "ready");
    assert.equal(res.data?.artists[0]?.name, "joined");
  } finally {
    h.dispose();
    globalThis.fetch = original;
    mock.timers.reset();
    clearSearchCache();
  }
});

test("prefetchKindsForMode warms only what the target tab will request", () => {
  assert.deepEqual(prefetchKindsForMode(5, { activeMode: 0, hasProfile: false }), ["calendar", "taste"]);
  assert.deepEqual(prefetchKindsForMode(4, { activeMode: 0, hasProfile: false }), ["search"]);
  assert.deepEqual(prefetchKindsForMode(4, { activeMode: 0, hasProfile: true }), [], "Search reopens on the profile");
  assert.deepEqual(prefetchKindsForMode(5, { activeMode: 5, hasProfile: false }), [], "the open tab is already loaded");
  assert.deepEqual(prefetchKindsForMode(1, { activeMode: 0, hasProfile: false }), [], "SSR already has the Stream Log");
});
