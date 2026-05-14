// 부부 프로필 입력 타입.
//
// 컴플라이언스 원칙: 이 데이터는 DB에 저장하지 않는다. API 요청 본문으로 받아
// 1회 계산에만 쓰고 폐기한다. (개인정보 최소수집 — 회의 컴플라이언스 패널 권고.)

/** 추천 가중치를 정하는 4개 조건. recommendation.ts 의 CandidateSignalKey 와 동일 리터럴. */
export type PriorityKey = "commute" | "budgetFit" | "school" | "buildingAge";

export const PRIORITY_LABELS: Record<PriorityKey, string> = {
  commute: "출퇴근 거리",
  budgetFit: "예산 적합도",
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
  budgetFit: 3,
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
   * 4개 조건별 중요도(1~5). 추천 가중치로 직접 정규화되어 쓰인다.
   * 사용자가 하나만 고르는 게 아니라 각 조건에 가중치를 부여한다.
   */
  priorities: Record<PriorityKey, number>;
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
