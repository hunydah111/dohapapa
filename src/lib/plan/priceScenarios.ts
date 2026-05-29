// 집값 시나리오 앵커 — "뇌피셜 ±%"가 아니라 공식 통계 과거 변동률을 출처와 함께 박는다.
// 사용자는 슬라이더로 '상승'을 조절하되, 각 시나리오 디폴트엔 근거가 붙는다(예측 아님·과거 기준).
//
// 근거(리서치 2026.5):
//  - 상승 = KB 아파트 매매가격지수 10년 CAGR(2015.8→2025.8): 서울 +5.5%·경기 +3.3% → 보수 반올림
//    서울 +5% / 경기 +3%. (끝점이 2025 과열기라 보수화.) 출처 KB부동산 2025.9.
//  - 하락 = 한국부동산원 전국주택가격동향조사 직전 하락기(2022) 수도권 −6.5% → 보수 −6%.
//  - 보합 = 0%(보수 기준선).
// 앱은 수도권 전용이므로 전국(+2.4%)이 아니라 서울/경기 값을 쓴다.
// A5(2026-05-29): R-ONE 시군구 실거래가격지수 통합 완료 — rebIndex.json 채워지면 시군구별
// 실측 추세 우선, 비면 위 KB 권역 폴백. 데이터 적재는 `npm run reb:build`(REB_API_KEY 필요).

import type { ScenarioKey } from "./index";
import { SEOUL_GU } from "@/types/profile";
import rebIndex from "@/data/rebIndex.json";

// A5: 한국부동산원 R-ONE 시군구별 실거래가격지수에서 구운 연 상승률(소수). 있으면 권역 일괄
// KB CAGR 대신 *시군구별 실측 추세*를 쓴다. 비어 있으면(미적재) 기존 KB 권역값으로 폴백 →
// 빈 상태=현재 동작 무변. build-reb-index.ts 가 채운다(REB_API_KEY 필요).
interface RebEntry { rateAnnual: number; asOf?: string }
const REB = rebIndex as { generatedAt: string; source: string; regions: Record<string, RebEntry> };

export interface ScenarioAnchor {
  key: ScenarioKey;
  label: string; // 하락 / 보합 / 상승
  rateAnnual: number; // 소수 (예 0.05 = +5%)
  basis: string; // 근거 한 줄 (사용자 표시)
  source: string; // 출처 + 기준일
}

const SEOUL = new Set<string>(SEOUL_GU);
export function isSeoul(sgg: string): boolean {
  return SEOUL.has(sgg);
}

const UP_SEOUL = 0.05;
const UP_GYEONGGI = 0.03;
const DOWN = -0.06;
const SRC_UP = "KB부동산 · 2025.9";
const SRC_DOWN = "한국부동산원 · 2022";

/** 시군구 상승률(연, 소수) — R-ONE(rebIndex) 구워졌으면 시군구 실측, 아니면 KB 권역 폴백.
 *  순수 함수(테스트용 export). 빈 rebIndex면 fromReb=false → 기존 동작. */
export function upRateFor(sgg: string): { rateAnnual: number; fromReb: boolean; asOf?: string } {
  const reb = REB.regions[sgg];
  if (reb && Number.isFinite(reb.rateAnnual)) {
    return { rateAnnual: reb.rateAnnual, fromReb: true, asOf: reb.asOf };
  }
  return { rateAnnual: isSeoul(sgg) ? UP_SEOUL : UP_GYEONGGI, fromReb: false };
}

/** 해당 동네(시군구)의 시나리오 앵커. 상승률은 R-ONE 시군구 실측 우선, 없으면 KB 권역. */
export function regionScenarios(sgg: string): Record<ScenarioKey, ScenarioAnchor> {
  const seoul = isSeoul(sgg);
  const up = upRateFor(sgg);
  return {
    down: {
      key: "down",
      label: "하락",
      rateAnnual: DOWN,
      basis: "직전 하락기(2022) 수도권 낙폭",
      source: SRC_DOWN,
    },
    flat: {
      key: "flat",
      label: "보합",
      rateAnnual: 0,
      basis: "변동 없음(보수 기준선)",
      source: "기준선",
    },
    up: {
      key: "up",
      label: "상승",
      rateAnnual: up.rateAnnual,
      basis: up.fromReb
        ? `${sgg} 실거래가격지수 추세${up.asOf ? ` (${up.asOf})` : ""}`
        : `${seoul ? "서울" : "경기"} 아파트 최근 10년 연평균`,
      source: up.fromReb ? "한국부동산원 R-ONE" : SRC_UP,
    },
  };
}

/** 슬라이더 '상승' 기본값(%) — R-ONE 시군구 실측 우선, 없으면 KB 권역. */
export function defaultUpPct(sgg: string): number {
  return upRateFor(sgg).rateAnnual * 100;
}

/** computePlan 폴백 기본값(수도권 일반: 경기 상승률 사용). */
export const DEFAULT_APPRECIATION = { down: DOWN, flat: 0, up: UP_GYEONGGI } as const;
