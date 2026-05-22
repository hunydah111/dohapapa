import { describe, it, expect } from "vitest";
import {
  scoreCommute,
  scoreBudgetFit,
  scoreSchool,
  scoreBuildingAge,
} from "@/lib/recommend/scoring";
import type { CoupleProfile } from "@/types/profile";
import type { CommuteLeg } from "@/types/recommendation";

// ── helpers ──────────────────────────────────────────────────────────────────

// CoupleProfile 픽스처 — 새 타입: Workplace 에 commuteMode·maxCommuteMinutes 포함,
// householdType·preferredAreaRange 필수, 전역 commuteMode/maxCommuteMinutes 제거
function makeProfile(overrides: Partial<CoupleProfile> = {}): CoupleProfile {
  return {
    householdType: "dualIncome",
    priorities: { commute: 5, school: 3, buildingAge: 2, largeComplex: 2 },
    preferredAreaRanges: ["p32_35"],
    workplaceA: {
      label: "직장A",
      lat: 37.5665,
      lng: 126.978,
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

function inRange(score: number): boolean {
  return score >= 0 && score <= 100;
}

/**
 * CommuteLeg 픽스처 — 필수 필드: workplace, workplaceLabel, workplaceLat,
 * workplaceLng, minutes, distanceKm, mode, maxCommuteMinutes, withinLimit.
 */
function leg(
  workplace: "A" | "B",
  minutes: number,
  withinLimit: boolean,
): CommuteLeg {
  return {
    workplace,
    workplaceLabel: workplace === "A" ? "직장A" : "직장B",
    workplaceLat: 37.5,
    workplaceLng: 127.0,
    minutes,
    distanceKm: 0,
    mode: "car",
    maxCommuteMinutes: 50,
    withinLimit,
  };
}

// ── scoreCommute ──────────────────────────────────────────────────────────────

describe("scoreCommute", () => {
  it("both legs within limit → high score (≥80)", () => {
    const legs: CommuteLeg[] = [leg("A", 30, true), leg("B", 25, true)];
    // workplaceA·B 의 maxCommuteMinutes 로 한도를 직접 지정
    const profile = makeProfile({
      workplaceA: {
        label: "직장A",
        lat: 37.5665,
        lng: 126.978,
        commuteMode: "car",
        maxCommuteMinutes: 50,
      },
      workplaceB: {
        label: "직장B",
        lat: 37.5,
        lng: 127.0,
        commuteMode: "car",
        maxCommuteMinutes: 50,
      },
    });
    const { score, reason } = scoreCommute(legs, profile);

    expect(score).toBeGreaterThanOrEqual(80);
    expect(inRange(score)).toBe(true);
    expect(reason.length).toBeGreaterThan(0);
  });

  it("both legs far over limit → low score (≤30)", () => {
    const legs: CommuteLeg[] = [leg("A", 120, false), leg("B", 110, false)];
    const profile = makeProfile({
      workplaceA: {
        label: "직장A",
        lat: 37.5665,
        lng: 126.978,
        commuteMode: "car",
        maxCommuteMinutes: 50,
      },
      workplaceB: {
        label: "직장B",
        lat: 37.5,
        lng: 127.0,
        commuteMode: "car",
        maxCommuteMinutes: 50,
      },
    });
    const { score, reason } = scoreCommute(legs, profile);

    expect(score).toBeLessThanOrEqual(30);
    expect(inRange(score)).toBe(true);
    expect(reason.length).toBeGreaterThan(0);
  });

  it("empty legs → score 55 with 통근 정보 없음", () => {
    // retired 처럼 직장 없는 경우 — 중립 55 반환
    const profile = makeProfile({ householdType: "retired", workplaceA: undefined });
    const { score, reason } = scoreCommute([], profile);

    expect(score).toBe(55);
    expect(reason).toBe("통근 정보 없음");
  });

  it("single leg (외벌이·1인가구) within limit → score ≥ 80", () => {
    const legs: CommuteLeg[] = [leg("A", 20, true)];
    const profile = makeProfile({
      householdType: "singleIncome",
      workplaceA: {
        label: "직장A",
        lat: 37.5665,
        lng: 126.978,
        commuteMode: "car",
        maxCommuteMinutes: 50,
      },
    });
    const { score } = scoreCommute(legs, profile);

    expect(score).toBeGreaterThanOrEqual(80);
    expect(inRange(score)).toBe(true);
  });

  it("score is always in [0, 100]", () => {
    const cases: CommuteLeg[][] = [
      [leg("A", 5, true)],
      [leg("A", 200, false)],
      [leg("A", 60, false), leg("B", 40, true)],
    ];
    const profile = makeProfile();
    for (const legs of cases) {
      const { score } = scoreCommute(legs, profile);
      expect(inRange(score)).toBe(true);
    }
  });

  it("car mode workplace — reads maxCommuteMinutes from workplaceA", () => {
    // 자차 통근 직장, 허용 40분인데 35분 → 허용 범위 내 (ratio 0.875)
    // 새 점수 분포: ratio 0→100, 1.0→75. 0.875 → 약 78점. 허용 범위 내는 75점 이상.
    const legs: CommuteLeg[] = [leg("A", 35, true)];
    const profile = makeProfile({
      workplaceA: {
        label: "자차직장",
        lat: 37.5,
        lng: 127.0,
        commuteMode: "car",
        maxCommuteMinutes: 40,
      },
    });
    const { score } = scoreCommute(legs, profile);
    expect(score).toBeGreaterThanOrEqual(75);
  });
});

// ── scoreBudgetFit ────────────────────────────────────────────────────────────

describe("scoreBudgetFit", () => {
  it("median well under net purchase power → high score (≥70)", () => {
    const netPower = 500_000_000;
    const median = netPower * 0.7;
    const { score, reason } = scoreBudgetFit(median, netPower);

    expect(score).toBeGreaterThanOrEqual(70);
    expect(inRange(score)).toBe(true);
    expect(reason.length).toBeGreaterThan(0);
  });

  it("median 30% over net purchase power → low score (≤20)", () => {
    const netPower = 500_000_000;
    const median = netPower * 1.3;
    const { score, reason } = scoreBudgetFit(median, netPower);

    expect(score).toBeLessThanOrEqual(20);
    expect(inRange(score)).toBe(true);
    expect(reason.length).toBeGreaterThan(0);
  });

  it("median exactly equal to net power → score in 30–100 range", () => {
    const netPower = 500_000_000;
    const { score } = scoreBudgetFit(netPower, netPower);

    expect(score).toBeGreaterThanOrEqual(30);
    expect(score).toBeLessThanOrEqual(100);
    expect(inRange(score)).toBe(true);
  });

  it("netPurchasePowerKrw <= 0 → score 0", () => {
    const { score } = scoreBudgetFit(500_000_000, 0);
    expect(score).toBe(0);
  });

  it("score is always in [0, 100]", () => {
    const netPower = 600_000_000;
    const medians = [
      300_000_000,
      600_000_000,
      700_000_000,
      900_000_000,
      1_200_000_000,
    ];
    for (const median of medians) {
      const { score } = scoreBudgetFit(median, netPower);
      expect(inRange(score)).toBe(true);
    }
  });
});

// ── scoreSchool ───────────────────────────────────────────────────────────────

describe("scoreSchool", () => {
  it("초등학교 150m 이내 → 초품아, score 95", () => {
    const { score, reason } = scoreSchool(
      { nearestElemSchoolM: 120, buildYear: 2010 },
      true,
    );
    expect(score).toBe(95);
    expect(reason).toContain("초품아");
  });

  it("초등학교 도보권(150~400m) → score 70", () => {
    const { score, reason } = scoreSchool(
      { nearestElemSchoolM: 300, buildYear: 2010 },
      true,
    );
    expect(score).toBe(70);
    expect(reason).toContain("도보권");
  });

  it("초등학교 400m 초과 + 학령기 자녀 있음 → score 45 (통학 부담)", () => {
    const { score, reason } = scoreSchool(
      { nearestElemSchoolM: 800, buildYear: 2005 },
      true,
    );
    expect(score).toBe(45);
    expect(reason).toContain("통학 거리 부담");
  });

  it("초등학교 400m 초과 + 학령기 자녀 없음 → score 55", () => {
    const { score } = scoreSchool(
      { nearestElemSchoolM: 800, buildYear: 2005 },
      false,
    );
    expect(score).toBe(55);
  });

  it("거리 정보 없음 → score 52", () => {
    const { score, reason } = scoreSchool(
      { nearestElemSchoolM: null, buildYear: 2010 },
      true,
    );
    expect(score).toBe(52);
    expect(reason).toContain("정보 없음");
  });

  it("score is always in [0, 100] and reason is non-empty", () => {
    const cases: [
      { nearestElemSchoolM: number | null; buildYear: number | null },
      boolean,
    ][] = [
      [{ nearestElemSchoolM: null, buildYear: null }, false],
      [{ nearestElemSchoolM: 100, buildYear: 2020 }, true],
      [{ nearestElemSchoolM: 500, buildYear: 2010 }, true],
      [{ nearestElemSchoolM: 900, buildYear: 2000 }, true],
      [{ nearestElemSchoolM: 150, buildYear: null }, true],
    ];

    for (const [complex, hasKid] of cases) {
      const { score, reason } = scoreSchool(complex, hasKid);
      expect(inRange(score)).toBe(true);
      expect(reason.length).toBeGreaterThan(0);
    }
  });
});

// ── scoreBuildingAge ──────────────────────────────────────────────────────────

describe("scoreBuildingAge", () => {
  it("연식과 무관하게 중립(60) — 가치는 실거래가에 반영되므로 별도 감점/가점 안 함", () => {
    expect(scoreBuildingAge(2020).score).toBe(60);
    expect(scoreBuildingAge(2000).score).toBe(60);
    expect(scoreBuildingAge(1980).score).toBe(60);
    expect(scoreBuildingAge(null).score).toBe(60);
  });

  it("score is always in [0, 100] and reason is non-empty", () => {
    const years: (number | null)[] = [
      null,
      1975,
      1985,
      1995,
      2005,
      2015,
      2023,
    ];
    for (const year of years) {
      const { score, reason } = scoreBuildingAge(year);
      expect(inRange(score)).toBe(true);
      expect(reason.length).toBeGreaterThan(0);
    }
  });
});
