import { db } from "@/lib/db";

export interface AreaMedian {
  area: number;
  medianKrw: number;
  count: number;
}

/** priceKrw는 BigInt로 반환되므로 Number()로 변환 후 정렬하여 중위값 추출. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * 지정 단지의 최근 windowMonths 개월 실거래를 평형별로 집계하여
 * 각 평형의 중위가(원)와 거래 건수를 반환한다.
 * 거래 건수 내림차순 정렬 — 표본이 두꺼운 평형이 앞에 온다.
 */
export async function getAreaMedians(
  complexId: string,
  windowMonths: number = 12,
): Promise<AreaMedian[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - windowMonths);

  const rows = await db.transaction.findMany({
    where: {
      complexId,
      dealDate: { gte: since },
    },
    select: { area: true, priceKrw: true },
  });

  // area 값은 Float이므로 소수점 1자리 반올림으로 같은 평형끼리 묶는다.
  const groups = new Map<number, number[]>();
  for (const row of rows) {
    const key = Math.round(row.area * 10) / 10;
    const prices = groups.get(key) ?? [];
    prices.push(Number(row.priceKrw));
    groups.set(key, prices);
  }

  const result: AreaMedian[] = [];
  for (const [area, prices] of groups) {
    result.push({ area, medianKrw: median(prices), count: prices.length });
  }

  return result.sort((a, b) => b.count - a.count);
}

/**
 * 거래 표본이 가장 두꺼운 평형(대표 평형)을 반환한다.
 * [minArea, maxArea) 전용면적 구간 안의 평형만 후보로 본다 — 사용자가 고른
 * 선호 평수대 밖의 평형(초소형 원룸·초대형 등)이 대표로 잡히는 것을 막는다.
 * 조건을 만족하는 평형이 없으면 null (해당 단지는 추천에서 제외).
 */
export function pickRepresentative(
  medians: AreaMedian[],
  minArea: number = 0,
  maxArea: number = Number.POSITIVE_INFINITY,
): AreaMedian | null {
  // medians 는 count 내림차순 정렬돼 있으므로 filter 후 첫 번째가 대표.
  const eligible = medians.filter((m) => m.area >= minArea && m.area < maxArea);
  return eligible.length > 0 ? eligible[0] : null;
}

/**
 * 여러 단지의 평형별 중위가를 청크 단위 쿼리로 한 번에 집계한다.
 * 단지별로 getAreaMedians 를 N번 호출하면 N개의 동시 쿼리가 발생해
 * SQLite 가 막히므로, 추천 엔진에서는 이 일괄 버전을 쓴다.
 */
export async function getAreaMediansForMany(
  complexIds: string[],
  windowMonths: number = 12,
): Promise<Map<string, AreaMedian[]>> {
  const since = new Date();
  since.setMonth(since.getMonth() - windowMonths);

  const CHUNK = 400;
  // complexId → (area → prices[])
  const byComplex = new Map<string, Map<number, number[]>>();

  for (let i = 0; i < complexIds.length; i += CHUNK) {
    const ids = complexIds.slice(i, i + CHUNK);
    const rows = await db.transaction.findMany({
      where: { complexId: { in: ids }, dealDate: { gte: since } },
      select: { complexId: true, area: true, priceKrw: true },
    });
    for (const row of rows) {
      let areaGroups = byComplex.get(row.complexId);
      if (!areaGroups) {
        areaGroups = new Map<number, number[]>();
        byComplex.set(row.complexId, areaGroups);
      }
      const key = Math.round(row.area * 10) / 10;
      const prices = areaGroups.get(key) ?? [];
      prices.push(Number(row.priceKrw));
      areaGroups.set(key, prices);
    }
  }

  const result = new Map<string, AreaMedian[]>();
  for (const [complexId, areaGroups] of byComplex) {
    const medians: AreaMedian[] = [];
    for (const [area, prices] of areaGroups) {
      medians.push({ area, medianKrw: median(prices), count: prices.length });
    }
    result.set(
      complexId,
      medians.sort((a, b) => b.count - a.count),
    );
  }
  return result;
}
