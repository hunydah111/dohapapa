import { describe, it, expect } from "vitest";
import { estimateBudget } from "@/lib/budget";
import type { CoupleProfile } from "@/types/profile";

function makeProfile(overrides: Partial<CoupleProfile> = {}): CoupleProfile {
  return {
    householdType: "dualIncome",
    priorities: { commute: 3, school: 3, buildingAge: 3 },
    preferredAreaRange: "p32_35",
    workplaceA: {
      label: "회사A",
      lat: 37.5,
      lng: 127.0,
      commuteMode: "car",
      maxCommuteMinutes: 50,
    },
    hasSchoolAgedChild: false,
    hasInfant: false,
    hasTwoOrMoreChildren: false,
    householdIncomeKrwYear: 100_000_000,
    seedMoneyKrw: 300_000_000,
    netAssetsKrw: 300_000_000,
    existingLoanMonthlyKrw: 0,
    hasOwnedHomeBefore: false,
    isNewlywed: false,
    ...overrides,
  };
}

describe("estimateBudget", () => {
  it("mid-income 생애최초: loan > 0, grossBudget = totalEquity + loan, netPurchasePower < gross, isEstimate true, assumptions non-empty, warnings include 기존대출 0 warning", () => {
    const profile = makeProfile({
      householdIncomeKrwYear: 100_000_000,
      seedMoneyKrw: 300_000_000,
      existingLoanMonthlyKrw: 0,
      hasOwnedHomeBefore: false,
    });

    const result = estimateBudget(profile);

    expect(result.loanEstimateKrw).toBeGreaterThan(0);
    expect(result.grossBudgetKrw).toBe(result.totalEquityKrw + result.loanEstimateKrw);
    expect(result.netPurchasePowerKrw).toBeLessThan(result.grossBudgetKrw);
    expect(result.isEstimate).toBe(true);
    expect(result.assumptions.length).toBeGreaterThan(0);
    expect(
      result.warnings.some((w) => w.includes("기존 대출을 0으로 입력")),
    ).toBe(true);
  });

  it("zero income → loanEstimateKrw === 0", () => {
    const profile = makeProfile({ householdIncomeKrwYear: 0 });
    const result = estimateBudget(profile);
    expect(result.loanEstimateKrw).toBe(0);
  });

  it("existing loan consumes all DSR allowance → loanEstimateKrw === 0", () => {
    // Monthly DSR allowance = 100M * 0.4 / 12 ≈ 3,333,333 won
    // Existing loan equal to that leaves 0 available.
    const profile = makeProfile({
      householdIncomeKrwYear: 100_000_000,
      existingLoanMonthlyKrw: (100_000_000 * 0.4) / 12,
    });
    const result = estimateBudget(profile);
    expect(result.loanEstimateKrw).toBe(0);
  });

  it("생애최초 (hasOwnedHomeBefore=false) loan >= 기보유 (hasOwnedHomeBefore=true) loan", () => {
    const baseProfile = makeProfile({
      householdIncomeKrwYear: 100_000_000,
      seedMoneyKrw: 300_000_000,
      existingLoanMonthlyKrw: 0,
    });

    const firstTimeBuyer = estimateBudget({ ...baseProfile, hasOwnedHomeBefore: false });
    const previousOwner = estimateBudget({ ...baseProfile, hasOwnedHomeBefore: true });

    expect(firstTimeBuyer.loanEstimateKrw).toBeGreaterThanOrEqual(
      previousOwner.loanEstimateKrw,
    );
  });

  it("all KRW outputs are integers", () => {
    const profile = makeProfile();
    const result = estimateBudget(profile);

    expect(Number.isInteger(result.seedMoneyKrw)).toBe(true);
    expect(Number.isInteger(result.loanEstimateKrw)).toBe(true);
    expect(Number.isInteger(result.grossBudgetKrw)).toBe(true);
    expect(Number.isInteger(result.acquisitionCostsKrw)).toBe(true);
    expect(Number.isInteger(result.netPurchasePowerKrw)).toBe(true);
    expect(Number.isInteger(result.monthlyPaymentKrw)).toBe(true);
  });

  it("대출 > 0 이면 monthlyPaymentKrw > 0", () => {
    const profile = makeProfile({
      householdIncomeKrwYear: 100_000_000,
      seedMoneyKrw: 300_000_000,
      existingLoanMonthlyKrw: 0,
    });
    const result = estimateBudget(profile);

    if (result.loanEstimateKrw > 0) {
      expect(result.monthlyPaymentKrw).toBeGreaterThan(0);
    } else {
      expect(result.monthlyPaymentKrw).toBe(0);
    }
  });

  it("totalEquityKrw = seedMoneyKrw (existingHome 없을 때)", () => {
    const profile = makeProfile({ seedMoneyKrw: 500_000_000 });
    const result = estimateBudget(profile);

    expect(result.homeSaleNetKrw).toBe(0);
    expect(result.capitalGainsTaxKrw).toBe(0);
    expect(result.totalEquityKrw).toBe(result.seedMoneyKrw);
  });

  it("existingHome 있으면 homeSaleNetKrw > 0 (잔금·양도세가 매도가보다 작을 때)", () => {
    const profile = makeProfile({
      seedMoneyKrw: 200_000_000,
      existingHome: {
        expectedSalePriceKrw: 800_000_000, // 8억
        remainingLoanKrw: 100_000_000,     // 잔금 1억
        qualifiesForTaxExemption: true,    // 비과세 요건 충족, 8억 ≤ 12억 → 양도세 0
      },
    });
    const result = estimateBudget(profile);

    expect(result.homeSaleNetKrw).toBeGreaterThan(0);
    // 비과세 → 양도세 0, 순수령액 = 8억 - 1억 = 7억
    expect(result.capitalGainsTaxKrw).toBe(0);
    expect(result.homeSaleNetKrw).toBe(700_000_000);
    expect(result.totalEquityKrw).toBe(
      result.seedMoneyKrw + result.homeSaleNetKrw,
    );
  });

  it("retired + 저소득 → warnings 에 은퇴 경고 포함", () => {
    const profile = makeProfile({
      householdType: "retired",
      householdIncomeKrwYear: 20_000_000,
    });
    const result = estimateBudget(profile);

    expect(
      result.warnings.some((w) => w.includes("은퇴·저소득")),
    ).toBe(true);
  });
});
