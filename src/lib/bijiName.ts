// 트레이딩 카드용 합성 이름 — 자연어 형태 "동네 등급비버".
// 예: "송파 피버", "강남 저스틴비버", "분당 탑비버", "영통 난비버".
// 1자 줄임("송피버")은 인지 안 돼서 자연어로 — 짧은 시군구 라벨 + 등급 풀라벨.
// 컴플라이언스: 박탈감 차단 — isFlex=false(gukmin·baby) 등급은 시군구를 안 붙이고 라벨 그대로.
// 부동산 동네 줄세우기 느낌 X.

import type { BudgetTier } from "./budgetPercentile";

/**
 * 시군구 → 사용자 친화 짧은 라벨.
 * "강남구"→"강남", "송파구"→"송파", "성남시 분당구"→"분당", "수원시 영통구"→"영통",
 * "고양시 일산동구"→"일산", "광명시"→"광명", "미추홀구"→"미추홀".
 *
 * 룰: ①공백 토큰 있으면 마지막 토큰을 base로(자치구·세부 우선) ②"구·시·군" 접미사 제거.
 */
export function sigunguShortLabel(sigungu: string | null | undefined): string {
  if (!sigungu) return "";
  const trimmed = sigungu.trim();
  if (!trimmed) return "";
  const tokens = trimmed.split(/\s+/);
  const base = tokens[tokens.length - 1] ?? trimmed;
  // "구/시/군"만 떼고, "동구·서구·일산동구" 같은 자체 의미 글자는 보존.
  // 단순화: 마지막 1자가 "구/시/군"이고 base 가 2자 이상이면 떼기.
  if (base.length >= 2 && /[구시군]$/.test(base)) {
    const stripped = base.slice(0, -1);
    // "일산동구"→"일산동" → 다시 "동"이면 떼면 "일산"이 되도록 한 번 더(흔한 패턴)
    if (stripped.length >= 2 && /[동서남북중]$/.test(stripped)) {
      // "일산동구"→"일산동"→"일산", "성남시"→"성남"
      // 단, "강남"·"강북" 같은 동서남북 자체 의미는 보존 — 길이 3 이상일 때만 한 번 더 절단
      if (stripped.length >= 3) return stripped.slice(0, -1);
    }
    return stripped;
  }
  return base;
}

/**
 * 동네+등급 합성 이름. isFlex=false면 시군구 안 붙이고 라벨 그대로(박탈감 차단).
 * sigungu가 없거나 키 추출 실패 시 라벨 폴백.
 */
export function composeBijiName(sigungu: string | null | undefined, tier: BudgetTier): string {
  if (!tier.isFlex) return tier.label;
  const short = sigunguShortLabel(sigungu);
  if (!short) return tier.label;
  return `${short} ${tier.label}`;
}
