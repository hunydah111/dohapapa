// 속성 기반(fast-check) 불변식 — estimateBudget 은 순수 함수라 어떤 입력 조합에도
// 깨지지 않아야 한다. "특정 입력에서 NaN/throw/음수예산" 같은 회귀를 영구 봉인한다.
import { describe, it } from "vitest";
import fc from "fast-check";
import { estimateBudget } from "@/lib/budget";
import type {
  CoupleProfile,
  HouseholdType,
  AreaRangeKey,
  PriorityKey,
} from "@/types/profile";

const won = fc.integer({ min: 0, max: 50_000_000_000 });

const household = fc.constantFrom<HouseholdType>(
  "single",
  "dualIncome",
  "singleIncome",
  "retired",
);
const area = fc.constantFrom<AreaRangeKey>(
  "under18",
  "p19_25",
  "p26_31",
  "p32_35",
  "p36_40",
  "p41_45",
  "over45",
);
const priorities = fc.record({
  commute: fc.integer({ min: 0, max: 5 }),
  school: fc.integer({ min: 0, max: 5 }),
  buildingAge: fc.integer({ min: 0, max: 5 }),
  largeComplex: fc.integer({ min: 0, max: 5 }),
}) as fc.Arbitrary<Record<PriorityKey, number>>;

const profileArb = fc.record({
  householdType: household,
  priorities,
  preferredAreaRange: area,
  hasSchoolAgedChild: fc.boolean(),
  hasInfant: fc.boolean(),
  hasTwoOrMoreChildren: fc.boolean(),
  hasThreeOrMoreChildren: fc.boolean(),
  isExpectingChild: fc.boolean(),
  householdIncomeKrwYear: won,
  seedMoneyKrw: won,
  netAssetsKrw: won,
  existingLoanMonthlyKrw: fc.integer({ min: 0, max: 20_000_000 }),
  hasOwnedHomeBefore: fc.boolean(),
  isNewlywed: fc.boolean(),
  budgetMode: fc.constantFrom<"simple" | "detailed" | undefined>(
    "simple",
    "detailed",
    undefined,
  ),
  availableBudgetKrw: fc.option(won, { nil: undefined }),
  ownedHomeCount: fc.option(fc.integer({ min: 0, max: 3 }), { nil: undefined }),
  additionalFundsKrw: fc.option(won, { nil: undefined }),
  existingHome: fc.option(
    fc.record({
      expectedSalePriceKrw: won,
      remainingLoanKrw: won,
      qualifiesForTaxExemption: fc.boolean(),
    }),
    { nil: undefined },
  ),
}) as fc.Arbitrary<CoupleProfile>;

describe("estimateBudget 속성 불변식", () => {
  it("어떤 입력에도 throw 없이 유한한 추정치를 낸다", () => {
    fc.assert(
      fc.property(profileArb, (p) => {
        const b = estimateBudget(p);
        const finite = [
          b.netPurchasePowerKrw,
          b.grossBudgetKrw,
          b.totalEquityKrw,
          b.loanEstimateKrw,
          b.acquisitionCostsKrw,
          b.monthlyPaymentKrw,
          b.capitalGainsTaxKrw,
          b.homeSaleNetKrw,
          b.seedMoneyKrw,
        ];
        for (const n of finite) {
          if (!Number.isFinite(n)) throw new Error(`비유한 값: ${n}`);
        }
        // 추정치 표기는 컴플라이언스상 항상 true
        if (b.isEstimate !== true) throw new Error("isEstimate !== true");
        // 실매수 가능가는 음수가 되면 안 됨(0 클램프)
        if (b.netPurchasePowerKrw < 0)
          throw new Error(`netPurchasePower 음수: ${b.netPurchasePowerKrw}`);
        // 결과 화면이 의존하는 배열들은 항상 존재
        if (
          !Array.isArray(b.warnings) ||
          !Array.isArray(b.assumptions) ||
          !Array.isArray(b.loanReasonLines) ||
          !Array.isArray(b.policyLoanMatches)
        )
          throw new Error("필수 배열 누락");
      }),
      { numRuns: 500 },
    );
  });
});
