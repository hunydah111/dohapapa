import { describe, it, expect } from "vitest";
import { estimateBudget } from "@/lib/budget";
import type { CoupleProfile } from "@/types/profile";

function makeProfile(overrides: Partial<CoupleProfile> = {}): CoupleProfile {
  return {
    priorities: { commute: 3, school: 3, buildingAge: 3 },
    workplaceA: { label: "회사A", lat: 37.5665, lng: 126.978 },
    childrenAges: [],
    householdIncomeKrwYear: 100_000_000,
    seedMoneyKrw: 300_000_000,
    existingLoanMonthlyKrw: 0,
    hasOwnedHomeBefore: false,
    ...overrides,
  };
}

describe("estimateBudget", () => {
  it("mid-income 생애최초: loan > 0, grossBudget = seed + loan, netPurchasePower < gross, isEstimate true, assumptions non-empty, warnings include 기존대출 0 warning", () => {
    const profile = makeProfile({
      householdIncomeKrwYear: 100_000_000,
      seedMoneyKrw: 300_000_000,
      existingLoanMonthlyKrw: 0,
      hasOwnedHomeBefore: false,
    });

    const result = estimateBudget(profile);

    expect(result.loanEstimateKrw).toBeGreaterThan(0);
    expect(result.grossBudgetKrw).toBe(result.seedMoneyKrw + result.loanEstimateKrw);
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
      existingLoanMonthlyKrw: 100_000_000 * 0.4 / 12, // exactly the DSR limit
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

    expect(firstTimeBuyer.loanEstimateKrw).toBeGreaterThanOrEqual(previousOwner.loanEstimateKrw);
  });

  it("all KRW outputs are integers", () => {
    const profile = makeProfile();
    const result = estimateBudget(profile);

    expect(Number.isInteger(result.seedMoneyKrw)).toBe(true);
    expect(Number.isInteger(result.loanEstimateKrw)).toBe(true);
    expect(Number.isInteger(result.grossBudgetKrw)).toBe(true);
    expect(Number.isInteger(result.acquisitionCostsKrw)).toBe(true);
    expect(Number.isInteger(result.netPurchasePowerKrw)).toBe(true);
  });
});
