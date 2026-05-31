// (지역 × 가격대) 반복매매 추세 지수 — 묵은/얇은 단지의 추정 현재가를 데이터 시점에서
// "지금"으로 시점 보정한다.
//
// WHY repeat-sales: 단순 월중위 ㎡단가는 "그 달에 어떤 단지가 거래됐냐"(구성 편차)로
// 출렁여 추세로 쓸 수 없다. 같은 (단지×평형)이 두 달 모두 거래된 것끼리 가격비를 모아
// 중위를 취하면 구성 편차가 제거된 깨끗한 추세가 나온다.
//
// WHY 가격대 분리(3극화, 2026~): 초고가(30억+)는 조정, 중가는 키맞추기 상승, 저가는 정체로
// 가격대별 추세가 다르다. 단일 지역 추세를 곱하면 상승 중가를 끌어내리거나 정체 저가를
// 끌어올려 더 틀린다. 그래서 (시군구 × 가격대)로 쪼개고, 표본 부족 시 (수도권 × 가격대)로
// 폴백한다.
//
// 데이터는 scripts/build-trend-index.ts 가 Neon 실데이터로 구워 trendIndex.json 으로 둔다.
// 비어 있으면(미생성) 모든 보정이 ×1 로 degrade — 앱은 그대로 동작한다.

import rawData from "@/data/trendIndex.json";

// 4단(2026-05-31): mid(10~30억)가 게임·시점보정에 너무 넓어 10억대/20억대로 분할.
// low <10억 · mid1 10~20억(10억대) · mid2 20~30억(20억대) · high 30억+.
export type PriceTier = "low" | "mid1" | "mid2" | "high";

export interface TrendSeries {
  /** month("YYYY-MM") → 연쇄 지수값(시리즈 첫 달 = 100). 모든 month 채워짐(거래 없는 달은 carry-forward). */
  index: Record<string, number>;
}

export interface TrendIndexData {
  generatedAt: string;
  /** 정렬된 month 목록. */
  months: string[];
  /** 가장 최근 month. 브리지의 기본 도착 시점. */
  latestMonth: string;
  /** key = `${scope}|${tier}` (scope = 시군구명 또는 "수도권"). */
  series: Record<string, TrendSeries>;
}

const data = rawData as TrendIndexData;

/** 전체(수도권) 폴백 scope 라벨 — 빌드 스크립트와 공유. */
export const ALL_SCOPE = "수도권";

// 가격대 경계 (원). 4단: <10억 / 10~20억 / 20~30억 / 30억+.
export const TIER_LOW_MAX = 1_000_000_000; // 10억
export const TIER_MID_SPLIT = 2_000_000_000; // 20억 — mid1/mid2 분할점
export const TIER_HIGH_MIN = 3_000_000_000; // 30억

// 브리지 계수 클램프 — 1년 보정이라도 ±폭 제한(이상치·표본오차로 인한 폭주 방지).
const BRIDGE_MIN = 0.8;
const BRIDGE_MAX = 1.25;

export function tierOf(priceKrw: number): PriceTier {
  if (priceKrw < TIER_LOW_MAX) return "low"; // <10억
  if (priceKrw < TIER_MID_SPLIT) return "mid1"; // 10~20억
  if (priceKrw < TIER_HIGH_MIN) return "mid2"; // 20~30억
  return "high"; // 30억+
}

/** 지수가 비었는지(미생성). 비면 모든 보정 ×1. */
export function isTrendIndexEmpty(): boolean {
  return data.months.length === 0 || Object.keys(data.series).length === 0;
}

/** 브리지 도착 시점(가장 최근 month). 데이터 없으면 빈 문자열. */
export function trendLatestMonth(): string {
  return data.latestMonth;
}

/** 정렬된 month 목록(촉 게임 출제용). */
export function trendMonths(): string[] {
  return data.months;
}

/** 전체 series 키 목록(`${scope}|${tier}`). */
export function trendSeriesKeys(): string[] {
  return Object.keys(data.series);
}

/** 키로 series 조회. 없으면 undefined. */
export function getTrendSeries(key: string): TrendSeries | undefined {
  return data.series[key];
}

/** 시리즈에서 month 의 지수값을 읽되, 범위를 벗어나면 양끝으로 클램프. */
function valueAt(series: TrendSeries, month: string): number | null {
  const direct = series.index[month];
  if (direct !== undefined) return direct;
  // months 범위 밖이면 첫/끝 값으로 클램프.
  const keys = Object.keys(series.index).sort();
  if (keys.length === 0) return null;
  if (month < keys[0]) return series.index[keys[0]];
  if (month > keys[keys.length - 1]) return series.index[keys[keys.length - 1]];
  // 중간 결손(이론상 없음) — 가장 가까운 이전 달.
  let best: string | null = null;
  for (const k of keys) {
    if (k <= month) best = k;
    else break;
  }
  return best ? series.index[best] : series.index[keys[0]];
}

/** 브리지 계수를 [BRIDGE_MIN, BRIDGE_MAX] 로 클램프. */
export function clampBridge(factor: number): number {
  return Math.min(BRIDGE_MAX, Math.max(BRIDGE_MIN, factor));
}

/** 한 시리즈 내 fromMonth → toMonth 보정 계수(범위 클램프 포함). 순수 함수. */
export function bridgeWithinSeries(
  series: TrendSeries,
  fromMonth: string,
  toMonth: string,
): number {
  if (fromMonth === toMonth) return 1;
  const from = valueAt(series, fromMonth);
  const to = valueAt(series, toMonth);
  if (from === null || to === null || from <= 0) return 1;
  return clampBridge(to / from);
}

/**
 * (시군구, 가격대)의 fromMonth → toMonth 시점 보정 계수.
 * 폴백 사다리: 시군구×tier → 수도권×tier → ×1. 결과는 [BRIDGE_MIN, BRIDGE_MAX] 클램프.
 */
export function bridgeFactor(
  sigungu: string,
  tier: PriceTier,
  fromMonth: string,
  toMonth: string,
): number {
  if (isTrendIndexEmpty() || !fromMonth || !toMonth || fromMonth === toMonth) {
    return 1;
  }
  const series =
    data.series[`${sigungu}|${tier}`] ?? data.series[`${ALL_SCOPE}|${tier}`];
  if (!series) return 1;
  return bridgeWithinSeries(series, fromMonth, toMonth);
}

/** 가장 최근 month 기준 n개월 전 month. 데이터 부족 시 null. */
export function monthsAgo(n: number): string | null {
  const m = data.months;
  if (m.length === 0) return null;
  const idx = m.length - 1 - n;
  return idx >= 0 ? m[idx] : null;
}

export interface TierTrend {
  /** 최근 windowMonths 개월 변동률(소수, 예 0.021 = +2.1%). 과거 사실 — 미래 예측 아님. */
  changeRatio: number;
  /** 실제 사용된 scope("강남구" 등 시군구 또는 "수도권" 폴백). */
  scope: string;
  tier: PriceTier;
  fromMonth: string;
  toMonth: string;
}

// 표시용 추세는 클램프하지 않되, 데이터 노이즈로 보이는 극단치(3개월 ±50% 초과)는 숨긴다.
const TREND_SANITY = 0.5;

/**
 * (시군구, 가격대)의 최근 windowMonths 개월 실거래 추세 변동률(표시용, 과거 사실).
 * 폴백: 시군구×tier → 수도권×tier. 데이터 부족·시리즈 없음·극단치면 null(→ UI 숨김).
 * 컴플라이언스: 과거 실거래 지수 변동일 뿐 미래가치 예측·투자권유 아님.
 */
export function tierTrend(
  sigungu: string,
  tier: PriceTier,
  windowMonths = 3,
): TierTrend | null {
  if (isTrendIndexEmpty()) return null;
  const toMonth = data.latestMonth;
  const fromMonth = monthsAgo(windowMonths);
  if (!fromMonth || !toMonth || fromMonth === toMonth) return null;
  const useSigungu = data.series[`${sigungu}|${tier}`] != null;
  const series =
    data.series[`${sigungu}|${tier}`] ?? data.series[`${ALL_SCOPE}|${tier}`];
  if (!series) return null;
  const from = valueAt(series, fromMonth);
  const to = valueAt(series, toMonth);
  if (from === null || to === null || from <= 0) return null;
  const changeRatio = to / from - 1;
  if (Math.abs(changeRatio) > TREND_SANITY) return null;
  return {
    changeRatio,
    scope: useSigungu ? sigungu : ALL_SCOPE,
    tier,
    fromMonth,
    toMonth,
  };
}
