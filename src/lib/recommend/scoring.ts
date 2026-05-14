import type { CoupleProfile } from "@/types/profile";
import type { CommuteLeg } from "@/types/recommendation";

type ScoreResult = { score: number; reason: string };

// ── 통근 점수 ────────────────────────────────────────────────────────────────

/**
 * 직장별 CommuteLeg 목록을 받아 통근 점수를 계산한다.
 * 각 leg 는 자체 maxCommuteMinutes 정보를 갖고 있지 않으므로, 여기서는
 * withinLimit 플래그와 프로필의 Workplace 목록을 함께 사용한다.
 *
 * legs 가 비어 있으면 중립 55점 — 은퇴·무직 가구는 통근 신호가 무의미하므로
 * 50점이 아닌 55점(살짝 양호)을 줘 retired 가중치 0과 함께 결과에 영향이 없도록 한다.
 */
export function scoreCommute(
  legs: CommuteLeg[],
  profile: CoupleProfile,
): ScoreResult {
  // retired 혹은 직장 없는 경우 — 통근 정보가 없으므로 중립
  if (legs.length === 0) return { score: 55, reason: "통근 정보 없음" };

  // Workplace 는 이제 직장별 maxCommuteMinutes 를 직접 보유
  const limitA =
    profile.workplaceA?.maxCommuteMinutes ?? 50;
  const limitB =
    profile.workplaceB?.maxCommuteMinutes ?? 50;

  const legA = legs.find((l) => l.workplace === "A");
  const legB = legs.find((l) => l.workplace === "B");

  const aMin = legA?.minutes ?? 0;
  const bMin = legB?.minutes ?? null;
  const bothPresent = bMin !== null;

  const aOver = aMin > limitA;
  const bOver = bMin !== null ? bMin > limitB : false;
  const anyOver = aOver || bOver;
  const allOver = bothPresent ? aOver && bOver : aOver;

  let score: number;
  let reason: string;

  if (!anyOver) {
    // 둘 다 허용 범위 내 → 90–100
    const aRatio = aMin / limitA;
    const bRatio = bMin !== null ? bMin / limitB : 0;
    const avgRatio = bothPresent ? (aRatio + bRatio) / 2 : aRatio;
    score = Math.round(100 - avgRatio * 10);
    score = Math.max(90, Math.min(100, score));

    if (bothPresent) {
      reason = `본인 ${aMin}분·배우자 ${bMin}분, 둘 다 허용 범위 내`;
    } else {
      reason = `통근 ${aMin}분, 허용 범위 내`;
    }
  } else if (allOver) {
    // 둘 다 초과 → 0–30
    const aExcess = aMin / limitA;
    const bExcess = bMin !== null ? bMin / limitB : aExcess;
    const avgExcess = bothPresent ? (aExcess + bExcess) / 2 : aExcess;
    score = Math.round(Math.max(0, 30 - (avgExcess - 1) * 30));
    score = Math.min(30, score);

    if (bothPresent) {
      reason = `본인 ${aMin}분(한도 ${limitA}분)·배우자 ${bMin}분(한도 ${limitB}분), 둘 다 초과`;
    } else {
      reason = `통근 ${aMin}분, 허용 한도 ${limitA}분 초과`;
    }
  } else {
    // 한 명만 초과 → 40–70
    const exceederRatio = aOver
      ? aMin / limitA
      : (bMin ?? 0) / limitB;
    score = Math.round(Math.max(40, 70 - (exceederRatio - 1) * 30));
    score = Math.min(70, score);

    if (aOver) {
      reason = `본인 ${aMin}분(한도 ${limitA}분) 초과·배우자 ${bMin}분 허용 범위 내`;
    } else {
      reason = `본인 ${aMin}분 허용 범위 내·배우자 ${bMin}분(한도 ${limitB}분) 초과`;
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

  const ratio = medianPriceKrw / netPurchasePowerKrw;

  if (ratio <= 1) {
    const marginPct = Math.round((1 - ratio) * 100);
    const score = Math.min(100, Math.round(70 + marginPct * 1.5));
    return { score, reason: `예산 내 여유 ${marginPct}%` };
  } else if (ratio <= 1.1) {
    const overPct = Math.round((ratio - 1) * 100);
    const score = Math.max(30, Math.min(60, Math.round(60 - overPct * 3)));
    return { score, reason: `예산 대비 ${overPct}% 초과` };
  } else {
    const overPct = Math.round((ratio - 1) * 100);
    const score = Math.round(Math.max(0, 20 - (overPct - 10) * 2));
    return { score, reason: `예산 대비 ${overPct}% 초과 (범위 외)` };
  }
}

// ── 학군·자녀 점수 ───────────────────────────────────────────────────────────

/**
 * 학군 점수 계산.
 *
 * 데이터 한계를 사용자에게 솔직히 알린다:
 * - 학업성취도·학원가·중고교 학군 데이터는 현재 없음.
 * - 초등학교 도보거리(nearestElemSchoolM)만 활용한다.
 * - reason 에 "초등학교 도보거리 기준 (학업성취도·학원가는 미반영)" 를 명시.
 */
export function scoreSchool(
  complex: { nearestElemSchoolM: number | null; buildYear: number | null },
  childrenAges: number[],
): ScoreResult {
  // 자녀 없음 — 학군 신호 자체가 무의미
  if (childrenAges.length === 0) {
    return { score: 55, reason: "자녀 없음 — 학군 비중 낮음" };
  }

  const hasElem = childrenAges.some((a) => a >= 7 && a <= 12);
  const hasToddler = childrenAges.some((a) => a >= 0 && a <= 6);
  const hasMiddleUp = childrenAges.some((a) => a >= 13);

  const dist = complex.nearestElemSchoolM;

  // 중고등 자녀만 있는 경우 — 해당 학군 데이터가 없으므로 중립
  if (hasMiddleUp && !hasElem && !hasToddler) {
    return {
      score: 55,
      reason: "중·고등 학군 데이터 미반영 — 학교알리미 등 별도 확인 권고",
    };
  }

  const HONEST_SUFFIX = " (학업성취도·학원가는 미반영)";

  let score = 55;
  const parts: string[] = [];

  if (hasElem) {
    // 초등 자녀 — 도보거리 기준으로 점수화
    if (dist === null) {
      score = 50;
      parts.push(`초등학교 거리 정보 없음 — 직접 확인 필요${HONEST_SUFFIX}`);
    } else if (dist <= 300) {
      score = 90;
      parts.push(
        `초등학교 ${dist}m — 도보 매우 가까움. 초등학교 도보거리 기준${HONEST_SUFFIX}`,
      );
    } else if (dist <= 600) {
      score = 70;
      parts.push(
        `초등학교 ${dist}m — 도보 가능. 초등학교 도보거리 기준${HONEST_SUFFIX}`,
      );
    } else {
      score = 45;
      parts.push(
        `초등학교 ${dist}m — 통학 거리 부담 있음. 초등학교 도보거리 기준${HONEST_SUFFIX}`,
      );
    }
  } else if (hasToddler) {
    // 미취학 아동 — 초등 준비 관점에서 완화 적용
    if (dist === null) {
      score = 55;
      parts.push(`초등학교 거리 정보 없음 (미취학 아동)${HONEST_SUFFIX}`);
    } else if (dist <= 400) {
      score = 80;
      parts.push(
        `초등학교 ${dist}m — 입학 후 통학 양호 예상. 초등학교 도보거리 기준${HONEST_SUFFIX}`,
      );
    } else if (dist <= 800) {
      score = 65;
      parts.push(
        `초등학교 ${dist}m — 입학 후 통학 무난. 초등학교 도보거리 기준${HONEST_SUFFIX}`,
      );
    } else {
      score = 45;
      parts.push(
        `초등학교 ${dist}m — 입학 후 통학 거리 확인 필요. 초등학교 도보거리 기준${HONEST_SUFFIX}`,
      );
    }
  }

  // 중고등 자녀도 동시에 있는 경우 — 점수를 중립값과 blend
  if (hasMiddleUp) {
    parts.push("중·고등 학군 데이터 미반영 — 학교알리미 등 별도 확인 권고");
    score = Math.round((score + 55) / 2);
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
