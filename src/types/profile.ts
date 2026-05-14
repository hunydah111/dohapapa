// 부부 프로필 입력 타입.
//
// 컴플라이언스 원칙: 이 데이터는 DB에 저장하지 않는다. API 요청 본문으로 받아
// 1회 계산에만 쓰고 폐기한다. (개인정보 최소수집 — 회의 컴플라이언스 패널 권고.)

import type { CommuteMode } from "./recommendation";

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

/**
 * 사용자가 중요도를 매기는 3개 조건.
 * 예산은 입력한 소득·시드머니로 자동 산정되는 '하드 제약'이라 여기에 넣지 않는다
 * (1~5로 평가할 성질의 항목이 아님). 추천 엔진은 예산 적합도를 이 3개의
 * 평균 중요도로 자동 반영한다.
 */
export type PriorityKey = "commute" | "school" | "buildingAge";

export const PRIORITY_LABELS: Record<PriorityKey, string> = {
  commute: "출퇴근 거리",
  school: "아이 학군",
  buildingAge: "단지 연식",
};

/** 중요도 척도 1~5 의 사람이 읽을 라벨. */
export const PRIORITY_SCALE_LABELS: Record<number, string> = {
  1: "별로",
  2: "조금",
  3: "보통",
  4: "중요",
  5: "매우 중요",
};

/** 모든 조건 중요도 기본값 = 3(보통). */
export const DEFAULT_PRIORITIES: Record<PriorityKey, number> = {
  commute: 3,
  school: 3,
  buildingAge: 3,
};

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Workplace {
  /** 회사명 또는 사용자가 입력한 라벨. */
  label: string;
  lat: number;
  lng: number;
}

export interface CoupleProfile {
  /**
   * 3개 조건별 중요도(1~5). 추천 가중치로 정규화되어 쓰인다.
   * 사용자가 하나만 고르는 게 아니라 각 조건에 가중치를 부여한다.
   */
  priorities: Record<PriorityKey, number>;
  /** 선호 평수대 — 대표 평형 필터에 사용. */
  preferredAreaRange: AreaRangeKey;
  /** 통근 수단 — 대중교통 / 자차. 통근 시간 추정 방식 결정. */
  commuteMode: CommuteMode;
  /** 배우자 A 직장 (필수). */
  workplaceA: Workplace;
  /** 배우자 B 직장 (외벌이면 생략). */
  workplaceB?: Workplace;
  /** 자녀 나이 목록. 빈 배열 = 무자녀. */
  childrenAges: number[];
  /** 연 가구소득 (원). 원 값은 JS Number 안전범위 내이므로 number 사용. */
  householdIncomeKrwYear: number;
  /** 보유 현금 시드머니 (원). */
  seedMoneyKrw: number;
  /** 기존 대출 월 상환액 (원). DSR 계산에 반드시 반영. */
  existingLoanMonthlyKrw: number;
  /** 세대 내 주택 보유 이력 — 생애최초/취득세 감면 판정용. */
  hasOwnedHomeBefore: boolean;
  /** 통근 허용 시간 (분). 비대칭 허용 가능. 미입력 시 DEFAULT_MAX_COMMUTE_MIN. */
  maxCommuteMinutesA?: number;
  maxCommuteMinutesB?: number;
}

export const DEFAULT_MAX_COMMUTE_MIN = 50;
