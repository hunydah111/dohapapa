// "내 집 마련 플랜" 계산엔진 (무주택 — Phase 1).
//
// 스펙: G:\...\비집고_Dday_계산엔진_스펙.md §2·§6. 예측 아님 — 현재가 고정 + 과거지표
// 앵커 + 사용자 가정. 디폴트는 감당 안전선(safeLine) 대출 사용.
//
// budget.ts(estimateBudget)가 이미 자기자본 E·대출 L·금리·월상환·안전선을 산출하므로
// 여기서는 그 결과 + (월저축·부업·목표가)로 "언제 살 수 있나(D-day)"와 "저축 vs 집값 경주"만
// 계산한다. 모든 값 추정(isEstimate).

import type { CoupleProfile } from "@/types/profile";
import type { BudgetEstimate } from "@/types/recommendation";
import { estimateAcquisitionCosts } from "@/lib/acquisitionCost";
import { DEFAULT_APPRECIATION } from "./priceScenarios";

export type ScenarioKey = "down" | "flat" | "up";

export interface PlanInput {
  /** 목표가 (원) — 선택 단지/동네 현재가. */
  targetPriceKrw: number;
  /** 월 저축액 (원). */
  monthlySavingKrw: number;
  /** 월 부업소득(세전, 원). 세후 근사 ×0.9 적용. */
  monthlySideKrw: number;
  /**
   * 연 상승률 시나리오(소수). 미지정 시 잠정 기본값.
   * ⚠️ Phase 2에서 한국부동산원 권역 실거래가격지수(반복매매)로 교체. 지금은 "가정" 라벨 필수.
   */
  appreciation?: { down: number; flat: number; up: number };
  /** 차트 지평을 맞출 헤드라인 시나리오(사용자 선택). 미지정 시 보합. */
  headlineKey?: ScenarioKey;
}

export interface PlanScenario {
  key: ScenarioKey;
  /** 연 상승률(소수). */
  rateAnnual: number;
  /** 도달까지 개월 수. null = 기간 내(40년) 못 따라잡음. */
  months: number | null;
}

export interface PlanResult {
  equityKrw: number;
  /** 적용 대출 (기본 안전선). */
  loanKrw: number;
  /** 목표가 기준 취득·부대비용. */
  acqCostKrw: number;
  /** 지금 구매가능가 = E + L − C. */
  purchaseNowKrw: number;
  /** 목표가 − 현재 구매가능가 (≥0). */
  gapKrw: number;
  /** 월 순증액 M = 저축 + 부업×0.9. */
  monthlyAccumKrw: number;
  scenarios: PlanScenario[];
  /** 차트용 — 연 단위 시계열(원). years[i] 시점의 각 값. */
  curve: {
    years: number[];
    affordable: number[];
    price: Record<ScenarioKey, number[]>;
  };
  isEstimate: true;
}

// 시나리오 앵커(출처 박힌 상승/하락/보합)는 priceScenarios.ts 가 단일 소스.
export {
  DEFAULT_APPRECIATION,
  regionScenarios,
  isSeoul,
  defaultUpPct,
} from "./priceScenarios";
export type { ScenarioAnchor } from "./priceScenarios";

const MAX_MONTHS = 480; // 40년
const SIDE_NET = 0.9; // 부업 세후 근사

/** 시나리오 교차시점(개월). 도달 불가면 null. */
function crossingMonths(
  equity: number,
  monthlyAccum: number,
  loan: number,
  acq: number,
  target: number,
  rateAnnual: number,
): number | null {
  const rMonthly = Math.pow(1 + rateAnnual, 1 / 12) - 1;
  for (let m = 0; m <= MAX_MONTHS; m++) {
    const affordable = equity + monthlyAccum * m + loan - acq;
    const price = target * Math.pow(1 + rMonthly, m);
    if (affordable >= price) return m;
  }
  return null;
}

export function computePlan(
  budget: BudgetEstimate,
  profile: CoupleProfile,
  input: PlanInput,
): PlanResult {
  const target = Math.max(0, input.targetPriceKrw);
  const equity = Math.max(0, budget.totalEquityKrw);
  // 디폴트는 감당 안전선 대출. 안전선이 없으면(소득 0·간단모드) 일반 추정대출.
  const loan = budget.safeLine?.loanEstimateKrw ?? budget.loanEstimateKrw;
  const acq = estimateAcquisitionCosts(target, profile).totalKrw;
  const purchaseNow = equity + loan - acq;
  const gap = Math.max(0, target - purchaseNow);
  const monthlyAccum =
    Math.max(0, input.monthlySavingKrw) +
    Math.round(Math.max(0, input.monthlySideKrw) * SIDE_NET);

  const appr = input.appreciation ?? DEFAULT_APPRECIATION;
  const rates: Record<ScenarioKey, number> = {
    down: appr.down,
    flat: appr.flat,
    up: appr.up,
  };

  const scenarios: PlanScenario[] = (["down", "flat", "up"] as ScenarioKey[]).map(
    (key) => ({
      key,
      rateAnnual: rates[key],
      months: crossingMonths(equity, monthlyAccum, loan, acq, target, rates[key]),
    }),
  );

  // 차트 지평: 헤드라인(보합) 도달을 항상 화면에 담는다. 보합이 없으면(40년+) 유한 교차
  // 최댓값(보통 하락) 기준. [6,40]년 클램프.
  const finiteYears = scenarios
    .map((s) => s.months)
    .filter((m): m is number => m !== null)
    .map((m) => m / 12);
  const headKey = input.headlineKey ?? "flat";
  const headMonths = scenarios.find((s) => s.key === headKey)!.months;
  const refYears =
    headMonths !== null
      ? headMonths / 12
      : finiteYears.length
        ? Math.max(...finiteYears)
        : 12;
  const horizon = Math.min(40, Math.max(6, Math.ceil(refYears + 2)));

  const years: number[] = [];
  const affordable: number[] = [];
  const price: Record<ScenarioKey, number[]> = { down: [], flat: [], up: [] };
  for (let y = 0; y <= horizon; y++) {
    years.push(y);
    affordable.push(equity + monthlyAccum * 12 * y + loan - acq);
    for (const key of ["down", "flat", "up"] as ScenarioKey[]) {
      price[key].push(target * Math.pow(1 + rates[key], y));
    }
  }

  return {
    equityKrw: equity,
    loanKrw: loan,
    acqCostKrw: acq,
    purchaseNowKrw: purchaseNow,
    gapKrw: gap,
    monthlyAccumKrw: monthlyAccum,
    scenarios,
    curve: { years, affordable, price },
    isEstimate: true,
  };
}

/** 개월 → "N년 M개월" / "40년+" 표시. */
export function formatDday(months: number | null): string {
  if (months === null) return "40년+";
  if (months <= 0) return "지금 가능";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}개월`;
  if (m === 0) return `${y}년`;
  return `${y}년 ${m}개월`;
}

/**
 * 결과 톤 — UI가 "맨 40년+" 대신 행동유도/격려를 보여주기 위한 분기.
 * - reachable: 한 시나리오라도 40년 안에 도달 → 평소대로 시점 표시.
 * - hopeless: 전 시나리오 40년+ → 동네↓·저축↑ 레버로 길 제시("끝은 희망").
 * - needBasics: 구매가능가도 월 순증도 0 이하(소득·현금·저축 전무) → 출발선 안내.
 */
export type PlanTone = "reachable" | "hopeless" | "needBasics";

export interface PlanGuidance {
  tone: PlanTone;
  /** 동네↓ 레버: 지금 저축 페이스로 horizonYears년이면 닿는 가격(원). */
  reachableInHorizonKrw: number;
  horizonYears: number;
  /** 저축↑ 레버: 보합 기준 neededYears년 안에 닿으려면 필요한 '월 순증액'(원). gap 0이면 0. */
  neededMonthlyKrw: number;
  neededYears: number;
}

export function planGuidance(
  plan: PlanResult,
  opts: { horizonYears?: number; neededYears?: number } = {},
): PlanGuidance {
  const horizonYears = opts.horizonYears ?? 10;
  const neededYears = opts.neededYears ?? 15;

  const noBasics = plan.purchaseNowKrw <= 0 && plan.monthlyAccumKrw <= 0;
  const allHopeless = plan.scenarios.every((s) => s.months === null);
  const tone: PlanTone = noBasics ? "needBasics" : allHopeless ? "hopeless" : "reachable";

  const reachableInHorizonKrw = Math.max(
    0,
    plan.purchaseNowKrw + plan.monthlyAccumKrw * 12 * horizonYears,
  );
  const neededMonthlyKrw =
    plan.gapKrw > 0 ? Math.ceil(plan.gapKrw / (neededYears * 12)) : 0;

  return { tone, reachableInHorizonKrw, horizonYears, neededMonthlyKrw, neededYears };
}
