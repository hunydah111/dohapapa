/**
 * build-region-prices.ts
 *
 * "내 집 마련 플랜" 목표 선택용 — 시군구 × 평형대 가격 분포를 complexSnapshot.json 에서
 * 집계해 src/data/regionPrices.json 으로 굽는다(작음, 커밋).
 *
 * 단순 "평균 한 숫자"는 욕망과 무관한 값(구축·소형·외곽까지 섞임)이라 무의미 → 대신
 * 백분위 기반 3티어(안정 P40 / 균형 P65 / 도전 P85)와 각 티어의 "예시 단지"를 함께 굽는다.
 * 사용자는 동네×평형을 고른 뒤 티어로 "어떤 집을 그리는지"를 고른다(price-first: 품질 라벨을
 * 자체 생성하지 않고 실제 단지명·동·건축년도·시세가 말하게 한다).
 *
 * 가드(부동산 데이터 관점):
 *  - 백분위 풀: lowConfidence·비양수 제외, 단지당 1표(같은 밴드 복수 평형은 거래 많은 쪽).
 *  - 대표단지 이름 표기: 거래 ≥3 · 분양권(presale) 제외 · 재건축 노포 제외
 *    (건축 35년↑ & 가격 P75↑ = 집 품질 아니라 땅값/재건축기대 → 오해 방지. 백분위 계산엔 포함).
 *
 * 실행: npx tsx scripts/build-region-prices.ts  (스냅샷 갱신 후 재실행+커밋)
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  AREA_RANGES,
  AREA_RANGE_ORDER,
  type AreaRangeKey,
} from "@/types/profile";

interface SnapMedian {
  area: number;
  medianKrw: number;
  count?: number;
  presale?: boolean;
  lowConfidence?: boolean;
  midpointMonth?: string;
}
interface SnapComplex {
  name: string;
  sigungu: string;
  dongName: string | null;
  buildYear: number | null;
  medians: SnapMedian[];
}

// 티어 정의 — 앱 기존 용어(안정/균형/도전) 재사용, 비하 없음·컴플라이언스 안전.
export type TierKey = "stable" | "balanced" | "challenge";
const TIER_DEFS: { key: TierKey; label: string; p: number }[] = [
  { key: "stable", label: "안정형", p: 0.4 },
  { key: "balanced", label: "균형형", p: 0.65 },
  { key: "challenge", label: "도전형", p: 0.9 }, // 상위 10% — 천장(max)은 분포 바에 별도 표시
];
const TIER_2: { key: TierKey; label: string; p: number }[] = [
  { key: "balanced", label: "균형형", p: 0.5 },
  { key: "challenge", label: "도전형", p: 0.85 },
];

const MIN_FOR_3 = 12; // 3티어 신뢰 표본
const MIN_FOR_2 = 6; // 2티어
const MIN_KEEP = 3; // 이하면 셀 자체 제외(너무 얇음)
const REPS_PER_TIER = 2; // 티어당 예시 단지 수
const REBUILD_AGE = 35; // 건축 N년↑ + 고가 = 재건축기대 → 이름표기 제외
const CURRENT_YEAR = new Date().getFullYear();

interface PoolEntry {
  name: string;
  dong: string | null;
  year: number | null;
  price: number;
  count: number;
  presale: boolean;
  month: string;
}
interface Rep {
  name: string;
  dong: string | null;
  year: number | null;
  krw: number;
}
interface Tier {
  key: TierKey;
  label: string;
  krw: number;
  reps: Rep[];
}
interface Cell {
  medianKrw: number; // 백분위 0.5 (backward-compat: verify-plan-personas·기존 폴백)
  sampleCount: number;
  asOf: string; // 풀 내 가장 최근 거래월
  min: number;
  max: number;
  tiers?: Tier[]; // n<MIN_FOR_2 이면 생략(단일 medianKrw로 폴백)
}

function bandOf(area: number): AreaRangeKey | null {
  for (const key of AREA_RANGE_ORDER) {
    const r = AREA_RANGES[key];
    if (area >= r.minM2 && (r.maxM2 === null || area < r.maxM2)) return key;
  }
  return null;
}

/** 오름차순 배열의 선형보간 백분위(q ∈ [0,1]). */
function percentile(sortedAsc: number[], q: number): number {
  const n = sortedAsc.length;
  if (n === 0) return 0;
  if (n === 1) return sortedAsc[0];
  const idx = q * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

const round만 = (x: number) => Math.round(x / 10_000) * 10_000;

/** 앵커 가격에 가장 가까운 예시 단지 — 가드 적용, 부족하면 점진 완화. */
function pickReps(pool: PoolEntry[], anchorPrice: number, p75: number): Rep[] {
  const notRebuild = (e: PoolEntry) =>
    !(e.year !== null && e.year < CURRENT_YEAR - REBUILD_AGE && e.price > p75);
  const base = pool.filter((e) => e.count >= 3 && !e.presale);
  let cand = base.filter(notRebuild);
  if (cand.length === 0) cand = base; // 재건축 가드 완화
  if (cand.length === 0) cand = pool.filter((e) => !e.presale);
  if (cand.length === 0) cand = pool;
  return [...cand]
    .sort(
      (a, b) =>
        Math.abs(a.price - anchorPrice) - Math.abs(b.price - anchorPrice),
    )
    .slice(0, REPS_PER_TIER)
    .map((e) => ({ name: e.name, dong: e.dong, year: e.year, krw: round만(e.price) }));
}

const snap = JSON.parse(
  readFileSync(path.resolve("src/data/complexSnapshot.json"), "utf8"),
) as { complexes: SnapComplex[] };

// 시군구|밴드 → 단지당 1표(같은 밴드 복수 평형은 거래 많은 쪽).
const groups = new Map<string, PoolEntry[]>();
for (const c of snap.complexes ?? []) {
  const perBand = new Map<AreaRangeKey, SnapMedian>();
  for (const m of c.medians ?? []) {
    if (m.lowConfidence) continue;
    if (!m.medianKrw || m.medianKrw <= 0) continue;
    const band = bandOf(m.area);
    if (!band) continue;
    const cur = perBand.get(band);
    if (!cur || (m.count ?? 0) > (cur.count ?? 0)) perBand.set(band, m);
  }
  for (const [band, m] of perBand) {
    const key = `${c.sigungu}|${band}`;
    const arr = groups.get(key) ?? [];
    arr.push({
      name: c.name,
      dong: c.dongName,
      year: c.buildYear,
      price: m.medianKrw,
      count: m.count ?? 0,
      presale: !!m.presale,
      month: m.midpointMonth ?? "",
    });
    groups.set(key, arr);
  }
}

const regions: Record<string, Partial<Record<AreaRangeKey, Cell>>> = {};
let cellCount = 0;
let tieredCount = 0;
for (const [key, pool] of groups) {
  const n = pool.length;
  if (n < MIN_KEEP) continue;
  const [sgg, band] = key.split("|") as [string, AreaRangeKey];
  const prices = pool.map((e) => e.price).sort((a, b) => a - b);
  const p75 = percentile(prices, 0.75);
  const asOf = pool.reduce((mx, e) => (e.month > mx ? e.month : mx), "");

  const defs = n >= MIN_FOR_3 ? TIER_DEFS : n >= MIN_FOR_2 ? TIER_2 : null;
  const tiers = defs?.map<Tier>((d) => {
    const krw = percentile(prices, d.p);
    return { key: d.key, label: d.label, krw: round만(krw), reps: pickReps(pool, krw, p75) };
  });

  (regions[sgg] ??= {})[band] = {
    medianKrw: round만(percentile(prices, 0.5)),
    sampleCount: n,
    asOf,
    min: round만(prices[0]),
    max: round만(prices[n - 1]),
    ...(tiers ? { tiers } : {}),
  };
  cellCount++;
  if (tiers) tieredCount++;
}

const out = {
  generatedAt: new Date().toISOString(),
  source: "complexSnapshot",
  regions,
};
const dest = path.resolve("src/data/regionPrices.json");
writeFileSync(dest, JSON.stringify(out) + "\n");
console.log(
  `regionPrices: 시군구 ${Object.keys(regions).length}곳 · ${cellCount}셀(티어 ${tieredCount}) → ${dest}`,
);
