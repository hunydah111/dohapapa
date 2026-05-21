// 추천(=조건 기반 필터링) 결과 타입.
//
// 컴플라이언스 주의:
// - "추천"이라는 단어는 UI 노출 문구에서 피하고 "조건에 맞는 단지" 식으로 표현.
// - 예산 추정은 공개된 DSR/LTV 공식만 적용하며 항상 "추정"으로 표시.
// - 특정 은행 상품 연결/비교 금지. 특정 매물 알선 금지 (단지 레벨까지만).

import type { CommuteMode, AreaRangeKey } from "./profile";

export type { CommuteMode };

// ── 정책대출 ─────────────────────────────────────────────────
/**
 * 정책대출(디딤돌·신생아 특례·보금자리론 등) 자격 판정 결과.
 * 컴플라이언스: "자격 가능성 안내"까지만 — 특정 은행 상품 연결 금지.
 */
export interface PolicyLoanMatch {
  /** 상품명 — "신생아 특례 디딤돌", "디딤돌(신혼)", "보금자리론" 등. */
  productName: string;
  /** 자격 충족 여부. */
  eligible: boolean;
  /** 자격 사유 또는 미해당 사유 (한국어). */
  reason: string;
  /** 해당 시 최대 대출 한도 (원). */
  loanLimitKrw?: number;
  /** 해당 시 금리 범위 (연 %). */
  rateMin?: number;
  rateMax?: number;
}

// ── 예산 추정 ───────────────────────────────────────────────
// 모든 원(KRW) 값은 number. (최대 ~100억 = 1e10, JS 안전정수 9e15 내.)
export interface BudgetEstimate {
  seedMoneyKrw: number;
  /** 갈아타기: 기존 집 매도 순수령액 (매도가 − 대출잔금 − 양도세추정). 음수면 음수 그대로. */
  homeSaleNetKrw: number;
  /** 갈아타기: 양도세 추정 (원). 없으면 0. */
  capitalGainsTaxKrw: number;
  /** 가용 자기자본 = seedMoneyKrw + homeSaleNetKrw. */
  totalEquityKrw: number;
  /** 추정 대출 가능액 — 정책대출 적격이면 그 한도, 아니면 일반 DSR·LTV 기준. */
  loanEstimateKrw: number;
  /** loanEstimateKrw 산정에 적용한 대출 종류. */
  appliedLoanType: "policy" | "general";
  /** 정책대출이 적용됐다면 그 상품명. */
  appliedPolicyName?: string;
  /** 정책대출 자격 판정 결과 (적격·미적격 모두 포함, 안내용). */
  policyLoanMatches: PolicyLoanMatch[];
  /** 추정 월 원리금 상환액 (원). */
  monthlyPaymentKrw: number;
  /** totalEquity + loan. */
  grossBudgetKrw: number;
  /** 취득세 + 중개수수료 + 부대비용 (acquisitionCost 모듈로 정밀 산출). */
  acquisitionCostsKrw: number;
  /** 실제 매매가 상한 = grossBudget − acquisitionCosts. */
  netPurchasePowerKrw: number;
  /** 항상 true — 이 값이 추정임을 타입 레벨에서 강제. */
  isEstimate: true;
  /** 사용자에게 보일 계산 가정. */
  assumptions: string[];
  /** 사용자에게 보일 경고 (음수 순수령액·DSR 초과 등 포함). */
  warnings: string[];
  /**
   * 대출 추정액이 어떻게·왜 그 금액으로 산출됐는지 단계별 설명.
   * 정책대출이면 정책명·한도·자격 사유와 DSR/LTV 비교, 일반대출이면 DSR 공식·LTV 상한 등.
   */
  loanReasonLines: string[];
}

// ── 통근 ────────────────────────────────────────────────────
export interface CommuteLeg {
  workplace: "A" | "B";
  /** 직장 라벨 (회사명 등). UI 도식 표시용. */
  workplaceLabel: string;
  /** 직장 위도. 카카오맵 길찾기 deep-link 출발지로 사용. */
  workplaceLat: number;
  /** 직장 경도. 카카오맵 길찾기 deep-link 출발지로 사용. */
  workplaceLng: number;
  /** 편도 통근 시간 (분). */
  minutes: number;
  /** 직장↔단지 직선거리 (km). 추정 시간의 근거. */
  distanceKm: number;
  /** 시간 추정에 쓴 교통수단. */
  mode: CommuteMode;
  /** 이 직장의 허용 통근시간(분) — 클라이언트가 실측 반영 후 withinLimit 재계산에 사용. */
  maxCommuteMinutes: number;
  /** 프로필의 허용 통근시간 이내인지. */
  withinLimit: boolean;
  /**
   * (클라이언트 전용) 대중교통 leg 의 실측 시간이 ODsay 로 채워졌는지.
   * 서버는 설정 안 함(=undefined, mock 직선거리 추정). 결과 화면에서 ODsay 호출 후 true.
   * mode==="transit" 이고 undefined 면 아직 mock 추정값.
   */
  realTransit?: boolean;
}

// ── 단지 후보 ────────────────────────────────────────────────
export type CandidateSignalKey =
  | "commute"
  | "budgetFit"
  | "school"
  | "buildingAge"
  | "largeComplex";

/**
 * 참고용 기본 가중치 (UI 안내·문서용). 실제 추천 가중치는 사용자가 입력한
 * priorities(1~5)를 정규화해 만든다 — recommend 엔진의 buildWeights 참고.
 */
export const CANDIDATE_SIGNAL_WEIGHTS: Record<CandidateSignalKey, number> = {
  commute: 40,
  budgetFit: 30,
  school: 20,
  buildingAge: 10,
  largeComplex: 10,
};

export const CANDIDATE_SIGNAL_LABELS: Record<CandidateSignalKey, string> = {
  commute: "통근",
  budgetFit: "예산 적합도",
  school: "학군·자녀",
  buildingAge: "단지 연식",
  largeComplex: "거래량",
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
  /**
   * 추정 현재가 범위 하단·상단(원). 신축 입주장처럼 같은 평형이 층·향 따라 크게
   * 벌어지는 단지는 단일가 대신 "31~36억" 범위로 정직하게 표시하기 위한 값.
   */
  priceLowKrw?: number;
  priceHighKrw?: number;
  /** 추정 현재가 산출에 쓴 거래 건수 — 가격 신뢰도 지표. */
  transactionCount: number;
  /** 최근 6개월 거래가 적어 12개월까지 넓혀 추정한 경우 true(거래 적음·참고용). */
  lowDataConfidence?: boolean;
  /**
   * 이 평형의 직접 실거래가 없어 인근 단지 환산으로 추정한 가격(등기 지연 신축 등).
   * true 면 UI 에 "추정 시세 · 실거래 미확정" 명시.
   */
  priceEstimated?: boolean;
  /** 추정 근거(예: "인근 3개 단지 시세 환산"). priceEstimated 일 때만. */
  estimateBasis?: string;
  /**
   * 대표 평형의 거래가 대부분 분양권/입주권(등기 전 권리 거래)인 경우 true.
   * 매매와 권리 상태가 달라 "분양권 거래"로 구분 표시.
   */
  priceFromPresale?: boolean;
  /** 단지 준공년도 — UI 에 "○○○○년식" 으로 표시. null = 정보 없음. */
  buildYear: number | null;
  /** 초품아 여부 — 초등학교가 단지에서 직선 150m 이내. */
  isChopumah: boolean;
  /** 같은 동·비슷한 연식 단지보다 ㎡당 단가가 높음 — '동네 인기단지' 배지용. */
  pricierThanPeers?: boolean;
  /** 선호 입지(분위기) 매칭 시 표시할 배지 라벨(예: "🌊 한강변"). 미매칭/미선택이면 없음. */
  vibeBadge?: string;
  commuteLegs: CommuteLeg[];
  scores: Record<CandidateSignalKey, number>;
  reasoning: Record<CandidateSignalKey, string>;
  /** 0~100. */
  totalScore: number;
  tier: CandidateTier;
  /** 왜 이 단지가 뽑혔는지 2~3문장 간략 리포트. */
  report: string;
  /**
   * 다른 두 후보와 비교해 왜 이 순위(=이 티어)에 있는지 한두 문장 설명.
   * 3개 후보가 모두 결정된 후 비교적으로 생성됨.
   */
  rankReason: string;
}

/** 상세 리포트 없이 이름만 보여줄 추가 후보. */
export interface MoreCandidate {
  complexId: string;
  complexName: string;
  sigungu: string;
  dongName: string;
  /** 단지 좌표 — 클라이언트가 대중교통 실측(ODsay) 재정렬 시 도착지로 사용. */
  latitude: number;
  longitude: number;
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
/** 완화 제안을 누르면 자동 적용할 변경 내용 (프론트가 프로필에 머지 후 재검색). */
export type RelaxationAction =
  | { kind: "commute"; workplace: "A" | "B"; addMinutes: number }
  | { kind: "budget"; addKrw: number }
  | { kind: "area"; areaRange: AreaRangeKey };

export interface RelaxationSuggestion {
  /** 사용자에게 보일 제안 문구 (예: "예산을 2억 늘리면 12곳"). */
  message: string;
  /** 이 제안 적용 시 나오는 단지 수. */
  resultCount: number;
  /** 누르면 자동 적용+재검색할 변경. */
  action: RelaxationAction;
}

export interface RecommendationResult {
  budget: BudgetEstimate;
  /** 상세 리포트 대상 — 보통 3개 (안정형·균형형·도전형). */
  candidates: ComplexCandidate[];
  /** 이름만 표시할 추가 후보 (보통 10개). */
  moreCandidates: MoreCandidate[];
  /** 통근 한도(이용자 설정)를 살짝 넘는(~×1.3) 후보 — 별도 섹션. 평소 빈 배열. */
  overLimitCandidates: MoreCandidate[];
  /** candidates 가 비었을 때 채워지는 조건 완화 제안. 평소엔 빈 배열. */
  relaxationSuggestions: RelaxationSuggestion[];
  /** 하드 필터 통과 단지 수. */
  consideredComplexCount: number;
  /** 선호 입지를 골랐지만 결과에 안 잡혔을 때 솔직 안내(가장 가까운 후보 + 지도 버튼용 정보). 평소엔 없음. */
  vibeNote?: {
    message: string;
    complexName: string;
    dongName: string;
  };
  /** 0건일 때, 어떤 추가 조건(하드)이 결과를 좁혔는지 지목하는 안내. 평소엔 없음. */
  emptyReason?: string;
  /** 필수 면책 고지. */
  disclaimer: string;
}

export const DISCLAIMER =
  "본 결과는 국토교통부 공개 실거래가와 사용자가 입력한 정보를 바탕으로 한 " +
  "참고용 정보 제공이며, 부동산 중개·투자자문·대출모집이 아닙니다. " +
  "예산·세금은 공개 공식에 따른 추정치이며 실제 한도·세액은 금융기관·세무 상담 결과에 따릅니다. " +
  "실제 구매 결정 전 반드시 전문가 상담을 권고합니다.";
