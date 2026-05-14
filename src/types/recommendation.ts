// 추천(=조건 기반 필터링) 결과 타입.
//
// 컴플라이언스 주의:
// - "추천"이라는 단어는 UI 노출 문구에서 피하고 "조건에 맞는 단지" 식으로 표현.
// - 예산 추정은 공개된 DSR/LTV 공식만 적용하며 항상 "추정"으로 표시.
// - 특정 은행 상품 연결/비교 금지. 특정 매물 알선 금지 (단지 레벨까지만).

// ── 예산 추정 ───────────────────────────────────────────────
// 모든 원(KRW) 값은 number. (최대 ~100억 = 1e10, JS 안전정수 9e15 내.)
export interface BudgetEstimate {
  seedMoneyKrw: number;
  /** DSR·LTV 공개공식 기반 추정 대출 가능액. */
  loanEstimateKrw: number;
  /** seed + loan. */
  grossBudgetKrw: number;
  /** 취득세 + 중개수수료 + 부대비용. */
  acquisitionCostsKrw: number;
  /** 실제 매매가 상한 = grossBudget - acquisitionCosts. */
  netPurchasePowerKrw: number;
  /** 항상 true — 이 값이 추정임을 타입 레벨에서 강제. */
  isEstimate: true;
  /** 사용자에게 보일 계산 가정 (예: "스트레스 DSR +3%p 반영"). */
  assumptions: string[];
  /** 사용자에게 보일 경고 (예: "기존 대출 미입력 시 한도가 과대 추정됨"). */
  warnings: string[];
}

// ── 통근 ────────────────────────────────────────────────────
export type CommuteMode = "transit" | "car";

export interface CommuteLeg {
  workplace: "A" | "B";
  /** 편도 통근 시간 (분). */
  minutes: number;
  /** 프로필의 허용 통근시간 이내인지. */
  withinLimit: boolean;
}

// ── 단지 후보 ────────────────────────────────────────────────
export type CandidateSignalKey =
  | "commute"
  | "budgetFit"
  | "school"
  | "buildingAge";

/**
 * 참고용 기본 가중치 (UI 안내·문서용). 실제 추천 가중치는 사용자가 입력한
 * priorities(1~5)를 정규화해 만든다 — recommend 엔진의 buildWeights 참고.
 */
export const CANDIDATE_SIGNAL_WEIGHTS: Record<CandidateSignalKey, number> = {
  commute: 40,
  budgetFit: 30,
  school: 20,
  buildingAge: 10,
};

export const CANDIDATE_SIGNAL_LABELS: Record<CandidateSignalKey, string> = {
  commute: "통근",
  budgetFit: "예산 적합도",
  school: "학군·자녀",
  buildingAge: "단지 연식",
};

export type CandidateTier = "안정형" | "균형형" | "도전형";

export interface ComplexCandidate {
  complexId: string;
  complexName: string;
  sigungu: string;
  dongName: string;
  latitude: number;
  longitude: number;
  /** 대표 평형 (전용㎡) — 실거래 표본이 가장 두꺼운 평형. */
  representativeArea: number;
  /** 대표 평형 실거래 중위가 (원). */
  medianPriceKrw: number;
  commuteLegs: CommuteLeg[];
  scores: Record<CandidateSignalKey, number>;
  reasoning: Record<CandidateSignalKey, string>;
  /** 0~100. */
  totalScore: number;
  tier: CandidateTier;
  /** 카드에 표시할 한 줄 요약. */
  oneLineReason: string;
}

export interface RecommendationResult {
  budget: BudgetEstimate;
  /** 보통 3개 (안정형·균형형·도전형). */
  candidates: ComplexCandidate[];
  /** 하드 필터 전 검토한 단지 수. */
  consideredComplexCount: number;
  /** 필수 면책 고지. */
  disclaimer: string;
}

export const DISCLAIMER =
  "본 결과는 국토교통부 공개 실거래가와 사용자가 입력한 정보를 바탕으로 한 " +
  "참고용 정보 제공이며, 부동산 중개·투자자문·대출모집이 아닙니다. " +
  "예산은 공개된 DSR/LTV 공식에 따른 추정치이며 실제 대출 한도는 금융기관 심사 결과에 따릅니다. " +
  "실제 구매 결정 전 반드시 전문가 상담을 권고합니다.";
