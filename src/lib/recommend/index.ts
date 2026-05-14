import { estimateBudget } from "@/lib/budget";
import { getCommuteMinutes } from "@/lib/commute";
import { db } from "@/lib/db";
import { AREA_RANGES, DEFAULT_MAX_COMMUTE_MIN } from "@/types/profile";
import type { CoupleProfile, LatLng, PriorityKey } from "@/types/profile";
import { DISCLAIMER } from "@/types/recommendation";
import type {
  CandidateSignalKey,
  CandidateTier,
  CommuteLeg,
  ComplexCandidate,
  MoreCandidate,
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
 * 사용자가 입력한 3개 조건 중요도(1~5)를 신호 가중치로 정규화한다.
 * 예산 적합도(budgetFit)는 사용자가 평가하는 항목이 아니라 입력 소득·시드머니로
 * 정해지는 하드 제약이므로, 나머지 3개의 평균 중요도로 자동 반영한다. 합은 1.
 */
function buildWeights(
  priorities: CoupleProfile["priorities"],
): Record<CandidateSignalKey, number> {
  const userKeys: PriorityKey[] = ["commute", "school", "buildingAge"];
  const userVals = userKeys.map((k) => Math.max(0, priorities[k] ?? 0));
  const userSum = userVals.reduce((s, v) => s + v, 0);
  const budgetFitRaw = userSum > 0 ? userSum / userKeys.length : 1;

  const raw: Record<CandidateSignalKey, number> = {
    commute: userVals[0],
    school: userVals[1],
    buildingAge: userVals[2],
    budgetFit: budgetFitRaw,
  };
  const keys = Object.keys(raw) as CandidateSignalKey[];
  const total = keys.reduce((s, k) => s + raw[k], 0);

  const normalized = {} as Record<CandidateSignalKey, number>;
  if (total <= 0) {
    for (const k of keys) normalized[k] = 0.25;
  } else {
    for (const k of keys) normalized[k] = raw[k] / total;
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

// ── 한 줄 요약 / 리포트 ──────────────────────────────────────────────────────

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

/** 왜 이 단지가 뽑혔는지 2~3문장 간략 리포트. */
function buildReport(
  c: {
    complexName: string;
    sigungu: string;
    dongName: string;
    representativeArea: number;
    medianPriceKrw: number;
    commuteLegs: CommuteLeg[];
    reasoning: Record<CandidateSignalKey, string>;
    totalScore: number;
  },
  weights: Record<CandidateSignalKey, number>,
): string {
  const eok = (c.medianPriceKrw / 1e8).toFixed(1);
  const legText = c.commuteLegs
    .map((l) => `${l.workplaceLabel} ${l.minutes}분`)
    .join(", ");
  const head = `${c.sigungu} ${c.dongName} ${c.complexName}, 전용 ${c.representativeArea}㎡ 실거래 중위 ${eok}억. 통근은 ${legText}.`;

  const orderedKeys = (Object.keys(weights) as CandidateSignalKey[]).sort(
    (a, b) => weights[b] - weights[a],
  );
  const reasons = orderedKeys
    .map((k) => c.reasoning[k])
    .filter((r) => r.length > 0)
    .slice(0, 2);
  const body = reasons.length > 0 ? ` ${reasons.join(". ")}.` : "";

  return `${head}${body} 종합 ${c.totalScore}점으로 선정.`;
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
  const labelA = profile.workplaceA.label;
  const wB: LatLng | null = profile.workplaceB
    ? { lat: profile.workplaceB.lat, lng: profile.workplaceB.lng }
    : null;
  const labelB = profile.workplaceB?.label ?? "";

  // 2. 좌표 있는 단지 전체 로드
  const allComplexes = await db.complex.findMany({
    where: { latitude: { not: null }, longitude: { not: null } },
  });

  // 3. 지리적 사전필터 — 직선거리 기준으로 두 직장 중 한 곳이라도 cutoff 안이면 통과.
  //    수도권 단지 1만 개 전부에 통근·중위가 계산을 돌리면 SQLite 가 막히므로,
  //    먼저 수백~수천 개로 줄인다. cutoff 는 mock 역산에 50% 마진 (수단별 속도 반영).
  const maxLimit = Math.max(limitA, limitB);
  const mode = profile.commuteMode;
  const cutoffKm =
    mode === "car"
      ? Math.max(8, (((maxLimit * 1.5 - 5) * 28) / 60) * 1.5)
      : Math.max(8, (((maxLimit * 1.5 - 12) * 22) / 60) * 1.5);

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

  // 선호 평수대 → 대표 평형 전용면적 구간 [minArea, maxArea).
  const areaRange = AREA_RANGES[profile.preferredAreaRange];
  const minArea = areaRange.minM2;
  const maxArea = areaRange.maxM2 ?? Number.POSITIVE_INFINITY;

  // 소규모 건물·도시형생활주택 배제. MOLIT 매매 API 에 세대수가 없어서
  // 6개월 거래 건수를 "250세대급 대단지" 프록시로 사용한다.
  const MIN_TRANSACTIONS = 8;

  // 5. 단지별 평가
  interface ScoredComplex {
    candidate: ComplexCandidate;
    medianKrw: number;
    passedHardFilter: boolean;
  }

  const evaluated = await Promise.all(
    geoSurvivors.map(async (complex): Promise<ScoredComplex | null> => {
      const medians = mediansMap.get(complex.id) ?? [];

      const totalTransactions = medians.reduce((s, m) => s + m.count, 0);
      if (totalTransactions < MIN_TRANSACTIONS) return null;

      const rep = pickRepresentative(medians, minArea, maxArea);
      if (rep === null) return null; // 선호 평수대 거래 데이터 없음 — 제외

      const complexCoord: LatLng = {
        lat: complex.latitude as number,
        lng: complex.longitude as number,
      };

      const legPromises: Promise<CommuteLeg>[] = [
        getCommuteMinutes(wA, complex.id, complexCoord, mode).then(
          (minutes): CommuteLeg => ({
            workplace: "A",
            workplaceLabel: labelA,
            minutes,
            distanceKm: Math.round(haversineKm(wA, complexCoord) * 10) / 10,
            mode,
            withinLimit: minutes <= limitA,
          }),
        ),
      ];
      if (wB) {
        const wBfixed = wB;
        legPromises.push(
          getCommuteMinutes(wBfixed, complex.id, complexCoord, mode).then(
            (minutes): CommuteLeg => ({
              workplace: "B",
              workplaceLabel: labelB,
              minutes,
              distanceKm:
                Math.round(haversineKm(wBfixed, complexCoord) * 10) / 10,
              mode,
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

      const base = {
        complexName: complex.name,
        sigungu: complex.sigungu,
        dongName: complex.dongName,
        representativeArea: rep.area,
        medianPriceKrw: rep.medianKrw,
        commuteLegs,
        reasoning,
        totalScore,
      };

      const candidate: ComplexCandidate = {
        complexId: complex.id,
        ...base,
        latitude: complex.latitude as number,
        longitude: complex.longitude as number,
        scores,
        tier: "균형형", // 후처리에서 재할당
        oneLineReason: buildOneLineReason(reasoning, weights),
        report: buildReport(base, weights),
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

  const balanced = survivors[0] ?? null;
  if (balanced) chosen.push({ entry: balanced, tier: "균형형" });

  const stableCandidate =
    top8
      .filter((e) => e !== balanced)
      .filter((e) => e.candidate.commuteLegs.every((l) => l.withinLimit))
      .sort(
        (a, b) =>
          a.medianKrw / netPurchasePowerKrw - b.medianKrw / netPurchasePowerKrw,
      )[0] ?? null;
  if (stableCandidate) chosen.push({ entry: stableCandidate, tier: "안정형" });

  const chosenEntries = new Set(chosen.map((c) => c.entry));
  const challengeCandidate =
    top8
      .filter((e) => !chosenEntries.has(e))
      .filter((e) => e.medianKrw <= netPurchasePowerKrw * 1.1)
      .sort((a, b) => b.medianKrw - a.medianKrw)[0] ?? null;
  if (challengeCandidate)
    chosen.push({ entry: challengeCandidate, tier: "도전형" });

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

  // 8. 추가 후보 — 상세 3개 다음 순위 단지를 이름만 (최대 10개)
  const chosenIds = new Set(candidates.map((c) => c.complexId));
  const moreCandidates: MoreCandidate[] = survivors
    .filter((e) => !chosenIds.has(e.candidate.complexId))
    .slice(0, 10)
    .map((e) => ({
      complexId: e.candidate.complexId,
      complexName: e.candidate.complexName,
      sigungu: e.candidate.sigungu,
      dongName: e.candidate.dongName,
      representativeArea: e.candidate.representativeArea,
      medianPriceKrw: e.candidate.medianPriceKrw,
      totalScore: e.candidate.totalScore,
    }));

  return {
    budget,
    candidates,
    moreCandidates,
    consideredComplexCount,
    disclaimer: DISCLAIMER,
  };
}
