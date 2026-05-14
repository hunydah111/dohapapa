import { estimateBudget } from "@/lib/budget";
import { getCommuteMinutes } from "@/lib/commute";
import { db } from "@/lib/db";
import { AREA_RANGES, AREA_RANGE_ORDER } from "@/types/profile";
import type {
  AreaRangeKey,
  CoupleProfile,
  LatLng,
  PriorityKey,
  Workplace,
} from "@/types/profile";
import { DISCLAIMER } from "@/types/recommendation";
import type {
  CandidateSignalKey,
  CandidateTier,
  CommuteLeg,
  ComplexCandidate,
  MoreCandidate,
  RelaxationSuggestion,
  RecommendationResult,
} from "@/types/recommendation";
import { getAreaMediansForMany, pickRepresentative } from "./complexMedian";
import type { AreaMedian } from "./complexMedian";
import {
  scoreBudgetFit,
  scoreBuildingAge,
  scoreCommute,
  scoreSchool,
} from "./scoring";

// ── 가중치 빌드 ──────────────────────────────────────────────────────────────

/**
 * 사용자가 입력한 3개 조건 중요도(1~5)를 신호 가중치로 정규화한다.
 * budgetFit 은 사용자가 평가하는 항목이 아니라 하드 제약이므로 나머지 3개의 평균으로 자동 반영.
 *
 * retired 가구는 통근이 무의미하므로 commute 가중치를 0 으로 만들고 재정규화한다.
 */
function buildWeights(
  priorities: CoupleProfile["priorities"],
  householdType: CoupleProfile["householdType"],
): Record<CandidateSignalKey, number> {
  const userKeys: PriorityKey[] = ["commute", "school", "buildingAge"];
  const userVals = userKeys.map((k) => Math.max(0, priorities[k] ?? 0));

  // retired 이면 통근 가중치를 0 으로 강제 — 통근 신호 자체가 무의미한 가구
  if (householdType === "retired") {
    userVals[0] = 0;
  }

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

// ── 지리 사전필터 cutoffKm ───────────────────────────────────────────────────

/**
 * 통근 수단과 허용 시간으로 직선거리 cutoff(km)를 역산한다.
 * 50% 마진을 얹어 API/mock 추정 오차와 우회 경로를 커버한다.
 */
function calcCutoffKm(wp: Workplace): number {
  const limit = wp.maxCommuteMinutes;
  if (wp.commuteMode === "car") {
    return Math.max(8, (((limit * 1.5 - 5) * 28) / 60) * 1.5);
  }
  return Math.max(8, (((limit * 1.5 - 12) * 22) / 60) * 1.5);
}

// ── 예산 밴드 ─────────────────────────────────────────────────────────────────

/**
 * 추천 단지 가격 밴드 (부동산 전문가 패널 권고):
 * - 상한 = 예산 + 1억 (예산 초과는 강하게 제한 — "한참 비싼 집은 안 본다")
 * - 하한 = max(예산 − 1억, 예산 × 0.85) — 절대 ±1억은 저가 구간에서 의미가
 *   너무 넓어지므로(3억 예산에 2~4억은 완전 다른 동네), 비율 하한과 큰 쪽을 쓴다.
 * 가격은 단순 중위가가 아니라 complexMedian 의 "추정 현재가"를 받는다.
 */
function priceInBudgetBand(
  priceKrw: number,
  netPurchasePowerKrw: number,
): boolean {
  const upper = netPurchasePowerKrw + 100_000_000;
  const lower = Math.max(
    netPurchasePowerKrw - 100_000_000,
    netPurchasePowerKrw * 0.85,
  );
  return priceKrw >= lower && priceKrw <= upper;
}

// ── 한 줄 요약 / 리포트 ──────────────────────────────────────────────────────

/** 가중치 상위 2개 신호의 reason 을 이어 붙인다. */
function buildOneLineReason(
  reasoning: Record<CandidateSignalKey, string>,
  weights: Record<CandidateSignalKey, number>,
  hasCommuteLegs: boolean,
): string {
  const keys = (Object.keys(weights) as CandidateSignalKey[]).sort(
    (a, b) => weights[b] - weights[a],
  );
  // 통근 정보 없으면 통근 신호를 제외하고 상위 2개 선택
  const filtered = hasCommuteLegs
    ? keys
    : keys.filter((k) => k !== "commute");
  return filtered
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

  // 통근 정보 없으면 통근 문구 생략 (retired 등)
  const legText =
    c.commuteLegs.length > 0
      ? " 통근은 " +
        c.commuteLegs.map((l) => `${l.workplaceLabel} ${l.minutes}분`).join(", ") +
        "."
      : "";

  const head = `${c.sigungu} ${c.dongName} ${c.complexName}, 전용 ${c.representativeArea}㎡ 추정 현재가 ${eok}억.${legText}`;

  const orderedKeys = (Object.keys(weights) as CandidateSignalKey[])
    .filter((k) => c.commuteLegs.length > 0 || k !== "commute")
    .sort((a, b) => weights[b] - weights[a]);

  const reasons = orderedKeys
    .map((k) => c.reasoning[k])
    .filter((r) => r.length > 0)
    .slice(0, 2);
  const body = reasons.length > 0 ? ` ${reasons.join(". ")}.` : "";

  return `${head}${body} 종합 ${c.totalScore}점으로 선정.`;
}

// ── commuteSummary 생성 ───────────────────────────────────────────────────────

function buildCommuteSummary(commuteLegs: CommuteLeg[]): string {
  if (commuteLegs.length === 0) return "통근 정보 없음";
  return commuteLegs
    .map((l) => `${l.workplaceLabel} ${l.minutes}분`)
    .join("·");
}

// ── 내부 타입 ────────────────────────────────────────────────────────────────

interface ScoredComplex {
  candidate: ComplexCandidate;
  medianKrw: number;
  passedHardFilter: boolean;
}

// ── 하드 필터 통과 건수 계산 (relaxation 시뮬레이션용) ──────────────────────

/**
 * 평가된 단지 목록을 받아 변경된 구매력·통근 한도로 하드필터 통과 건수를 반환한다.
 * 이미 평가된 결과(medianKrw, commuteLegs)를 재사용하므로 추가 DB/API 호출 없음.
 */
function countPassingHardFilter(
  evaluated: ScoredComplex[],
  netPurchasePowerKrw: number,
  commuteExtraMinutes: number,
  workplaces: Workplace[],
): number {
  return evaluated.filter((e) => {
    const priceOutOfBand = !priceInBudgetBand(e.medianKrw, netPurchasePowerKrw);
    if (priceOutOfBand) return false;

    // 통근 한도를 extraMinutes 만큼 늘렸을 때도 초과하는지 확인
    const commuteTooLong = e.candidate.commuteLegs.some((leg) => {
      const wp = workplaces.find((w) =>
        leg.workplace === "A"
          ? w === workplaces[0]
          : w === workplaces[1],
      );
      const limit = (wp?.maxCommuteMinutes ?? 50) + commuteExtraMinutes;
      return leg.minutes > limit * 1.5;
    });
    return !commuteTooLong;
  }).length;
}

// ── 메인 추천 함수 ───────────────────────────────────────────────────────────

export async function recommendComplexes(
  profile: CoupleProfile,
): Promise<RecommendationResult> {
  // 1. 예산 추정
  const budget = estimateBudget(profile);
  const { netPurchasePowerKrw } = budget;

  // 2. 직장 목록 구성 — 존재하는 것만. 각 Workplace 가 commuteMode·maxCommuteMinutes 자체 보유
  const workplaces: Workplace[] = [
    profile.workplaceA,
    profile.workplaceB,
  ].filter((wp): wp is Workplace => wp !== undefined);

  const weights = buildWeights(profile.priorities, profile.householdType);

  // 3. 좌표 있는 단지 전체 로드
  const allComplexes = await db.complex.findMany({
    where: { latitude: { not: null }, longitude: { not: null } },
  });

  // 4. 지리적 사전필터
  // 직장이 있으면 각 직장별 cutoffKm 을 그 직장의 commuteMode 로 계산.
  // 직장이 0개(retired)면 사전필터 없이 전체 통과 — commuteLegs 가 빌 것이므로
  // 통근 하드필터도 적용되지 않아 과도한 제한이 없다.
  const geoSurvivors =
    workplaces.length === 0
      ? allComplexes
      : allComplexes.filter((c) => {
          const coord: LatLng = {
            lat: c.latitude as number,
            lng: c.longitude as number,
          };
          // 직장 중 하나라도 cutoff 안에 있으면 통과
          return workplaces.some((wp) => {
            const cutoffKm = calcCutoffKm(wp);
            return haversineKm(wp, coord) <= cutoffKm;
          });
        });

  // 5. 중위가 일괄 조회
  const mediansMap = await getAreaMediansForMany(geoSurvivors.map((c) => c.id));

  const areaRange = AREA_RANGES[profile.preferredAreaRange];
  const minArea = areaRange.minM2;
  const maxArea = areaRange.maxM2 ?? Number.POSITIVE_INFINITY;

  // 소규모 건물 배제 — 6개월 거래 건수를 대단지 프록시로 사용
  const MIN_TRANSACTIONS = 8;

  // 6. 단지별 평가
  const evaluated = await Promise.all(
    geoSurvivors.map(async (complex): Promise<ScoredComplex | null> => {
      const medians: AreaMedian[] = mediansMap.get(complex.id) ?? [];

      const totalTransactions = medians.reduce((s, m) => s + m.count, 0);
      if (totalTransactions < MIN_TRANSACTIONS) return null;

      const rep = pickRepresentative(medians, minArea, maxArea);
      if (rep === null) return null;

      const complexCoord: LatLng = {
        lat: complex.latitude as number,
        lng: complex.longitude as number,
      };

      // 직장별 통근 leg 계산 — 각 직장의 commuteMode 사용
      const legPromises: Promise<CommuteLeg>[] = workplaces.map((wp, idx) => {
        const wpLabel: "A" | "B" = idx === 0 ? "A" : "B";
        return getCommuteMinutes(wp, complex.id, complexCoord, wp.commuteMode).then(
          (minutes): CommuteLeg => ({
            workplace: wpLabel,
            workplaceLabel: wp.label,
            minutes,
            distanceKm: Math.round(haversineKm(wp, complexCoord) * 10) / 10,
            mode: wp.commuteMode,
            withinLimit: minutes <= wp.maxCommuteMinutes,
          }),
        );
      });
      const commuteLegs = await Promise.all(legPromises);

      // 하드 필터 — 가격은 예산 밴드 안, 통근은 허용시간 안
      const priceOutOfBand = !priceInBudgetBand(
        rep.medianKrw,
        netPurchasePowerKrw,
      );
      // 직장 없으면 통근 제약 없음 (retired)
      const commuteTooLong = commuteLegs.some((leg) => {
        const wp = workplaces.find((_, i) =>
          leg.workplace === "A" ? i === 0 : i === 1,
        );
        return leg.minutes > (wp?.maxCommuteMinutes ?? 50) * 1.5;
      });
      const passedHardFilter = !priceOutOfBand && !commuteTooLong;

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

      const hasCommuteLegs = commuteLegs.length > 0;
      // 초품아 — 초등학교가 단지에서 직선 150m 이내 (전문가 패널: 100m 는 너무 좁음)
      const isChopumah =
        complex.nearestElemSchoolM !== null &&
        complex.nearestElemSchoolM <= 150;

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
        transactionCount: rep.count,
        isChopumah,
        scores,
        tier: "균형형", // 후처리에서 재할당
        oneLineReason: buildOneLineReason(reasoning, weights, hasCommuteLegs),
        report: buildReport(base, weights),
      };

      return { candidate, medianKrw: rep.medianKrw, passedHardFilter };
    }),
  );

  const validEvaluated = evaluated.filter(
    (e): e is ScoredComplex => e !== null,
  );

  // 하드 필터 통과 단지만, 총점 내림차순
  const survivors = validEvaluated
    .filter((e) => e.passedHardFilter)
    .sort((a, b) => b.candidate.totalScore - a.candidate.totalScore);

  const consideredComplexCount = survivors.length;

  // ── P0#2 — relaxationSuggestions ────────────────────────────────────────
  // 결과 0건일 때만 계산. 조건 완화 시나리오별로 몇 곳이 통과하는지 시뮬레이션.
  const relaxationSuggestions: RelaxationSuggestion[] = [];

  if (survivors.length === 0 && validEvaluated.length > 0) {
    // (a) 예산 30% 추가 확보 가정
    const relaxedBudget = netPurchasePowerKrw * 1.3;
    const countBudgetRelax = countPassingHardFilter(
      validEvaluated,
      relaxedBudget,
      0,
      workplaces,
    );
    if (countBudgetRelax > 0) {
      const addEok = ((relaxedBudget - netPurchasePowerKrw) / 1e8).toFixed(1);
      relaxationSuggestions.push({
        message: `예산을 약 ${addEok}억 더 확보하면 ${countBudgetRelax}곳이 조건에 맞습니다`,
        resultCount: countBudgetRelax,
      });
    }

    // (b) 모든 직장 통근 허용시간 +20분
    if (workplaces.length > 0) {
      const countCommuteRelax = countPassingHardFilter(
        validEvaluated,
        netPurchasePowerKrw,
        20,
        workplaces,
      );
      if (countCommuteRelax > 0) {
        relaxationSuggestions.push({
          message: `통근 허용시간을 20분 늘리면 ${countCommuteRelax}곳이 조건에 맞습니다`,
          resultCount: countCommuteRelax,
        });
      }
    }

    // (c) 선호 평수대를 한 단계 넓힘 — 다음 단계(더 큰 평형) 시도
    const currentIdx = AREA_RANGE_ORDER.indexOf(profile.preferredAreaRange);
    const nextAreaKey: AreaRangeKey | undefined =
      currentIdx < AREA_RANGE_ORDER.length - 1
        ? AREA_RANGE_ORDER[currentIdx + 1]
        : undefined;
    if (nextAreaKey !== undefined) {
      const nextRange = AREA_RANGES[nextAreaKey];
      const nextMin = nextRange.minM2;
      const nextMax = nextRange.maxM2 ?? Number.POSITIVE_INFINITY;
      // 선호 평수대 변경 시 re-pick — validEvaluated 의 medianKrw 는 현재 대표 평형 기준이므로
      // 여기서는 근사적으로 geoSurvivors 에서 nextRange 로 재집계 수를 계산한다.
      let countAreaRelax = 0;
      for (const c of geoSurvivors) {
        const medians = mediansMap.get(c.id) ?? [];
        const totalTx = medians.reduce((s, m) => s + m.count, 0);
        if (totalTx < MIN_TRANSACTIONS) continue;
        const rep = pickRepresentative(medians, nextMin, nextMax);
        if (rep === null) continue;
        if (!priceInBudgetBand(rep.medianKrw, netPurchasePowerKrw)) continue;
        countAreaRelax++;
      }
      if (countAreaRelax > 0) {
        relaxationSuggestions.push({
          message: `선호 평수대를 "${nextRange.label}"로 조정하면 ${countAreaRelax}곳이 조건에 맞습니다`,
          resultCount: countAreaRelax,
        });
      }
    }
  }

  // ── 3티어 선정 ───────────────────────────────────────────────────────────

  const top8 = survivors.slice(0, 8);
  const chosen: { entry: ScoredComplex; tier: CandidateTier }[] = [];

  // 균형형: 총점 최고
  const balanced = survivors[0] ?? null;
  if (balanced) chosen.push({ entry: balanced, tier: "균형형" });

  // 안정형: 예산 여유 크고 통근 OK (retired 는 commuteLegs 가 비므로 every 가 항상 true)
  const stableCandidate =
    top8
      .filter((e) => e !== balanced)
      .filter((e) => e.candidate.commuteLegs.every((l) => l.withinLimit))
      .sort(
        (a, b) =>
          a.medianKrw / netPurchasePowerKrw - b.medianKrw / netPurchasePowerKrw,
      )[0] ?? null;
  if (stableCandidate) chosen.push({ entry: stableCandidate, tier: "안정형" });

  // 도전형: 예산 밴드 내에서 가장 비싼
  const chosenEntries = new Set(chosen.map((c) => c.entry));
  const challengeCandidate =
    top8
      .filter((e) => !chosenEntries.has(e))
      .filter((e) => priceInBudgetBand(e.medianKrw, netPurchasePowerKrw))
      .sort((a, b) => b.medianKrw - a.medianKrw)[0] ?? null;
  if (challengeCandidate)
    chosen.push({ entry: challengeCandidate, tier: "도전형" });

  // 3개 미만이면 남은 survivors 로 보충
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

  // ── moreCandidates — 상위 3개 다음 최대 10개, commuteSummary 포함 ──────────

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
      commuteSummary: buildCommuteSummary(e.candidate.commuteLegs),
    }));

  return {
    budget,
    candidates,
    moreCandidates,
    relaxationSuggestions,
    consideredComplexCount,
    disclaimer: DISCLAIMER,
  };
}
