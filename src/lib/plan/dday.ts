// D-day 인라인 — 결과 카드용 "1순위 시군구 중위(대표가) 입성까지 며칠" 계산.
//
// 한 방 스펙(2026-06-11): 판정 카드에 D-day 메인 숫자. 입력 추가 0개 —
// 월저축은 소득 기반 디폴트(연소득의 25%/12), 목표가는 시군구×평형 중위가 자동 주입.
//
// 컴플라이언스: 현재가 고정(보합) + 가정 저축 — 예측 아님, 전부 추정. 라벨 필수.
// 박탈감 캡: D-9,999일 초과(또는 40년+ 미도달)는 숫자 대신 "D-아득" (baby 등급 숨김 룰과 동족).

import type { CoupleProfile, AreaRangeKey } from "@/types/profile";
import { AREA_RANGES, AREA_RANGE_ORDER } from "@/types/profile";
import { estimateBudget } from "@/lib/budget";
import { estimateAcquisitionCosts } from "@/lib/acquisitionCost";
import regionPrices from "@/data/regionPrices.json";
import { computePlan, DEFAULT_APPRECIATION, regionScenarios } from "./index";

interface Rep {
  name: string;
  dong: string | null;
  year: number | null;
  krw: number;
}
interface Tier {
  key: "stable" | "balanced" | "challenge";
  label: string;
  krw: number;
  reps: Rep[];
}
interface Cell {
  medianKrw: number;
  sampleCount: number;
  tiers?: Tier[];
}
const REGIONS = regionPrices.regions as Record<
  string,
  Partial<Record<AreaRangeKey, Cell>>
>;

const AVG_DAYS_PER_MONTH = 30.44;
/** 박탈감 캡 — 이 일수 초과는 숫자 대신 "D-아득". */
export const DDAY_CAP_DAYS = 9999;

export interface DdayResult {
  sigungu: string;
  band: AreaRangeKey;
  bandLabel: string;
  /** 목표가 = 시군구×평형 중위가(원). */
  targetKrw: number;
  /** 가정 월저축(원) — 소득 기반 디폴트. */
  monthlySavingKrw: number;
  /** 도달 개월. 0 = 지금 가능. null = 40년+ 미도달. */
  months: number | null;
  /** 표시용 일수 (months × 30.44 반올림). null = 미도달. */
  days: number | null;
  /** true = "D-아득" 표시 (days > 9,999 또는 미도달). */
  capped: boolean;
}

/** 소득 기반 디폴트 월저축 — 가구 연소득의 25%를 12로 나눠 만원 단위 반올림. */
export function defaultMonthlySaving(profile: CoupleProfile): number {
  const income = Math.max(0, profile.householdIncomeKrwYear ?? 0);
  return Math.round((income * 0.25) / 12 / 10_000) * 10_000;
}

/** 전용㎡ → 평형 밴드. 어느 구간에도 안 걸리면 null. */
export function bandOfArea(areaM2: number | null | undefined): AreaRangeKey | null {
  if (areaM2 == null || !(areaM2 > 0)) return null;
  for (const key of AREA_RANGE_ORDER) {
    const r = AREA_RANGES[key];
    if (areaM2 >= r.minM2 && (r.maxM2 === null || areaM2 < r.maxM2)) return key;
  }
  return null;
}

/**
 * 1순위 시군구의 중위가 기준 D-day. 데이터 없으면 null (UI는 조용히 숨김).
 * - band: 1순위 단지 전용면적 → 밴드. 없으면 사용자 선호 밴드 → 그래도 없으면 데이터 있는 첫 밴드.
 * - 시나리오: 보합(현재가 고정) — "예측"이 아니라 "지금 가격 기준" 프레임.
 */
export function computeDdayForSigungu(
  profile: CoupleProfile,
  sigungu: string,
  areaM2?: number | null,
  monthlySavingOverrideKrw?: number,
): DdayResult | null {
  const cells = REGIONS[sigungu];
  if (!cells) return null;

  // 밴드 선택 — 단지 평형 우선, 선호 밴드 폴백, 마지막으로 데이터 있는 밴드.
  const candidates: AreaRangeKey[] = [];
  const fromArea = bandOfArea(areaM2);
  if (fromArea) candidates.push(fromArea);
  for (const k of profile.preferredAreaRanges ?? []) {
    if (!candidates.includes(k)) candidates.push(k);
  }
  for (const k of AREA_RANGE_ORDER) {
    if (!candidates.includes(k)) candidates.push(k);
  }
  let band: AreaRangeKey | null = null;
  let target = 0;
  for (const k of candidates) {
    const cell = cells[k];
    if (cell && cell.medianKrw > 0 && cell.sampleCount >= 5) {
      band = k;
      target = cell.medianKrw;
      break;
    }
  }
  if (!band) return null;

  const monthlySavingKrw =
    monthlySavingOverrideKrw != null
      ? Math.max(0, monthlySavingOverrideKrw)
      : defaultMonthlySaving(profile);

  const budget = estimateBudget(profile, { targetPriceKrw: target, sigungu });
  const plan = computePlan(budget, profile, {
    targetPriceKrw: target,
    monthlySavingKrw,
    monthlySideKrw: 0,
    appreciation: {
      down: DEFAULT_APPRECIATION.down,
      flat: 0, // 현재가 고정 — D-day의 기준 프레임
      up: regionScenarios(sigungu).up.rateAnnual,
    },
    headlineKey: "flat",
  });
  const months = plan.scenarios.find((s) => s.key === "flat")?.months ?? null;
  const days = months === null ? null : Math.round(months * AVG_DAYS_PER_MONTH);
  const capped = days === null || days > DDAY_CAP_DAYS;

  return {
    sigungu,
    band,
    bandLabel: AREA_RANGES[band].label,
    targetKrw: target,
    monthlySavingKrw,
    months,
    days,
    capped,
  };
}

export interface Conquest {
  /** 같은 평형 데이터가 있는 수도권 시군구 수. */
  total: number;
  /** 그중 지금(중위가 기준) 입성 가능한 곳 수. */
  affordableNow: number;
  bandLabel: string;
}

/**
 * vs 지도 정복 게이지 — "수도권 N곳 중 지금 입성 가능 M곳".
 * 비교 대상이 사람이 아니라 지도라 박탈감이 호기심("나는 몇 곳?")으로 빠진다.
 * 시나리오 없음 — 지금 구매력 vs 시군구 중위가 단순 비교 (예측 0).
 */
export function computeConquest(
  profile: CoupleProfile,
  areaM2?: number | null,
): Conquest | null {
  const band =
    bandOfArea(areaM2) ?? profile.preferredAreaRanges?.[0] ?? "p26_31";
  let total = 0;
  let affordableNow = 0;
  for (const [sgg, cells] of Object.entries(REGIONS)) {
    const cell = cells[band];
    if (!cell || !(cell.medianKrw > 0) || cell.sampleCount < 5) continue;
    total += 1;
    const budget = estimateBudget(profile, {
      targetPriceKrw: cell.medianKrw,
      sigungu: sgg,
    });
    const loan = budget.safeLine?.loanEstimateKrw ?? budget.loanEstimateKrw;
    const acq = estimateAcquisitionCosts(cell.medianKrw, profile).totalKrw;
    const purchaseNow = Math.max(0, budget.totalEquityKrw) + loan - acq;
    if (purchaseNow >= cell.medianKrw) affordableNow += 1;
  }
  if (total < 10) return null; // 데이터 빈약하면 게이지 숨김
  return { total, affordableNow, bandLabel: AREA_RANGES[band].label };
}
