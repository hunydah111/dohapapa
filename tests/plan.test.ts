import { describe, it, expect } from "vitest";
import { estimateBudget } from "@/lib/budget";
import {
  computePlan,
  formatDday,
  planGuidance,
  regionScenarios,
  defaultUpPct,
  isSeoul,
  DEFAULT_APPRECIATION,
} from "@/lib/plan";
import type { CoupleProfile } from "@/types/profile";

function makeProfile(overrides: Partial<CoupleProfile> = {}): CoupleProfile {
  return {
    householdType: "dualIncome",
    priorities: { commute: 3, school: 3, buildingAge: 3, largeComplex: 2 },
    preferredAreaRanges: ["p32_35"],
    workplaceA: { label: "A", lat: 37.5, lng: 127, commuteMode: "car", maxCommuteMinutes: 50 },
    hasSchoolAgedChild: false,
    hasInfant: false,
    hasTwoOrMoreChildren: false,
    hasThreeOrMoreChildren: false,
    isExpectingChild: false,
    householdIncomeKrwYear: 100_000_000,
    seedMoneyKrw: 300_000_000,
    netAssetsKrw: 300_000_000,
    existingLoanMonthlyKrw: 0,
    hasOwnedHomeBefore: false,
    isNewlywed: false,
    ...overrides,
  };
}

const TARGET = 900_000_000; // 9억 — 갭이 생기는 목표가
const SAVE = 2_000_000; // 월 200만

describe("computePlan", () => {
  it("갭>0: 보합 교차 = ceil(gap/M), 하락은 더 빠르고 상승은 더 느림/불가", () => {
    const budget = estimateBudget(makeProfile());
    const plan = computePlan(budget, makeProfile(), {
      targetPriceKrw: TARGET,
      monthlySavingKrw: SAVE,
      monthlySideKrw: 0,
    });

    expect(plan.gapKrw).toBeGreaterThan(0);
    expect(plan.monthlyAccumKrw).toBe(SAVE);
    expect(plan.purchaseNowKrw).toBe(
      plan.equityKrw + plan.loanKrw - plan.acqCostKrw,
    );

    const flat = plan.scenarios.find((s) => s.key === "flat")!;
    const down = plan.scenarios.find((s) => s.key === "down")!;
    const up = plan.scenarios.find((s) => s.key === "up")!;

    expect(flat.months).toBe(Math.ceil(plan.gapKrw / plan.monthlyAccumKrw));
    expect(down.months).not.toBeNull();
    expect(down.months!).toBeLessThanOrEqual(flat.months!);
    // 상승은 더 오래 걸리거나 못 따라잡음(null)
    expect(up.months === null || up.months >= flat.months!).toBe(true);
  });

  it("부업 추가 → 월 순증액↑ → 보합 시점 단축", () => {
    const budget = estimateBudget(makeProfile());
    const base = computePlan(budget, makeProfile(), {
      targetPriceKrw: TARGET,
      monthlySavingKrw: SAVE,
      monthlySideKrw: 0,
    });
    const withSide = computePlan(budget, makeProfile(), {
      targetPriceKrw: TARGET,
      monthlySavingKrw: SAVE,
      monthlySideKrw: 1_000_000, // 세후 ×0.9 = +90만
    });
    expect(withSide.monthlyAccumKrw).toBe(SAVE + 900_000);
    const baseFlat = base.scenarios.find((s) => s.key === "flat")!.months!;
    const sideFlat = withSide.scenarios.find((s) => s.key === "flat")!.months!;
    expect(sideFlat).toBeLessThanOrEqual(baseFlat);
  });

  it("이미 살 수 있으면(목표<구매가능가) 갭 0·전 시나리오 0개월", () => {
    const budget = estimateBudget(makeProfile());
    const plan = computePlan(budget, makeProfile(), {
      targetPriceKrw: 400_000_000, // 4억 — 구매가능가보다 낮음
      monthlySavingKrw: SAVE,
      monthlySideKrw: 0,
    });
    expect(plan.gapKrw).toBe(0);
    for (const s of plan.scenarios) expect(s.months).toBe(0);
  });

  it("높은 상승률 + 적은 저축 → 상승 시나리오 못 따라잡음(null)", () => {
    const budget = estimateBudget(makeProfile());
    const plan = computePlan(budget, makeProfile(), {
      targetPriceKrw: TARGET,
      monthlySavingKrw: 300_000, // 월 30만
      monthlySideKrw: 0,
      appreciation: { down: -0.05, flat: 0, up: 0.08 },
    });
    expect(plan.scenarios.find((s) => s.key === "up")!.months).toBeNull();
  });

  it("곡선: 길이 일치, 구매가능가·상승가 단조 증가", () => {
    const budget = estimateBudget(makeProfile());
    const plan = computePlan(budget, makeProfile(), {
      targetPriceKrw: TARGET,
      monthlySavingKrw: SAVE,
      monthlySideKrw: 0,
    });
    const { years, affordable, price } = plan.curve;
    expect(affordable.length).toBe(years.length);
    expect(price.up.length).toBe(years.length);
    for (let i = 1; i < years.length; i++) {
      expect(affordable[i]).toBeGreaterThan(affordable[i - 1]);
      expect(price.up[i]).toBeGreaterThan(price.up[i - 1]);
      expect(price.flat[i]).toBe(price.flat[0]); // 보합 0% → 평평
    }
  });

  it("DEFAULT_APPRECIATION 확인 + formatDday 표기", () => {
    expect(DEFAULT_APPRECIATION.flat).toBe(0);
    expect(formatDday(null)).toBe("40년+");
    expect(formatDday(0)).toBe("지금 가능");
    expect(formatDday(14)).toBe("1년 2개월");
    expect(formatDday(24)).toBe("2년");
    expect(formatDday(5)).toBe("5개월");
  });
});

describe("planGuidance — 끝은 희망", () => {
  it("정상 프로필: 도달 가능 → reachable", () => {
    const budget = estimateBudget(makeProfile());
    const plan = computePlan(budget, makeProfile(), {
      targetPriceKrw: TARGET,
      monthlySavingKrw: SAVE,
      monthlySideKrw: 0,
    });
    expect(planGuidance(plan).tone).toBe("reachable");
  });

  it("전 시나리오 40년+ → hopeless + 동네↓·저축↑ 레버 수치 제공", () => {
    // 저소득·소액현금이 30억을 노림 + 월 10만 저축 → 하락 시나리오조차 40년 안에 못 닿음.
    const lowProfile = makeProfile({
      householdIncomeKrwYear: 30_000_000,
      seedMoneyKrw: 50_000_000,
      netAssetsKrw: 50_000_000,
    });
    const budget = estimateBudget(lowProfile);
    const plan = computePlan(budget, lowProfile, {
      targetPriceKrw: 3_000_000_000, // 30억
      monthlySavingKrw: 100_000, // 월 10만
      monthlySideKrw: 0,
    });
    expect(plan.purchaseNowKrw).toBeGreaterThan(0);
    expect(plan.scenarios.every((s) => s.months === null)).toBe(true);

    const g = planGuidance(plan);
    expect(g.tone).toBe("hopeless");
    // 동네↓: 지금 페이스로 10년이면 닿는 가격 = 구매가능가 + 월순증×120
    expect(g.reachableInHorizonKrw).toBe(
      Math.max(0, plan.purchaseNowKrw + plan.monthlyAccumKrw * 12 * g.horizonYears),
    );
    expect(g.reachableInHorizonKrw).toBeGreaterThan(plan.purchaseNowKrw);
    // 저축↑: 보합 기준 neededYears 안에 닿는 월 순증
    expect(g.neededMonthlyKrw).toBe(Math.ceil(plan.gapKrw / (g.neededYears * 12)));
  });

  it("(scenario anchors) 서울/경기 상승률 분리 + 출처·하락 공통", () => {
    expect(isSeoul("강남구")).toBe(true);
    expect(isSeoul("광명시")).toBe(false);

    const seoul = regionScenarios("강남구");
    const gg = regionScenarios("광명시");
    expect(seoul.up.rateAnnual).toBeCloseTo(0.05);
    expect(gg.up.rateAnnual).toBeCloseTo(0.03);
    expect(seoul.up.basis).toContain("서울");
    expect(gg.up.basis).toContain("경기");
    // 하락·보합은 권역 공통
    for (const s of [seoul, gg]) {
      expect(s.down.rateAnnual).toBeCloseTo(-0.06);
      expect(s.flat.rateAnnual).toBe(0);
      expect(s.up.source).toContain("KB");
      expect(s.down.source).toContain("부동산원");
    }
    expect(defaultUpPct("강남구")).toBe(5);
    expect(defaultUpPct("광명시")).toBe(3);
    expect(DEFAULT_APPRECIATION.down).toBeCloseTo(-0.06);
  });
});

describe("planGuidance — 추가", () => {
  it("소득·현금·저축 모두 0 → needBasics", () => {
    const empty = makeProfile({
      householdIncomeKrwYear: 0,
      seedMoneyKrw: 0,
      netAssetsKrw: 0,
    });
    const budget = estimateBudget(empty);
    const plan = computePlan(budget, empty, {
      targetPriceKrw: TARGET,
      monthlySavingKrw: 0,
      monthlySideKrw: 0,
    });
    expect(plan.purchaseNowKrw).toBeLessThanOrEqual(0);
    expect(plan.monthlyAccumKrw).toBe(0);
    expect(planGuidance(plan).tone).toBe("needBasics");
  });
});

describe("2025.10.15 — Plan sigungu 패스로 LTV 차등이 D-day에 반영", () => {
  it("동일 프로필도 비규제(미추홀구)가 규제(강남)보다 보합 D-day 짧음", () => {
    const profile = makeProfile({
      householdIncomeKrwYear: 100_000_000,
      seedMoneyKrw: 300_000_000,
      netAssetsKrw: 300_000_000,
    });
    const target = 600_000_000;

    // 규제(강남) — LTV 40%·스트레스 7.0%
    const regBudget = estimateBudget(profile, { targetPriceKrw: target, sigungu: "강남구" });
    const regPlan = computePlan(regBudget, profile, {
      targetPriceKrw: target,
      monthlySavingKrw: SAVE,
      monthlySideKrw: 0,
    });

    // 비규제(인천 미추홀) — LTV 70%·스트레스 5.5%
    const nonRegBudget = estimateBudget(profile, { targetPriceKrw: target, sigungu: "미추홀구" });
    const nonRegPlan = computePlan(nonRegBudget, profile, {
      targetPriceKrw: target,
      monthlySavingKrw: SAVE,
      monthlySideKrw: 0,
    });

    // 비규제가 대출·구매가능가 더 큼 → 갭 더 작음 → 보합 D-day 짧음(또는 즉시).
    expect(nonRegBudget.loanEstimateKrw).toBeGreaterThan(regBudget.loanEstimateKrw);
    expect(nonRegPlan.purchaseNowKrw).toBeGreaterThan(regPlan.purchaseNowKrw);
    expect(nonRegPlan.gapKrw).toBeLessThanOrEqual(regPlan.gapKrw);
    const regFlat = regPlan.scenarios.find((s) => s.key === "flat")!.months;
    const nonRegFlat = nonRegPlan.scenarios.find((s) => s.key === "flat")!.months;
    // 보합 도달 시점: 둘 다 도달하면 비규제 ≤ 규제, 또는 비규제는 도달·규제는 null 가능.
    if (regFlat !== null && nonRegFlat !== null) {
      expect(nonRegFlat).toBeLessThanOrEqual(regFlat);
    } else if (nonRegFlat === null) {
      expect(regFlat).toBeNull(); // 비규제도 못 닿으면 규제는 더 못 닿음
    }
  });

  it("sigungu 미지정은 보수적 규제 fallback과 동일", () => {
    const profile = makeProfile({
      householdIncomeKrwYear: 100_000_000,
      seedMoneyKrw: 300_000_000,
      netAssetsKrw: 300_000_000,
    });
    const target = 600_000_000;
    const noSgg = estimateBudget(profile, { targetPriceKrw: target });
    const reg = estimateBudget(profile, { targetPriceKrw: target, sigungu: "강남구" });
    expect(noSgg.loanEstimateKrw).toBe(reg.loanEstimateKrw);
  });
});
