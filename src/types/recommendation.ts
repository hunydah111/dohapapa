// 추천(=조건 기반 필터링) 결과 타입.
//
// 컴플라이언스 주의:
// - "추천"이라는 단어는 UI 노출 문구에서 피하고 "조건에 맞는 단지" 식으로 표현.
// - 예산 추정은 공개된 DSR/LTV 공식만 적용하며 항상 "추정"으로 표시.
// - 특정 은행 상품 연결/비교 금지. 특정 매물 알선 금지 (단지 레벨까지만).

import type { CommuteMode } from "./profile";

export type { CommuteMode };

// ── 예산 추정 ───────────────────────────────────────────────
// 모든 원(KRW) 값은 number. (최대 ~100억 = 1e10, JS 안전정수 9e15 내.)
export interface BudgetEstimate {
  seedMoneyKrw: number;
  /** 갈아타기: 기존 집 매도 순수령액 (매도가 − 대출잔금 − 양도세추정). 없으면 0. */
  homeSaleNetKrw: number;
  /** 갈아타기: 양도세 추정 (원). 없으면 0. */
  capitalGainsTaxKrw: number;
  /** 가용 자기자본 = seedMoneyKrw + homeSaleNetKrw. */
  totalEquityKrw: number;
  /** DSR·LTV 공개공식 기반 추정 대출 가능액. */
  loanEstimateKrw: number;
  /** 추정 월 원리금 상환액 (원). */
  monthlyPaymentKrw: number;
  /** totalEquity + loan. */
  grossBudgetKrw: number;
  /** 취득세 + 중개수수료 + 부대비용. */
  acquisitionCostsKrw: number;
  /** 실제 매매가 상한 = grossBudget − acquisitionCosts. */
  netPurchasePowerKrw: number;
  /** 항상 true — 이 값이 추정임을 타입 레벨에서 강제. */
  isEstimate: true;
  /** 사용자에게 보일 계산 가정 (예: "스트레스 DSR +3%p 반영"). */
  assumptions: string[];
  /** 사용자에게 보일 경고. */
  warnings: string[];
}

// ── 통근 ────────────────────────────────────────────────────
export interface CommuteLeg {
  workplace: "A" | "B";
  /** 직장 라벨 (회사명 등). UI 도식 표시용. */
  workplaceLabel: string;
  /** 편도 통근 시간 (분). */
  minutes: number;
  /** 직장↔단지 직선거리 (km). 추정 시간의 근거. */
  distanceKm: number;
  /** 시간 추정에 쓴 교통수단. */
  mode: CommuteMode;
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
  /**
   * 대표 평형 추정 현재가 (원). 최근 6개월 실거래에 최근 거래 가중 + 추세 보정.
   * 단순 중위가가 아니라 "지금 거래될 가격"의 추정치 — 부동산 전문가 패널 권고.
   */
  medianPriceKrw: number;
  /** 추정 현재가 산출에 쓴 최근 6개월 거래 건수 — 가격 신뢰도 지표. */
  transactionCount: number;
  /** 초품아 여부 — 초등학교가 단지에서 직선 150m 이내. */
  isChopumah: boolean;
  commuteLegs: CommuteLeg[];
  scores: Record<CandidateSignalKey, number>;
  reasoning: Record<CandidateSignalKey, string>;
  /** 0~100. */
  totalScore: number;
  tier: CandidateTier;
  /** 카드에 표시할 한 줄 요약. */
  oneLineReason: string;
  /** 왜 이 단지가 뽑혔는지 2~3문장 간략 리포트. */
  report: string;
}

/** 상세 리포트 없이 이름만 보여줄 추가 후보. */
export interface MoreCandidate {
  complexId: string;
  complexName: string;
  sigungu: string;
  dongName: string;
  representativeArea: number;
  medianPriceKrw: number;
  totalScore: number;
  /** 통근 한 줄 요약 (예: "본인 28분·배우자 35분"). */
  commuteSummary: string;
}

/**
 * 결과가 0건일 때, 어떤 조건을 어떻게 풀면 몇 곳이 나오는지 제안.
 * (P0 — 0건 막다른 길 해소.)
 */
export interface RelaxationSuggestion {
  /** 사용자에게 보일 제안 문구 (예: "예산을 2억 늘리면 12곳"). */
  message: string;
  /** 이 제안 적용 시 나오는 단지 수. */
  resultCount: number;
}

export interface RecommendationResult {
  budget: BudgetEstimate;
  /** 상세 리포트 대상 — 보통 3개 (안정형·균형형·도전형). */
  candidates: ComplexCandidate[];
  /** 이름만 표시할 추가 후보 (보통 10개). */
  moreCandidates: MoreCandidate[];
  /** candidates 가 비었을 때 채워지는 조건 완화 제안. 평소엔 빈 배열. */
  relaxationSuggestions: RelaxationSuggestion[];
  /** 하드 필터 통과 단지 수. */
  consideredComplexCount: number;
  /** 필수 면책 고지. */
  disclaimer: string;
}

export const DISCLAIMER =
  "본 결과는 국토교통부 공개 실거래가와 사용자가 입력한 정보를 바탕으로 한 " +
  "참고용 정보 제공이며, 부동산 중개·투자자문·대출모집이 아닙니다. " +
  "예산·세금은 공개 공식에 따른 추정치이며 실제 한도·세액은 금융기관·세무 상담 결과에 따릅니다. " +
  "실제 구매 결정 전 반드시 전문가 상담을 권고합니다.";
