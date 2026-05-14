import { DEFAULT_MAX_COMMUTE_MIN } from "@/types/profile";
import type { CoupleProfile } from "@/types/profile";
import type { CommuteLeg } from "@/types/recommendation";

type ScoreResult = { score: number; reason: string };

// ── 통근 점수 ────────────────────────────────────────────────────────────────

/**
 * 두 직장의 통근 시간을 프로필 허용치와 비교해 점수화한다.
 * legs가 비어 있으면 중립 점수 50을 준다(단일 직장이 없는 예외 케이스 방어).
 */
export function scoreCommute(
  legs: CommuteLeg[],
  profile: CoupleProfile,
): ScoreResult {
  if (legs.length === 0) return { score: 50, reason: "통근 정보 없음" };

  const limitA = profile.maxCommuteMinutesA ?? DEFAULT_MAX_COMMUTE_MIN;
  const limitB = profile.maxCommuteMinutesB ?? DEFAULT_MAX_COMMUTE_MIN;

  const legA = legs.find((l) => l.workplace === "A");
  const legB = legs.find((l) => l.workplace === "B");

  // 직장 A는 항상 존재; B는 외벌이면 없을 수 있다.
  const aMin = legA?.minutes ?? 0;
  const aLimit = limitA;
  const bMin = legB?.minutes ?? null;
  const bLimit = limitB;

  const aOver = aMin > aLimit;
  const bOver = bMin !== null ? bMin > bLimit : false;
  const bothPresent = bMin !== null;

  // 한 명 또는 두 명 모두 초과 여부에 따라 tier 결정.
  const anyOver = aOver || bOver;
  const allOver = bothPresent ? aOver && bOver : aOver;

  let score: number;
  let reason: string;

  if (!anyOver) {
    // 둘 다 허용 범위 내 → 90–100 (여유가 클수록 높음)
    const aRatio = aMin / aLimit; // 0~1, 낮을수록 여유
    const bRatio = bMin !== null ? bMin / bLimit : 0;
    const avgRatio = bothPresent ? (aRatio + bRatio) / 2 : aRatio;
    score = Math.round(100 - avgRatio * 10); // 1.0 → 90, 0 → 100
    score = Math.max(90, Math.min(100, score));

    if (bothPresent) {
      reason = `남편 ${aMin}분·아내 ${bMin}분, 둘 다 허용 범위 내`;
    } else {
      reason = `통근 ${aMin}분, 허용 범위 내`;
    }
  } else if (allOver) {
    // 둘 다 초과 → 0–30
    const aExcess = aMin / aLimit;
    const bExcess = bMin !== null ? bMin / bLimit : aExcess;
    const avgExcess = bothPresent ? (aExcess + bExcess) / 2 : aExcess;
    score = Math.round(Math.max(0, 30 - (avgExcess - 1) * 30));
    score = Math.min(30, score);

    if (bothPresent) {
      reason = `남편 ${aMin}분(한도 ${aLimit}분)·아내 ${bMin}분(한도 ${bLimit}분), 둘 다 초과`;
    } else {
      reason = `통근 ${aMin}분, 허용 한도 ${aLimit}분 초과`;
    }
  } else {
    // 한 명만 초과 → 40–70
    const exceederRatio = aOver
      ? aMin / aLimit
      : (bMin ?? 0) / bLimit;
    score = Math.round(Math.max(40, 70 - (exceederRatio - 1) * 30));
    score = Math.min(70, score);

    if (aOver) {
      reason = `남편 ${aMin}분(한도 ${aLimit}분) 초과·아내 ${bMin}분 허용 범위 내`;
    } else {
      reason = `남편 ${aMin}분 허용 범위 내·아내 ${bMin}분(한도 ${bLimit}분) 초과`;
    }
  }

  return { score, reason };
}

// ── 예산 적합도 점수 ─────────────────────────────────────────────────────────

export function scoreBudgetFit(
  medianPriceKrw: number,
  netPurchasePowerKrw: number,
): ScoreResult {
  if (netPurchasePowerKrw <= 0) {
    return { score: 0, reason: "구매력 정보 없음" };
  }

  const ratio = medianPriceKrw / netPurchasePowerKrw; // 1.0 = 딱 예산, <1 = 여유

  if (ratio <= 1) {
    // 예산 내 — 여유율에 따라 70–100
    const marginPct = Math.round((1 - ratio) * 100);
    // ratio 0.8 → margin 20% → score ~100; ratio 1.0 → margin 0% → score 70
    const score = Math.round(70 + marginPct * 1.5);
    const clamped = Math.min(100, score);
    return { score: clamped, reason: `예산 내 여유 ${marginPct}%` };
  } else if (ratio <= 1.1) {
    // 최대 10% 초과 — 30–60
    const overPct = Math.round((ratio - 1) * 100);
    // ratio 1.01 → over 1% → score ~57; ratio 1.10 → over 10% → score 30
    const score = Math.round(60 - overPct * 3);
    const clamped = Math.max(30, Math.min(60, score));
    return { score: clamped, reason: `예산 대비 ${overPct}% 초과` };
  } else {
    // 10% 초과 → 0–20
    const overPct = Math.round((ratio - 1) * 100);
    const score = Math.round(Math.max(0, 20 - (overPct - 10) * 2));
    return { score, reason: `예산 대비 ${overPct}% 초과 (범위 외)` };
  }
}

// ── 학군·자녀 점수 ───────────────────────────────────────────────────────────

export function scoreSchool(
  complex: { nearestElemSchoolM: number | null; buildYear: number | null },
  childrenAges: number[],
): ScoreResult {
  if (childrenAges.length === 0) {
    return { score: 60, reason: "자녀 없음 — 학군 비중 낮음" };
  }

  const hasElem = childrenAges.some((a) => a >= 7 && a <= 12); // 초등
  const hasToddler = childrenAges.some((a) => a >= 0 && a <= 6); // 영유아
  const hasMiddleUp = childrenAges.some((a) => a >= 13); // 중학생 이상

  const dist = complex.nearestElemSchoolM;

  let score = 60;
  const parts: string[] = [];

  if (hasElem) {
    // 초등 자녀가 있으면 초등학교 거리 가장 중요.
    if (dist === null) {
      score = 50;
      parts.push("초등학교 거리 정보 없음");
    } else if (dist <= 300) {
      score = 95;
      parts.push(`초등학교 ${dist}m — 매우 가까움`);
    } else if (dist <= 600) {
      score = 75;
      parts.push(`초등학교 ${dist}m — 도보 가능`);
    } else {
      score = 40;
      parts.push(`초등학교 ${dist}m — 다소 멀어 통학 부담 있음`);
    }
  } else if (hasToddler && !hasMiddleUp) {
    // 영유아만 있는 경우 — 초등 준비 관점에서 완화 적용.
    if (dist === null) {
      score = 55;
      parts.push("초등학교 거리 정보 없음 (미취학 아동)");
    } else if (dist <= 400) {
      score = 80;
      parts.push(`초등학교 ${dist}m — 미취학 아동 기준 양호`);
    } else if (dist <= 800) {
      score = 65;
      parts.push(`초등학교 ${dist}m — 미취학 아동 기준 무난`);
    } else {
      score = 45;
      parts.push(`초등학교 ${dist}m — 입학 후 통학 거리 확인 필요`);
    }
  }

  if (hasMiddleUp) {
    // 중학교 이상 데이터 없음 — 점수를 중립값으로 blending.
    parts.push("중학교 이상 학군 데이터 부재 — 별도 확인 권고");
    // 이미 초등 또는 영유아 점수가 적용됐다면 평균 blending.
    if (hasElem || hasToddler) {
      score = Math.round((score + 55) / 2);
    } else {
      score = 55;
    }
  }

  return { score, reason: parts.join(" · ") || "학군 정보 없음" };
}

// ── 건축연도 점수 ────────────────────────────────────────────────────────────

export function scoreBuildingAge(buildYear: number | null): ScoreResult {
  if (buildYear === null) {
    return { score: 50, reason: "건축년도 정보 없음" };
  }

  if (buildYear >= 2015) {
    return { score: 90, reason: `${buildYear}년 준공 — 신축급` };
  } else if (buildYear >= 2005) {
    return { score: 75, reason: `${buildYear}년 준공 — 준신축` };
  } else if (buildYear >= 1995) {
    return { score: 60, reason: `${buildYear}년 준공 — 중간 연식` };
  } else if (buildYear >= 1985) {
    return {
      score: 45,
      reason: `${buildYear}년 준공 — 노후 단지 — 재건축 가능성은 별도 검토`,
    };
  } else {
    return {
      score: 40,
      reason: `${buildYear}년 준공 — 노후 단지 — 재건축 이슈 확인 필요`,
    };
  }
}
