import { describe, it, expect } from "vitest";
import { policyFreshness, POLICY_META, POLICY_BASIS, evaluatePolicyLoans } from "@/lib/policyLoan";
import type { CoupleProfile } from "@/types/profile";

function profile(over: Partial<CoupleProfile> = {}): CoupleProfile {
  return {
    householdType: "dualIncome",
    priorities: { commute: 3, school: 3, buildingAge: 3, largeComplex: 2 },
    preferredAreaRanges: ["p32_35"],
    hasSchoolAgedChild: false, hasInfant: false, hasTwoOrMoreChildren: false,
    hasThreeOrMoreChildren: false, isExpectingChild: false,
    householdIncomeKrwYear: 60_000_000, seedMoneyKrw: 100_000_000, netAssetsKrw: 150_000_000,
    existingLoanMonthlyKrw: 0, hasOwnedHomeBefore: false, isNewlywed: false, ownedHomeCount: 0,
    ...over,
  };
}
const find = (p: CoupleProfile, name: string, target?: number) =>
  evaluatePolicyLoans(p, target == null ? undefined : { targetPriceKrw: target }).find((m) => m.productName === name)!;

describe("policyFreshness / POLICY_META", () => {
  const verified = new Date(`${POLICY_META.lastVerified}T00:00:00Z`);

  it("검증일 직후엔 stale 아님 + 경과일 계산", () => {
    const f = policyFreshness(new Date(verified.getTime() + 10 * 86_400_000));
    expect(f.daysSinceVerified).toBe(10);
    expect(f.stale).toBe(false);
  });

  it("120일 초과면 stale (재확인 권고)", () => {
    expect(policyFreshness(new Date(verified.getTime() + 121 * 86_400_000)).stale).toBe(true);
  });

  it("검증일 이전(시계 오차)도 음수 없이 0", () => {
    const f = policyFreshness(new Date(verified.getTime() - 5 * 86_400_000));
    expect(f.daysSinceVerified).toBe(0);
    expect(f.stale).toBe(false);
  });

  it("POLICY_BASIS는 effectiveLabel·lastVerified에서 파생", () => {
    expect(POLICY_BASIS).toContain(POLICY_META.effectiveLabel);
    expect(POLICY_BASIS).toContain(POLICY_META.lastVerified);
  });
});

describe("D2 — 주택가 요건 게이트 (targetPriceKrw)", () => {
  it("targetPriceKrw 미상이면 현행 유지(자격 그대로) — 디딤돌(일반)", () => {
    expect(find(profile(), "디딤돌(일반)").eligible).toBe(true);
  });

  it("디딤돌(일반): 5억 이하면 적격, 초과면 부적격", () => {
    expect(find(profile(), "디딤돌(일반)", 450_000_000).eligible).toBe(true);
    const over = find(profile(), "디딤돌(일반)", 550_000_000);
    expect(over.eligible).toBe(false);
    expect(over.reason).toMatch(/주택가.*초과/);
  });

  it("디딤돌(신혼): 6억 경계", () => {
    const p = profile({ isNewlywed: true, householdIncomeKrwYear: 70_000_000, netAssetsKrw: 300_000_000 });
    expect(find(p, "디딤돌(신혼)", 600_000_000).eligible).toBe(true);
    expect(find(p, "디딤돌(신혼)", 650_000_000).eligible).toBe(false);
  });

  it("신생아 특례: 9억 경계", () => {
    const p = profile({ hasInfant: true, householdIncomeKrwYear: 150_000_000 });
    expect(find(p, "신생아 특례 디딤돌", 850_000_000).eligible).toBe(true);
    expect(find(p, "신생아 특례 디딤돌", 950_000_000).eligible).toBe(false);
  });

  it("보금자리론: 6억 경계", () => {
    expect(find(profile(), "보금자리론", 600_000_000).eligible).toBe(true);
    expect(find(profile(), "보금자리론", 700_000_000).eligible).toBe(false);
  });

  it("주택가로 부적격이어도 소득 등 다른 사유와 독립 — 가격만 초과 시 가격 사유", () => {
    const r = find(profile(), "보금자리론", 700_000_000);
    expect(r.eligible).toBe(false);
    expect(r.reason).toContain("주택가");
  });
});
