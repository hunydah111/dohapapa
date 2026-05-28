// 트레이딩 카드용 합성 이름 — 자연어 형태 "동네 등급비버".
// 예: "강남구 퀸비버", "송파구 비  버", "분당구 저스틴비버", "광명시 비버", "구로구 아기비버".
// 1자 줄임은 인지 안 돼서 자연어로 — 짧은 시군구 라벨 + 등급 풀라벨.
//
// 2026-05-28: 모든 등급에 시군구 prefix 적용 (사용자 요청: 일관성). 박탈감 차단은
// isFlex 플래그를 "상위 N% 숫자 표시"에만 한정 (HeroResultCard.tsx). 시군구는
// 동네 정체성·소속감이지 줄세우기가 아니므로 박탈감 룰 영향 X.

import type { BudgetTier } from "./budgetPercentile";

/**
 * 시군구 → 사용자 친화 짧은 라벨.
 * "강남구"→"강남구", "송파구"→"송파구", "성남시 분당구"→"분당구",
 * "수원시 영통구"→"영통구", "고양시 일산동구"→"일산동구", "광명시"→"광명시".
 *
 * 룰: 공백 토큰 있으면 마지막 토큰(자치구·세부)을 그대로. "구·시·군" 접미사는 보존
 * (사용자 의도: "구로 피버" 어색 → "구로구 피버" 정자연).
 */
export function sigunguShortLabel(sigungu: string | null | undefined): string {
  if (!sigungu) return "";
  const trimmed = sigungu.trim();
  if (!trimmed) return "";
  const tokens = trimmed.split(/\s+/);
  return tokens[tokens.length - 1] ?? trimmed;
}

/**
 * 동네+등급 합성 이름 "시군구 등급". 모든 등급에 적용.
 * sigungu가 없거나 키 추출 실패 시 라벨 폴백.
 */
export function composeBijiName(sigungu: string | null | undefined, tier: BudgetTier): string {
  const short = sigunguShortLabel(sigungu);
  if (!short) return tier.label;
  return `${short} ${tier.label}`;
}
