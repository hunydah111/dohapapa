import { describe, it, expect } from "vitest";
import { estimateBudget } from "@/lib/budget";
import { computePlan, formatDday, DEFAULT_APPRECIATION } from "@/lib/plan";
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
