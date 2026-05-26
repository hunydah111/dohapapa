import { describe, it, expect } from "vitest";
import { estimateBudget } from "@/lib/budget";
import type { CoupleProfile } from "@/types/profile";

function makeProfile(overrides: Partial<CoupleProfile> = {}): CoupleProfile {
  return {
    householdType: "dualIncome",
    priorities: { commute: 3, school: 3, buildingAge: 3, largeComplex: 2 },
    preferredAreaRanges: ["p32_35"],
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

  it("월부담 신호등: 대출>0이면 paymentToIncomeRatio = 월원리금/월소득", () => {
    const profile = makeProfile({
      householdIncomeKrwYear: 100_000_000,
      seedMoneyKrw: 300_000_000,
      existingLoanMonthlyKrw: 0,
    });
    const result = estimateBudget(profile);

    expect(result.loanEstimateKrw).toBeGreaterThan(0);
    expect(result.paymentToIncomeRatio).toBeDefined();
    const monthlyIncome = 100_000_000 / 12;
    expect(result.paymentToIncomeRatio!).toBeCloseTo(
      result.monthlyPaymentKrw / monthlyIncome,
      6,
    );
    expect(result.paymentToIncomeRatio!).toBeGreaterThan(0);
  });

  it("금리 스트레스: +1/+2%p 두 항목, 월원리금이 금리 따라 증가", () => {
    const profile = makeProfile({
      householdIncomeKrwYear: 100_000_000,
      seedMoneyKrw: 300_000_000,
      existingLoanMonthlyKrw: 0,
    });
    const result = estimateBudget(profile);

    expect(result.stressTest).toBeDefined();
    expect(result.stressTest!.map((s) => s.deltaRatePct)).toEqual([1, 2]);
    // 금리가 오를수록 월 원리금 증가: base < +1%p < +2%p
    expect(result.stressTest![0].monthlyPaymentKrw).toBeGreaterThan(
      result.monthlyPaymentKrw,
    );
    expect(result.stressTest![1].monthlyPaymentKrw).toBeGreaterThan(
      result.stressTest![0].monthlyPaymentKrw,
    );
    expect(
      result.stressTest!.every((s) => Number.isInteger(s.monthlyPaymentKrw)),
    ).toBe(true);
  });

  it("대출 0(소득 0)이면 신호등·스트레스 모두 undefined", () => {
    const result = estimateBudget(makeProfile({ householdIncomeKrwYear: 0 }));
    expect(result.loanEstimateKrw).toBe(0);
    expect(result.paymentToIncomeRatio).toBeUndefined();
    expect(result.stressTest).toBeUndefined();
  });

  it("간단 모드는 신호등·스트레스·안전선 없음", () => {
    const result = estimateBudget(
      makeProfile({
        budgetMode: "simple",
        availableBudgetKrw: 500_000_000,
      }),
    );
    expect(result.paymentToIncomeRatio).toBeUndefined();
    expect(result.stressTest).toBeUndefined();
    expect(result.safeLine).toBeUndefined();
  });

  it("안전선(#6): 은행 최대 월부담이 30% 초과면 safeLine 대출·월상환↓, 비율≈30%", () => {
    // 비규제지역(인천 등) — LTV 70%·DSR +1.5%p 트랙이라 월부담 30% 초과 시나리오 가능.
    // 규제지역(서울25+경기12)은 LTV 40%로 떨어져 자연 월부담이 30% 이하라 이 케이스 의미 없음.
    const result = estimateBudget(
      makeProfile({
        householdIncomeKrwYear: 100_000_000,
        seedMoneyKrw: 300_000_000,
        existingLoanMonthlyKrw: 0,
      }),
      { sigungu: "미추홀구" }, // 비규제 — 70% 트랙
    );
    // 일반 DSR 한도(40%) 적용 프로필 → 월부담 30% 초과 가정
    expect(result.paymentToIncomeRatio).toBeGreaterThan(0.3);
    expect(result.safeLine).toBeDefined();
    const safe = result.safeLine!;
    expect(safe.loanEstimateKrw).toBeLessThan(result.loanEstimateKrw);
    expect(safe.monthlyPaymentKrw).toBeLessThan(result.monthlyPaymentKrw);
    expect(safe.netPurchasePowerKrw).toBeLessThanOrEqual(
      result.netPurchasePowerKrw,
    );
    expect(safe.paymentToIncomeRatio!).toBeCloseTo(0.3, 2);
    expect(safe.stressTest).toBeDefined();
    expect(Number.isInteger(safe.loanEstimateKrw)).toBe(true);
  });

  it("대출 0이면 safeLine undefined", () => {
    const result = estimateBudget(makeProfile({ householdIncomeKrwYear: 0 }));
    expect(result.safeLine).toBeUndefined();
  });

  // ── 2025.10.15 대책: 시군구 × 보유 LTV 매트릭스 ──────────────────────────
  describe("2025.10.15 LTV 매트릭스 (sigungu 기반 분기)", () => {
    const base = {
      householdIncomeKrwYear: 100_000_000,
      seedMoneyKrw: 300_000_000,
      existingLoanMonthlyKrw: 0,
    };

    it("규제지역 무주택 → LTV 40% 트랙·스트레스 7.0%·6억 캡", () => {
      const r = estimateBudget(makeProfile({ ...base, ownedHomeCount: 0 }), {
        sigungu: "강남구",
      });
      expect(r.assumptions.some((a) => /40%/.test(a))).toBe(true);
      expect(r.assumptions.some((a) => /7\.0%/.test(a))).toBe(true);
      expect(r.assumptions.some((a) => /규제지역/.test(a))).toBe(true);
    });

    it("규제지역 1주택 보유 → LTV 0% (유주택 대출 제한)", () => {
      const r = estimateBudget(
        makeProfile({ ...base, ownedHomeCount: 1, hasOwnedHomeBefore: true }),
        { sigungu: "성남시 분당구" },
      );
      expect(r.loanEstimateKrw).toBe(0);
      expect(r.assumptions.some((a) => /유주택/.test(a))).toBe(true);
    });

    it("비규제지역 무주택 → LTV 70% 트랙·스트레스 5.5%·캡 없음", () => {
      const reg = estimateBudget(makeProfile({ ...base, ownedHomeCount: 0 }), {
        sigungu: "강남구", // 규제
      });
      const nonReg = estimateBudget(
        makeProfile({ ...base, ownedHomeCount: 0 }),
        { sigungu: "미추홀구" }, // 인천·비규제
      );
      // 비규제(70%·5.5%·캡無)가 규제(40%·7.0%·6억캡)보다 대출 더 많이 나옴
      expect(nonReg.loanEstimateKrw).toBeGreaterThan(reg.loanEstimateKrw);
      expect(nonReg.assumptions.some((a) => /70%/.test(a))).toBe(true);
      expect(nonReg.assumptions.some((a) => /5\.5%/.test(a))).toBe(true);
      expect(nonReg.assumptions.some((a) => /비규제지역/.test(a))).toBe(true);
    });

    it("비규제지역 1주택 → LTV 60%", () => {
      const r = estimateBudget(
        makeProfile({ ...base, ownedHomeCount: 1, hasOwnedHomeBefore: true }),
        { sigungu: "구리시" },
      );
      expect(r.loanEstimateKrw).toBeGreaterThan(0);
      expect(r.assumptions.some((a) => /60%/.test(a))).toBe(true);
    });

    it("2주택+ 는 규제·비규제 무관 LTV 0", () => {
      const reg = estimateBudget(
        makeProfile({ ...base, ownedHomeCount: 2, hasOwnedHomeBefore: true }),
        { sigungu: "강남구" },
      );
      const nonReg = estimateBudget(
        makeProfile({ ...base, ownedHomeCount: 2, hasOwnedHomeBefore: true }),
        { sigungu: "구리시" },
      );
      expect(reg.loanEstimateKrw).toBe(0);
      expect(nonReg.loanEstimateKrw).toBe(0);
    });

    it("sigungu 미지정 → 보수적 규제 가정 (예산 과대 추정 회피)", () => {
      const noSgg = estimateBudget(makeProfile({ ...base, ownedHomeCount: 0 }));
      const reg = estimateBudget(
        makeProfile({ ...base, ownedHomeCount: 0 }),
        { sigungu: "강남구" },
      );
      // 미지정 결과 = 규제 결과 (동일 LTV 40%·스트레스 7.0%)
      expect(noSgg.loanEstimateKrw).toBe(reg.loanEstimateKrw);
      expect(noSgg.assumptions.some((a) => /동네 미지정/.test(a))).toBe(true);
    });
  });
});
