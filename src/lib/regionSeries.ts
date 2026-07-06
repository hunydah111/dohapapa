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

// ── y축 가격 눈금 (v2.4 — 세로축에 가격 눈금이 없으면 선의 높이가 의미 불명) ────────
/** 눈금 스텝 사다리 — 전부 5천만의 배수("깔끔한" 억 단위 눈금: 14억 / 14.5억 / 15억…).
 *  DailyFront TempTrendChart의 동적 도메인(±패딩·스냅)과 같은 사상, 단위만 원화. */
export const PRICE_TICK_STEPS = [
  50_000_000, 100_000_000, 200_000_000, 500_000_000,
  1_000_000_000, 2_000_000_000, 5_000_000_000,
] as const;

export interface PriceAxis {
  /** 차트 y 도메인(원) — 관측 min/max ± 여유. */
  domainMin: number;
  domainMax: number;
  /** 도메인 안의 눈금(원, 오름차순) — 항상 2~3개, 전부 step의 배수. */
  ticks: number[];
}

/**
 * 관측 중위 min/max → 동적 y축. 규칙:
 *  - 스텝 = (범위+양쪽 8% 패딩)/2.5 를 사다리에서 올림 스냅 → 눈금 최대 3개 보장.
 *  - 패딩 ≥ 스텝×0.3 — 선이 눈금선에 붙어 안 뭉개지게.
 *  - 눈금이 2개 미만이면(평평한 구간 등) 도메인을 반 스텝씩 확장 — 2개 보장.
 * 입력이 비정상(min>max, ≤0)이면 null — 호출부가 축 없이 렌더(기존 폴백).
 */
export function priceAxis(minKrw: number, maxKrw: number): PriceAxis | null {
  if (!(minKrw > 0) || !(maxKrw >= minKrw)) return null;
  const span = Math.max(maxKrw - minKrw, 1);
  const rawStep = (span * 1.16) / 2.5;
  const step =
    PRICE_TICK_STEPS.find((s) => s >= rawStep) ??
    PRICE_TICK_STEPS[PRICE_TICK_STEPS.length - 1];
  const pad = Math.max(span * 0.08, step * 0.3);
  let lo = Math.max(0, minKrw - pad);
  let hi = maxKrw + pad;
  let t0 = Math.ceil(lo / step) * step;
  let t1 = Math.floor(hi / step) * step;
  // 평평한 구간(단일 관측월 등)은 눈금이 0~1개 — 2개 들어올 때까지 확장(항상 수렴).
  while (t1 < t0 + step) {
    lo = Math.max(0, lo - step / 2);
    hi += step / 2;
    t0 = Math.ceil(lo / step) * step;
    t1 = Math.floor(hi / step) * step;
  }
  const ticks: number[] = [];
  for (let t = t0; t <= t1; t += step) ticks.push(t);
  return { domainMin: lo, domainMax: hi, ticks };
}

// ── 12개월 요약 한 줄 (v2.4) — "관측 중위 A → B (±x%) · 거래 최다 M(N건)" ─────────
export interface RegionSeriesSummary {
  firstYm: string;
  firstKrw: number;
  lastYm: string;
  lastKrw: number;
  /** (last − first) / first — 관측 중위끼리의 변화(시세 지수 아님 — 라벨 의무). */
  pct: number;
  busiestYm: string;
  busiestCount: number;
}

/** 유효(중위가 non-null) 월 2개 미만이면 null — 요약 줄 생략. 거래 최다는 동률 시 최신 월. */
export function regionSeriesSummary(
  months: readonly string[],
  entry: RegionSeriesEntry,
): RegionSeriesSummary | null {
  const valid: number[] = [];
  entry.medianKrw.forEach((v, i) => {
    if (v !== null && i < months.length) valid.push(i);
  });
  if (valid.length < 2) return null;
  const fi = valid[0];
  const li = valid[valid.length - 1];
  const firstKrw = entry.medianKrw[fi]!;
  const lastKrw = entry.medianKrw[li]!;
  let bi = 0;
  entry.counts.forEach((c, i) => {
    if (i < months.length && c >= entry.counts[bi]) bi = i; // ≥ — 동률은 최신 월
  });
  return {
    firstYm: months[fi],
    firstKrw,
    lastYm: months[li],
    lastKrw,
    pct: (lastKrw - firstKrw) / firstKrw,
    busiestYm: months[bi],
    busiestCount: entry.counts[bi],
  };
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
