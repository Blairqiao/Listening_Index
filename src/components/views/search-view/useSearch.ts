import { useState, useEffect } from "react";
import {
  DEFAULT_SEARCH_FILTER,
  DEFAULT_SEARCH_SORT,
  type SearchFilter,
  type SearchResponse,
  type SearchSort,
} from "@/lib/search-types";
import { checkSearchQuery, type SearchQueryCheck } from "@/lib/search-utils";

export type SearchStatus = "idle" | "loading" | "ready" | "error";

const SEARCH_CACHE_MAX = 50;
const searchCache = new Map<string, SearchResponse>();
const searchInFlight = new Map<string, Promise<SearchResponse>>();
let cacheGeneration = 0;

export function clearSearchCache(): void {
  searchCache.clear();
  searchInFlight.clear();
  cacheGeneration++;
}

function searchRequestUrl(query: string, sort: SearchSort, page: number, filter: SearchFilter): string | null {
  const check = checkSearchQuery(query);
  return check.ok
    ? "/api/listening/search?" +
      new URLSearchParams({ q: check.query, sort, page: String(page), type: filter })
    : null;
}

/** Warms the Search tab before it opens. `useSearch` waits on a request this starts instead of repeating it. */
export function prefetchSearch(
  query: string,
  sort: SearchSort = DEFAULT_SEARCH_SORT,
  page = 1,
  filter: SearchFilter = DEFAULT_SEARCH_FILTER,
): void {
  const url = searchRequestUrl(query, sort, page, filter);
  if (!url || searchCache.has(url) || searchInFlight.has(url)) return;
  const generation = cacheGeneration;
  const request = fetch(url, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<SearchResponse>;
    })
    .then((json) => {
      if (generation === cacheGeneration) setInCache(url, json);
      return json;
    })
    .finally(() => {
      if (searchInFlight.get(url) === request) searchInFlight.delete(url);
    });
  searchInFlight.set(url, request);
  request.catch(() => {});
}

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

export function useSearch(
  query: string,
  sort: SearchSort = DEFAULT_SEARCH_SORT,
  page = 1,
  filter: SearchFilter = DEFAULT_SEARCH_FILTER,
): {
  status: SearchStatus;
  data: SearchResponse | null;
  dataFilter: SearchFilter | null;
  check: SearchQueryCheck;
} {
  const check = checkSearchQuery(query);
  const requestUrl = searchRequestUrl(query, sort, page, filter);

  const [lastReady, setLastReady] = useState<{
    data: SearchResponse | null;
    filter: SearchFilter | null;
  }>({
    data: null,
    filter: null,
  });
  const [errorUrl, setErrorUrl] = useState<string | null>(null);
  const [errorGeneration, setErrorGeneration] = useState<number>(cacheGeneration);
  const [previousRequestUrl, setPreviousRequestUrl] = useState<string | null>(requestUrl);

  // Transition adjustment during render when effective query or invalid state changes
  if (requestUrl !== previousRequestUrl) {
    setPreviousRequestUrl(requestUrl);
    setErrorUrl(null);
    if (requestUrl === null) {
      setLastReady({ data: null, filter: null });
    }
  }

  const cachedHit = requestUrl ? searchCache.get(requestUrl) ?? null : null;

  if (cachedHit && (lastReady.data !== cachedHit || lastReady.filter !== filter)) {
    setLastReady({ data: cachedHit, filter });
  }

  const delay = check.ok && check.query === "" ? 0 : 250;
  const currentGeneration = cacheGeneration;

  useEffect(() => {
    if (!requestUrl) {
      return;
    }

    if (searchCache.has(requestUrl)) {
      return;
    }

    const prefetch = searchInFlight.get(requestUrl);
    if (prefetch) {
      let cancelled = false;
      prefetch.then(
        (json) => {
          if (cancelled || currentGeneration !== cacheGeneration) return;
          setLastReady({ data: json, filter });
          setErrorUrl(null);
        },
        () => {
          if (cancelled || currentGeneration !== cacheGeneration) return;
          setErrorUrl(requestUrl);
          setErrorGeneration(currentGeneration);
        },
      );
      return () => {
        cancelled = true;
      };
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
          if (!controller.signal.aborted && currentGeneration === cacheGeneration) {
            setErrorUrl(requestUrl);
            setErrorGeneration(currentGeneration);
          }
          return;
        }

        const json: SearchResponse = await res.json();
        if (controller.signal.aborted || currentGeneration !== cacheGeneration) {
          return;
        }

        setInCache(requestUrl, json);
        setLastReady({ data: json, filter });
        setErrorUrl(null);
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError" || controller.signal.aborted || currentGeneration !== cacheGeneration) {
          return;
        }
        setErrorUrl(requestUrl);
        setErrorGeneration(currentGeneration);
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestUrl, delay, currentGeneration, filter]);

  if (!check.ok) {
    return {
      status: "idle",
      data: null,
      dataFilter: null,
      check,
    };
  }

  if (cachedHit) {
    return {
      status: "ready",
      data: cachedHit,
      dataFilter: filter,
      check,
    };
  }

  if (errorUrl === requestUrl && errorGeneration === cacheGeneration) {
    return {
      status: "error",
      data: null,
      dataFilter: null,
      check,
    };
  }

  return {
    status: "loading",
    data: lastReady.data,
    dataFilter: lastReady.data ? lastReady.filter : null,
    check,
  };
}
