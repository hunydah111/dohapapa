// WHY: This module extracts identifiers from Naver Real Estate URLs only — it intentionally does not fetch or scrape Naver for legal reasons.

import { ListingInput } from "@/types/listing";

export interface ParseResult {
  /** Extracted partial input — may be empty if URL only yields ID. */
  partial: Partial<ListingInput>;
  /** Naver-side listing identifier extracted from URL, if any. */
  naverListingId: string | null;
  /** True if the URL is a recognized Naver real-estate URL format. */
  recognized: boolean;
  /** User-facing Korean note about what could/couldn't be parsed. */
  note: string;
}

/**
 * Recognized Naver Real Estate URL patterns:
 *   land.naver.com/article/<articleId>           (legacy)
 *   m.land.naver.com/article/info/<articleId>    (mobile)
 *   new.land.naver.com/articles/<articleId>      (current desktop)
 *   new.land.naver.com/complexes/<complexId>?articleNo=<articleId>  (complex page)
 *
 * All patterns tolerate http/https, trailing slashes, hash fragments,
 * and extra query-string parameters.
 */

/** Matches any Naver land subdomain/host variant. */
const NAVER_LAND_HOST_RE =
  /^https?:\/\/(?:(?:m|new)\.)?land\.naver\.com(?:\/|$)/i;

/**
 * Ordered list of URL extractors.
 * Each entry carries a host guard regex and a path regex with a named
 * capture group `articleId` for the listing identifier.
 */
interface UrlPattern {
  /** Must match the full URL for this pattern to be tried. */
  hostGuard: RegExp;
  /** Applied to the URL's pathname (without query/hash). */
  pathRe: RegExp;
  /** If true, fall back to `articleNo` query param instead of path capture. */
  useQueryParam?: true;
}

const URL_PATTERNS: readonly UrlPattern[] = [
  // legacy: land.naver.com/article/<id>
  {
    hostGuard: /^https?:\/\/land\.naver\.com\//i,
    pathRe: /\/article\/(?<articleId>\d+)/i,
  },
  // mobile: m.land.naver.com/article/info/<id>
  {
    hostGuard: /^https?:\/\/m\.land\.naver\.com\//i,
    pathRe: /\/article\/info\/(?<articleId>\d+)/i,
  },
  // current desktop: new.land.naver.com/articles/<id>
  {
    hostGuard: /^https?:\/\/new\.land\.naver\.com\//i,
    pathRe: /\/articles\/(?<articleId>\d+)/i,
  },
  // complex page: new.land.naver.com/complexes/<complexId>?articleNo=<id>
  {
    hostGuard: /^https?:\/\/new\.land\.naver\.com\//i,
    pathRe: /\/complexes\/\d+/i,
    useQueryParam: true,
  },
];

/** Extract the pathname portion (no query string, no hash) from a raw URL string. */
function extractPathname(raw: string): string {
  try {
    return new URL(raw).pathname;
  } catch {
    // Fallback: strip query and hash manually.
    return raw.replace(/[?#].*$/, "").replace(/^https?:\/\/[^/]+/, "");
  }
}

/** Extract a query-string parameter value from a raw URL string. */
function extractQueryParam(raw: string, param: string): string | null {
  try {
    return new URL(raw).searchParams.get(param);
  } catch {
    const match = raw.match(new RegExp(`[?&]${param}=([^&#]+)`));
    return match ? (match[1] ?? null) : null;
  }
}

export function parseNaverUrl(url: string): ParseResult {
  // Defensive: handle empty strings.
  if (!url.trim()) {
    return {
      partial: {},
      naverListingId: null,
      recognized: false,
      note: "네이버 부동산 URL 형식이 아닙니다",
    };
  }

  // Gate: must be a Naver land domain.
  if (!NAVER_LAND_HOST_RE.test(url)) {
    return {
      partial: {},
      naverListingId: null,
      recognized: false,
      note: "네이버 부동산 URL 형식이 아닙니다",
    };
  }

  // Try each pattern in order.
  const pathname = extractPathname(url);

  for (const pattern of URL_PATTERNS) {
    if (!pattern.hostGuard.test(url)) continue;
    if (!pattern.pathRe.test(pathname)) continue;

    // Host + path matched — URL is recognized.
    let articleId: string | null = null;

    if (pattern.useQueryParam) {
      articleId = extractQueryParam(url, "articleNo");
    } else {
      const match = pathname.match(pattern.pathRe);
      articleId = match?.groups?.["articleId"] ?? null;
    }

    if (!articleId) {
      return {
        partial: {},
        naverListingId: null,
        recognized: true,
        note: "URL은 인식되었지만 매물 ID를 추출하지 못했습니다",
      };
    }

    return {
      partial: { externalUrl: url },
      naverListingId: articleId,
      recognized: true,
      note: "매물 ID는 추출했지만 본문 정보는 사용자가 직접 입력해야 합니다",
    };
  }

  // Host matched the Naver land guard but no path pattern fired.
  return {
    partial: {},
    naverListingId: null,
    recognized: true,
    note: "URL은 인식되었지만 매물 ID를 추출하지 못했습니다",
  };
}
