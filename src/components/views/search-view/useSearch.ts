import { useState, useEffect } from "react";
import type { SearchResponse } from "@/lib/search-types";
import { checkSearchQuery, type SearchQueryCheck } from "@/lib/search-utils";

export type SearchStatus = "idle" | "loading" | "ready" | "error";

const SEARCH_CACHE_MAX = 50;
const searchCache = new Map<string, SearchResponse>();

function setInCache(key: string, value: SearchResponse): void {
  if (searchCache.has(key)) {
    searchCache.delete(key);
  } else if (searchCache.size >= SEARCH_CACHE_MAX) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) {
      searchCache.delete(oldestKey);
    }
  }
  searchCache.set(key, value);
}

export function useSearch(query: string): {
  status: SearchStatus;
  data: SearchResponse | null;
  check: SearchQueryCheck;
} {
  const check = checkSearchQuery(query);
  const effectiveQuery = check.ok ? check.query : null;

  const [lastReadyData, setLastReadyData] = useState<SearchResponse | null>(null);
  const [errorQuery, setErrorQuery] = useState<string | null>(null);
  const [prevEffectiveQuery, setPrevEffectiveQuery] = useState<string | null>(effectiveQuery);

  // Transition adjustment during render when effective query or invalid state changes
  if (effectiveQuery !== prevEffectiveQuery) {
    setPrevEffectiveQuery(effectiveQuery);
    setErrorQuery(null);
    if (effectiveQuery === null) {
      setLastReadyData(null);
    }
  }

  const cachedHit = effectiveQuery ? searchCache.get(effectiveQuery) ?? null : null;

  if (cachedHit && lastReadyData !== cachedHit) {
    setLastReadyData(cachedHit);
  }

  useEffect(() => {
    if (!effectiveQuery) {
      return;
    }

    if (searchCache.has(effectiveQuery)) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          "/api/listening/search?q=" + encodeURIComponent(effectiveQuery),
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!res.ok) {
          if (!controller.signal.aborted) {
            setErrorQuery(effectiveQuery);
          }
          return;
        }

        const json: SearchResponse = await res.json();
        if (controller.signal.aborted) {
          return;
        }

        setInCache(effectiveQuery, json);
        setLastReadyData(json);
        setErrorQuery(null);
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError" || controller.signal.aborted) {
          return;
        }
        setErrorQuery(effectiveQuery);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [effectiveQuery]);

  if (!check.ok) {
    return {
      status: "idle",
      data: null,
      check,
    };
  }

  if (cachedHit) {
    return {
      status: "ready",
      data: cachedHit,
      check,
    };
  }

  if (errorQuery === effectiveQuery) {
    return {
      status: "error",
      data: null,
      check,
    };
  }

  return {
    status: "loading",
    data: lastReadyData,
    check,
  };
}
