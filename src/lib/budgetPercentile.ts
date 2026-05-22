// 예산 백분위 — 추정 구매력이 최근 수도권 실거래가 분포에서 어느 위치인지.
// scripts/build-budget-percentile.ts 가 Neon 실데이터로 구워 budgetPercentile.json 으로 둔다.
// 비어 있으면(미생성) null 반환 → UI 에서 자동 숨김. 순수 함수.
//
// 컴플라이언스/소유주 보호: 가격 분포(공개 사실)에 '사용자 예산'을 줄 세울 뿐, 특정
// 단지/동네를 줄 세우지 않는다. 미래가치 예측이 아니라 현재 가격대 도달 범위(추정).

import data from "@/data/budgetPercentile.json";

export interface BudgetPercentileData {
  generatedAt: string;
  /** 분포에 쓰인 거래 수. */
  count: number;
  /** 길이 101 — index p = 하위 p% 지점의 가격(원). 미생성이면 빈 배열. */
  percentiles: number[];
}

const TABLE = data as BudgetPercentileData;

// 표본이 이보다 적으면 신뢰 못 해 숨김.
const MIN_COUNT = 200;

/**
 * 예산이 "상위 X% 가격대까지 닿는지" 반환 (X 작을수록 강함).
 * 예: 반환 38 → 최근 수도권 실거래의 상위 38% 가격대까지 살 수 있는 예산.
 * 데이터 없음/표본 부족/예산 0 이하면 null.
 */
export function budgetTopPercent(budgetKrw: number): number | null {
  const ps = TABLE.percentiles;
  if (ps.length < 101 || TABLE.count < MIN_COUNT || budgetKrw <= 0) return null;

  // budget 이하 거래 비율(affordable %) = budget 보다 큰 마지막 백분위 index.
  let affordPct = 0;
  for (let p = 0; p <= 100; p++) {
    if (ps[p] <= budgetKrw) affordPct = p;
    else break;
  }
  // 상위 X% = 100 - affordable%.
  return 100 - affordPct;
}

// ── 구매력 계급도 ("비버 빌드" 컨셉) ─────────────────────────────────────────
// 상위 X% → 재미있는 등급. 위는 비현실 플렉스로 띄우고, 아래는 '짓는 중'으로 절대 안 깐다.
// 컴플라이언스: '구매력=지을 수 있는 집 규모' 비유일 뿐, 자산가치·미래가치·투자권유 아님.
// isFlex=false(그 이하)면 "상위 N%" 숫자를 숨겨 박탈감을 차단한다.
export interface BudgetTier {
  emoji: string;
  label: string;
  /** 결과 카드용 위트 한 줄. */
  drip: string;
  /** true면 "상위 N%" 노출, false(최하위)면 숫자 숨김. */
  isFlex: boolean;
}

export function budgetTier(topPercent: number): BudgetTier {
  if (topPercent <= 1)
    return { emoji: "🕺", label: "저스틴비버", drip: "비버계 월드스타 — 못 사는 집이 없음", isFlex: true };
  if (topPercent <= 10)
    return { emoji: "🔥", label: "피버", drip: "지금이 부동산 피버타임, 어디든 골라 지음", isFlex: true };
  if (topPercent <= 30)
    return { emoji: "🏆", label: "탑비버", drip: "비버 중의 TOP, 상급지도 넘봄", isFlex: true };
  if (topPercent <= 50)
    return { emoji: "😎", label: "난비버", drip: "난다긴다하는 비버, 알짜만 콕", isFlex: true };
  if (topPercent <= 70)
    return { emoji: "🦫", label: "비버", drip: "단단한 국민 비버, 차곡차곡", isFlex: false };
  return { emoji: "🐣", label: "아기비버", drip: "이제 막 댐 배우는 중 — 비지가 옆에서 응원", isFlex: false };
}
