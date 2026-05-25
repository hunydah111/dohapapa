/**
 * build-region-prices.ts
 *
 * "내 집 마련 플랜" 목표 선택용 — 시군구 × 평형대 대표가(중위) 테이블을
 * complexSnapshot.json 에서 집계해 src/data/regionPrices.json 으로 굽는다(작음, 커밋).
 * 클라가 6.6MB 스냅샷 대신 이 작은 테이블만 import 해서 동네+평형 고르면 목표가 자동 채움.
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
  lowConfidence?: boolean;
}
interface SnapComplex {
  sigungu: string;
  medians: SnapMedian[];
}

const SEP = "|"; // 시군구|밴드 키 구분자 (둘 다 파이프 미포함)

function bandOf(area: number): AreaRangeKey | null {
  for (const key of AREA_RANGE_ORDER) {
    const r = AREA_RANGES[key];
    if (area >= r.minM2 && (r.maxM2 === null || area < r.maxM2)) return key;
  }
  return null;
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  return n % 2 ? s[(n - 1) / 2] : Math.round((s[n / 2 - 1] + s[n / 2]) / 2);
}

const snap = JSON.parse(
  readFileSync(path.resolve("src/data/complexSnapshot.json"), "utf8"),
) as { complexes: SnapComplex[] };

const groups = new Map<string, number[]>();
for (const c of snap.complexes ?? []) {
  for (const m of c.medians ?? []) {
    if (m.lowConfidence) continue;
    if (!m.medianKrw || m.medianKrw <= 0) continue;
    const band = bandOf(m.area);
    if (!band) continue;
    const k = `${c.sigungu}${SEP}${band}`;
    const arr = groups.get(k);
    if (arr) arr.push(m.medianKrw);
    else groups.set(k, [m.medianKrw]);
  }
}

const regions: Record<
  string,
  Partial<Record<AreaRangeKey, { medianKrw: number; sampleCount: number }>>
> = {};
let cells = 0;
for (const [k, vals] of groups) {
  if (vals.length < 3) continue; // 표본 3건 미만 제외(신뢰도)
  const [sgg, band] = k.split(SEP) as [string, AreaRangeKey];
  (regions[sgg] ??= {})[band] = {
    medianKrw: median(vals),
    sampleCount: vals.length,
  };
  cells++;
}

const out = {
  generatedAt: new Date().toISOString(),
  source: "complexSnapshot",
  regions,
};
const dest = path.resolve("src/data/regionPrices.json");
writeFileSync(dest, JSON.stringify(out) + "\n");
console.log(
  `regionPrices: 시군구 ${Object.keys(regions).length}곳 · ${cells}셀 → ${dest}`,
);
