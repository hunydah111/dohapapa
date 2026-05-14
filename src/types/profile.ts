// 부부 프로필 입력 타입.
//
// 컴플라이언스 원칙: 이 데이터는 DB에 저장하지 않는다. API 요청 본문으로 받아
// 1회 계산에만 쓰고 폐기한다. (개인정보 최소수집 — 회의 컴플라이언스 패널 권고.)

export type Segment = "commute" | "school" | "budget" | "loan";

export const SEGMENT_LABELS: Record<Segment, string> = {
  commute: "출퇴근이 가장 걱정",
  school: "아이 학군이 가장 걱정",
  budget: "예산이 가장 걱정",
  loan: "대출 한도가 가장 걱정",
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
  /** 세그먼트 분기용 — 가장 큰 걱정거리. 추천 가중치를 이쪽으로 기울인다. */
  primaryConcern: Segment;
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
