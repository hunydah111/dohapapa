import type { CoupleProfile } from "@/types/profile";
import type { CommuteLeg } from "@/types/recommendation";

type ScoreResult = { score: number; reason: string };

// ── 통근 점수 ────────────────────────────────────────────────────────────────

/**
 * 직장별 CommuteLeg 목록을 받아 통근 점수를 계산한다.
 *
 * [P0 변별력] 기존 구현은 허용범위 내 모든 단지가 90~100점에 몰려 신호가 없었다.
 * 허용 비율(실제분/한도)을 0~100에 넓게 선형 매핑해 60~100 범위로 퍼지도록 한다.
 *
 * [P0 기준 통일] 하드필터 기준을 한도×1.3 으로 통일했으므로,
 * 점수 계산도 같은 상수(COMMUTE_HARD_FACTOR = 1.3)를 기준으로 감점한다.
 * 1.0배 이내 = 만점 구간, 1.0~1.3배 = 선형 감점, 1.3배 초과 = 하드필터 제거 대상.
 *
 * legs 가 비어 있으면 중립 55점 — 은퇴·무직 가구는 통근 신호가 무의미하므로
 * 50점이 아닌 55점을 줘 retired 가중치 0과 함께 결과에 영향이 없도록 한다.
 */
// 하드필터와 동일한 배수 — 이 값을 바꾸면 index.ts 의 COMMUTE_HARD_FACTOR 도 함께 바꿔야 한다.
export const COMMUTE_HARD_FACTOR = 1.3;

export function scoreCommute(
  legs: CommuteLeg[],
  profile: CoupleProfile,
): ScoreResult {
  // retired 혹은 직장 없는 경우 — 통근 정보가 없으므로 중립
  if (legs.length === 0) return { score: 55, reason: "통근 정보 없음" };

  const limitA = profile.workplaceA?.maxCommuteMinutes ?? 50;
  const limitB = profile.workplaceB?.maxCommuteMinutes ?? 50;

  const legA = legs.find((l) => l.workplace === "A");
  const legB = legs.find((l) => l.workplace === "B");

  const aMin = legA?.minutes ?? 0;
  const bMin = legB?.minutes ?? null;
  const bothPresent = bMin !== null;

  // 하드필터 기준(×1.3)을 초과했는지 여부
  const aHardOver = aMin > limitA * COMMUTE_HARD_FACTOR;
  const bHardOver = bMin !== null ? bMin > limitB * COMMUTE_HARD_FACTOR : false;

  // [변별력] 각 leg 의 비율을 0~100 점수로 변환하는 단조 함수.
  // ratio = 실제 통근시간 / 허용한도
  //   0.0  → 100점 (극단적으로 가까움)
  //   0.5  → 90점
  //   1.0  → 75점  (한도 딱 맞음 — 만점이 아님, 여유에 따라 차등)
  //   1.3  → 55점  (하드필터 경계)
  //   2.0+ → 0점
  function ratioToScore(ratio: number): number {
    if (ratio <= 0) return 100;
    if (ratio <= 1.0) {
      // 0~1 구간: 75~100 선형
      return Math.round(100 - ratio * 25);
    }
    if (ratio <= COMMUTE_HARD_FACTOR) {
      // 1.0~1.3 구간: 55~75 선형 (경계값 연속)
      const t = (ratio - 1.0) / (COMMUTE_HARD_FACTOR - 1.0); // 0→1
      return Math.round(75 - t * 20);
    }
    // 1.3 초과: 하드필터 제거 대상이지만 점수는 0까지 떨어질 수 있음
    return Math.max(0, Math.round(55 - (ratio - COMMUTE_HARD_FACTOR) * 40));
  }

  let score: number;
  let reason: string;

  if (bothPresent) {
    const aRatio = aMin / limitA;
    const bRatio = bMin / limitB;
    // 두 직장 중 나쁜 쪽에 더 가중 — 맞벌이는 두 사람 모두 중요하므로 min 기반
    const worstRatio = Math.max(aRatio, bRatio);
    const avgRatio = (aRatio + bRatio) / 2;
    // worst 70% + avg 30% 혼합으로 나쁜 쪽 반영
    const blended = worstRatio * 0.7 + avgRatio * 0.3;
    score = ratioToScore(blended);

    if (aHardOver || bHardOver) {
      reason = `본인 ${aMin}분(한도 ${limitA}분)·배우자 ${bMin}분(한도 ${limitB}분), 한도 초과`;
    } else if (aMin > limitA || bMin > limitB) {
      const over = aMin > limitA ? `본인 ${aMin}분` : `배우자 ${bMin}분`;
      reason = `${over} 허용범위 초과 — 상대방은 범위 내`;
    } else {
      reason = `본인 ${aMin}분·배우자 ${bMin}분, 둘 다 허용 범위 내`;
    }
  } else {
    const aRatio = aMin / limitA;
    score = ratioToScore(aRatio);

    if (aHardOver) {
      reason = `통근 ${aMin}분, 허용 한도(${limitA}분)의 ${COMMUTE_HARD_FACTOR}배 초과`;
    } else if (aMin > limitA) {
      reason = `통근 ${aMin}분, 허용 한도 ${limitA}분 초과`;
    } else {
      reason = `통근 ${aMin}분, 허용 범위 내`;
    }
  }

  return { score: Math.max(0, Math.min(100, score)), reason };
}

// ── 예산 적합도 점수 ─────────────────────────────────────────────────────────

/**
 * 예산 대비 가격 여유율을 완만한 기울기로 60~95 범위에 매핑한다.
 *
 * [P0 변별력] 기존 구현은 예산 내 단지가 모두 85~100점에 몰렸다.
 * 여유 0% = 70점, 10% = 80점, 30%+ = 95점으로 점수 분포를 넓힌다.
 * 100점은 자제 — 어떤 단지도 "완벽하게 저렴"하지 않다는 전문가 패널 의견 반영.
 *
 * ratio = medianPrice / netPurchasePower
 *   ratio ≤ 0.70 → 95점 (여유 30% 이상)
 *   ratio = 0.90 → 80점 (여유 10%)
 *   ratio = 1.00 → 70점 (딱 맞음)
 *   ratio = 1.05 → 55점 (5% 초과)
 *   ratio = 1.10 → 40점 (10% 초과)
 *   ratio ≥ 1.15 → 10~20점 (범위 외)
 */
export function scoreBudgetFit(
  medianPriceKrw: number,
  netPurchasePowerKrw: number,
): ScoreResult {
  if (netPurchasePowerKrw <= 0) {
    return { score: 0, reason: "구매력 정보 없음" };
  }

  const ratio = medianPriceKrw / netPurchasePowerKrw;

  // 예산을 잘 활용하는 구간(예산의 85~100%)을 최고점으로 본다. 너무 싸면
  // (예산 대비 한참 저렴) 활용도가 낮다고 보아 감점, 초과하면 더 빨리 감점.
  if (ratio <= 1.0) {
    const marginPct = Math.round((1 - ratio) * 100);
    let score: number;
    if (ratio >= 0.85) {
      score = 95; // 예산 85~100% 활용 — 최고
    } else {
      // 0.85 미만: 쌀수록 감점 (0.85→95, 0.50→60, 하한 45)
      score = Math.max(45, Math.round(95 - (0.85 - ratio) * 100));
    }
    return {
      score,
      reason:
        ratio >= 0.85
          ? `예산 거의 다 활용 (여유 ${marginPct}%)`
          : `예산보다 ${marginPct}% 저렴`,
    };
  }

  if (ratio <= 1.10) {
    // 0%~10% 초과: 95점(ratio=1.0) → 55점(ratio=1.10) 선형
    const overPct = Math.round((ratio - 1) * 100);
    const score = Math.max(55, Math.round(95 - (ratio - 1.0) * (40 / 0.10)));
    return {
      score: Math.min(95, score),
      reason: `예산 대비 ${overPct}% 초과`,
    };
  }

  // 10% 초과 ~ : 55점 이하로 급락
  const overPct = Math.round((ratio - 1) * 100);
  const score = Math.max(0, Math.round(55 - (ratio - 1.1) * (55 / 0.15)));
  return {
    score: Math.min(54, score),
    reason: `예산 대비 ${overPct}% 초과 (범위 외)`,
  };
}

// ── 학군·자녀 점수 ───────────────────────────────────────────────────────────

/**
 * 학군 점수 — "초품아 여부" 중심으로 단순화 (부동산 전문가 패널 권고).
 * - 초품아: 초등학교가 단지에서 직선 150m 이내. (100m 는 실제 초품아 단지를
 *   상당수 누락 — 전문가 다수가 150m 권고.)
 * - 그 밖엔 도보권 / 통학 부담 2단계.
 * - 학업성취도·학원가·배정 중학교는 현재 데이터 없음 (별도 과제).
 *
 * hasSchoolAgedChild: 통학 거리 부담 감점 폭에만 영향 (있으면 더 깎임).
 * 초품아 보너스는 자녀 유무와 무관하게 모든 단지 자산가치에 반영된다.
 */
export function scoreSchool(
  complex: { nearestElemSchoolM: number | null; buildYear: number | null },
  hasSchoolAgedChild: boolean,
): ScoreResult {
  const dist = complex.nearestElemSchoolM;

  if (dist === null) {
    return { score: 52, reason: "초등학교 거리 정보 없음" };
  }
  // 초품아 — 초등학교 직선 150m 이내
  if (dist <= 150) {
    return { score: 95, reason: `초품아 (초등학교 ${dist}m 이내)` };
  }
  if (dist <= 400) {
    return { score: 70, reason: `초등학교 도보권 (${dist}m)` };
  }
  // 통학 거리 부담 — 학령기 자녀가 있으면 감점 폭이 크다
  return {
    score: hasSchoolAgedChild ? 45 : 55,
    reason: `초등학교 ${dist}m — 통학 거리 부담`,
  };
}

// ── 건축연도 점수 ────────────────────────────────────────────────────────────

// WHY 중립화: 연식의 가치(신축 프리미엄·재건축 기대 등)는 이미 실거래가에 반영된다.
// 노후 단지를 점수로 감점하면 "재건축 기대가 높아 비싼 구축"을 가격과 모순되게 깎게 됨.
// 따라서 연식은 별도 감점/가점하지 않고 중립(60)으로 둔다. 시장의 평가는 budgetFit(실거래가)과
// '동네 또래단지보다 비싸요' 배지(또래 대비 평단가)로 드러낸다.
export function scoreBuildingAge(buildYear: number | null): ScoreResult {
  return {
    score: 60,
    reason:
      buildYear !== null
        ? `${buildYear}년 준공 — 연식 가치는 실거래가에 반영(별도 감점 없음)`
        : "건축년도 정보 없음",
  };
}

// ── 거래 많은 단지(대단지·인기) 점수 ─────────────────────────────────────────

/**
 * 최근 6개월 거래량을 "대단지·인기 단지" 프록시로 점수화한다.
 * (세대수 데이터 도입 전 근사 — 거래가 활발할수록 규모·환금성이 큰 경향)
 * 거래 8건(분석 최소) → 0점, 약 50건 이상 → 100점.
 */
export function scoreLargeComplex(transactionCount: number): ScoreResult {
  const score = Math.max(
    0,
    Math.min(100, Math.round((transactionCount - 8) * 2.4)),
  );
  return { score, reason: `최근 6개월 거래 ${transactionCount}건` };
}
