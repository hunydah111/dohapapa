// 트레이딩 카드용 합성 이름 — 시군구 + 등급 닉네임.
// 예: 광명시 + fever → "광피버", 강남구 + justin → "강저스", 수원시 영통구 + top → "영탑비".
// 컴플라이언스: 박탈감 차단 — isFlex=false(gukmin·baby) 등급은 시군구를 안 붙이고 라벨 그대로.
// 부동산 동네 줄세우기 느낌 X.

import type { BeaverTierSlug, BudgetTier } from "./budgetPercentile";

const TIER_NICKNAME: Record<BeaverTierSlug, string> = {
  justin: "저스",
  fever: "피버",
  top: "탑비",
  nan: "난비",
  gukmin: "비버",
  baby: "아기",
};

/**
 * 시군구 키 글자 — "광명시"→"광", "성남시 분당구"→"분"(자치구 우선),
 * "수원시 영통구"→"영", "강남구"→"강".
 * 공백 분리 토큰의 **마지막 토큰** 첫 자(자치구·세부 행정구를 우선).
 */
export function sigunguShortKey(sigungu: string | null | undefined): string {
  if (!sigungu) return "";
  const trimmed = sigungu.trim();
  if (!trimmed) return "";
  const tokens = trimmed.split(/\s+/);
  const tail = tokens[tokens.length - 1] ?? "";
  return tail.charAt(0) || trimmed.charAt(0);
}

/**
 * 동네+등급 합성 이름. isFlex=false면 시군구 안 붙이고 라벨 그대로(박탈감 차단).
 * sigungu가 없거나 키 추출 실패 시도 라벨 폴백.
 */
export function composeBijiName(sigungu: string | null | undefined, tier: BudgetTier): string {
  if (!tier.isFlex) return tier.label;
  const key = sigunguShortKey(sigungu);
  if (!key) return tier.label;
  return `${key}${TIER_NICKNAME[tier.slug]}`;
}
