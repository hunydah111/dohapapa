import { estimateBudget } from "@/lib/budget";
import { getCommuteMinutes } from "@/lib/commute";
import { db } from "@/lib/db";
import { DEFAULT_MAX_COMMUTE_MIN } from "@/types/profile";
import type { CoupleProfile } from "@/types/profile";
import { DISCLAIMER } from "@/types/recommendation";
import type {
  CandidateSignalKey,
  CandidateTier,
  CommuteLeg,
  ComplexCandidate,
  RecommendationResult,
} from "@/types/recommendation";
import { getAreaMedians, pickRepresentative } from "./complexMedian";
import {
  scoreBudgetFit,
  scoreBuildingAge,
  scoreCommute,
  scoreSchool,
} from "./scoring";

// ── 가중치 빌드 ──────────────────────────────────────────────────────────────

/**
 * 사용자가 입력한 4개 조건 중요도(1~5)를 정규화해 신호 가중치로 만든다.
 * 합은 항상 1. 모두 0이면 균등 가중(0.25씩)으로 폴백한다.
 */
function buildWeights(
  priorities: CoupleProfile["priorities"],
): Record<CandidateSignalKey, number> {
  const keys: CandidateSignalKey[] = [
    "commute",
    "budgetFit",
    "school",
    "buildingAge",
  ];
  const total = keys.reduce((s, k) => s + Math.max(0, priorities[k] ?? 0), 0);
  const normalized = {} as Record<CandidateSignalKey, number>;
  if (total <= 0) {
    for (const k of keys) normalized[k] = 0.25;
  } else {
    for (const k of keys) normalized[k] = Math.max(0, priorities[k] ?? 0) / total;
  }
  return normalized;
}

// ── 한 줄 요약 생성 ──────────────────────────────────────────────────────────

/**
 * 점수 가중치 순으로 상위 2개 신호의 reason을 이어 붙인다.
 */
function buildOneLineReason(
  reasoning: Record<CandidateSignalKey, string>,
  weights: Record<CandidateSignalKey, number>,
): string {
  const keys = (Object.keys(weights) as CandidateSignalKey[]).sort(
    (a, b) => weights[b] - weights[a],
  );
  const top2 = keys.slice(0, 2);
  return top2.map((k) => reasoning[k]).join(" · ");
}

// ── 메인 추천 함수 ───────────────────────────────────────────────────────────

export async function recommendComplexes(
  profile: CoupleProfile,
): Promise<RecommendationResult> {
  // 1. 예산 추정
  const budget = estimateBudget(profile);
  const { netPurchasePowerKrw } = budget;

  // 2. 전체 단지 로드 (좌표 없는 단지 제외)
  const allComplexes = await db.complex.findMany();
  const complexesWithCoord = allComplexes.filter(
    (c) => c.latitude !== null && c.longitude !== null,
  );

  // 3. 통근 허용 한도
  const limitA = profile.maxCommuteMinutesA ?? DEFAULT_MAX_COMMUTE_MIN;
  const limitB = profile.maxCommuteMinutesB ?? DEFAULT_MAX_COMMUTE_MIN;

  // 4. 단지별 평가 (비동기 병렬)
  const weights = buildWeights(profile.priorities);

  interface ScoredComplex {
    candidate: ComplexCandidate;
    medianKrw: number;
    passedHardFilter: boolean;
  }

  const evaluated = await Promise.all(
    complexesWithCoord.map(async (complex): Promise<ScoredComplex | null> => {
      // 4-a. 대표 평형 중위가
      const medians = await getAreaMedians(complex.id);
      const rep = pickRepresentative(medians);
      if (rep === null) return null; // 거래 데이터 없음 — 제외

      // 4-b. 통근 계산
      const complexCoord = {
        lat: complex.latitude as number,
        lng: complex.longitude as number,
      };

      const legPromises: Promise<CommuteLeg>[] = [];

      legPromises.push(
        getCommuteMinutes(
          { lat: profile.workplaceA.lat, lng: profile.workplaceA.lng },
          complex.id,
          complexCoord,
          "transit",
        ).then((minutes) => ({
          workplace: "A" as const,
          minutes,
          withinLimit: minutes <= limitA,
        })),
      );

      if (profile.workplaceB) {
        const wB = profile.workplaceB;
        legPromises.push(
          getCommuteMinutes(
            { lat: wB.lat, lng: wB.lng },
            complex.id,
            complexCoord,
            "transit",
          ).then((minutes) => ({
            workplace: "B" as const,
            minutes,
            withinLimit: minutes <= limitB,
          })),
        );
      }

      const commuteLegs = await Promise.all(legPromises);

      // 4-c. 하드 필터 조건 계산
      const priceTooHigh = rep.medianKrw > netPurchasePowerKrw * 1.1;
      const commuteTooLong = commuteLegs.some((leg) => {
        const limit = leg.workplace === "A" ? limitA : limitB;
        return leg.minutes > limit * 1.5;
      });
      const passedHardFilter = !priceTooHigh && !commuteTooLong;

      // 4-d. 신호별 점수 계산 (하드 필터 탈락해도 계산은 수행 — 탈락 표시만)
      const commuteResult = scoreCommute(commuteLegs, profile);
      const budgetResult = scoreBudgetFit(rep.medianKrw, netPurchasePowerKrw);
      const schoolResult = scoreSchool(
        {
          nearestElemSchoolM: complex.nearestElemSchoolM,
          buildYear: complex.buildYear,
        },
        profile.childrenAges,
      );
      const ageResult = scoreBuildingAge(complex.buildYear);

      const scores: Record<CandidateSignalKey, number> = {
        commute: commuteResult.score,
        budgetFit: budgetResult.score,
        school: schoolResult.score,
        buildingAge: ageResult.score,
      };

      const reasoning: Record<CandidateSignalKey, string> = {
        commute: commuteResult.reason,
        budgetFit: budgetResult.reason,
        school: schoolResult.reason,
        buildingAge: ageResult.reason,
      };

      // 4-e. 가중 합산 점수
      const totalScore = Math.round(
        (Object.keys(scores) as CandidateSignalKey[]).reduce(
          (sum, k) => sum + scores[k] * weights[k],
          0,
        ),
      );

      const oneLineReason = buildOneLineReason(reasoning, weights);

      const candidate: ComplexCandidate = {
        complexId: complex.id,
        complexName: complex.name,
        sigungu: complex.sigungu,
        dongName: complex.dongName,
        latitude: complex.latitude as number,
        longitude: complex.longitude as number,
        representativeArea: rep.area,
        medianPriceKrw: rep.medianKrw,
        commuteLegs,
        scores,
        reasoning,
        totalScore,
        // tier는 후처리에서 할당한다.
        tier: "균형형",
        oneLineReason,
      };

      return { candidate, medianKrw: rep.medianKrw, passedHardFilter };
    }),
  );

  // null(거래 데이터 없는 단지) 제거
  const validEvaluated = evaluated.filter(
    (e): e is ScoredComplex => e !== null,
  );

  // 5. 하드 필터 통과한 단지만 추출
  const survivors = validEvaluated
    .filter((e) => e.passedHardFilter)
    .sort((a, b) => b.candidate.totalScore - a.candidate.totalScore);

  const consideredComplexCount = survivors.length;

  // 6. 3가지 티어 후보 선정 ─────────────────────────────────────────────────

  const top8 = survivors.slice(0, 8);

  const chosen: { entry: ScoredComplex; tier: CandidateTier }[] = [];

  // 균형형: 전체 최고 점수
  const balanced = survivors[0] ?? null;
  if (balanced) {
    chosen.push({ entry: balanced, tier: "균형형" });
  }

  // 안정형: top8 중 예산 여유(낮은 가격비율)가 가장 크고 통근이 괜찮은 것.
  //         단, 균형형과 달라야 한다.
  const stableCandidate = top8
    .filter((e) => e !== balanced)
    .filter((e) => e.candidate.commuteLegs.every((l) => l.withinLimit))
    .sort(
      (a, b) =>
        a.medianKrw / netPurchasePowerKrw -
        b.medianKrw / netPurchasePowerKrw,
    )[0] ?? null;

  if (stableCandidate) {
    chosen.push({ entry: stableCandidate, tier: "안정형" });
  }

  // 도전형: top8 중 가격이 가장 높되 순매매력 내(×1.1 이내)인 것.
  //         균형형·안정형과 달라야 한다.
  const chosenEntries = new Set(chosen.map((c) => c.entry));
  const challengeCandidate = top8
    .filter((e) => !chosenEntries.has(e))
    .filter((e) => e.medianKrw <= netPurchasePowerKrw * 1.1)
    .sort((a, b) => b.medianKrw - a.medianKrw)[0] ?? null;

  if (challengeCandidate) {
    chosen.push({ entry: challengeCandidate, tier: "도전형" });
  }

  // 후보가 3개 미만이면 남은 survivors로 순서대로 채운다.
  const tierOrder: CandidateTier[] = ["균형형", "안정형", "도전형"];
  if (chosen.length < 3) {
    const usedEntries = new Set(chosen.map((c) => c.entry));
    for (const e of survivors) {
      if (chosen.length >= 3) break;
      if (!usedEntries.has(e)) {
        const tier = tierOrder[chosen.length];
        chosen.push({ entry: e, tier });
        usedEntries.add(e);
      }
    }
  }

  // 7. ComplexCandidate 최종 조립 (tier 할당)
  const candidates: ComplexCandidate[] = chosen.map(({ entry, tier }) => ({
    ...entry.candidate,
    tier,
  }));

  return {
    budget,
    candidates,
    consideredComplexCount,
    disclaimer: DISCLAIMER,
  };
}
