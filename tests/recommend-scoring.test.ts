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
    priorities: { commute: 5, school: 3, buildingAge: 2 },
    preferredAreaRange: "p32_35",
    workplaceA: {
      label: "직장A",
      lat: 37.5665,
      lng: 126.978,
      commuteMode: "transit",
      maxCommuteMinutes: 50,
    },
    childrenAges: [],
    householdIncomeKrwYear: 80_000_000,
    seedMoneyKrw: 200_000_000,
    existingLoanMonthlyKrw: 0,
    hasOwnedHomeBefore: false,
    ...overrides,
  };
}

function inRange(score: number): boolean {
  return score >= 0 && score <= 100;
}

/**
 * CommuteLeg 픽스처 — 새 타입 필수 필드: workplace, workplaceLabel, minutes,
 * distanceKm, mode, withinLimit.
 */
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
    // workplaceA·B 의 maxCommuteMinutes 로 한도를 직접 지정
    const profile = makeProfile({
      workplaceA: {
        label: "직장A",
        lat: 37.5665,
        lng: 126.978,
        commuteMode: "transit",
        maxCommuteMinutes: 50,
      },
      workplaceB: {
        label: "직장B",
        lat: 37.5,
        lng: 127.0,
        commuteMode: "transit",
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
        commuteMode: "transit",
        maxCommuteMinutes: 50,
      },
      workplaceB: {
        label: "직장B",
        lat: 37.5,
        lng: 127.0,
        commuteMode: "transit",
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
        commuteMode: "transit",
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
    // 자차 통근 직장, 허용 40분인데 35분 → 범위 내
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
    expect(score).toBeGreaterThanOrEqual(80);
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
  it("empty childrenAges → score 55 with reason mentioning 자녀 없음", () => {
    const complex = { nearestElemSchoolM: 400, buildYear: 2010 };
    const { score, reason } = scoreSchool(complex, []);

    // P1#7: 자녀 없음 → 55 (이전 60 에서 변경)
    expect(score).toBe(55);
    expect(reason).toContain("자녀 없음");
  });

  it("child age 9 (초등) + nearestElemSchoolM: 200 → high score (≥80)", () => {
    const complex = { nearestElemSchoolM: 200, buildYear: 2010 };
    const { score, reason } = scoreSchool(complex, [9]);

    expect(score).toBeGreaterThanOrEqual(80);
    expect(inRange(score)).toBe(true);
    expect(reason.length).toBeGreaterThan(0);
  });

  it("초등 child + very close school (≤300m) → score = 90", () => {
    const complex = { nearestElemSchoolM: 150, buildYear: 2010 };
    const { score, reason } = scoreSchool(complex, [8]);

    // P1#7: 정직한 라벨링 — 학업성취도 미반영 명시 포함
    expect(score).toBe(90);
    expect(reason).toContain("학업성취도·학원가는 미반영");
  });

  it("초등 child + distant school (>600m) → score = 45", () => {
    const complex = { nearestElemSchoolM: 800, buildYear: 2005 };
    const { score } = scoreSchool(complex, [10]);

    expect(score).toBe(45);
  });

  it("중고등 자녀만 있는 경우 → score 55 + 데이터 미반영 안내", () => {
    const complex = { nearestElemSchoolM: 300, buildYear: 2010 };
    const { score, reason } = scoreSchool(complex, [14]);

    expect(score).toBe(55);
    expect(reason).toContain("중·고등 학군 데이터 미반영");
  });

  it("score is always in [0, 100] and reason is non-empty", () => {
    const cases: [
      { nearestElemSchoolM: number | null; buildYear: number | null },
      number[],
    ][] = [
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

  it("newer buildings score higher than older buildings", () => {
    const score2020 = scoreBuildingAge(2020).score;
    const score2000 = scoreBuildingAge(2000).score;
    const score1985 = scoreBuildingAge(1985).score;

    expect(score2020).toBeGreaterThan(score2000);
    expect(score2000).toBeGreaterThan(score1985);
  });
});
