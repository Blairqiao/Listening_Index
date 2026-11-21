import type { RangeKey } from "@/lib/types";
import {
  DEFAULT_SEARCH_FILTER,
  DEFAULT_SEARCH_SORT,
  SEARCH_FILTER_OPTIONS,
  SEARCH_MAX_CHARS,
  SEARCH_SINGLE_TYPE_ROWS,
  SEARCH_SORT_OPTIONS,
  type ProfileTarget,
  type SearchFilter,
  type SearchSort,
} from "@/lib/search-types";

export const RANGE_KEYS: RangeKey[] = ["1d", "1w", "1m", "6m", "1y", "all"];

export type SearchQueryCheck =
  | { ok: true; query: string }
  | { ok: false; reason: "too_long" };

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_REGEX = /[\u0000-\u001f\u007f]/;

export function checkSearchQuery(raw: string): SearchQueryCheck {
  const query = raw.trim();
  const charCount = [...query].length;
  if (charCount > SEARCH_MAX_CHARS) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, query };
}

export function parseSearchFilter(raw: string | null | undefined): SearchFilter {
  return SEARCH_FILTER_OPTIONS.find(({ value }) => value === raw)?.value ?? DEFAULT_SEARCH_FILTER;
}

export function parseSearchSort(raw: string | null | undefined): SearchSort {
  return SEARCH_SORT_OPTIONS.find(({ value }) => value === raw)?.value ?? DEFAULT_SEARCH_SORT;
}

export function parseSearchPage(raw: string | null | undefined): number {
  if (!raw || !/^[1-9][0-9]*$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page * SEARCH_SINGLE_TYPE_ROWS) ? page : 1;
}

export function normalizeForSearch(s: string): string {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function parseRangeKey(v: string | null | undefined): RangeKey | null {
  if (!v) return null;
  return (RANGE_KEYS as readonly string[]).includes(v) ? (v as RangeKey) : null;
}

function extractTargetParam(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string
): string | null {
  if (params instanceof URLSearchParams) {
    return params.get(key);
  }
  const val = params[key];
  if (Array.isArray(val)) {
    return val.length > 0 ? val[0] : null;
  }
  return typeof val === "string" ? val : null;
}

function sanitizeTargetValue(val: string | null): string | null {
  if (val === null) return null;
  const trimmed = val.trim();
  if (trimmed.length < 1 || trimmed.length > 200) {
    return null;
  }
  if (CONTROL_CHAR_REGEX.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function parseProfileTarget(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): ProfileTarget | null {
  const track = sanitizeTargetValue(extractTargetParam(params, "track"));
  if (track !== null) {
    return { kind: "track", key: track };
  }

  const artist = sanitizeTargetValue(extractTargetParam(params, "artist"));
  if (artist !== null) {
    return { kind: "artist", key: artist };
  }

  const album = sanitizeTargetValue(extractTargetParam(params, "album"));
  if (album !== null) {
    return { kind: "album", key: album };
  }

  return null;
}

export function resolveDisplayFilter(
  status: "idle" | "loading" | "ready" | "error",
  requested: SearchFilter,
  dataFilter: SearchFilter | null
): SearchFilter {
  if (status === "loading" && dataFilter !== null) {
    return dataFilter;
  }
  return requested;
}

export function getSearchStatusText(args: {
  status: "idle" | "loading" | "ready" | "error";
  query: string;
  hasResults: boolean;
}): string | null {
  if (args.status === "loading") {
    return null;
  }
  if (args.status === "error") {
    return "SEARCH FAILED";
  }
  if (args.status === "idle") {
    return "QUERY TOO LONG";
  }
  if (args.status === "ready" && !args.hasResults) {
    return args.query.trim() ? "[ NO MATCHES ]" : "[ NO PLAYS IN ARCHIVE ]";
  }
  return null;
}
