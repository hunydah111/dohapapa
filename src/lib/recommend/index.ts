import { estimateBudget } from "@/lib/budget";
import { getCommuteMinutes } from "@/lib/commute";
import { db } from "@/lib/db";
import { DEFAULT_MAX_COMMUTE_MIN } from "@/types/profile";
import type { CoupleProfile, LatLng } from "@/types/profile";
import { DISCLAIMER } from "@/types/recommendation";
import type {
  CandidateSignalKey,
  CandidateTier,
  CommuteLeg,
  ComplexCandidate,
  RecommendationResult,
} from "@/types/recommendation";
import { getAreaMediansForMany, pickRepresentative } from "./complexMedian";
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

// ── 직선거리 (haversine, km) ─────────────────────────────────────────────────

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ── 한 줄 요약 생성 ──────────────────────────────────────────────────────────

/** 가중치 상위 2개 신호의 reason 을 이어 붙인다. */
function buildOneLineReason(
  reasoning: Record<CandidateSignalKey, string>,
  weights: Record<CandidateSignalKey, number>,
): string {
  const keys = (Object.keys(weights) as CandidateSignalKey[]).sort(
    (a, b) => weights[b] - weights[a],
  );
  return keys
    .slice(0, 2)
    .map((k) => reasoning[k])
    .filter((r) => r.length > 0)
    .join(" · ");
}

// ── 메인 추천 함수 ───────────────────────────────────────────────────────────

export async function recommendComplexes(
  profile: CoupleProfile,
): Promise<RecommendationResult> {
  // 1. 예산 추정
  const budget = estimateBudget(profile);
  const { netPurchasePowerKrw } = budget;

  const limitA = profile.maxCommuteMinutesA ?? DEFAULT_MAX_COMMUTE_MIN;
  const limitB = profile.maxCommuteMinutesB ?? DEFAULT_MAX_COMMUTE_MIN;
  const weights = buildWeights(profile.priorities);

  const wA: LatLng = {
    lat: profile.workplaceA.lat,
    lng: profile.workplaceA.lng,
  };
  const wB: LatLng | null = profile.workplaceB
    ? { lat: profile.workplaceB.lat, lng: profile.workplaceB.lng }
    : null;

  // 2. 좌표 있는 단지 전체 로드
  const allComplexes = await db.complex.findMany({
    where: { latitude: { not: null }, longitude: { not: null } },
  });

  // 3. 지리적 사전필터 — 직선거리 기준으로 두 직장 중 한 곳이라도 cutoff 안이면 통과.
  //    수도권 단지 1만 개 전부에 통근·중위가 계산을 돌리면 SQLite 가 막히므로,
  //    먼저 수백~수천 개로 줄인다. cutoff 는 mock transit 역산에 50% 마진.
  const maxLimit = Math.max(limitA, limitB);
  const cutoffKm = Math.max(8, (((maxLimit * 1.5 - 12) * 22) / 60) * 1.5);

  const geoSurvivors = allComplexes.filter((c) => {
    const coord: LatLng = {
      lat: c.latitude as number,
      lng: c.longitude as number,
    };
    if (haversineKm(wA, coord) <= cutoffKm) return true;
    if (wB && haversineKm(wB, coord) <= cutoffKm) return true;
    return false;
  });

  // 4. 중위가 일괄 조회 (단지별 개별 쿼리 대신 청크 쿼리)
  const mediansMap = await getAreaMediansForMany(geoSurvivors.map((c) => c.id));

  // 가족 규모에 따른 최소 전용면적(㎡) — 오피스텔·초소형 원룸을 대표 평형에서 배제.
  const childCount = profile.childrenAges.length;
  const minArea = childCount >= 2 ? 60 : childCount === 1 ? 45 : 33;

  // 소규모 건물·도시형생활주택 배제. MOLIT 매매 API 에 세대수가 없어서
  // 6개월 거래 건수를 "250세대급 대단지" 프록시로 사용한다.
  // (정확한 세대수 필터는 공동주택 단지정보 API 연동이 필요.)
  const MIN_TRANSACTIONS = 8;

  // 5. 단지별 평가 — 이 시점엔 통근(mock)·점수 계산 모두 순수 함수라 I/O 없음
  interface ScoredComplex {
    candidate: ComplexCandidate;
    medianKrw: number;
    passedHardFilter: boolean;
  }

  const evaluated = await Promise.all(
    geoSurvivors.map(async (complex): Promise<ScoredComplex | null> => {
      const medians = mediansMap.get(complex.id) ?? [];

      // 거래 건수 프록시로 소규모 단지 배제
      const totalTransactions = medians.reduce((s, m) => s + m.count, 0);
      if (totalTransactions < MIN_TRANSACTIONS) return null;

      const rep = pickRepresentative(medians, minArea);
      if (rep === null) return null; // 가족용 평형 거래 데이터 없음 — 제외

      const complexCoord: LatLng = {
        lat: complex.latitude as number,
        lng: complex.longitude as number,
      };

      const legPromises: Promise<CommuteLeg>[] = [
        getCommuteMinutes(wA, complex.id, complexCoord, "transit").then(
          (minutes) => ({
            workplace: "A" as const,
            minutes,
            withinLimit: minutes <= limitA,
          }),
        ),
      ];
      if (wB) {
        legPromises.push(
          getCommuteMinutes(wB, complex.id, complexCoord, "transit").then(
            (minutes) => ({
              workplace: "B" as const,
              minutes,
              withinLimit: minutes <= limitB,
            }),
          ),
        );
      }
      const commuteLegs = await Promise.all(legPromises);

      // 하드 필터
      const priceTooHigh = rep.medianKrw > netPurchasePowerKrw * 1.1;
      const commuteTooLong = commuteLegs.some((leg) => {
        const limit = leg.workplace === "A" ? limitA : limitB;
        return leg.minutes > limit * 1.5;
      });
      const passedHardFilter = !priceTooHigh && !commuteTooLong;

      // 신호별 점수
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

      const totalScore = Math.round(
        (Object.keys(scores) as CandidateSignalKey[]).reduce(
          (sum, k) => sum + scores[k] * weights[k],
          0,
        ),
      );

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
        tier: "균형형", // 후처리에서 재할당
        oneLineReason: buildOneLineReason(reasoning, weights),
      };

      return { candidate, medianKrw: rep.medianKrw, passedHardFilter };
    }),
  );

  const validEvaluated = evaluated.filter(
    (e): e is ScoredComplex => e !== null,
  );

  // 6. 하드 필터 통과 단지만, 총점 내림차순
  const survivors = validEvaluated
    .filter((e) => e.passedHardFilter)
    .sort((a, b) => b.candidate.totalScore - a.candidate.totalScore);

  const consideredComplexCount = survivors.length;

  // 7. 3가지 티어 후보 선정
  const top8 = survivors.slice(0, 8);
  const chosen: { entry: ScoredComplex; tier: CandidateTier }[] = [];

  // 균형형: 전체 최고 점수
  const balanced = survivors[0] ?? null;
  if (balanced) chosen.push({ entry: balanced, tier: "균형형" });

  // 안정형: top8 중 예산 여유가 가장 크고 통근이 모두 허용 범위인 것
  const stableCandidate =
    top8
      .filter((e) => e !== balanced)
      .filter((e) => e.candidate.commuteLegs.every((l) => l.withinLimit))
      .sort(
        (a, b) =>
          a.medianKrw / netPurchasePowerKrw - b.medianKrw / netPurchasePowerKrw,
      )[0] ?? null;
  if (stableCandidate) chosen.push({ entry: stableCandidate, tier: "안정형" });

  // 도전형: top8 중 가격이 가장 높되 순매매력 내(×1.1)인 것
  const chosenEntries = new Set(chosen.map((c) => c.entry));
  const challengeCandidate =
    top8
      .filter((e) => !chosenEntries.has(e))
      .filter((e) => e.medianKrw <= netPurchasePowerKrw * 1.1)
      .sort((a, b) => b.medianKrw - a.medianKrw)[0] ?? null;
  if (challengeCandidate) chosen.push({ entry: challengeCandidate, tier: "도전형" });

  // 3개 미만이면 남은 survivors 로 순서대로 채운다
  const tierOrder: CandidateTier[] = ["균형형", "안정형", "도전형"];
  if (chosen.length < 3) {
    const usedEntries = new Set(chosen.map((c) => c.entry));
    for (const e of survivors) {
      if (chosen.length >= 3) break;
      if (!usedEntries.has(e)) {
        chosen.push({ entry: e, tier: tierOrder[chosen.length] });
        usedEntries.add(e);
      }
    }
  }

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
