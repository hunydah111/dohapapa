// 시군구 월별 실거래 관측 시계열 — 공유 타입 + 순수 집계 함수 (v2.3 동네면).
//
// 생산: scripts/build-region-series.ts (주간 크론 — DB 접근은 크론에서만).
// 소비: src/app/r/[sigungu]/page.tsx (빌드 타임 JSON import — 요청당 DB 읽기 0).
//
// 편집 헌장: 이 시계열은 "실거래 관측값"이다 — 시세 지수가 아니며, 라벨·각주에
// 반드시 "국토부 실거래 관측값(해제·직거래 제외, 평형 혼합 중위)"를 병기한다.
// 평형 혼합 중위인 이유: 시군구 단위 월 표본에서 평형 분리를 하면 대부분의 달이
// 표본 부족으로 비어 버린다 → 혼합 중위 + 각주 명시가 정직한 절충.
//
// 순수 함수 — API·파일 접근 없음. 크론 스크립트와 테스트가 같은 함수를 쓴다.

/** 시계열 월 버킷 수 — 완료월 12 + 당월(집계 중) 1. */
export const REGION_SERIES_MONTHS = 13;
/** 이 미만 표본인 달은 중위가를 인쇄하지 않는다(null — 표본 부족). 거래량 막대는 그대로. */
export const REGION_SERIES_MIN_DEALS = 3;

export interface RegionSeriesEntry {
  /** months[i] 달의 유효 거래(해제·직거래·분양권 제외) 건수. */
  counts: number[];
  /** months[i] 달 유효 거래 전체의 중위가(원, 만원 단위 반올림).
   *  표본 REGION_SERIES_MIN_DEALS 미만이면 null. */
  medianKrw: (number | null)[];
}

export interface RegionSeriesFile {
  /** null = placeholder(첫 주간 갱신 전) — 페이지는 안내 문구로 graceful 처리. */
  generatedAt: string | null;
  /** "YYYY-MM" 오름차순, 길이 REGION_SERIES_MONTHS (placeholder는 []). */
  months: string[];
  regions: Record<string, RegionSeriesEntry>;
}

/** 집계 입력 1건 — 호출부(크론)가 해제·직거래·분양권을 이미 걸러 넘긴다. */
export interface RegionSeriesTx {
  sigungu: string;
  /** "YYYY-MM" (KST 기준 계약월). */
  ym: string;
  priceKrw: number;
}

/** end(당월) 포함 최근 n개월 "YYYY-MM" 오름차순. */
export function lastMonths(end: Date, n: number): string[] {
  const out: string[] = [];
  const y = end.getFullYear();
  const m = end.getMonth(); // 0-based
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** Date → "YYYY-MM" (로컬 TZ — 크론은 TZ=Asia/Seoul 로 실행). */
export function ymOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 만원 단위 반올림 — 파일 크기 억제 + 원 단위 정밀도라는 허위 신호 방지. */
export function roundManwon(krw: number): number {
  return Math.round(krw / 10_000) * 10_000;
}

/** 중위값 — 짝수 표본은 가운데 두 값 평균. 빈 배열은 null. */
export function median(values: number[]): number | null {
  const n = values.length;
  if (n === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * 시군구 × 월 버킷 집계. months 밖의 거래는 무시. 거래가 한 건도 없는 시군구는
 * 결과에서 생략(파일 크기 — 페이지는 없는 시군구를 "주간 갱신부터" 문구로 처리).
 */
export function bucketRegionSeries(
  rows: readonly RegionSeriesTx[],
  months: readonly string[],
): Record<string, RegionSeriesEntry> {
  const idx = new Map(months.map((ym, i) => [ym, i]));
  const pools = new Map<string, number[][]>(); // sigungu → months[i]별 가격 풀
  for (const r of rows) {
    const i = idx.get(r.ym);
    if (i === undefined) continue;
    if (!(r.priceKrw > 0)) continue;
    let pool = pools.get(r.sigungu);
    if (!pool) {
      pool = Array.from({ length: months.length }, () => []);
      pools.set(r.sigungu, pool);
    }
    pool[i].push(r.priceKrw);
  }

  const regions: Record<string, RegionSeriesEntry> = {};
  // 지면 정렬 안정성 — 시군구 가나다순.
  for (const sigungu of [...pools.keys()].sort((a, b) => a.localeCompare(b, "ko"))) {
    const pool = pools.get(sigungu)!;
    const counts = pool.map((p) => p.length);
    if (counts.every((c) => c === 0)) continue;
    const medianKrw = pool.map((p) => {
      if (p.length < REGION_SERIES_MIN_DEALS) return null; // 표본 부족 — 중위가 미인쇄
      const m = median(p);
      return m === null ? null : roundManwon(m);
    });
    regions[sigungu] = { counts, medianKrw };
  }
  return regions;
}

/**
 * 중위가 라인의 연속 구간 분리 — null(표본 부족) 달에서 선을 끊는다.
 * 반환: [{ i(월 인덱스), v(원) }, ...] 구간 배열. 고립 1점 구간도 그대로(점으로 렌더).
 */
export function medianLineSegments(
  medianKrw: readonly (number | null)[],
): { i: number; v: number }[][] {
  const segments: { i: number; v: number }[][] = [];
  let cur: { i: number; v: number }[] = [];
  medianKrw.forEach((v, i) => {
    if (v === null) {
      if (cur.length > 0) segments.push(cur);
      cur = [];
    } else {
      cur.push({ i, v });
    }
  });
  if (cur.length > 0) segments.push(cur);
  return segments;
}
