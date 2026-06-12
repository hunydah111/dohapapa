import { describe, it, expect } from "vitest";
import {
  computeDdayForSigungu,
  defaultMonthlySaving,
  bandOfArea,
  DDAY_CAP_DAYS,
} from "@/lib/plan/dday";
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

// 게이트: 소득 상·중·하 3케이스 — 소득↑이면 D-day↓(단조성), 캡 동작, 디폴트 저축.
const HIGH = makeProfile({ householdIncomeKrwYear: 250_000_000, seedMoneyKrw: 1_500_000_000, netAssetsKrw: 1_500_000_000 });
const MID = makeProfile(); // 연 1억 · 시드 3억
const LOW = makeProfile({ householdIncomeKrwYear: 40_000_000, seedMoneyKrw: 30_000_000, netAssetsKrw: 30_000_000 });

describe("defaultMonthlySaving", () => {
  it("연소득 25%/12, 만원 단위 — 1억이면 월 208만", () => {
    expect(defaultMonthlySaving(MID)).toBe(2_080_000);
  });
  it("소득 0이면 0", () => {
    expect(defaultMonthlySaving(makeProfile({ householdIncomeKrwYear: 0 }))).toBe(0);
  });
});

describe("bandOfArea", () => {
  it("84㎡ → p32_35", () => {
    expect(bandOfArea(84)).toBe("p32_35");
  });
  it("59㎡ → p19_25, 경계 밖(10㎡)은 null", () => {
    expect(bandOfArea(59)).toBe("p19_25");
    expect(bandOfArea(10)).toBeNull();
  });
});

describe("computeDdayForSigungu — 소득 상·중·하 (강남구 84㎡)", () => {
  const hi = computeDdayForSigungu(HIGH, "강남구", 84);
  const mid = computeDdayForSigungu(MID, "강남구", 84);
  const lo = computeDdayForSigungu(LOW, "강남구", 84);

  it("셋 다 데이터 있는 결과를 낸다", () => {
    expect(hi).not.toBeNull();
    expect(mid).not.toBeNull();
    expect(lo).not.toBeNull();
    expect(hi!.targetKrw).toBeGreaterThan(0);
    expect(hi!.targetKrw).toBe(mid!.targetKrw); // 같은 목표가(시군구 중위)
  });

  it("단조성 — 소득·자산 높을수록 D-day 짧다 (months 오름차순: 상≤중≤하)", () => {
    const m = (r: ReturnType<typeof computeDdayForSigungu>) =>
      r!.months === null ? Number.POSITIVE_INFINITY : r!.months;
    expect(m(hi)).toBeLessThanOrEqual(m(mid));
    expect(m(mid)).toBeLessThanOrEqual(m(lo));
  });

  it("캡 일관성 — days>9,999 또는 미도달이면 capped", () => {
    for (const r of [hi, mid, lo]) {
      if (r!.days === null || r!.days > DDAY_CAP_DAYS) expect(r!.capped).toBe(true);
      else expect(r!.capped).toBe(false);
    }
  });

  it("저소득 케이스는 강남 중위에 즉시 도달 못 한다 (months>0 또는 미도달)", () => {
    expect(lo!.months === null || lo!.months > 0).toBe(true);
  });
});

describe("computeDdayForSigungu — 폴백·엣지", () => {
  it("없는 시군구는 null (UI 조용히 숨김)", () => {
    expect(computeDdayForSigungu(MID, "존재안함시", 84)).toBeNull();
  });
  it("면적 미상이면 선호 밴드로 폴백해도 결과가 난다", () => {
    expect(computeDdayForSigungu(MID, "강남구", null)).not.toBeNull();
  });
  it("저축 오버라이드 0 + 지금 도달 불가면 미도달(null)·capped", () => {
    const r = computeDdayForSigungu(LOW, "강남구", 84, 0);
    expect(r).not.toBeNull();
    if (r!.months !== 0) {
      expect(r!.months).toBeNull();
      expect(r!.capped).toBe(true);
    }
  });
});
