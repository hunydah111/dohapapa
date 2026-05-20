// 사용자(가구) 프로필 입력 타입.
//
// 컴플라이언스 원칙: 이 데이터는 DB에 저장하지 않는다. API 요청 본문으로 받아
// 1회 계산에만 쓰고 폐기한다.
//
// 참고: 타입명 CoupleProfile 은 레거시 — 제품은 1인·은퇴 가구까지 다룬다.

export type CommuteMode = "car";

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
  school: "초품아 여부",
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
export const DEFAULT_COMMUTE_MODE: CommuteMode = "car";
export const DEFAULT_MAX_COMMUTE_MIN = 50;

// ── 선호 입지(분위기) — 재미용 소프트 가점. 단일 선택, 기본 "상관없음". ──
// 분위기(소프트 가점)는 지역과 안 겹치는 '느낌'만 — 한강변·조용함.
// 강남/홍대/성수는 '동네'라 지역(REGION_PRESETS)으로 이동했다.
export type LocationVibe = "riverside" | "quiet";

export const LOCATION_VIBE_LABELS: Record<LocationVibe, string> = {
  riverside: "한강변",
  quiet: "새소리·나뭇잎소리",
};

export const LOCATION_VIBE_ORDER: LocationVibe[] = ["riverside", "quiet"];

/** 입지 강도 1~3 (조금/꽤/많이). 키별 강도 맵 — 복수선택 가능. */
export type LocationVibes = Partial<Record<LocationVibe, number>>;

export const LOCATION_VIBE_LEVEL_LABELS: Record<number, string> = {
  1: "조금",
  2: "꽤",
  3: "많이",
};

// ── 필수 지역(시군구) 선택지 — complex.sigungu 값과 정확히 일치해야 함 ──
export const SEOUL_GU: string[] = [
  "강남구", "강동구", "강북구", "강서구", "관악구", "광진구", "구로구", "금천구",
  "노원구", "도봉구", "동대문구", "동작구", "마포구", "서대문구", "서초구", "성동구",
  "성북구", "송파구", "양천구", "영등포구", "용산구", "은평구", "종로구", "중구", "중랑구",
];

export const GYEONGGI_SIGUNGU: string[] = [
  "가평군", "고양시 덕양구", "고양시 일산동구", "고양시 일산서구", "과천시", "광명시",
  "광주시", "구리시", "군포시", "김포시", "남양주시", "동두천시", "부천시 소사구",
  "부천시 오정구", "부천시 원미구", "성남시 분당구", "성남시 수정구", "성남시 중원구",
  "수원시 권선구", "수원시 영통구", "수원시 장안구", "수원시 팔달구", "시흥시",
  "안산시 단원구", "안산시 상록구", "안성시", "안양시 동안구", "안양시 만안구", "양주시",
  "양평군", "여주시", "연천군", "오산시", "용인시 기흥구", "용인시 수지구", "용인시 처인구",
  "의왕시", "의정부시", "이천시", "파주시", "평택시", "포천시", "하남시", "화성시 남양구",
  "화성시 동탄구", "화성시 병점구", "화성시 향남구",
];

export const REGION_GROUPS: { label: "서울" | "경기"; regions: string[] }[] = [
  { label: "서울", regions: SEOUL_GU },
  { label: "경기", regions: GYEONGGI_SIGUNGU },
];

// 핫플 빠른 선택 — 누르면 해당 시군구를 필수 지역에 추가(하드). (구 '상권' 취향을 지역으로)
export const REGION_PRESETS: { label: string; regions: string[] }[] = [
  { label: "강남", regions: ["강남구"] },
  { label: "홍대·합정", regions: ["마포구"] },
  { label: "성수", regions: ["성동구"] },
];

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
  /** 선호 입지(분위기) — 재미용 소프트 가점. 키별 강도(1~3)·복수선택. 없으면 영향 없음. */
  locationVibes?: LocationVibes;
  /** 필수 지역(시군구) — 하드 필터. 비었으면 전체. OR 로직. */
  requiredRegions?: string[];
  /** 대단지 선호 — 소프트 가점(거래량 프록시; 세대수 데이터 확보 전 근사). */
  preferLargeComplex?: boolean;
  /** 신축만 — 이 준공년도 이후만(하드). 0/없으면 무제한. */
  minBuildYear?: number;
  /** 초품아만 — 초등학교 150m 이내만(하드). */
  requireChopumah?: boolean;
  /** 본인 직장. 은퇴·무직(retired)이면 생략. */
  workplaceA?: Workplace;
  /** 배우자 직장. 맞벌이(dualIncome)일 때만. */
  workplaceB?: Workplace;
  /**
   * 초등학교 다닐 아이 있음 — 초등학교 통학 거리 점수에 반영.
   * 데이터로 다룰 수 있는 게 초등학교 거리뿐이라(중·고·학원가 데이터 없음)
   * 필드명은 hasSchoolAgedChild 그대로 두되 의미는 "초등학생"으로 한정.
   */
  hasSchoolAgedChild: boolean;
  /**
   * 출산 2년 이내 자녀 있음 — 신생아 특례 디딤돌 자격 판정용.
   * 신생아 특례 디딤돌은 대출 신청일 기준 2년 이내 출산이 원칙이므로
   * UI 라벨은 "만 2세 이하" 로 표시 (이전엔 "만 1세 이하" 였음).
   */
  hasInfant: boolean;
  /** 자녀 2명 이상 — 디딤돌(일반) 소득 기준 완화 판정용. */
  hasTwoOrMoreChildren: boolean;
  /**
   * 자녀 3명 이상 (다자녀) — 안내용 분류. 다자녀 추가 정책(주거·세제) 확인 권고.
   * 현 정책대출 산식엔 미반영 — 디딤돌 일반 완화는 hasTwoOrMoreChildren 으로 처리됨.
   */
  hasThreeOrMoreChildren: boolean;
  /**
   * 임신 중·출산 예정 — 안내용 정보. 출산 후 신생아 특례 디딤돌 재시뮬레이션
   * 권고. 현 정책대출 산식엔 영향 X (출생일 확정 후 적용 가능하므로).
   */
  isExpectingChild: boolean;
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
