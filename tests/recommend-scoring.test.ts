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

function makeProfile(overrides: Partial<CoupleProfile> = {}): CoupleProfile {
  return {
    priorities: { commute: 5, school: 3, buildingAge: 2 },
    workplaceA: { label: "회사A", lat: 37.5665, lng: 126.978 },
    childrenAges: [],
    householdIncomeKrwYear: 80_000_000,
    seedMoneyKrw: 200_000_000,
    existingLoanMonthlyKrw: 0,
    hasOwnedHomeBefore: false,
    maxCommuteMinutesA: 50,
    maxCommuteMinutesB: 50,
    ...overrides,
  };
}

function inRange(score: number): boolean {
  return score >= 0 && score <= 100;
}

/** scoreCommute 는 workplace/minutes/withinLimit 만 쓰므로 나머지는 더미. */
function leg(
  workplace: "A" | "B",
  minutes: number,
  withinLimit: boolean,
): CommuteLeg {
  return {
    workplace,
    workplaceLabel: workplace === "A" ? "직장A" : "직장B",
    minutes,
    distanceKm: 0,
    mode: "transit",
    withinLimit,
  };
}

// ── scoreCommute ──────────────────────────────────────────────────────────────

describe("scoreCommute", () => {
  it("both legs within limit → high score (≥80)", () => {
    const legs: CommuteLeg[] = [leg("A", 30, true), leg("B", 25, true)];
    const profile = makeProfile({ maxCommuteMinutesA: 50, maxCommuteMinutesB: 50 });
    const { score, reason } = scoreCommute(legs, profile);

    expect(score).toBeGreaterThanOrEqual(80);
    expect(inRange(score)).toBe(true);
    expect(reason.length).toBeGreaterThan(0);
  });

  it("both legs far over limit → low score (≤30)", () => {
    const legs: CommuteLeg[] = [leg("A", 120, false), leg("B", 110, false)];
    const profile = makeProfile({ maxCommuteMinutesA: 50, maxCommuteMinutesB: 50 });
    const { score, reason } = scoreCommute(legs, profile);

    expect(score).toBeLessThanOrEqual(30);
    expect(inRange(score)).toBe(true);
    expect(reason.length).toBeGreaterThan(0);
  });

  it("empty legs → score 50 with reason", () => {
    const profile = makeProfile();
    const { score, reason } = scoreCommute([], profile);

    expect(score).toBe(50);
    expect(reason).toBe("통근 정보 없음");
  });

  it("single leg (외벌이) within limit → score ≥ 80", () => {
    const legs: CommuteLeg[] = [leg("A", 20, true)];
    const profile = makeProfile({ maxCommuteMinutesA: 50 });
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
});

// ── scoreBudgetFit ────────────────────────────────────────────────────────────

describe("scoreBudgetFit", () => {
  it("median well under net purchase power → high score (≥70)", () => {
    // median is 70% of net power → well within budget
    const netPower = 500_000_000;
    const median = netPower * 0.7;
    const { score, reason } = scoreBudgetFit(median, netPower);

    expect(score).toBeGreaterThanOrEqual(70);
    expect(inRange(score)).toBe(true);
    expect(reason.length).toBeGreaterThan(0);
  });

  it("median 30% over net purchase power → low score (≤20)", () => {
    const netPower = 500_000_000;
    const median = netPower * 1.3; // 30% over
    const { score, reason } = scoreBudgetFit(median, netPower);

    expect(score).toBeLessThanOrEqual(20);
    expect(inRange(score)).toBe(true);
    expect(reason.length).toBeGreaterThan(0);
  });

  it("median exactly equal to net power → score in 30–70 range", () => {
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
    const medians = [300_000_000, 600_000_000, 700_000_000, 900_000_000, 1_200_000_000];
    for (const median of medians) {
      const { score } = scoreBudgetFit(median, netPower);
      expect(inRange(score)).toBe(true);
    }
  });
});

// ── scoreSchool ───────────────────────────────────────────────────────────────

describe("scoreSchool", () => {
  it("empty childrenAges → score ≈ 60 with reason mentioning 자녀 없음", () => {
    const complex = { nearestElemSchoolM: 400, buildYear: 2010 };
    const { score, reason } = scoreSchool(complex, []);

    expect(score).toBe(60);
    expect(reason).toContain("자녀 없음");
  });

  it("child age 9 (초등) + nearestElemSchoolM: 200 → high score (≥80)", () => {
    const complex = { nearestElemSchoolM: 200, buildYear: 2010 };
    const { score, reason } = scoreSchool(complex, [9]);

    expect(score).toBeGreaterThanOrEqual(80);
    expect(inRange(score)).toBe(true);
    expect(reason.length).toBeGreaterThan(0);
  });

  it("초등 child + very close school (≤300m) → score = 95", () => {
    const complex = { nearestElemSchoolM: 150, buildYear: 2010 };
    const { score } = scoreSchool(complex, [8]);

    expect(score).toBe(95);
  });

  it("초등 child + distant school (>600m) → score = 40", () => {
    const complex = { nearestElemSchoolM: 800, buildYear: 2005 };
    const { score } = scoreSchool(complex, [10]);

    expect(score).toBe(40);
  });

  it("score is always in [0, 100] and reason is non-empty", () => {
    const cases: [{ nearestElemSchoolM: number | null; buildYear: number | null }, number[]][] = [
      [{ nearestElemSchoolM: null, buildYear: null }, []],
      [{ nearestElemSchoolM: 100, buildYear: 2020 }, [7]],
      [{ nearestElemSchoolM: 500, buildYear: 2010 }, [3]],
      [{ nearestElemSchoolM: 900, buildYear: 2000 }, [14]],
      [{ nearestElemSchoolM: null, buildYear: null }, [5, 12]],
    ];

    for (const [complex, ages] of cases) {
      const { score, reason } = scoreSchool(complex, ages);
      expect(inRange(score)).toBe(true);
      expect(reason.length).toBeGreaterThan(0);
    }
  });
});

// ── scoreBuildingAge ──────────────────────────────────────────────────────────

describe("scoreBuildingAge", () => {
  it("buildYear 2020 → high score (≥85)", () => {
    const { score, reason } = scoreBuildingAge(2020);

    expect(score).toBeGreaterThanOrEqual(85);
    expect(inRange(score)).toBe(true);
    expect(reason.length).toBeGreaterThan(0);
  });

  it("buildYear 1980 → low score (≤45)", () => {
    const { score, reason } = scoreBuildingAge(1980);

    expect(score).toBeLessThanOrEqual(45);
    expect(inRange(score)).toBe(true);
    expect(reason.length).toBeGreaterThan(0);
  });

  it("buildYear null → score ~50", () => {
    const { score, reason } = scoreBuildingAge(null);

    expect(score).toBe(50);
    expect(reason.length).toBeGreaterThan(0);
  });

  it("score is always in [0, 100] and reason is non-empty", () => {
    const years: (number | null)[] = [null, 1975, 1985, 1995, 2005, 2015, 2023];
    for (const year of years) {
      const { score, reason } = scoreBuildingAge(year);
      expect(inRange(score)).toBe(true);
      expect(reason.length).toBeGreaterThan(0);
    }
  });

  it("newer buildings score higher than older buildings", () => {
    const score2020 = scoreBuildingAge(2020).score;
    const score2000 = scoreBuildingAge(2000).score;
    const score1985 = scoreBuildingAge(1985).score;

    expect(score2020).toBeGreaterThan(score2000);
    expect(score2000).toBeGreaterThan(score1985);
  });
});
