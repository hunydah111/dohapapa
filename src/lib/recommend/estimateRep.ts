// 주변 시세 연동 추정 — 등기 지연 등으로 해당 평형의 직접 실거래가 아직 없는 신축의
// 대표 평형 가격을, "거리·연식·한강근접이 비슷한 인근 단지의 같은 평형 ㎡단가"로 환산한다.
//
// WHY 거리 기반(동 경계 무시): 같은 동만 보면 바로 옆이라도 다른 동이면 못 끌어온다.
//   (예: 메이플자이(잠원동)는 바로 옆 원베일리(반포동)와 연동돼야 함.) 그래서 직선거리
//   ≤DIST_MAX_KM 안에서 거리·연식 가까운 순으로 가중한다.
// WHY 한강근접 유사도: 같은 거리·연식이라도 한강변이냐 아니냐로 시세가 크게 갈린다.
//   한강까지 거리가 비슷한 단지에 가중해 "한강변은 한강변끼리" 비교한다.
// WHY ㎡단가는 비교 단지의 raw(브리지 전): 활발한 인근 단지는 이미 최근가라, coarse 한
//   시군구 추세 브리지로 또 깎으면 그 동네 프리미엄을 잃는다.
//
// 한계(정직): 실제 조망(층·향·시야 가림)은 MOLIT 공개데이터로 알 수 없다. 같은 단지 같은
//   층도 향 따라 수억 차이가 나지만, 그건 실거래가 찍혀야 드러난다. 그래서 이 추정치는
//   본질적으로 ±폭이 크며 "실거래 등재 전 · 주변 시세 연동 추정"으로 명확히 표시한다.

import { haversineKm } from "@/lib/geo";
import { vibeDistanceKm } from "./locationVibe";

const YEAR_TOL = 5; // 비교 단지 연식 허용 범위(±년)
const DIST_MAX_KM = 3; // 비교 반경
const MIN_PEERS = 3; // 이만큼의 비교 단지가 있어야 환산
const DIST_SCALE = 0.5; // 거리 가중 스케일(km) — 가까울수록 지배적(같은 동네가 지배하도록 가파르게)
const RIVER_SCALE = 0.6; // 한강거리 유사도 스케일(km)

/** 비교 단지의 한 점 — 타깃 평형대의 raw ㎡단가·면적·좌표·한강거리. */
export interface CompPoint {
  buildYear: number;
  /** ㎡당 단가(원, 브리지 전 raw). */
  perM2: number;
  /** 그 대표 평형의 전용면적(㎡). */
  area: number;
  lat: number;
  lng: number;
  /** 한강까지 최단거리(km). */
  riverKm: number;
}

/** 추정 대상 단지 정보. */
export interface TargetInfo {
  buildYear: number | null;
  lat: number;
  lng: number;
  riverKm: number;
}

export interface EstimatedRep {
  /** 환산 대상 면적(㎡) — 비교 단지들의 대표 면적(가중 중위). */
  area: number;
  /** 환산 추정가(원). */
  priceKrw: number;
  /** UI 근거 문구. */
  basis: string;
  /** 환산에 쓴 비교 단지 수. */
  compCount: number;
}

/** 가중 중위값(값·가중치). 가중 누적이 절반을 넘는 값. */
function weightedMedian(items: { v: number; w: number }[]): number {
  if (items.length === 0) return 0;
  const sorted = [...items].sort((a, b) => a.v - b.v);
  const total = sorted.reduce((s, it) => s + it.w, 0);
  let cum = 0;
  for (const it of sorted) {
    cum += it.w;
    if (cum >= total / 2) return it.v;
  }
  return sorted[sorted.length - 1].v;
}

/**
 * 거리·연식·한강근접이 비슷한 인근 단지로 타깃 평형 가격을 환산한다.
 * 비교 단지가 MIN_PEERS 미만이면 null(환산 불가 — 추정하지 않음).
 */
export function estimateRepFromComps(
  comps: CompPoint[] | undefined,
  target: TargetInfo | null,
): EstimatedRep | null {
  if (!target || target.buildYear == null || !comps) return null;
  const by = target.buildYear;

  const cand: { p: CompPoint; dist: number }[] = [];
  for (const p of comps) {
    if (Math.abs(p.buildYear - by) > YEAR_TOL) continue;
    const dist = haversineKm(
      { lat: p.lat, lng: p.lng },
      { lat: target.lat, lng: target.lng },
    );
    if (dist > DIST_MAX_KM) continue;
    cand.push({ p, dist });
  }
  if (cand.length < MIN_PEERS) return null;

  let wsum = 0;
  let perM2sum = 0;
  const areaItems: { v: number; w: number }[] = [];
  for (const { p, dist } of cand) {
    const wYear = 1 / (1 + (p.buildYear - by) ** 2);
    const wDist = 1 / (1 + (dist / DIST_SCALE) ** 2);
    const wRiver = 1 / (1 + (Math.abs(p.riverKm - target.riverKm) / RIVER_SCALE) ** 2);
    const w = wYear * wDist * wRiver;
    wsum += w;
    perM2sum += p.perM2 * w;
    areaItems.push({ v: p.area, w });
  }
  if (wsum <= 0) return null;

  const perM2 = perM2sum / wsum;
  const area = weightedMedian(areaItems);
  if (perM2 <= 0 || area <= 0) return null;

  return {
    area,
    priceKrw: Math.round(perM2 * area),
    basis: `주변 ${cand.length}개 단지 시세 연동`,
    compCount: cand.length,
  };
}

/** 단지 좌표에서 한강 최단거리(km). estimateRep 비교점/타깃 구성에 공통 사용. */
export function riverDistanceKm(lat: number, lng: number): number {
  return vibeDistanceKm("riverside", { lat, lng });
}
