// 비집고 패치노트 v0 — "오늘 처음 확인된 실거래"를 **그 단지 자기 시세(단지×평형 중위가)**와
// 대조해 너프(단지 시세 대비 급등 공개)·버프(급락 공개)로 분류한다.
//
// ⚠️ 기준 선택의 이유(2026-07-04 창간호 1차분 교훈): 시군구 중위가 대비로 재면
// "그 동네에서 원래 비싼/싼 단지"가 매일 상위를 도배한다(구조적 이탈 ≠ 뉴스).
// 신고가성/급락성 "선별"은 단지 자신의 최근 중위가 기준으로 잰다.
//
// ⚠️ 노출 기준(2026-07-06 사장 지시): 중위가는 우리 "추정치"라 화면에 시세로 단정
// 노출하면 위험하다("니가 제일 모르는 게 시세"). 그래서
//   - 중위가(pct)   = 내부 선별 필터 전용 (±7% 문턱·노이즈컷) — 화면 노출 금지
//   - 직전 실거래(pctVsPrev)·1년/두 달 최고가 = 화면에 노출하는 비교 팩트
// 비교는 같은 단지 ±3㎡(중위가 lookup 과 동일 허용오차)의 최근 60일 내 직전 실거래 기준,
// 표기엔 항상 날짜(연도 포함 '26.6.18 포맷) 병기.
//
// ⚠️ 오보 게이트(2026-07-07 사장 적발 — 금강펜테리움 사례): 직전 거래가 이상치면
// pctVsPrev 하나만으로 "40.5% 높게 팔렸다"는 왜곡 헤드라인이 나간다. [강세 거래] 게재와
// 헤드라인 신고가성 rung 은 passesStrongGate(이중 합의 + 상한 컷)를 통과해야 한다.
//
// 정직성 규약:
// - MOLIT는 '신고일'을 주지 않는다. "오늘 공개"는 "오늘 폴링에서 처음 확인"의 뜻이며,
//   UI 카피는 반드시 "오늘 공개된/확인된"으로 쓰고 "실시간"이라 말하지 않는다.
// - 계약일(dealDate)이 PATCH_SCOPE_DAYS보다 오래된 거래는 뒷북이므로 다루지 않는다.
//   (신고 지연 30일 규정상 스코프 밖 지연 신고는 존재하지만, '오늘의 변동' 콘텐츠가 아님)
//
// 순수 함수 — API·파일 접근 없음. 크론(scripts/daily-pulse.ts)과 테스트가 같은 함수를 쓴다.

import { bandOfArea } from "@/lib/plan/dday";
import { SEOUL_SIGUNGU } from "@/lib/molit";

/** MolitDeal의 직렬화 가능 서브셋 (bigint → number 변환은 호출부 책임). */
export interface PatchDealInput {
  apartmentName: string;
  /** 계약일 YYYY-MM-DD */
  dealDateISO: string;
  priceKrw: number;
  /** 전용면적 ㎡ */
  area: number;
  sigunguName: string;
  dongName: string;
  floor: number | null;
  /** 거래유형 — "직거래"는 증여성 의심으로 너프/버프 분류에서 제외(스코프·seen엔 포함). */
  dealingGbn?: string;
  /** 해제된 거래 — 스코프에서 아예 제외(유효 거래 아님). */
  canceled?: boolean;
  /** 건축년도 — 신축 첫 실거래 헤드라인 판정용. MOLIT 미제공 시 null. */
  buildYear?: number | null;
  /** 직전 실거래(60일 내·같은 단지 ±3㎡) 대비 % — computePatch가 freshDeals 요약에
   *  동봉(2026-07-08). 입력으로 들어올 땐 무시. dailyRecent 롤링을 타고 동네판
   *  [직전 대비 평균]의 재료가 된다 — 3일 풀 안에서 직전을 다시 찾는 결함(전 동네
   *  0건 사태, 사장 제보) 수리. */
  pctVsPrev?: number | null;
}

export interface ComplexMedianCell {
  medianKrw: number;
  sampleCount: number;
  /** 최근 1년 실거래 최고가(원) — 주간 스냅샷(complexSnapshot)의 maxKrw.
   *  구 스냅샷(다음 주간 갱신 전)엔 없으므로 optional — 없으면 최고가 갱신 판정 생략. */
  maxKrw?: number | null;
  /** 최근 1년 최고가의 계약일 YYYY-MM-DD — "1년 내 최고가 갱신 (종전 … · 날짜 · 층)" 표기용.
   *  스냅샷이 maxDate 를 굽기 전(구 스냅샷)엔 없음 — 없으면 날짜 병기 생략. */
  maxDate?: string | null;
  /** 최근 1년 최고가 거래의 층 — 위와 동일하게 optional(구 스냅샷 호환). */
  maxFloor?: number | null;
  /** 단지 좌표(스냅샷 latitude/longitude) — 행 미니맵·카카오맵 링크용. 미등재면 null. */
  lat?: number | null;
  lng?: number | null;
  /** 최근접 지하철역 거리(m) — complexSnapshot의 nearestSubwayM. 미등재면 null. */
  nearestSubwayM?: number | null;
}

/** 거래 → 그 단지×평형의 자기 중위가. 단지를 못 찾으면 null(해당 거래는 스킵). */
export type ComplexMedianLookup = (
  deal: PatchDealInput,
) => ComplexMedianCell | null;

export interface PatchItem {
  kind: "nerf" | "buff";
  sigungu: string;
  dong: string;
  apt: string;
  areaM2: number;
  band: string;
  priceKrw: number;
  medianKrw: number;
  /** (price − 단지 자기 중위가) / 단지 자기 중위가. 너프 양수, 버프 음수.
   *  ⚠️ 내부 선별 필터 전용 — 중위가는 우리 추정치라 화면에 "시세"로 단정 노출 금지
   *  (2026-07-06 사장 지시). 화면 노출은 pctVsPrev(직전 실거래 팩트)만 쓴다. */
  pct: number;
  dealDate: string;
  /** 그 단지×평형의 최근 1년 실거래 최고가(원) — 헤드라인 "1년 최고가 갱신" 판정용.
   *  스냅샷이 아직 maxKrw 를 안 주면 null/undefined (구 스키마 호환). */
  maxKrw?: number | null;
  /** 같은 단지 ±3㎡의 직전 실거래가(원) — 60일 내(PATCH_PREV_MAX_AGE_DAYS). 없으면 null.
   *  ⚠️ v2.5: 매칭을 밴드 전체 → 같은 단지 ±3㎡(중위가 lookup 과 동일 허용오차)로 좁힘 —
   *  같은 밴드 안에서 평형이 섞이면(49㎡ vs 59㎡ 등) '직전 거래 대비'가 왜곡된다. */
  prevKrw?: number | null;
  /** 직전 실거래 계약일 YYYY-MM-DD — 비교 표기엔 항상 날짜 병기(사장 지시). */
  prevDate?: string | null;
  /** 직전 실거래의 층 — "직전 '26.6.18 4.2억(7층)" 병기용. 미제공이면 null. */
  prevFloor?: number | null;
  /** (price − prevKrw) / prevKrw — 화면 노출용 등락(실거래 팩트 기준). prev 없으면 null. */
  pctVsPrev?: number | null;
  /** 폴링창(window) 내 같은 단지 ±3㎡ 자기 제외 최고가 — "두 달 내 최고가" rung 판정용. */
  windowMaxKrw?: number | null;
  /** 단지 좌표 — 행 미니맵·카카오맵 링크용. 스냅샷 미등재(신축 등)면 null. */
  lat?: number | null;
  lng?: number | null;
  /** 층 — 행 메타 "12층" 태그용. MOLIT 미제공이면 null. */
  floor?: number | null;
  /** 최근접 지하철역 거리(m) — 행 메타 "역 350m" 태그용. 스냅샷 미등재면 null. */
  nearestSubwayM?: number | null;
}

/** 시군구 단위 하루 집계 — fresh 중개거래 중 직전 거래(60일 내)가 존재하는 거래의
 *  직전 실거래 대비 평균 등락(pctVsPrev 평균). 팩트 기준 — 중위가 추정 아님. */
export interface RegionPulse {
  sigungu: string;
  /** 직전 실거래 대비 평균 등락률(소수). 약세 음수, 강세 양수. */
  avgPct: number;
  /** 집계에 들어간(직전 거래 존재) 거래 수. */
  count: number;
}

/** [주요 거래] 코너 아이템 — 오늘 공개된 수도권 15억 이상 중개거래 전부. */
export interface MajorItem {
  sigungu: string;
  dong: string;
  apt: string;
  areaM2: number;
  priceKrw: number;
  dealDate: string;
  /** 단지 자기 시세 대비 이탈률(소수) — lookup 가능·표본 충분할 때만, 아니면 null. */
  pct: number | null;
  /** 건축년도 — 신축 첫 실거래 판정용. 미제공 null. */
  buildYear: number | null;
  /** 단지 자기 중위가 lookup 성공 시 그 표본수, 실패 시 null("거래 이력 없는 단지" 신호). */
  sampleCount: number | null;
  /** 같은 단지 ±3㎡의 직전 실거래가(원) — 60일 내. 없으면 null. */
  prevKrw?: number | null;
  /** 직전 실거래 계약일 YYYY-MM-DD. */
  prevDate?: string | null;
  /** 직전 실거래의 층 — UI 병기용. 미제공이면 null. */
  prevFloor?: number | null;
  /** (price − prevKrw) / prevKrw — 실거래 팩트 기준 등락. prev 없으면 null. */
  pctVsPrev?: number | null;
  /** 기준점 최고가(원) — 행 서브라인 "최근 {기간} 최고" 비교용. 스냅샷 1년 최고가
   *  (maxKrw)가 있으면 그것을 우선(refMaxPeriod="1년"), 없으면 폴링창 내 자기 제외
   *  최고가(refMaxPeriod="2개월"). 비교 대상 자체가 없으면 null → 서브라인 생략. */
  windowMaxKrw?: number | null;
  /** 기준점 최고가의 계약일 — "2개월"(폴링창)은 항상, "1년"은 새 스냅샷(maxDate 보유)부터.
   *  구 스냅샷 "1년" 기준점은 날짜 미보관 → null(표기 생략). */
  windowMaxDate?: string | null;
  /** 기준점 최고가 거래의 층 — 값 있을 때만 병기("6.4억 ('26.5.2·12층)"). 없으면 null. */
  windowMaxFloor?: number | null;
  /** 기준점 기간 라벨 — UI 가 "1년/2개월"을 알 수 있게. */
  refMaxPeriod?: "1년" | "2개월" | null;
  /** 단지 좌표 — 행 미니맵·카카오맵 링크용. 스냅샷 미등재(신축 첫거래 등)면 null. */
  lat?: number | null;
  lng?: number | null;
  /** 층 — 행 메타 "12층" 태그용. MOLIT 미제공이면 null. */
  floor?: number | null;
  /** 최근접 지하철역 거리(m) — 행 메타 "역 350m" 태그용. 스냅샷 미등재면 null. */
  nearestSubwayM?: number | null;
}

/** [오늘의 해제] 아이템 — 오늘 처음 확인된 계약 해제 신고(국토부 공개 행정 사실).
 *  해제 "사유"는 데이터에 없으므로 어떤 해석도 붙이지 않는다 — 단정 금지. */
export interface CancellationItem {
  sigungu: string;
  dong: string;
  apt: string;
  areaM2: number;
  priceKrw: number;
  /** 계약일 YYYY-MM-DD — 해제 확인일이 아님(MOLIT는 해제일을 별도로 안 줌). */
  dealDate: string;
  /** 그 가격이 같은 단지×밴드 window 내 "다른 유효 거래들"보다 높았는지 —
   *  "해제 전까지 이 단지 최고가로 공개돼 있었음" 문구 판정. 비교할 유효 거래가
   *  하나도 없으면 false(최고가 주장 자체가 공허 — 팩트만 인쇄). */
  wasTopInWindow: boolean;
  floor?: number | null;
  nearestSubwayM?: number | null;
}

/** [오늘 최다 공개 동네] 아이템 — fresh 유효 거래 시군구 집계. */
export interface BusiestRegion {
  sigungu: string;
  count: number;
}

/** 오늘의 온도 — 직전 실거래 대비(팩트 기준). fresh 중개거래 중 같은 단지×밴드에
 *  60일 내 직전 거래가 존재하는 것만 집계한다 (중위가 추정치 기준 폐기 — 2026-07-06). */
export interface PatchTemp {
  /** 직전 실거래보다 +1% 초과 높게 거래된 건수. */
  above: number;
  /** 직전 실거래보다 −1% 초과 낮게 거래된 건수. */
  below: number;
  /** 직전 거래가 존재한 거래 수(±1% 이내 중립 포함 — above/below 어디에도 안 셈). */
  matched: number;
}

export interface PatchResult {
  nerf: PatchItem[];
  /** 급락 실명 리스트 — UI 게재 폐지(특정 단지 비하 금지, 2026-07-06 사장 지시).
   *  데이터엔 남긴다(추후 분석용) — 렌더는 하지 않는다. */
  buff: PatchItem[];
  /** 오늘 공개된 15억 이상 중개거래 전부 — 가격 내림차순. */
  major: MajorItem[];
  /** 오늘의 온도 — matched < 30(표본 부족)이면 null. */
  temp: PatchTemp | null;
  /** 권역 온도 8행용 — 시군구별 온도(전역 temp와 같은 풀·같은 규칙, ±1% 중립).
   *  권역 구획은 앱 쪽(lib/zones.ts)이 담당 — 구획이 바뀌어도 데이터 재발행 불필요.
   *  키는 시군구 가나다순(결정적 직렬화). 표본 문턱 없이 전부(표시 판단은 UI). */
  regionTemp: Record<string, PatchTemp>;
  /** [약세 동네] — 시군구별 평균 이탈률 avgPct ≤ −1%·표본 5건 이상, 약세 순 상위 3. */
  weakRegions: RegionPulse[];
  /** 대칭 집계(avgPct ≥ +1%) — 데이터용. UI 는 [강세 거래] 실명이 이미 담당하므로 비게재. */
  strongRegions: RegionPulse[];
  /** [오늘의 해제] — 오늘 처음 확인된 해제 신고(canceled이면서 seen에 없던 것).
   *  wasTop 우선, 이어서 가격 내림차순. 0건이면 UI 코너 생략. */
  cancellations: CancellationItem[];
  /** [오늘 최다 공개 동네] — fresh 유효 거래 시군구 집계 상위 3(count≥3만). */
  busiestRegions: BusiestRegion[];
  /** [오늘의 거래 지도]용 — fresh 유효 거래(직거래 포함 — '공개' 건수 팩트)의
   *  시군구별 전체 집계. busiestRegions와 같은 풀이되 문턱·상위N 없이 전부(0건은 제외).
   *  키는 시군구 가나다순(결정적 직렬화). */
  regionCounts: Record<string, number>;
  /** 스코프(최근 계약 14일) 안 거래 수 */
  scopeDealCount: number;
  /** 그중 오늘 처음 확인된 거래 수 */
  newDealCount: number;
  /** 다음 폴링을 위한 seen 키 — window 전체(canceled 포함), 정렬·중복 제거.
   *  ⚠️ v2.3 재설계: 종전엔 스코프 내 유효 거래만 넣어 canceled가 매일 '신규 해제'로
   *  재등장할 버그 소지가 있었다. 이제 입력 window 전체를 seenKeyOf(해제 상태 구분)로 넣는다. */
  nextSeenKeys: string[];
  /** 오늘 처음 확인된 거래 원본(유효 fresh + 신규 해제, canceled 플래그 보존) —
   *  주말 저볼륨 폴백(dailyRecent.json 롤링 append)용 경량 요약 소스. */
  freshDeals: PatchDealInput[];
}

/** 계약일 기준 스코프 일수 — 이보다 오래된 거래는 패치 대상 아님. */
export const PATCH_SCOPE_DAYS = 14;
/** 단지 자기 시세 대비 이 비율 이상이면 너프/버프로 분류. */
export const PATCH_MIN_PCT = 0.07;
/** 상승(너프) 노이즈 컷 — 이 비율 초과 괴리는 입력오류·특수거래 의심으로 제외. */
export const PATCH_NOISE_MAX_UP = 0.35;
/** 하락(버프) 노이즈 컷 — 비대칭으로 더 엄격. 중개거래 표기여도 −30% 초과 급락은
 *  증여성 의심이라 코너에서도 제외 (2026-07-04 사장 지시). */
export const PATCH_NOISE_MAX_DOWN = 0.3;
/** @deprecated PATCH_NOISE_MAX_UP / PATCH_NOISE_MAX_DOWN 비대칭 컷으로 분리됨. */
export const PATCH_NOISE_MAX_PCT = PATCH_NOISE_MAX_UP;
/** [주요 거래] 코너 하한 — 오늘 공개된 수도권 이 가격 이상 중개거래는 전부 싣는다. */
export const PATCH_MAJOR_MIN_PRICE_KRW = 1_500_000_000;
/** 오늘의 온도 최소 표본 — 직전 실거래 대비(팩트 기준)로 재정의하며 30→20으로 완화
 *  (직전 거래 존재 요건 때문에 표본이 줄어듦). 이보다 적으면 온도 비표시(null). */
export const PATCH_TEMP_MIN_MATCHED = 20;
/** 오늘의 온도 중립 밴드 — 직전 실거래 ±1% 이내는 위/아래 어느 쪽에도 안 센다. */
export const PATCH_TEMP_NEUTRAL_PCT = 0.01;
/** 직전 거래 비교 유효기간(일) — 계약일 기준 이보다 묵은 직전 거래는 비교 무의미라
 *  prev 없음(null)으로 처리 ("직전 거래가 5년 전이면 비교가 무의미" — 사장 지적 2026-07-06).
 *  현 폴링창(2개월)에선 사실상 자동이지만, 추후 스냅샷 lastKrw 등 더 긴 이력 소스를
 *  붙여도 이 규칙이 코드 레벨에서 강제되도록 명문화한다. */
export const PATCH_PREV_MAX_AGE_DAYS = 60;
/** 직전 거래·기준점 매칭 전용면적 허용오차(㎡) — 중위가 lookup(±3㎡)과 동일 기준.
 *  밴드 전체 매칭은 평형 혼합 왜곡(49㎡ 거래가 59㎡의 '직전'이 되는 등)을 만든다. */
export const PATCH_PREV_AREA_TOLERANCE_M2 = 3;
/** 단지×평형 중위가 표본이 이보다 적으면 대조 자체를 신뢰하지 않음(단지 단위라 작게). */
export const PATCH_MIN_SAMPLE = 3;
/** 초저가(원) 컷 — 지분·특수 거래 방어. */
export const PATCH_MIN_PRICE_KRW = 50_000_000;
/** 너프/버프 각각 상위 N건. */
export const PATCH_TOP_N = 5;

// ── 오보 게이트(2026-07-07 사장 적발) — [강세 거래] 게재·헤드라인 신고가성 rung 공통 ──
// 실사례: 남양주 금강펜테리움 5.9억 — pctVsPrev +40.5%로 헤드라인에 실렸지만,
// 자기 중위가 대비는 +17.8%뿐이고 직전 거래(4.2억)가 자기 중위가보다 −16% 낮았던
// "이상치"였다. 직전 거래 하나만 믿으면 이상치 대비 등락이 뉴스로 확성된다.
// → 두 신호 합의 원칙: 직전 거래 대비(pctVsPrev)와 자기 중위가 대비(pct)가 "둘 다"
//   +7% 이상일 때만 신고가성으로 게재하고, pctVsPrev +30% 초과는 직전 거래 이상치
//   의심으로 컷한다. 셋 중 하나라도 어기면 게재 제외.
/** 강세 게재 하한 — 직전 거래 대비 최소 상승률. */
export const PATCH_STRONG_MIN_PCT_VS_PREV = 0.07;
/** 강세 게재 상한 — 직전 거래 대비 이 비율 초과 급등은 직전 거래 이상치 의심 컷. */
export const PATCH_STRONG_MAX_PCT_VS_PREV = 0.3;

/** 오보 게이트 판정 — computePatch(게재 목록)와 UI(구 데이터 렌더 필터)가 공유한다.
 *  구 스키마(prev 필드 없음) 아이템은 자동 탈락 — 표시할 팩트가 없다. */
export function passesStrongGate(i: {
  /** 자기 중위가 대비 이탈률(내부 선별 값). */
  pct: number;
  prevKrw?: number | null;
  pctVsPrev?: number | null;
}): boolean {
  return (
    i.prevKrw != null &&
    i.pctVsPrev != null &&
    i.pctVsPrev >= PATCH_STRONG_MIN_PCT_VS_PREV &&
    i.pctVsPrev <= PATCH_STRONG_MAX_PCT_VS_PREV &&
    i.pct >= PATCH_MIN_PCT
  );
}
/** [약세/강세 동네] 시군구 집계 — 대조 성공 거래가 이보다 적은 동네는 안 실음. */
export const PATCH_REGION_MIN_COUNT = 5;
/** [약세/강세 동네] 평균 이탈률 문턱(절대값) — 이보다 완만하면 중립으로 보고 생략. */
export const PATCH_REGION_MIN_AVG_PCT = 0.01;
/** [약세/강세 동네] 상위 N개 동네. */
export const PATCH_REGION_TOP_N = 3;
/** [오늘 최다 공개 동네] 상위 N개. */
export const PATCH_BUSIEST_TOP_N = 3;
/** [오늘 최다 공개 동네] 최소 건수 — 이보다 적은 동네는 안 실음. */
export const PATCH_BUSIEST_MIN_COUNT = 3;
/** 주말 저볼륨 폴백 문턱 — 오늘 fresh 유효 거래가 이보다 적으면 최근 며칠을 합산(merged). */
export const PATCH_MERGED_MIN_FRESH = 80;
/** dailyRecent.json 롤링 보존 일수 — 오늘 포함 3일(그보다 묵은 항목은 prune). */
export const DAILY_RECENT_KEEP_DAYS = 3;

/** 거래 동일성 키 — 같은 거래가 매일 재폴링돼도 한 번만 '신규'로 잡히게. */
export function dealKey(d: PatchDealInput): string {
  return [
    d.sigunguName,
    d.apartmentName,
    d.area,
    d.dealDateISO,
    d.priceKrw,
    d.floor ?? "",
  ].join("|");
}

/** seen 저장용 키 — 해제 상태를 구분한다. 같은 거래가 유효로 공개됐다가 나중에
 *  해제되면 MOLIT 레코드 필드(=dealKey)는 동일하므로, 상태를 키에 넣지 않으면
 *  "유효→해제 전환"을 영영 신규 해제로 못 잡는다(그게 이 코너의 핵심 뉴스).
 *  해제 키는 별도 접미로 저장 → 전환 시 딱 한 번 '오늘 처음 확인된 해제'로 잡히고,
 *  다음 폴링부턴 seen에 있어 재등장하지 않는다. */
export function seenKeyOf(d: PatchDealInput): string {
  return d.canceled ? `${dealKey(d)}|해제` : dealKey(d);
}

/** 2단(+검증) 발행 프로토콜의 모노토닉 덮어쓰기 가드 — 순수 함수(크론·테스트 공유).
 *  크론이 하루 3회(05:20 본판 · 05:50/06:12 검증판) 돌 때, 검증판이 본판보다 얇으면
 *  (오늘 fresh 유효 거래 수 ≤ 기존 newDealCount) 기존 발행분을 덮어쓰지 않는다.
 *  본판이 GitHub cron 지연·국토부 배치 부분 착지로 얇게 나갔을 때만 더 풍부한 판으로
 *  교체된다 — 지면은 하루 안에서 단조증가(monotonic)만 허용. 날짜가 다르면 정상 진행. */
export function shouldSkipPatchOverwrite(opts: {
  /** 기존 dailyPatch.json 의 generatedAt — placeholder(발행 전)면 null. */
  prevGeneratedAt: string | null;
  /** 기존 dailyPatch.json 의 newDealCount. */
  prevNewDealCount: number;
  /** 이번 실행 기준일 YYYY-MM-DD. */
  todayISO: string;
  /** 이번 실행의 fresh 유효 거래 수(일간 diff — merged 재계산 전 기준). */
  freshCount: number;
}): boolean {
  return (
    opts.prevGeneratedAt !== null &&
    opts.prevGeneratedAt === opts.todayISO &&
    opts.freshCount <= opts.prevNewDealCount
  );
}

/** 주말 합산(merged) 모드용 seen 차감 — 최근 며칠(dailyRecent) 항목을 seen에서 빼서
 *  그 거래들이 다시 fresh로 잡히게 한다. 순수 함수 — 크론과 테스트가 같이 쓴다. */
export function subtractRecentFromSeen(
  seenKeys: ReadonlySet<string>,
  recentItems: readonly PatchDealInput[],
): Set<string> {
  const out = new Set(seenKeys);
  for (const item of recentItems) out.delete(seenKeyOf(item));
  return out;
}

function daysBetweenISO(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00Z`).getTime();
  const to = new Date(`${toISO}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function computePatch(opts: {
  deals: PatchDealInput[];
  /** 직전 폴링까지 확인된 거래 키 (없으면 빈 Set = 첫 실행) */
  seenKeys: ReadonlySet<string>;
  lookupMedian: ComplexMedianLookup;
  /** 기준일 YYYY-MM-DD (크론 TZ=Asia/Seoul 기준 오늘) */
  todayISO: string;
  /** 계약일 스코프 오버라이드 — 창간호(부트스트랩)는 3일로 좁혀 씀. 기본 PATCH_SCOPE_DAYS. */
  scopeDays?: number;
}): PatchResult {
  const { deals, seenKeys, lookupMedian, todayISO } = opts;
  const scopeDays = opts.scopeDays ?? PATCH_SCOPE_DAYS;

  // 0) 직전 거래 타임라인 — canceled 만 제외한 window "전체"(스코프 이전 거래 포함).
  //    화면에 노출하는 비교 기준은 우리 추정(중위가 "시세")이 아니라 실거래 팩트(직전 거래)
  //    — "니가 제일 모르는 게 시세" (2026-07-06 사장 지시).
  //    ⚠️ v2.5 오보 게이트: 매칭 단위를 밴드 전체 → 같은 단지 ±3㎡(중위가 lookup 과 동일
  //    허용오차)로 좁힘. 같은 밴드 안 평형 혼합(49㎡ 거래가 59㎡의 '직전'이 되는 등)이
  //    pctVsPrev 를 왜곡했다 — 금강펜테리움 사례(직전 4.2억이 자기 중위가 −16% 이상치).
  type TimelineDeal = {
    selfKey: string;
    dateISO: string;
    priceKrw: number;
    area: number;
    floor: number | null;
  };
  const cxKeyOf = (d: PatchDealInput): string =>
    `${d.sigunguName}|${d.apartmentName}`;
  const sameAreaType = (a: number, b: number): boolean =>
    Math.abs(a - b) <= PATCH_PREV_AREA_TOLERANCE_M2;
  const timeline = new Map<string, TimelineDeal[]>();
  for (const d of deals) {
    if (d.canceled) continue;
    const list = timeline.get(cxKeyOf(d)) ?? [];
    list.push({
      selfKey: dealKey(d),
      dateISO: d.dealDateISO,
      priceKrw: d.priceKrw,
      area: d.area,
      floor: d.floor ?? null,
    });
    timeline.set(cxKeyOf(d), list);
  }
  /** 직전 거래 — 같은 단지 ±3㎡, 계약일이 같거나 이른 것 중 최신. 자기 자신(동일 dealKey)
   *  제외, 같은 날짜 타거래는 층이 달라도 허용. 같은 날짜가 여럿이면 가격 최고를 채택
   *  (결정적이면서 pctVsPrev 과대 방지 쪽으로 보수적). 계약일 기준
   *  PATCH_PREV_MAX_AGE_DAYS(60일)보다 묵은 직전 거래는 비교 무의미 — null. */
  const findPrev = (
    d: PatchDealInput,
  ): { prevKrw: number; prevDate: string; prevFloor: number | null } | null => {
    const list = timeline.get(cxKeyOf(d));
    if (!list) return null;
    const self = dealKey(d);
    let best: TimelineDeal | null = null;
    for (const c of list) {
      if (c.selfKey === self) continue;
      if (!sameAreaType(c.area, d.area)) continue;
      if (c.dateISO > d.dealDateISO) continue;
      if (
        !best ||
        c.dateISO > best.dateISO ||
        (c.dateISO === best.dateISO && c.priceKrw > best.priceKrw)
      ) {
        best = c;
      }
    }
    if (!best) return null;
    if (daysBetweenISO(best.dateISO, d.dealDateISO) > PATCH_PREV_MAX_AGE_DAYS) return null;
    return { prevKrw: best.priceKrw, prevDate: best.dateISO, prevFloor: best.floor };
  };
  /** window 내 같은 단지 ±3㎡의 자기 제외 최고가(+계약일·층) — "두 달 내 최고가" rung
   *  판정과 [주요 거래] 기준점 서브라인용. 동가면 계약일 최신 채택. */
  const findWindowMax = (
    d: PatchDealInput,
  ): { priceKrw: number; dateISO: string; floor: number | null } | null => {
    const list = timeline.get(cxKeyOf(d));
    if (!list) return null;
    const self = dealKey(d);
    let mx: TimelineDeal | null = null;
    for (const c of list) {
      if (c.selfKey === self) continue;
      if (!sameAreaType(c.area, d.area)) continue;
      if (
        !mx ||
        c.priceKrw > mx.priceKrw ||
        (c.priceKrw === mx.priceKrw && c.dateISO > mx.dateISO)
      ) {
        mx = c;
      }
    }
    return mx ? { priceKrw: mx.priceKrw, dateISO: mx.dateISO, floor: mx.floor } : null;
  };

  // 1) 스코프: 계약일이 오늘로부터 scopeDays 이내 (미래 날짜·해제 거래는 제외)
  const scope = deals.filter((d) => {
    if (d.canceled) return false;
    const age = daysBetweenISO(d.dealDateISO, todayISO);
    return age >= 0 && age <= scopeDays;
  });

  // seen은 window "전체"(canceled 포함, 스코프 제한 없음)로 구축 — 해제 거래가
  // 스코프 밖 계약일이어도 seen에 남아 매일 '신규 해제'로 재등장하지 않게 한다.
  // (분석 scope는 위처럼 계속 canceled 제외 — 유효 거래만 판독 대상)
  const nextSeenKeys = Array.from(new Set(deals.map(seenKeyOf))).sort();

  // 2) 오늘 처음 확인된 거래
  const fresh = scope.filter((d) => !seenKeys.has(dealKey(d)));

  // 2-a) [오늘의 해제] — canceled이면서 seen에 없던 것(해제 키 기준). 초저가(지분성)만 컷.
  //      wasTopInWindow = 같은 단지 ±3㎡ window 내 "다른 유효 거래들"(timeline, canceled 제외)
  //      전부보다 강하게 높았는지 — 비교 대상이 없으면 false(공허한 최고가 주장 금지).
  //      직전 거래 매칭과 동일 기준(±3㎡) — 평형 혼합이면 '최고가였다' 주장도 왜곡된다.
  const freshCancellations = deals.filter(
    (d) =>
      d.canceled === true &&
      !seenKeys.has(seenKeyOf(d)) &&
      d.priceKrw >= PATCH_MIN_PRICE_KRW,
  );
  const cancellations: CancellationItem[] = freshCancellations.map((d) => {
    const others = (timeline.get(cxKeyOf(d)) ?? []).filter((c) =>
      sameAreaType(c.area, d.area),
    );
    const wasTopInWindow =
      others.length > 0 && others.every((c) => d.priceKrw > c.priceKrw);
    const cell = lookupMedian(d);
    return {
      sigungu: d.sigunguName,
      dong: d.dongName,
      apt: d.apartmentName,
      areaM2: d.area,
      priceKrw: d.priceKrw,
      dealDate: d.dealDateISO,
      wasTopInWindow,
      floor: d.floor ?? null,
      nearestSubwayM: cell?.nearestSubwayM ?? null,
    };
  });
  // wasTop 우선 → 가격 내림차순 → 계약일 최신 (결정적 정렬).
  cancellations.sort(
    (a, b) =>
      Number(b.wasTopInWindow) - Number(a.wasTopInWindow) ||
      b.priceKrw - a.priceKrw ||
      b.dealDate.localeCompare(a.dealDate),
  );

  // 2-b) [오늘 최다 공개 동네] — fresh 유효 거래 전체(직거래 포함 — '공개' 건수 팩트) 집계.
  const busiestAgg = new Map<string, number>();
  for (const d of fresh) {
    busiestAgg.set(d.sigunguName, (busiestAgg.get(d.sigunguName) ?? 0) + 1);
  }
  const busiestRegions: BusiestRegion[] = Array.from(busiestAgg, ([sigungu, count]) => ({
    sigungu,
    count,
  }))
    .filter((r) => r.count >= PATCH_BUSIEST_MIN_COUNT)
    .sort((a, b) => b.count - a.count || a.sigungu.localeCompare(b.sigungu, "ko"))
    .slice(0, PATCH_BUSIEST_TOP_N);

  // 2-c) [오늘의 거래 지도] — 같은 풀(busiestAgg)의 전체 집계, 문턱 없이(0건 자연 제외).
  //      가나다순 키 — dailyPatch.json 직렬화가 결정적이도록.
  const regionCounts: Record<string, number> = {};
  for (const sigungu of [...busiestAgg.keys()].sort((a, b) => a.localeCompare(b, "ko"))) {
    regionCounts[sigungu] = busiestAgg.get(sigungu)!;
  }

  // 3) 중위가 대조 → 분류 (+ 주요 거래 · 오늘의 온도 동시 집계)
  const classified: PatchItem[] = [];
  const major: MajorItem[] = [];
  let tempAbove = 0;
  let tempBelow = 0;
  let tempMatched = 0;
  // 시군구별 등락 집계 — fresh 중개거래 중 직전 거래(60일 내) 존재분의 pctVsPrev 평균.
  const regionAgg = new Map<string, { sum: number; count: number }>();
  // 권역 온도 8행용 — 시군구별 above/below/matched (전역 온도와 같은 풀).
  const regionTempAgg = new Map<string, PatchTemp>();
  // freshDeals 요약 동봉용 — dealKey → pctVsPrev (동네판 [직전 대비 평균] 재료, 2026-07-08).
  const pctVsPrevByKey = new Map<string, number>();
  for (const d of fresh) {
    // 직거래 = 가족 간 증여성 거래 가능성 — 가격 신호로 안 씀 (특히 급락 버프 오염 방지)
    if (d.dealingGbn === "직거래") continue;
    if (d.priceKrw < PATCH_MIN_PRICE_KRW) continue;

    // 직전 거래 팩트 — 화면 노출용 비교 기준(온도·동네 집계·강세 행·헤드라인).
    const prev = findPrev(d);
    const pctVsPrev = prev ? (d.priceKrw - prev.prevKrw) / prev.prevKrw : null;
    if (pctVsPrev !== null) pctVsPrevByKey.set(dealKey(d), pctVsPrev);

    // 중위가 대조 — ⚠️ 내부 선별 필터 전용(±7% 문턱·노이즈컷·표본 신뢰).
    // 우리 추정치라 화면에 "시세"로 단정 노출하지 않는다.
    // lookup 실패(null) = "거래 이력 없는 단지" 신호 → major.sampleCount=null로 보존.
    const cell = lookupMedian(d);
    const trustedMedianKrw =
      cell && cell.sampleCount >= PATCH_MIN_SAMPLE && cell.medianKrw > 0
        ? cell.medianKrw
        : null;
    const pct =
      trustedMedianKrw !== null ? (d.priceKrw - trustedMedianKrw) / trustedMedianKrw : null;

    // ── [주요 거래] — 15억 이상 중개거래 전부 (band·표본과 무관하게 게재) ──
    if (d.priceKrw >= PATCH_MAJOR_MIN_PRICE_KRW) {
      // 기준점(기간 내 최고 거래가) — 스냅샷 1년 최고가 우선, 없으면 폴링창(2개월) 최고.
      // "1년" 날짜·층은 새 스냅샷(maxDate·maxFloor 동봉)부터 — 구 스냅샷은 null(표기 생략).
      const snapMax = cell?.maxKrw ?? null;
      const wm = findWindowMax(d);
      const refMax =
        snapMax !== null && snapMax > 0
          ? {
              krw: snapMax,
              date: cell?.maxDate ?? null,
              floor: cell?.maxFloor ?? null,
              period: "1년" as const,
            }
          : wm
            ? { krw: wm.priceKrw, date: wm.dateISO, floor: wm.floor, period: "2개월" as const }
            : null;
      major.push({
        sigungu: d.sigunguName,
        dong: d.dongName,
        apt: d.apartmentName,
        areaM2: d.area,
        priceKrw: d.priceKrw,
        dealDate: d.dealDateISO,
        pct,
        buildYear: d.buildYear ?? null,
        sampleCount: cell && cell.medianKrw > 0 ? cell.sampleCount : null,
        prevKrw: prev?.prevKrw ?? null,
        prevDate: prev?.prevDate ?? null,
        prevFloor: prev?.prevFloor ?? null,
        pctVsPrev,
        windowMaxKrw: refMax?.krw ?? null,
        windowMaxDate: refMax?.date ?? null,
        windowMaxFloor: refMax?.floor ?? null,
        refMaxPeriod: refMax?.period ?? null,
        lat: cell?.lat ?? null,
        lng: cell?.lng ?? null,
        floor: d.floor ?? null,
        nearestSubwayM: cell?.nearestSubwayM ?? null,
      });
    }

    // ── 오늘의 온도 — 직전 실거래 대비(팩트 기준). ±1% 이내는 중립(matched에만) ──
    if (pctVsPrev !== null) {
      tempMatched += 1;
      if (pctVsPrev > PATCH_TEMP_NEUTRAL_PCT) tempAbove += 1;
      else if (pctVsPrev < -PATCH_TEMP_NEUTRAL_PCT) tempBelow += 1;
      // ── [약세/강세 동네] 시군구 집계 — 온도와 같은 풀(직전 거래 존재 중개거래) ──
      const agg = regionAgg.get(d.sigunguName) ?? { sum: 0, count: 0 };
      agg.sum += pctVsPrev;
      agg.count += 1;
      regionAgg.set(d.sigunguName, agg);
      // ── 권역 온도용 시군구별 온도 — 전역 temp와 동일 규칙(±1% 중립은 matched만) ──
      const rt = regionTempAgg.get(d.sigunguName) ?? { above: 0, below: 0, matched: 0 };
      rt.matched += 1;
      if (pctVsPrev > PATCH_TEMP_NEUTRAL_PCT) rt.above += 1;
      else if (pctVsPrev < -PATCH_TEMP_NEUTRAL_PCT) rt.below += 1;
      regionTempAgg.set(d.sigunguName, rt);
    }

    // ── 너프/버프 선별(eligibility) — 기존 중위가 필터 유지(내부용) ──
    if (pct === null || trustedMedianKrw === null) continue;
    const band = bandOfArea(d.area);
    if (!band) continue;
    if (Math.abs(pct) < PATCH_MIN_PCT) continue;
    // 비대칭 노이즈 컷 — 상승 +35% 초과, 하락 −30% 초과는 제외.
    if (pct > PATCH_NOISE_MAX_UP || pct < -PATCH_NOISE_MAX_DOWN) continue;

    classified.push({
      kind: pct > 0 ? "nerf" : "buff",
      sigungu: d.sigunguName,
      dong: d.dongName,
      apt: d.apartmentName,
      areaM2: d.area,
      band,
      priceKrw: d.priceKrw,
      medianKrw: trustedMedianKrw,
      pct,
      dealDate: d.dealDateISO,
      // 최근 1년 실거래 최고가 — 스냅샷이 아직 안 주면 null(구 스키마 호환).
      maxKrw: cell?.maxKrw ?? null,
      // 직전 실거래 팩트 — 화면·헤드라인 노출용.
      prevKrw: prev?.prevKrw ?? null,
      prevDate: prev?.prevDate ?? null,
      prevFloor: prev?.prevFloor ?? null,
      pctVsPrev,
      windowMaxKrw: findWindowMax(d)?.priceKrw ?? null,
      lat: cell?.lat ?? null,
      lng: cell?.lng ?? null,
      floor: d.floor ?? null,
      nearestSubwayM: cell?.nearestSubwayM ?? null,
    });
  }

  // ── [약세/강세 동네] — 시군구 평균 이탈률, 표본 5건 이상만 ──
  const regionPulses: RegionPulse[] = Array.from(regionAgg, ([sigungu, a]) => ({
    sigungu,
    avgPct: a.sum / a.count,
    count: a.count,
  })).filter((r) => r.count >= PATCH_REGION_MIN_COUNT);
  const weakRegions = regionPulses
    .filter((r) => r.avgPct <= -PATCH_REGION_MIN_AVG_PCT)
    .sort((a, b) => a.avgPct - b.avgPct) // 가장 약세부터
    .slice(0, PATCH_REGION_TOP_N);
  const strongRegions = regionPulses
    .filter((r) => r.avgPct >= PATCH_REGION_MIN_AVG_PCT)
    .sort((a, b) => b.avgPct - a.avgPct) // 가장 강세부터
    .slice(0, PATCH_REGION_TOP_N);

  // 주요 거래 — 가격 내림차순 (동가는 계약일 최신 우선).
  major.sort((a, b) => b.priceKrw - a.priceKrw || b.dealDate.localeCompare(a.dealDate));

  // 4) 같은 단지×평형은 대표 1건만 — 도배 방지.
  //    너프 대표는 pctVsPrev(화면 노출 팩트) 최대, 버프 대표는 |pct| 최대(데이터용).
  const repScore = (i: PatchItem): number =>
    i.kind === "nerf" ? i.pctVsPrev ?? Number.NEGATIVE_INFINITY : Math.abs(i.pct);
  const byComplex = new Map<string, PatchItem>();
  for (const item of classified) {
    const k = `${item.kind}|${item.sigungu}|${item.apt}|${item.band}`;
    const cur = byComplex.get(k);
    if (!cur || repScore(item) > repScore(cur)) byComplex.set(k, item);
  }
  const deduped = Array.from(byComplex.values());

  // [강세 거래] 게재 요건 — 오보 게이트(passesStrongGate): 직전 거래 팩트(60일 내)가
  // 있고, pctVsPrev·pct 둘 다 +7% 이상(두 신호 합의)이며, pctVsPrev ≤ +30%(직전 거래
  // 이상치 컷)인 것만. 셋 중 하나라도 어기면 미게재 — 금강펜테리움 사례 참조(상수 주석).
  const nerfPublished = deduped
    .filter((i) => i.kind === "nerf" && passesStrongGate(i))
    .sort((a, b) => (b.pctVsPrev ?? 0) - (a.pctVsPrev ?? 0))
    .slice(0, PATCH_TOP_N);
  // buff 는 데이터 보존용(렌더 안 함) — 기존 |pct| 정렬 유지.
  const buffRanked = deduped
    .filter((i) => i.kind === "buff")
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .slice(0, PATCH_TOP_N);

  // 권역 온도용 시군구별 온도 — 가나다순 키(결정적 직렬화, regionCounts와 동일 규칙).
  const regionTemp: Record<string, PatchTemp> = {};
  for (const sigungu of [...regionTempAgg.keys()].sort((a, b) => a.localeCompare(b, "ko"))) {
    regionTemp[sigungu] = regionTempAgg.get(sigungu)!;
  }

  return {
    nerf: nerfPublished,
    buff: buffRanked,
    major,
    temp:
      tempMatched >= PATCH_TEMP_MIN_MATCHED
        ? { above: tempAbove, below: tempBelow, matched: tempMatched }
        : null,
    regionTemp,
    weakRegions,
    strongRegions,
    cancellations,
    busiestRegions,
    regionCounts,
    scopeDealCount: scope.length,
    newDealCount: fresh.length,
    nextSeenKeys,
    // dailyRecent 롤링용 — 유효 fresh + 신규 해제(canceled 플래그 보존).
    // fresh엔 직전 대비 %를 동봉(있을 때만) — 동네판 [직전 대비 평균]이 1면과
    // 동일 기준(60일 창)으로 계산되게 한다.
    freshDeals: [
      ...fresh.map((d) => {
        const p = pctVsPrevByKey.get(dealKey(d));
        return p !== undefined ? { ...d, pctVsPrev: p } : d;
      }),
      ...freshCancellations,
    ],
  };
}

// ── 오늘의 헤드라인 — "뉴스가치 사다리" (2026-07-04 사장 확정) ──────────────────
// 위에서 첫 매치 채택. 하락(버프) 아이템은 어떤 경우에도 헤드라인 금지
// (중개거래 표기여도 가족 간 거래 의심 — 급락을 1면 헤드라인으로 확성하지 않는다).

export interface HeadlineResult {
  kind: "first-trade" | "nerf" | "top-major" | "none";
  text: string;
}

/** 신축 판정 — 건축년도가 기준연도−3 이상. */
const FIRST_TRADE_BUILD_YEAR_WINDOW = 3;

function eokText(krw: number): string {
  const v = krw / 100_000_000;
  const s = v.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** "2026-06-25" → "'26.6.25" — 직전/종전 비교 표기용(사장 지시: 항상 날짜 병기).
 *  v2.5: 연도 병기 의무 — 직전 거래가 작년일 수 있어 월일만 쓰면 오독("6/18이 올해?").
 *  올해여도 같은 포맷으로 통일한다. UI(DailyFront·동네면)의 ymdShort 와 동일 규칙. */
export function ymdShortText(dateISO: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  return m ? `'${m[1].slice(2)}.${Number(m[2])}.${Number(m[3])}` : dateISO;
}

/** 등락률(소수) → "8.3" (소수 1자리, .0 생략). */
function pctText(pct: number): string {
  const s = (pct * 100).toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** 헤드라인 후보 — 사다리 순서 그대로의 목록 + 아이템 동일성 키(톱/서브 중복 회피용). */
interface HeadlineCandidate extends HeadlineResult {
  /** 동일 아이템 판정 키 — 시군구|단지|계약일|가격. */
  itemKey: string;
}

function headlineItemKey(i: {
  sigungu: string;
  apt: string;
  dealDate: string;
  priceKrw: number;
}): string {
  return `${i.sigungu}|${i.apt}|${i.dealDate}|${i.priceKrw}`;
}

/**
 * 뉴스가치 사다리 후보 목록 — 위 rung부터 순서대로. 첫 원소가 곧 pickHeadline 결과.
 * 1. 신축 첫/두 번째 실거래(15억 이상) — 가격 내림차순.
 * 2. 신고가성 상승(nerf, pctVsPrev 내림차순 입력 순서) — 아이템별 문구 사다리
 *    ① 1년 최고가 갱신 ② 두 달 내 최고가 ③ 직전 거래 대비. 팩트 없으면 그 아이템 스킵.
 * 3. 오늘의 최고가 — major 순서(가격 내림차순)대로 전부(서브 차순위 회피용).
 */
function headlineCandidates(opts: {
  major: MajorItem[];
  nerf: PatchItem[];
  todayISO: string;
}): HeadlineCandidate[] {
  const { major, nerf, todayISO } = opts;
  const baseYear = Number(todayISO.slice(0, 4));
  const out: HeadlineCandidate[] = [];

  // 1) 신축 첫/두 번째 실거래 — 후보 여럿이면 가격 최고부터.
  const firstTrades = major
    .filter(
      (m) =>
        m.buildYear !== null &&
        m.buildYear >= baseYear - FIRST_TRADE_BUILD_YEAR_WINDOW &&
        (m.sampleCount === null || m.sampleCount <= 2) &&
        m.priceKrw >= PATCH_MAJOR_MIN_PRICE_KRW,
    )
    .sort((a, b) => b.priceKrw - a.priceKrw);
  for (const top of firstTrades) {
    const eok = eokText(top.priceKrw);
    // 시세 이력 자체가 없으면 "입주 후 첫 실거래", 표본 1~2면 "{n}번째 거래"(기존 표본 + 이번).
    const text =
      top.sampleCount === null || top.sampleCount === 0
        ? `${top.apt} 입주 후 첫 실거래 — ${eok}억 공개`
        : `${top.apt} ${top.sampleCount + 1}번째 거래 ${eok}억`;
    out.push({ kind: "first-trade", text, itemKey: headlineItemKey(top) });
  }

  // 2) 신고가성 상승 — 실거래 팩트 사다리. 후보는 입력 순서(computePatch 가
  //    pctVsPrev 내림차순으로 게재 목록을 만든다)대로 훑고, 팩트가 잡히는 후보만 싣는다.
  //    오보 게이트 — 게재 목록과 동일한 이중 합의(+7% 합의·+30% 컷)를 헤드라인에도 강제.
  //    구 데이터(게이트 이전 산출 nerf)로 렌더 시점에 재계산해도 오보 후보가 못 올라온다.
  for (const cand of nerf) {
    if (!passesStrongGate(cand)) continue;
    const eok = eokText(cand.priceKrw);
    const itemKey = headlineItemKey(cand);
    // 2-① 최근 1년 최고가 갱신 — 주간 스냅샷의 관측 실거래 최고가(maxKrw) 대비.
    //      등락률은 (price − maxKrw) / maxKrw 로 재계산.
    const maxKrw = cand.maxKrw ?? null;
    if (maxKrw !== null && maxKrw > 0 && cand.priceKrw > maxKrw) {
      out.push({
        kind: "nerf",
        text: `${cand.sigungu} ${cand.apt}, 최근 1년 최고가 ${pctText(
          (cand.priceKrw - maxKrw) / maxKrw,
        )}% 갱신 — ${eok}억`,
        itemKey,
      });
      continue;
    }
    const prevKrw = cand.prevKrw ?? null;
    const pctVsPrev = cand.pctVsPrev ?? null;
    if (prevKrw !== null && cand.prevDate && pctVsPrev !== null && pctVsPrev > 0) {
      const prevMd = ymdShortText(cand.prevDate);
      // 2-② 두 달(폴링창) 내 최고가 — window 내 자기 제외 최고가보다도 높음.
      const windowMaxKrw = cand.windowMaxKrw ?? null;
      if (windowMaxKrw !== null && cand.priceKrw > windowMaxKrw) {
        out.push({
          kind: "nerf",
          text: `${cand.sigungu} ${cand.apt}, 두 달 내 최고가 — 직전 거래(${prevMd})보다 ${pctText(pctVsPrev)}% 높게 팔렸다`,
          itemKey,
        });
        continue;
      }
      // 2-③ 직전 거래 대비 — 날짜 병기 의무.
      out.push({
        kind: "nerf",
        text: `${cand.sigungu} ${cand.apt}, 직전 거래(${prevMd})보다 ${pctText(pctVsPrev)}% 높게 팔렸다 — ${eok}억`,
        itemKey,
      });
      continue;
    }
    // 2-④ 비교 팩트 없음(구 스키마 등) — 이 후보 스킵, 다음 후보로.
  }

  // 3) 오늘의 최고가 — major 전부(가격 내림차순 입력 순서). 서브 차순위 회피에 쓰인다.
  for (const top of major) {
    out.push({
      kind: "top-major",
      text: `오늘 공개 최고가 — ${top.apt} ${eokText(top.priceKrw)}억`,
      itemKey: headlineItemKey(top),
    });
  }

  return out;
}

/**
 * 오늘의 헤드라인 선정 — 순수 함수. 비교 문구는 전부 실거래 팩트만
 * (중위가 "시세" 단정 금지 — 2026-07-06 사장 지시).
 * 1. 신축 첫/두 번째 실거래(15억 이상): buildYear ≥ 기준연도−3 AND (거래 이력 없음 OR 표본 ≤ 2)
 *    → 후보 여럿이면 가격 최고. (원래 팩트 서술 — 그대로)
 * 2. 신고가성 상승 — 후보(pctVsPrev 내림차순)를 돌며 문구 사다리 첫 매치:
 *    ① 최근 1년 최고가(maxKrw) 갱신 ② 두 달(폴링창) 내 최고가 ③ 직전 거래 대비
 *    ④ 비교 팩트 없음 → 이 후보 스킵, 다음 후보/다음 rung.
 * 3. 오늘의 최고가: major[0].
 * 4. 폴백: "판을 흔든 거래는 없었다".
 */
export function pickHeadline(opts: {
  major: MajorItem[];
  nerf: PatchItem[];
  /** 폴백 문구용 — 오늘 공개(신규 확인) 건수. */
  newDealCount: number;
  /** 기준일 YYYY-MM-DD — 신축 판정 기준연도. */
  todayISO: string;
}): HeadlineResult {
  const cands = headlineCandidates(opts);
  if (cands.length > 0) {
    const { kind, text } = cands[0];
    return { kind, text };
  }
  // 4) 폴백 — "시세" 단어 화면 노출 금지.
  return {
    kind: "none",
    text: `오늘 공개 ${opts.newDealCount.toLocaleString("ko-KR")}건 — 판을 흔든 거래는 없었다`,
  };
}

// ── 헤드라인 묶음 — 톱 1 + 세그먼트 서브 3 (v2.3) ─────────────────────────────

export type HeadlineSegmentLabel = "서울" | "경기·인천" | "9억 이하";

export interface SubHeadline {
  label: HeadlineSegmentLabel;
  kind: HeadlineResult["kind"];
  text: string;
}

export interface HeadlinesResult {
  top: HeadlineResult;
  /** 세그먼트 서브 — 팩트 후보가 없는 세그먼트는 생략(0~3개). */
  subs: SubHeadline[];
}

/** [9억 이하] 세그먼트 가격 문턱(원) — priceKrw < 9억. */
export const HEADLINE_SUB_CHEAP_MAX_KRW = 900_000_000;

/**
 * 톱 1 + 서브 3 — 톱은 기존 전체 사다리(pickHeadline과 동일), 서브는 세그먼트별
 * 사다리: [서울](LAWD 코드 11*) · [경기·인천](그 외) · [9억 이하](priceKrw < 9억).
 * 세그먼트 1픽이 톱 "또는 앞선 서브"와 동일 아이템이면 차순위 후보, 없으면 그 서브 생략
 * (v2.5 — [경기·인천]과 [9억 이하]에 같은 거래가 중복 게재되던 문제 수정).
 */
export function pickHeadlines(opts: {
  major: MajorItem[];
  nerf: PatchItem[];
  newDealCount: number;
  todayISO: string;
}): HeadlinesResult {
  const { major, nerf, todayISO } = opts;
  const all = headlineCandidates({ major, nerf, todayISO });
  const topCand = all.length > 0 ? all[0] : null;
  const top: HeadlineResult = topCand
    ? { kind: topCand.kind, text: topCand.text }
    : pickHeadline(opts); // 후보 0 → 기존 "판을 흔든 거래는 없었다" 폴백

  const segments: { label: HeadlineSegmentLabel; pred: (i: { sigungu: string; priceKrw: number }) => boolean }[] = [
    { label: "서울", pred: (i) => SEOUL_SIGUNGU.has(i.sigungu) },
    { label: "경기·인천", pred: (i) => !SEOUL_SIGUNGU.has(i.sigungu) },
    { label: "9억 이하", pred: (i) => i.priceKrw < HEADLINE_SUB_CHEAP_MAX_KRW },
  ];

  const subs: SubHeadline[] = [];
  // 이미 실린 아이템(톱 + 앞선 서브) — 같은 거래가 두 세그먼트에 중복 게재되지 않게.
  const usedKeys = new Set<string>(topCand ? [topCand.itemKey] : []);
  for (const seg of segments) {
    const segCands = headlineCandidates({
      major: major.filter(seg.pred),
      nerf: nerf.filter(seg.pred),
      todayISO,
    });
    // 톱·앞선 서브와 동일 아이템이면 차순위 — 팩트 후보가 바닥나면 이 서브는 생략.
    const pick = segCands.find((c) => !usedKeys.has(c.itemKey));
    if (pick) {
      usedKeys.add(pick.itemKey);
      subs.push({ label: seg.label, kind: pick.kind, text: pick.text });
    }
  }

  return { top, subs };
}
