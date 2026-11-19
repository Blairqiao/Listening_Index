import type { RangeKey } from "@/lib/types";
import {
  DEFAULT_SEARCH_SORT,
  SEARCH_MAX_CHARS,
  SEARCH_RESULT_LIMIT,
  SEARCH_SORT_OPTIONS,
  type ProfileTarget,
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

export function parseSearchSort(raw: string | null) {
  return SEARCH_SORT_OPTIONS.find(({ value }) => value === raw)?.value ?? DEFAULT_SEARCH_SORT;
}

export function parseSearchPage(raw: string | null): number {
  if (!raw || !/^[1-9][0-9]*$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page * SEARCH_RESULT_LIMIT) ? page : 1;
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
