// 추격판(#19)·격차 게이지(#10) 데이터 — 구별 분기 상위 5%/10% 평단가 5년 시계열.
//
// 구성(2026-07-07 사장 확정): 구별 상위 평단가를 분기 버킷으로 5년, 강남=100 인덱스,
// 역전 마커. "상위 5%"는 그 분기 그 구 유효 거래 평단가(원/㎡)의 P95 컷(상위 5% 진입가).
//
// 편집 헌장: 관측값이지 시세 지수 아님(각주 의무) · 분기·표본 병기 · 하락 실명 랭킹 아님
// (고정 축 시계열 — 줄세우기가 아니라 궤적). 표본 CHASE_MIN_DEALS 미만 분기는 null(인쇄 금지).

export const CHASE_QUARTERS = 21; // 5년(20분기) + 진행 중 당분기
/** 분기·구 최소 표본 — 백분위가 안정되려면 중위보다 훨씬 크게. */
export const CHASE_MIN_DEALS = 30;
/** 인덱스 기준 구 — "강남=100" (사장 확정 구성). */
export const CHASE_BASE_SIGUNGU = "강남구";

export interface RegionChaseTx {
  sigungu: string;
  /** 계약 분기 "YYYY-Qn". */
  yq: string;
  /** 평단가 원/㎡ (priceKrw / area). */
  pricePerM2: number;
}

export interface RegionChaseEntry {
  /** 분기별 상위 5% 진입 평단가(원/㎡). 표본 부족 분기는 null. */
  p95: (number | null)[];
  /** 분기별 상위 10% 진입 평단가. */
  p90: (number | null)[];
  /** 분기별 유효 거래 수(표본 병기용). */
  deals: number[];
}

export interface RegionChaseFile {
  generatedAt: string | null;
  /** 오름차순 "YYYY-Qn" — 모든 entry 배열과 같은 길이·같은 순서. */
  quarters: string[];
  regions: Record<string, RegionChaseEntry>;
}

/** Date → "YYYY-Qn". */
export function yqOf(d: Date): string {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

/** now 포함 최근 n개 분기, 오름차순. */
export function lastQuarters(now: Date, n: number): string[] {
  const out: string[] = [];
  let y = now.getFullYear();
  let q = Math.floor(now.getMonth() / 3) + 1;
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-Q${q}`);
    q -= 1;
    if (q === 0) {
      q = 4;
      y -= 1;
    }
  }
  return out;
}

/** 상위 pct 진입값 — nearest-rank: 내림차순 정렬에서 ceil(n×pct)번째. pct=0.05 → P95 컷. */
export function topCut(values: number[], pct: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => b - a);
  const rank = Math.max(1, Math.ceil(sorted.length * pct));
  return sorted[rank - 1];
}

/** 유효 거래 → 분기 버킷 집계. quarters 밖 거래·미지 분기는 무시. */
export function bucketRegionChase(
  txs: readonly RegionChaseTx[],
  quarters: readonly string[],
): Record<string, RegionChaseEntry> {
  const qIdx = new Map(quarters.map((q, i) => [q, i]));
  const pool = new Map<string, number[][]>(); // sigungu → 분기별 평단가 배열
  for (const t of txs) {
    const i = qIdx.get(t.yq);
    if (i === undefined || !(t.pricePerM2 > 0)) continue;
    let arr = pool.get(t.sigungu);
    if (!arr) {
      arr = quarters.map(() => []);
      pool.set(t.sigungu, arr);
    }
    arr[i].push(t.pricePerM2);
  }
  const regions: Record<string, RegionChaseEntry> = {};
  for (const sigungu of [...pool.keys()].sort((a, b) => a.localeCompare(b, "ko"))) {
    const arr = pool.get(sigungu)!;
    const deals = arr.map((v) => v.length);
    // 유효 분기(표본 충족) 2개 미만이면 시계열로 무의미 — 파일에서 생략.
    if (deals.filter((n) => n >= CHASE_MIN_DEALS).length < 2) continue;
    regions[sigungu] = {
      p95: arr.map((v) => (v.length >= CHASE_MIN_DEALS ? topCut(v, 0.05) : null)),
      p90: arr.map((v) => (v.length >= CHASE_MIN_DEALS ? topCut(v, 0.1) : null)),
      deals,
    };
  }
  return regions;
}

/** 강남=100 인덱스 — 각 분기의 (구 p95 ÷ 기준구 p95)×100. 어느 한쪽 null이면 null. */
export function chaseIndex(
  file: RegionChaseFile,
  sigungu: string,
  base: string = CHASE_BASE_SIGUNGU,
): (number | null)[] | null {
  const me = file.regions[sigungu];
  const b = file.regions[base];
  if (!me || !b) return null;
  return me.p95.map((v, i) => {
    const bv = b.p95[i];
    if (v == null || bv == null || bv <= 0) return null;
    return Math.round((v / bv) * 1000) / 10; // 소수 1자리
  });
}

export interface ChaseBoardRow {
  sigungu: string;
  /** 강남=100 인덱스 시계열(quarters 순서) — 차트용. */
  index: (number | null)[];
  /** 최신 유효 인덱스와 그 분기 위치 — 게이지용. */
  latest: number;
  latestQi: number;
  /** 창 안 최초 유효 인덱스와 그 분기 위치 — "5년 전 → 지금" 궤적용. */
  first: number;
  firstQi: number;
  /** latest − first (양수 = 추격, 음수 = 벌어짐). */
  delta: number;
}

export interface ChaseBoard {
  /** 기준 구(강남=100). */
  base: string;
  /** 게이지 행 — 최신 인덱스 내림차순(강남과 격차가 좁은 순), 기계적 선정. */
  rows: ChaseBoardRow[];
  /** 창 안 delta 최대 구(추격폭 1위) — rows 밖이어도 병기. 유효 2분기 미만이면 null. */
  topClimber: ChaseBoardRow | null;
}

/** 월요 분석면 보드 — 기준 구 제외 전 구의 인덱스를 계산해 최신값 상위 n개를 뽑는다.
 *  선정은 전부 기계 규칙(편집 헌장: 편파 시비 차단) — 최신 분기 인덱스 내림차순. */
export function buildChaseBoard(file: RegionChaseFile, n: number): ChaseBoard | null {
  if (!file.generatedAt || !file.regions[CHASE_BASE_SIGUNGU]) return null;
  const rows: ChaseBoardRow[] = [];
  for (const sigungu of Object.keys(file.regions)) {
    if (sigungu === CHASE_BASE_SIGUNGU) continue;
    const index = chaseIndex(file, sigungu);
    if (!index) continue;
    let latestQi = -1;
    let firstQi = -1;
    for (let i = 0; i < index.length; i++) {
      if (index[i] == null) continue;
      if (firstQi === -1) firstQi = i;
      latestQi = i;
    }
    // 궤적이 성립하려면 서로 다른 두 분기의 유효 인덱스가 필요.
    if (firstQi === -1 || latestQi === firstQi) continue;
    const latest = index[latestQi]!;
    const first = index[firstQi]!;
    rows.push({
      sigungu,
      index,
      latest,
      latestQi,
      first,
      firstQi,
      delta: Math.round((latest - first) * 10) / 10,
    });
  }
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.latest - a.latest || a.sigungu.localeCompare(b.sigungu, "ko"));
  const topClimber = [...rows].sort(
    (a, b) => b.delta - a.delta || a.sigungu.localeCompare(b.sigungu, "ko"),
  )[0];
  return { base: CHASE_BASE_SIGUNGU, rows: rows.slice(0, n), topClimber };
}

export interface OvertakeMark {
  /** 추월이 확인된 분기(양쪽 유효 관측). */
  quarter: string;
  /** 추월한 구 / 추월당한 구. */
  passer: string;
  passed: string;
}

/** 역전 마커 — 두 구의 p95 우열이 뒤집힌 분기(양 분기 모두 양쪽 관측 있을 때만). */
export function findOvertakes(
  file: RegionChaseFile,
  a: string,
  b: string,
): OvertakeMark[] {
  const ea = file.regions[a];
  const eb = file.regions[b];
  if (!ea || !eb) return [];
  const out: OvertakeMark[] = [];
  let prevSign: number | null = null;
  for (let i = 0; i < file.quarters.length; i++) {
    const va = ea.p95[i];
    const vb = eb.p95[i];
    if (va == null || vb == null || va === vb) continue;
    const sign = va > vb ? 1 : -1;
    if (prevSign !== null && sign !== prevSign) {
      out.push({
        quarter: file.quarters[i],
        passer: sign === 1 ? a : b,
        passed: sign === 1 ? b : a,
      });
    }
    prevSign = sign;
  }
  return out;
}
