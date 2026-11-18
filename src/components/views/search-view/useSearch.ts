import { useState, useEffect } from "react";
import { DEFAULT_SEARCH_SORT, type SearchResponse, type SearchSort } from "@/lib/search-types";
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

export function useSearch(query: string, sort: SearchSort = DEFAULT_SEARCH_SORT, page = 1): {
  status: SearchStatus;
  data: SearchResponse | null;
  check: SearchQueryCheck;
} {
  const check = checkSearchQuery(query);
  const requestUrl = check.ok
    ? "/api/listening/search?" + new URLSearchParams({ q: check.query, sort, page: String(page) })
    : null;

  const [lastReadyData, setLastReadyData] = useState<SearchResponse | null>(null);
  const [errorUrl, setErrorUrl] = useState<string | null>(null);
  const [previousRequestUrl, setPreviousRequestUrl] = useState<string | null>(requestUrl);

  // Transition adjustment during render when effective query or invalid state changes
  if (requestUrl !== previousRequestUrl) {
    setPreviousRequestUrl(requestUrl);
    setErrorUrl(null);
    if (requestUrl === null || (check.ok && check.query === "")) {
      setLastReadyData(null);
    }
  }

  const cachedHit = requestUrl ? searchCache.get(requestUrl) ?? null : null;

  if (cachedHit && lastReadyData !== cachedHit) {
    setLastReadyData(cachedHit);
  }

  const delay = check.ok && check.query === "" ? 0 : 250;

  useEffect(() => {
    if (!requestUrl) {
      return;
    }

    if (searchCache.has(requestUrl)) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          requestUrl,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!res.ok) {
          if (!controller.signal.aborted) {
            setErrorUrl(requestUrl);
          }
          return;
        }

        const json: SearchResponse = await res.json();
        if (controller.signal.aborted) {
          return;
        }

        setInCache(requestUrl, json);
        setLastReadyData(json);
        setErrorUrl(null);
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError" || controller.signal.aborted) {
          return;
        }
        setErrorUrl(requestUrl);
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestUrl, delay]);

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

  if (errorUrl === requestUrl) {
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
