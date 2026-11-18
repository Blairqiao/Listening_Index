import type { RangeKey } from "@/lib/types";
import {
  SEARCH_MAX_CHARS,
  type ProfileTarget,
} from "@/lib/search-types";

export const RANGE_KEYS: RangeKey[] = ["1d", "1w", "1m", "6m", "1y", "all"];

export type SearchQueryCheck =
  | { ok: true; query: string }
  | { ok: false; reason: "empty" | "too_short" | "too_long" };

const CJK_REGEX = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_REGEX = /[\u0000-\u001f\u007f]/;

export function containsCjk(s: string): boolean {
  return CJK_REGEX.test(s);
}

export function checkSearchQuery(raw: string): SearchQueryCheck {
  const query = raw.trim();
  if (query === "") {
    return { ok: false, reason: "empty" };
  }
  const charCount = [...query].length;
  const minChars = containsCjk(query) ? 1 : 2;
  if (charCount < minChars) {
    return { ok: false, reason: "too_short" };
  }
  if (charCount > SEARCH_MAX_CHARS) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, query };
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

  return null;
}
