import { describe, it, expect } from "vitest";
import {
  scoreCommute,
  scoreBudgetFit,
  scoreSchool,
  scoreBuildingAge,
  scoreLargeComplex,
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
  it("신축일수록 점수가 높다(단조 비증가) — 사용자가 연식을 중시할 때만 가중치로 반영", () => {
    const years = [2024, 2020, 2015, 2010, 2006, 2002, 1996, 1992, 1985];
    const scores = years.map((y) => scoreBuildingAge(y).score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
    expect(scores[0]).toBeGreaterThan(scores[scores.length - 1]); // 신축 > 노후
  });

  it("2005년 = 60점 앵커: index.ts 안정형 '준신축 이상' 필터(≥60) 경계와 일치", () => {
    expect(scoreBuildingAge(2005).score).toBeGreaterThanOrEqual(60);
    expect(scoreBuildingAge(2004).score).toBeLessThan(60);
  });

  it("건축년도 정보 없으면 중립(60)", () => {
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

// ── scoreLargeComplex ─────────────────────────────────────────────────────────

describe("scoreLargeComplex", () => {
  it("세대수 있으면 그 값으로(클수록 높음) + reason에 세대수 노출", () => {
    const big = scoreLargeComplex(10, 3000);
    const small = scoreLargeComplex(10, 200);
    expect(big.score).toBeGreaterThan(small.score);
    expect(big.reason).toContain("3,000세대");
    expect(big.reason).toContain("대단지");
  });

  it("세대수 없으면 거래량 프록시로 폴백 + 바닥 50", () => {
    expect(scoreLargeComplex(8, null).reason).toContain("거래");
    expect(scoreLargeComplex(0, null).score).toBe(50); // 거래 적어도 바닥 50
    expect(scoreLargeComplex(0).score).toBe(50); // 인자 생략도 동일
  });

  it("두 경로 모두 [0,100] 범위", () => {
    for (const [tx, h] of [[5, null], [200, null], [10, 50], [10, 9999]] as [number, number | null][]) {
      expect(inRange(scoreLargeComplex(tx, h).score)).toBe(true);
    }
  });
});
