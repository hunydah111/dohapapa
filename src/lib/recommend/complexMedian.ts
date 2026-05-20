import { db } from "@/lib/db";

export interface AreaMedian {
  area: number;
  /**
   * 추정 현재가 (원). 최근 6개월 실거래의 "최근 거래 가중 중위값 × 추세 계수".
   * 단순 중위가가 아니라 "지금 거래될 가격" 추정 — 부동산 전문가 패널 권고.
   */
  medianKrw: number;
  /** 최근 6개월 거래 건수 — 가격 신뢰도 지표. */
  count: number;
  /**
   * 단지 내 다른 평형 대비 ㎡당 단가가 비정상(역전·극단치)이라 신뢰도가 낮음.
   * 대표 평형 선택에서 제외된다 (C-1: 플래그만, 가격 보정은 하지 않음).
   */
  lowConfidence: boolean;
}

const WINDOW_MONTHS = 6;
// 최근 거래일수록 무겁게: w = exp(-LAMBDA * daysAgo). 약 140일 반감기.
const LAMBDA = 0.005;
// 추세 계수 클램프 — 과보정 방지.
const TREND_MIN = 0.9;
const TREND_MAX = 1.12;

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

interface Tx {
  price: number;
  daysAgo: number;
}

function decayWeight(daysAgo: number): number {
  return Math.exp(-LAMBDA * daysAgo);
}

/** 한 평형 그룹의 거래들로 추정 현재가를 산출한다. */
function estimateCurrentPrice(txs: Tx[]): number {
  if (txs.length === 0) return 0;

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

  return estimated;
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
): Promise<Map<string, AreaMedian[]>> {
  const since = new Date();
  since.setMonth(since.getMonth() - WINDOW_MONTHS);
  const now = Date.now();

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
    const medians: AreaMedian[] = [];
    for (const [area, txs] of areaGroups) {
      medians.push({
        area,
        medianKrw: estimateCurrentPrice(txs),
        count: txs.length,
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
