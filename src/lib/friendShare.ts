// 친구와 비교 — 결과 페이지에서 자기 비지 정체성(tier slug + sigungu)만 URL 파라미터로
// 친구한테 보내고, 친구가 그 URL을 열면 LandingHero·결과 페이지에 친구 비지가 노출됨.
//
// 컴플라이언스: 친구의 프로필(소득·자산·직장 등)은 전혀 전달 안 함. 등급 + 동네만.
// 이건 이미 OG 공유카드(/s/b/{grade}/{region})에 노출되는 정보 수준과 동일.

import { BEAVER_TIERS, getTierBySlug } from "./budgetPercentile";
import type { BudgetTier } from "./budgetPercentile";

export const FRIEND_PARAM = "f";

export interface FriendTag {
  tier: BudgetTier;
  sigungu: string;
}

/** 자기 결과를 친구 공유용 짧은 string으로 인코딩. "{slug}.{시군구}" 형태. */
export function encodeFriend(tier: BudgetTier, sigungu: string): string {
  return `${tier.slug}.${encodeURIComponent(sigungu)}`;
}

/** URL 파라미터 값을 FriendTag으로 디코드. 잘못된 형식이면 null. */
export function decodeFriend(raw: string | null | undefined): FriendTag | null {
  if (!raw) return null;
  const dotIdx = raw.indexOf(".");
  if (dotIdx <= 0 || dotIdx === raw.length - 1) return null;
  const slug = raw.slice(0, dotIdx);
  const sigunguRaw = raw.slice(dotIdx + 1);
  const tier = getTierBySlug(slug);
  if (!tier) return null;
  let sigungu: string;
  try {
    sigungu = decodeURIComponent(sigunguRaw);
  } catch {
    return null;
  }
  if (!sigungu || sigungu.length > 20) return null;
  return { tier, sigungu };
}

/** 친구 공유용 전체 URL 생성. siteUrl 끝에 / 없어야 함. */
export function buildFriendUrl(siteUrl: string, tier: BudgetTier, sigungu: string): string {
  return `${siteUrl}/?${FRIEND_PARAM}=${encodeFriend(tier, sigungu)}`;
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
