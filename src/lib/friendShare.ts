// 친구 공유 — 결과 페이지에서 자기 판정(tier slug + sigungu + D-day)만 URL 파라미터로
// 던지고, 친구가 그 URL을 열면 LandingHero·결과 페이지·OG에 친구 판정이 노출됨.
//
// 2026-06-12 한 방 4단계: "{slug}.{시군구}" → "{slug}.{시군구}.{dday}" 3필드 확장.
//  - dday 세그먼트: "now"(지금 가능) | "far"(아득/미도달) | 숫자(일수). 없으면 레거시(비표시).
//  - 프레임은 자조 초대("나 까였다, 너도 까봐") — 1:1 대결 강요 아님 (박탈감 기각 평결).
//
// 컴플라이언스: 친구의 프로필(소득·자산·직장 등)은 전혀 전달 안 함. 등급+동네+D-day 일수만.

import { BEAVER_TIERS, getTierBySlug } from "./budgetPercentile";
import type { BudgetTier } from "./budgetPercentile";
import type { DdayResult } from "./plan/dday";

export const FRIEND_PARAM = "f";

export interface FriendDday {
  kind: "now" | "far" | "days";
  /** kind === "days"일 때만. */
  days?: number;
}

export interface FriendTag {
  tier: BudgetTier;
  sigungu: string;
  /** 3필드 링크에만 존재. 레거시 2필드 링크는 undefined. */
  dday?: FriendDday;
}

/** DdayResult → URL 세그먼트. null이면 세그먼트 생략(레거시 형태 유지). */
function ddaySegment(dday: DdayResult | null | undefined): string | null {
  if (!dday) return null;
  if (dday.months === 0) return "now";
  if (dday.capped || dday.days === null) return "far";
  return String(dday.days);
}

/** 자기 결과를 친구 공유용 짧은 string으로 인코딩. "{slug}.{시군구}[.{dday}]" */
export function encodeFriend(
  tier: BudgetTier,
  sigungu: string,
  dday?: DdayResult | null,
): string {
  const base = `${tier.slug}.${encodeURIComponent(sigungu)}`;
  const seg = ddaySegment(dday);
  return seg ? `${base}.${seg}` : base;
}

/** URL 파라미터 값을 FriendTag으로 디코드. 잘못된 형식이면 null. 레거시 2필드 호환. */
export function decodeFriend(raw: string | null | undefined): FriendTag | null {
  if (!raw) return null;
  const dotIdx = raw.indexOf(".");
  if (dotIdx <= 0 || dotIdx === raw.length - 1) return null;
  const slug = raw.slice(0, dotIdx);
  let rest = raw.slice(dotIdx + 1);
  const tier = getTierBySlug(slug);
  if (!tier) return null;

  // 3번째 세그먼트(dday) — 마지막 점 뒤가 now|far|숫자일 때만 분리.
  // 시군구 자체엔 점이 없으므로(인코딩됨) 안전하지만, 보수적으로 패턴 검증.
  let dday: FriendDday | undefined;
  const lastDot = rest.lastIndexOf(".");
  if (lastDot > 0 && lastDot < rest.length - 1) {
    const seg = rest.slice(lastDot + 1);
    if (seg === "now") dday = { kind: "now" };
    else if (seg === "far") dday = { kind: "far" };
    else if (/^\d{1,5}$/.test(seg)) dday = { kind: "days", days: Number(seg) };
    if (dday) rest = rest.slice(0, lastDot);
  }

  let sigungu: string;
  try {
    sigungu = decodeURIComponent(rest);
  } catch {
    return null;
  }
  if (!sigungu || sigungu.length > 20) return null;
  return { tier, sigungu, dday };
}

/** 친구 D-day 표시 문자열 — "D-5,114" | "지금 입성 가능" | "D-아득". 없으면 null. */
export function friendDdayLabel(tag: FriendTag | null | undefined): string | null {
  const d = tag?.dday;
  if (!d) return null;
  if (d.kind === "now") return "지금 입성 가능";
  if (d.kind === "far") return "D-아득";
  return `D-${(d.days ?? 0).toLocaleString()}`;
}

/** 친구 공유용 전체 URL 생성. siteUrl 끝에 / 없어야 함. */
export function buildFriendUrl(
  siteUrl: string,
  tier: BudgetTier,
  sigungu: string,
  dday?: DdayResult | null,
): string {
  return `${siteUrl}/?${FRIEND_PARAM}=${encodeFriend(tier, sigungu, dday)}`;
}

/** 현재 URL에서 친구 태그 읽기 (브라우저 only). */
export function readFriendFromLocation(): FriendTag | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return decodeFriend(params.get(FRIEND_PARAM));
}

// 디코드 검증 — BEAVER_TIERS 키 존재 여부 (legacy alias 포함)
export function isValidFriendSlug(slug: string): boolean {
  return getTierBySlug(slug) !== null;
}
// keep BEAVER_TIERS import alive for future extension
export const _BEAVER_TIERS_KEYS = Object.keys(BEAVER_TIERS);
