// 지면 행 면적 표기 — "84.7㎡ · 32~35평" (2026-07-08 사장 지시: 평수 병기).
//
// 평형 라벨은 판정 폼과 같은 통용 매핑(types/profile.ts AREA_RANGES — 공급 평형 통념을
// 전용㎡ 구간으로 번역한 것)을 그대로 쓴다. 단일 평수("34평") 단정은 공급면적 데이터가
// 없어 불가 — 구간 라벨이 정직한 상한선. 구간 밖(전용 25㎡ 미만)은 ㎡만 표기.

import { AREA_RANGES, AREA_RANGE_ORDER } from "@/types/profile";

/** 전용㎡ → "84.7" (소수 .0 생략) — 기존 sqm 3중 중복의 단일 소스. */
export function sqm(area: number): string {
  const s = area.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** 전용㎡ → 통용 평형 구간 라벨("32~35평"). 매핑 밖이면 null. */
export function pyeongLabel(areaM2: number): string | null {
  for (const key of AREA_RANGE_ORDER) {
    const r = AREA_RANGES[key];
    if (areaM2 >= r.minM2 && (r.maxM2 === null || areaM2 < r.maxM2)) return r.label;
  }
  return null;
}

/** 행 메타 면적부 — "84.7㎡ · 32~35평" (라벨 없으면 "84.7㎡"). */
export function areaMeta(areaM2: number): string {
  const label = pyeongLabel(areaM2);
  return label ? `${sqm(areaM2)}㎡ · ${label}` : `${sqm(areaM2)}㎡`;
}
