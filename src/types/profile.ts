// 사용자(가구) 프로필 입력 타입.
//
// 컴플라이언스 원칙: 이 데이터는 DB에 저장하지 않는다. API 요청 본문으로 받아
// 1회 계산에만 쓰고 폐기한다.
//
// 참고: 타입명 CoupleProfile 은 레거시 — 제품은 1인·은퇴 가구까지 다룬다.

export type CommuteMode = "transit" | "car";

/** 가구 유형 — 입력 흐름과 추천 처리를 분기한다. */
export type HouseholdType =
  | "single" // 1인 (미혼·단독)
  | "dualIncome" // 맞벌이 부부
  | "singleIncome" // 외벌이 부부
  | "retired"; // 은퇴·통근 무관

export const HOUSEHOLD_TYPE_LABELS: Record<HouseholdType, string> = {
  single: "1인 가구",
  dualIncome: "맞벌이 부부",
  singleIncome: "외벌이 부부",
  retired: "은퇴·통근 무관",
};

// ── 우선순위 ─────────────────────────────────────────────────
export type PriorityKey = "commute" | "school" | "buildingAge";

export const PRIORITY_LABELS: Record<PriorityKey, string> = {
  commute: "출퇴근 거리",
  school: "아이 학군",
  buildingAge: "단지 연식",
};

export const PRIORITY_SCALE_LABELS: Record<number, string> = {
  1: "별로",
  2: "조금",
  3: "보통",
  4: "중요",
  5: "매우 중요",
};

export const DEFAULT_PRIORITIES: Record<PriorityKey, number> = {
  commute: 3,
  school: 3,
  buildingAge: 3,
};

// ── 선호 평수 ────────────────────────────────────────────────
// 사용자가 말하는 "평수"는 보통 공급 평형(예: 84㎡ = "34평")이고, 데이터는
// 전용면적이다. 각 평수대를 흔히 통용되는 전용㎡ 구간으로 매핑한다.
export type AreaRangeKey =
  | "under18"
  | "p19_25"
  | "p26_31"
  | "p32_35"
  | "p36_40"
  | "p41_45"
  | "over45";

export interface AreaRange {
  label: string;
  /** 전용면적 하한 (㎡, 이상). */
  minM2: number;
  /** 전용면적 상한 (㎡, 미만). null = 무제한. */
  maxM2: number | null;
}

export const AREA_RANGES: Record<AreaRangeKey, AreaRange> = {
  under18: { label: "18평 이하", minM2: 0, maxM2: 46 },
  p19_25: { label: "19~25평", minM2: 46, maxM2: 62 },
  p26_31: { label: "26~31평", minM2: 62, maxM2: 78 },
  p32_35: { label: "32~35평", minM2: 78, maxM2: 89 },
  p36_40: { label: "36~40평", minM2: 89, maxM2: 102 },
  p41_45: { label: "41~45평", minM2: 102, maxM2: 115 },
  over45: { label: "45평 이상", minM2: 115, maxM2: null },
};

export const AREA_RANGE_ORDER: AreaRangeKey[] = [
  "under18",
  "p19_25",
  "p26_31",
  "p32_35",
  "p36_40",
  "p41_45",
  "over45",
];

export const DEFAULT_AREA_RANGE: AreaRangeKey = "p32_35";
export const DEFAULT_COMMUTE_MODE: CommuteMode = "transit";
export const DEFAULT_MAX_COMMUTE_MIN = 50;

// ── 직장 / 위치 ──────────────────────────────────────────────
export interface LatLng {
  lat: number;
  lng: number;
}

export interface Workplace {
  /** 회사명 또는 사용자가 입력한 라벨. */
  label: string;
  lat: number;
  lng: number;
  /** 이 직장으로의 통근 수단 (직장별로 다를 수 있음 — 맞벌이 자차/지하철 혼용). */
  commuteMode: CommuteMode;
  /** 이 직장 통근 허용 시간 (분). */
  maxCommuteMinutes: number;
}

// ── 갈아타기 — 기존 주택 매도 ────────────────────────────────
export interface ExistingHome {
  /** 예상 매도가 (원). */
  expectedSalePriceKrw: number;
  /** 남은 주택담보대출 잔금 (원). */
  remainingLoanKrw: number;
  /** 1세대 1주택 양도세 비과세 요건 충족 (2년 이상 보유+거주). */
  qualifiesForTaxExemption: boolean;
}

// ── 가구 프로필 ──────────────────────────────────────────────
export interface CoupleProfile {
  /** 가구 유형 — 폼 흐름·통근 처리 분기. */
  householdType: HouseholdType;
  /** 3개 조건별 중요도(1~5). 추천 가중치로 정규화되어 쓰인다. */
  priorities: Record<PriorityKey, number>;
  /** 선호 평수대 — 대표 평형 필터. */
  preferredAreaRange: AreaRangeKey;
  /** 본인 직장. 은퇴·무직(retired)이면 생략. */
  workplaceA?: Workplace;
  /** 배우자 직장. 맞벌이(dualIncome)일 때만. */
  workplaceB?: Workplace;
  /**
   * 초·중·고 자녀 있음 — 학군 점수에 반영(통학 거리 부담 감점 등).
   * 데이터로는 초등학교 거리만 알기 때문에 정확한 자녀 나이는 의미가 없어
   * boolean 으로 단순화. 영유아는 별도 필드.
   */
  hasSchoolAgedChild: boolean;
  /** 영유아(만 1세 이하) 있음 — 신생아 특례 디딤돌 자격 판정용. */
  hasInfant: boolean;
  /** 자녀 2명 이상 — 디딤돌(일반) 소득 기준 완화 판정용. */
  hasTwoOrMoreChildren: boolean;
  /** 연 가구소득 (원). 부부면 합산. */
  householdIncomeKrwYear: number;
  /** 보유 현금 (원). */
  seedMoneyKrw: number;
  /** 순자산 총액 (원). 금융자산+부동산−부채 개략값 — 정책대출 자산요건 판정용. */
  netAssetsKrw: number;
  /** 기존 대출 월 상환액 합계 (원). 주담대·신용대출·할부 등 전부. DSR 계산에 반영. */
  existingLoanMonthlyKrw: number;
  /** 세대 내 주택 보유 이력 — 생애최초 취득세 감면·정책대출 판정용. */
  hasOwnedHomeBefore: boolean;
  /** 혼인 7년 이내 신혼 여부 — 정책대출 신혼 요건 판정용. 1인·은퇴는 false. */
  isNewlywed: boolean;
  /** 갈아타기 — 기존 집을 팔아 자금을 마련하는 경우. 없으면 undefined. */
  existingHome?: ExistingHome;
}
