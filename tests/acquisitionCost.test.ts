import { describe, it, expect } from "vitest";
import { estimateAcquisitionCosts } from "@/lib/acquisitionCost";
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
    hasThreeOrMoreChildren: false,
    isExpectingChild: false,
    householdIncomeKrwYear: 80_000_000,
    seedMoneyKrw: 200_000_000,
    netAssetsKrw: 200_000_000,
    existingLoanMonthlyKrw: 0,
    hasOwnedHomeBefore: false,
    isNewlywed: false,
    ...overrides,
  };
}

const BILLION = 100_000_000; // 1억

describe("estimateAcquisitionCosts", () => {
  it("5억 매물 → 취득세 실효율 ≈ 1.1%, total > 0, breakdown non-empty", () => {
    const price = 5 * BILLION;
    const profile = makeProfile({ hasOwnedHomeBefore: true }); // 감면 제외
    const result = estimateAcquisitionCosts(price, profile);

    const effectiveRate = result.acquisitionTaxKrw / price;
    // 5억 is below 6억 bracket → 1.1%
    expect(effectiveRate).toBeCloseTo(0.011, 2);
    expect(result.totalKrw).toBeGreaterThan(0);
    expect(result.breakdown.length).toBeGreaterThan(0);
  });

  it("12억 매물 → 취득세 실효율 ≈ 3.3%", () => {
    const price = 12 * BILLION;
    const profile = makeProfile({ hasOwnedHomeBefore: true }); // no 감면
    const result = estimateAcquisitionCosts(price, profile);

    const effectiveRate = result.acquisitionTaxKrw / price;
    // 12억 is above 9억 bracket → 3.3%
    expect(effectiveRate).toBeCloseTo(0.033, 2);
  });

  it("생애최초 + 10억 매물 → 취득세에 200만원 감면 적용 (기보유보다 낮음)", () => {
    const price = 10 * BILLION;
    const firstTimeBuyer = estimateAcquisitionCosts(
      price,
      makeProfile({ hasOwnedHomeBefore: false }),
    );
    const previousOwner = estimateAcquisitionCosts(
      price,
      makeProfile({ hasOwnedHomeBefore: true }),
    );

    // 생애최초 gets 200만원 discount → lower acquisition tax
    expect(firstTimeBuyer.acquisitionTaxKrw).toBeLessThan(
      previousOwner.acquisitionTaxKrw,
    );
    expect(
      previousOwner.acquisitionTaxKrw - firstTimeBuyer.acquisitionTaxKrw,
    ).toBe(2_000_000);
  });

  it("all outputs are integers", () => {
    const price = 7 * BILLION;
    const profile = makeProfile({ hasOwnedHomeBefore: false });
    const result = estimateAcquisitionCosts(price, profile);

    expect(Number.isInteger(result.acquisitionTaxKrw)).toBe(true);
    expect(Number.isInteger(result.brokerFeeKrw)).toBe(true);
    expect(Number.isInteger(result.miscKrw)).toBe(true);
    expect(Number.isInteger(result.totalKrw)).toBe(true);
  });

  it("totalKrw equals sum of components", () => {
    const price = 8 * BILLION;
    const profile = makeProfile({ hasOwnedHomeBefore: false });
    const result = estimateAcquisitionCosts(price, profile);

    expect(result.totalKrw).toBe(
      result.acquisitionTaxKrw + result.brokerFeeKrw + result.miscKrw,
    );
  });
});
