import { db } from "@/lib/db";
import { bridgeFactor, tierOf, trendLatestMonth } from "./trendIndex";

export interface AreaMedian {
  area: number;
  /**
   * 추정 현재가 (원). 최근 6개월 실거래의 "최근 거래 가중 중위값 × 추세 계수".
   * 단순 중위가가 아니라 "지금 거래될 가격" 추정 — 부동산 전문가 패널 권고.
   */
  medianKrw: number;
  /**
   * 추정 현재가 범위 하단 (원). 최근 거래의 분위/최저. 신축 입주장처럼 같은 평형이
   * 층·향 따라 크게 벌어지는 단지의 "정직한 폭"을 점추정 대신 보여주기 위한 값.
   */
  priceLow: number;
  /** 추정 현재가 범위 상단 (원). 최근 거래의 분위/최고. */
  priceHigh: number;
  /** 데이터 유효시점 month("YYYY-MM") — 추세 시점 보정의 출발점. */
  midpointMonth: string;
  /** 최근 6개월 거래 건수 — 가격 신뢰도 지표. */
  count: number;
  /**
   * 가격 변동계수(CV = 표준편차/평균). 낮을수록 가격이 안정적(환금성·예측가능성↑).
   * 표본 2건 미만이면 0(중립). 기본 가점에서 "안정성"으로 살짝 반영된다.
   */
  volatility: number;
  /**
   * 최근 6개월 거래가 부족해 12개월까지 넓혀 산출한 경우 true(거래 적음·참고용).
   * 신축/등기 직후 등 거래가 드문 단지를 살리기 위한 폴백.
   */
  sparse: boolean;
  /**
   * 단지 내 다른 평형 대비 ㎡당 단가가 비정상(역전·극단치)이라 신뢰도가 낮음.
   * 대표 평형 선택에서 제외된다 (C-1: 플래그만, 가격 보정은 하지 않음).
   */
  lowConfidence: boolean;
}

const WINDOW_MONTHS = 6;
// 거래 적은 단지 폴백: 6개월 거래가 FALLBACK_MIN_TX 미만이면 12개월까지 넓혀 산출.
const FALLBACK_WINDOW_MONTHS = 12;
const FALLBACK_MIN_TX = 8;
const SIX_MONTHS_DAYS = WINDOW_MONTHS * 30.4;
// 최근 거래일수록 무겁게: w = exp(-LAMBDA * daysAgo). 약 140일 반감기.
const LAMBDA = 0.005;
// 추세 계수 클램프 — 과보정 방지.
const TREND_MIN = 0.9;
const TREND_MAX = 1.12;

// ── 얇은표본 보정 (A) ──
// 거래가 THIN_SAMPLE_MAX 건 이하인 평형은 가중중위값이 "최근 고가"를 묻어버린다.
// 신축 입주장에선 같은 평형이 같은 주에도 층·향 따라 4~5억씩 벌어지는데, 중위값은
// 가운데 한 건(흔히 저층·초기 등기분)을 골라 시세를 과소평가 → 저예산 유저에게
// 비싼 단지를 과노출시킨다. 그래서 "최근분기 최고 실거래" 쪽으로 ALPHA 만큼 보수적으로
// 끌어올린다. 단, 최근가가 추정가보다 높을 때만 — 하락 단지를 과대평가하지 않는다.
const THIN_SAMPLE_MAX = 7;
const THIN_LIFT_ALPHA = 0.4;
// 표시용 가격범위: 표본이 작으면(≤SMALL_POOL_MAX) 최저~최고 그대로, 크면 분위로 트림.
const SMALL_POOL_MAX = 5;
const RANGE_LOW_Q = 0.1;
const RANGE_HIGH_Q = 0.9;

// ── 평형 간 ㎡당 단가 교차검증 (C-1) ──
// 신뢰표본(거래 N건 이상)들의 ㎡당 단가를 기준으로, 빈약표본 평형의 단가가
// [LOW, HIGH] 배수를 벗어나면(역전·극단치) 신뢰도 낮음으로 표시한다.
const CROSS_RELIABLE_COUNT = 5;
const CROSS_LOW_RATIO = 0.7;
const CROSS_HIGH_RATIO = 1.5;

/** 가중 중위값 — 가격 오름차순 정렬 후 누적 가중치가 절반을 넘는 가격. */
function weightedMedian(items: { price: number; weight: number }[]): number {
  if (items.length === 0) return 0;
  const sorted = [...items].sort((a, b) => a.price - b.price);
  const totalW = sorted.reduce((s, it) => s + it.weight, 0);
  let cum = 0;
  for (const it of sorted) {
    cum += it.weight;
    if (cum >= totalW / 2) return it.price;
  }
  return sorted[sorted.length - 1].price;
}

/** 분위수(선형보간). q∈[0,1]. 빈 배열이면 0. */
function percentile(prices: number[], q: number): number {
  if (prices.length === 0) return 0;
  const s = [...prices].sort((a, b) => a - b);
  if (s.length === 1) return s[0];
  const idx = q * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  return s[lo] + (idx - lo) * (s[hi] - s[lo]);
}

/** Date → "YYYY-MM" (UTC). 빌드 스크립트 monthKey 와 동일 규칙. */
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface Tx {
  price: number;
  daysAgo: number;
}

export interface PriceEstimate {
  /** 추정 현재가(원). */
  price: number;
  /** 표시용 범위 하단(원). */
  low: number;
  /** 표시용 범위 상단(원). */
  high: number;
  /**
   * 데이터의 "유효 시점" — 거래일들의 최근가중 평균 daysAgo. 시점 보정(추세 지수)의
   * 출발점을 잡는 데 쓴다. 최근 거래가 많을수록 작다(=지금에 가깝다).
   */
  midpointDaysAgo: number;
}

function decayWeight(daysAgo: number): number {
  return Math.exp(-LAMBDA * daysAgo);
}

/** 가격 변동계수(CV = 표준편차/평균). 표본 2건 미만이면 0(중립). */
function priceVolatility(txs: Tx[]): number {
  if (txs.length < 2) return 0;
  const prices = txs.map((t) => t.price);
  const mean = prices.reduce((s, p) => s + p, 0) / prices.length;
  if (mean <= 0) return 0;
  const variance =
    prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length;
  return Math.sqrt(variance) / mean;
}

/** 한 평형 그룹의 거래들로 추정 현재가와 표시용 범위를 산출한다. */
export function estimateCurrentPrice(txs: Tx[]): PriceEstimate {
  if (txs.length === 0)
    return { price: 0, low: 0, high: 0, midpointDaysAgo: 0 };

  // 1. 최근 거래 가중 중위값
  const base = weightedMedian(
    txs.map((t) => ({ price: t.price, weight: decayWeight(t.daysAgo) })),
  );

  const recent = txs.filter((t) => t.daysAgo <= 90);
  const older = txs.filter((t) => t.daysAgo > 90);

  // 최근 분기(≤90일) 가중중위 — 추세 계산과 하한 가드에 공통으로 쓴다.
  const recentMed =
    recent.length > 0
      ? weightedMedian(
          recent.map((t) => ({ price: t.price, weight: decayWeight(t.daysAgo) })),
        )
      : 0;

  // 2. 추세 계수 — 최근 3개월 vs 직전 3개월. 단, 양쪽 모두 4건 이상일 때만 적용.
  // 2~3건 표본은 가중중위가 사실상 한 거래값이라(이상치 한 건이 추세를 좌우)
  // 멀쩡한 base 를 왜곡한다 — 그런 경우 추세를 적용하지 않는다.
  let trend = 1;
  if (recent.length >= 4 && older.length >= 4) {
    const olderMed = weightedMedian(
      older.map((t) => ({ price: t.price, weight: decayWeight(t.daysAgo) })),
    );
    if (olderMed > 0) {
      trend = Math.min(TREND_MAX, Math.max(TREND_MIN, recentMed / olderMed));
    }
  }

  let estimated = Math.round(base * trend);

  // 3. 하한 가드 — 최근 분기 표본이 충분(3건 이상)하면 추정가가 그 가중중위값보다
  // 낮아지지 않게 막는다. 추세계수가 base 를 최근 실거래 밑으로 끌어내리는 오류 방지.
  if (recent.length >= 3 && recentMed > 0) {
    estimated = Math.max(estimated, Math.round(recentMed));
  }

  // 4. 얇은표본 보정 — 최근분기 최고 실거래 쪽으로 보수 보정(저예산 과노출 방지).
  // 최근가가 추정가보다 높을 때만 끌어올린다. 하락 단지는 최근가가 낮으므로 보정 안 됨.
  if (txs.length <= THIN_SAMPLE_MAX) {
    const pool =
      recent.length > 0
        ? recent
        : [...txs].sort((a, b) => a.daysAgo - b.daysAgo).slice(0, 3);
    const recentMax = Math.max(...pool.map((t) => t.price));
    if (recentMax > estimated) {
      estimated = Math.round(estimated + THIN_LIFT_ALPHA * (recentMax - estimated));
    }
  }

  // 5. 표시용 범위 — 최근 거래(2건↑이면 최근, 아니면 전체)의 최저~최고 또는 분위.
  const rangePool = (recent.length >= 2 ? recent : txs).map((t) => t.price);
  let low: number;
  let high: number;
  if (rangePool.length <= SMALL_POOL_MAX) {
    low = Math.min(...rangePool);
    high = Math.max(...rangePool);
  } else {
    low = Math.round(percentile(rangePool, RANGE_LOW_Q));
    high = Math.round(percentile(rangePool, RANGE_HIGH_Q));
  }

  // 데이터 유효시점 — 거래일들의 최근가중 평균 daysAgo.
  const wsum = txs.reduce((s, t) => s + decayWeight(t.daysAgo), 0);
  const midpointDaysAgo =
    wsum > 0
      ? txs.reduce((s, t) => s + t.daysAgo * decayWeight(t.daysAgo), 0) / wsum
      : 0;

  return {
    price: estimated,
    // 범위가 점추정을 항상 감싸도록 보정(보정으로 estimated 가 high 를 넘지 않게).
    low: Math.min(low, estimated),
    high: Math.max(high, estimated),
    midpointDaysAgo,
  };
}

/**
 * 단지 내 평형들의 ㎡당 단가를 교차검증해 비정상 평형을 표시한다 (C-1: 플래그만).
 * 신뢰표본(거래 CROSS_RELIABLE_COUNT 건 이상)이 2개 이상일 때만 동작한다. 그 신뢰표본들의
 * ㎡당 단가(count 가중 중위)를 기준으로, 빈약표본 평형이 [LOW, HIGH] 배수를 벗어나면
 * lowConfidence = true 로 표시한다. 가격을 보정하지는 않는다.
 */
export function flagLowConfidence(medians: AreaMedian[]): void {
  const reliable = medians.filter(
    (m) => m.count >= CROSS_RELIABLE_COUNT && m.area > 0 && m.medianKrw > 0,
  );
  if (reliable.length < 2) return;

  const refPerM2 = weightedMedian(
    reliable.map((m) => ({ price: m.medianKrw / m.area, weight: m.count })),
  );
  if (refPerM2 <= 0) return;

  for (const m of medians) {
    // 신뢰표본은 데이터가 두꺼우므로 그대로 신뢰 (프리미엄/할인일 수 있음).
    if (m.count >= CROSS_RELIABLE_COUNT || m.area <= 0 || m.medianKrw <= 0) continue;
    const ratio = m.medianKrw / m.area / refPerM2;
    if (ratio < CROSS_LOW_RATIO || ratio > CROSS_HIGH_RATIO) {
      m.lowConfidence = true;
    }
  }
}

/**
 * 여러 단지의 평형별 추정 현재가를 청크 단위 쿼리로 한 번에 집계한다.
 * 단지별로 N번 쿼리하면 동시 쿼리 폭주로 SQLite 가 막히므로 일괄 처리.
 */
export async function getAreaMediansForMany(
  complexIds: string[],
  sigunguById?: Map<string, string>,
): Promise<Map<string, AreaMedian[]>> {
  // 12개월까지 가져와 두고, 단지별로 6개월이 충분하면 6개월만, 부족하면 12개월을 쓴다.
  const since = new Date();
  since.setMonth(since.getMonth() - FALLBACK_WINDOW_MONTHS);
  const now = Date.now();
  // 추세 시점 보정 도착 시점. sigunguById 가 주어지고 지수가 있을 때만 보정한다.
  const latestMonth = sigunguById ? trendLatestMonth() : "";

  const CHUNK = 400;
  // complexId → (area → Tx[])
  const byComplex = new Map<string, Map<number, Tx[]>>();

  for (let i = 0; i < complexIds.length; i += CHUNK) {
    const ids = complexIds.slice(i, i + CHUNK);
    const rows = await db.transaction.findMany({
      where: { complexId: { in: ids }, dealDate: { gte: since } },
      select: { complexId: true, area: true, priceKrw: true, dealDate: true },
    });
    for (const row of rows) {
      let areaGroups = byComplex.get(row.complexId);
      if (!areaGroups) {
        areaGroups = new Map<number, Tx[]>();
        byComplex.set(row.complexId, areaGroups);
      }
      // 평형 버킷은 1㎡ 단위 내림으로 묶는다 — 같은 타입(예: 전용 59.84·59.98㎡)이
      // 0.1㎡ 차이로 쪼개지는 것을 막고, 전용면적 타입 표기(예: 84.6㎡ → "84㎡")와
      // 평수대 필터(>= min && < max)에 모두 맞는다.
      const key = Math.floor(row.area);
      const list = areaGroups.get(key) ?? [];
      list.push({
        price: Number(row.priceKrw),
        daysAgo: (now - row.dealDate.getTime()) / 86_400_000,
      });
      areaGroups.set(key, list);
    }
  }

  const result = new Map<string, AreaMedian[]>();
  for (const [complexId, areaGroups] of byComplex) {
    // 6개월 거래가 충분하면 6개월만, 부족하면 12개월 전체로 폴백(sparse).
    let recent6Total = 0;
    for (const txs of areaGroups.values()) {
      recent6Total += txs.filter((t) => t.daysAgo <= SIX_MONTHS_DAYS).length;
    }
    const useFallback = recent6Total < FALLBACK_MIN_TX;

    const medians: AreaMedian[] = [];
    for (const [area, txs12] of areaGroups) {
      const txs = useFallback
        ? txs12
        : txs12.filter((t) => t.daysAgo <= SIX_MONTHS_DAYS);
      if (txs.length === 0) continue;
      const est = estimateCurrentPrice(txs);
      const midpointMonth = monthKey(new Date(now - est.midpointDaysAgo * 86_400_000));

      // 시점 보정 — 데이터 유효시점(midpointMonth) → 최신월. 가격대(tier)는 보정 전
      // 추정가 기준. 점추정·범위에 같은 계수를 곱해 일관성 유지.
      let factor = 1;
      const sigungu = sigunguById?.get(complexId);
      if (latestMonth && sigungu) {
        factor = bridgeFactor(sigungu, tierOf(est.price), midpointMonth, latestMonth);
      }

      medians.push({
        area,
        medianKrw: Math.round(est.price * factor),
        priceLow: Math.round(est.low * factor),
        priceHigh: Math.round(est.high * factor),
        midpointMonth,
        count: txs.length,
        volatility: priceVolatility(txs),
        sparse: useFallback,
        lowConfidence: false,
      });
    }
    flagLowConfidence(medians);
    result.set(
      complexId,
      medians.sort((a, b) => b.count - a.count),
    );
  }
  return result;
}

/**
 * 거래 표본이 가장 두꺼운 평형(대표 평형)을 반환한다.
 * [minArea, maxArea) 전용면적 구간 안의 평형만 후보로 본다.
 *
 * [P1 최소 거래건수] minCount 미만인 평형은 가격 신뢰도가 낮으므로 후보에서 제외한다.
 * 기본값 3건 — 1~2건 표본으로는 이상값 한 건이 대표가 될 수 있음.
 * 조건을 만족하는 평형이 없으면 null (해당 단지는 추천에서 제외).
 */
export function pickRepresentative(
  medians: AreaMedian[],
  minArea: number = 0,
  maxArea: number = Number.POSITIVE_INFINITY,
  minCount: number = 3,
): AreaMedian | null {
  const eligible = medians.filter(
    (m) =>
      m.area >= minArea &&
      m.area < maxArea &&
      m.count >= minCount &&
      !m.lowConfidence,
  );
  // getAreaMediansForMany 가 count 내림차순으로 정렬해 반환하므로 [0] = 최다 거래 평형
  return eligible.length > 0 ? eligible[0] : null;
}
