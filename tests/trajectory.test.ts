import { describe, it, expect } from "vitest";
import { buildLadder } from "@/lib/plan/trajectory";
import type { CoupleProfile } from "@/types/profile";

function prof(over: Partial<CoupleProfile> = {}): CoupleProfile {
  return {
    householdType: "dualIncome",
    priorities: { commute: 3, school: 3, buildingAge: 3, largeComplex: 2 },
    preferredAreaRanges: ["p32_35"],
    hasSchoolAgedChild: false, hasInfant: false, hasTwoOrMoreChildren: false,
    hasThreeOrMoreChildren: false, isExpectingChild: false,
    householdIncomeKrwYear: 100000000, seedMoneyKrw: 250000000, netAssetsKrw: 300000000,
    existingLoanMonthlyKrw: 0, hasOwnedHomeBefore: false, isNewlywed: true, ownedHomeCount: 0,
    ...over,
  };
}
const base = { band: "p32_35" as const, monthlySideKrw: 0, scenarioKey: "flat" as const };

describe("buildLadder", () => {
  it("칸 수는 최대 4 (현재 + 3)", () => {
    const l = buildLadder(prof(), { ...base, monthlySavingKrw: 2_000_000 });
    expect(l.rungs.length).toBeGreaterThan(0);
    expect(l.rungs.length).toBeLessThanOrEqual(4);
  });

  it("미래 칸은 시점·가격 모두 오름차순(사다리 위로만)", () => {
    const l = buildLadder(prof(), { ...base, monthlySavingKrw: 3_000_000 });
    for (let i = 1; i < l.rungs.length; i++) {
      // 다중 칸 시퀀스의 미래 칸은 항상 실측 개월(지평 내) — null 폴백은 단일 칸일 때만.
      expect(l.rungs[i].monthsAway!).toBeGreaterThanOrEqual(l.rungs[i - 1].monthsAway!);
      expect(l.rungs[i].entryKrw).toBeGreaterThan(l.rungs[i - 1].entryKrw);
    }
  });

  it("단조성: 저축이 많을수록 최상단 동네 도달이 빠르거나 같다", () => {
    const lo = buildLadder(prof(), { ...base, monthlySavingKrw: 1_000_000 });
    const hi = buildLadder(prof(), { ...base, monthlySavingKrw: 5_000_000 });
    const top = (l: ReturnType<typeof buildLadder>) => l.rungs[l.rungs.length - 1];
    // 저축 많으면 같은 가격대를 더 빨리 — 최상단이 더 비싸거나(더 멀리), 같은 곳이면 더 빨리
    expect(top(hi).entryKrw).toBeGreaterThanOrEqual(top(lo).entryKrw);
  });

  it("상승 시나리오는 보합보다 어렵다(미래 칸 수 ≤ 보합)", () => {
    const flat = buildLadder(prof(), { ...base, monthlySavingKrw: 2_000_000, scenarioKey: "flat" });
    const up = buildLadder(prof(), { ...base, monthlySavingKrw: 2_000_000, scenarioKey: "up" });
    const futureCount = (l: ReturnType<typeof buildLadder>) => l.rungs.filter((r) => !r.affordableNow).length;
    expect(futureCount(up)).toBeLessThanOrEqual(futureCount(flat));
  });

  it("막다른 길 금지: 저예산·상승이어도 rungs 1개 이상 + 안내 note (D7)", () => {
    const poor = buildLadder(
      prof({ householdIncomeKrwYear: 0, seedMoneyKrw: 0, netAssetsKrw: 0, budgetMode: "simple", availableBudgetKrw: 0 }),
      { ...base, monthlySavingKrw: 0, scenarioKey: "up" },
    );
    expect(poor.rungs.length).toBeGreaterThanOrEqual(1);
    expect(poor.note).toBeTruthy();
  });

  it("저축 0이고 이미 충분하면 현재 칸은 affordableNow", () => {
    const rich = buildLadder(
      prof({ seedMoneyKrw: 2_000_000_000, netAssetsKrw: 2_500_000_000 }),
      { ...base, monthlySavingKrw: 0 },
    );
    expect(rich.rungs[0].affordableNow).toBe(true);
  });
});
