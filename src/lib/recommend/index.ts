import { estimateBudget } from "@/lib/budget";
import {
  getCommuteMinutes,
  getCommuteProvider,
  mockProvider,
} from "@/lib/commute";
import type { CommuteProvider } from "@/lib/commute";
import { db } from "@/lib/db";
import { haversineKm } from "@/lib/geo";
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
  COMMUTE_HARD_FACTOR,
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

// ── 지리 사전필터 cutoffKm ───────────────────────────────────────────────────

/**
 * 통근 수단과 허용 시간으로 직선거리 cutoff(km)를 역산한다.
 * 50% 마진을 얹어 API/mock 추정 오차와 우회 경로를 커버한다.
 * (이 마진은 사전필터 여유분이며 하드필터 배수 COMMUTE_HARD_FACTOR 와 무관하다.)
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

// ── 리포트 ────────────────────────────────────────────────────────────────────

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

  const head = `${c.sigungu} ${c.dongName} ${c.complexName}, 전용 ${c.representativeArea}㎡ 실거래 중위가 ${eok}억(최근 6개월).${legText}`;

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

// ── 1·2·3등 비교 근거 ─────────────────────────────────────────────────────────
//
// 3개 후보가 모두 결정된 후, 각 후보가 왜 그 순위(=티어)인지 한 문장 설명한다.
// 사용자가 "왜 이게 1등이고 저게 2등인지" 한 눈에 납득하도록.

const TIER_HEAD: Record<CandidateTier, string> = {
  균형형: "균형형 — 종합점수 최고",
  안정형: "안정형 — 보수적인 안전 선택",
  도전형: "도전형 — 예산을 더 쓰면 잡히는 상위안",
};

function eokOf(krw: number): string {
  return (krw / 1e8).toFixed(1);
}

/** A 가 B 대비 어떤 점에서 우위인지 짧은 비교 문구. 큰 차이만 골라낸다. */
function compareTo(a: ComplexCandidate, b: ComplexCandidate, bLabel: string): string {
  const diffs: string[] = [];

  const scoreDiff = a.totalScore - b.totalScore;
  if (Math.abs(scoreDiff) >= 5) {
    diffs.push(
      `종합 ${Math.abs(scoreDiff)}점 ${scoreDiff > 0 ? "높음" : "낮음"}`,
    );
  }

  const priceDiff = a.medianPriceKrw - b.medianPriceKrw;
  if (Math.abs(priceDiff) >= 30_000_000) {
    diffs.push(
      `${eokOf(Math.abs(priceDiff))}억 ${priceDiff > 0 ? "비쌈" : "쌈"}`,
    );
  }

  const commuteA = a.commuteLegs.reduce((s, l) => s + l.minutes, 0);
  const commuteB = b.commuteLegs.reduce((s, l) => s + l.minutes, 0);
  if (commuteA > 0 && commuteB > 0 && Math.abs(commuteA - commuteB) >= 5) {
    diffs.push(
      `통근 ${Math.abs(commuteA - commuteB)}분 ${commuteA < commuteB ? "짧음" : "김"}`,
    );
  }

  if (a.buildYear !== null && b.buildYear !== null) {
    const yearDiff = a.buildYear - b.buildYear;
    if (Math.abs(yearDiff) >= 5) {
      diffs.push(
        yearDiff > 0 ? `${yearDiff}년 더 신축` : `${-yearDiff}년 더 구축`,
      );
    }
  }

  if (a.scores.school - b.scores.school >= 15) {
    diffs.push("학군 점수 더 높음");
  } else if (b.scores.school - a.scores.school >= 15) {
    diffs.push("학군 점수 더 낮음");
  }

  if (diffs.length === 0) return `${bLabel} 대비 유사 수준`;
  return `${bLabel} 대비 ${diffs.slice(0, 2).join(", ")}`;
}

/** 3개 후보가 결정된 후, 각각의 rankReason 을 채워 반환한다. */
function fillRankReasons(candidates: ComplexCandidate[]): ComplexCandidate[] {
  if (candidates.length === 0) return candidates;

  return candidates.map((c, i) => {
    const others = candidates.filter((_, j) => j !== i);
    const head = TIER_HEAD[c.tier];

    if (others.length === 0) {
      return { ...c, rankReason: head };
    }

    // 1등(균형형)이 아닌 경우는 "균형형 대비 X" 식이 자연스럽고,
    // 균형형은 "안정형/도전형 대비 X" 두 줄을 합쳐 보여준다.
    let body: string;
    if (c.tier === "균형형") {
      const parts = others.map((o) =>
        compareTo(c, o, o.tier),
      );
      body = parts.join(" · ");
    } else {
      const balanced = others.find((o) => o.tier === "균형형");
      body = balanced
        ? compareTo(c, balanced, "1등(균형형)")
        : others.map((o) => compareTo(c, o, o.tier)).join(" · ");
    }

    return { ...c, rankReason: `${head}. ${body}.` };
  });
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
 * 통근 leg 들이 (허용시간 + extraMinutes) × COMMUTE_HARD_FACTOR 를 초과하는지.
 * scoring.ts 와 동일한 COMMUTE_HARD_FACTOR 를 사용한다. (A→직장0, B→직장1)
 */
function commuteExceedsLimit(
  legs: CommuteLeg[],
  workplaces: Workplace[],
  extraMinutes: number,
): boolean {
  return legs.some((leg) => {
    const wp = leg.workplace === "A" ? workplaces[0] : workplaces[1];
    const limit = (wp?.maxCommuteMinutes ?? 50) + extraMinutes;
    return leg.minutes > limit * COMMUTE_HARD_FACTOR;
  });
}

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
  return evaluated.filter(
    (e) =>
      priceInBudgetBand(e.medianKrw, netPurchasePowerKrw) &&
      !commuteExceedsLimit(e.candidate.commuteLegs, workplaces, commuteExtraMinutes),
  ).length;
}

/**
 * 통근 조건은 만족하지만 가격이 예산 밴드 상한을 넘어 탈락한 단지 중 가장 싼 것을
 * 잡기 위해 필요한 "최소 추가 예산(원)"을 반환한다. 없으면 null. 1천만원 단위 올림.
 */
function minExtraBudgetForMoreKrw(
  evaluated: ScoredComplex[],
  netPurchasePowerKrw: number,
  commuteExtraMinutes: number,
  workplaces: Workplace[],
): number | null {
  const upper = netPurchasePowerKrw + 100_000_000;
  let minAbove = Number.POSITIVE_INFINITY;
  for (const e of evaluated) {
    if (commuteExceedsLimit(e.candidate.commuteLegs, workplaces, commuteExtraMinutes)) {
      continue;
    }
    if (e.medianKrw > upper && e.medianKrw < minAbove) minAbove = e.medianKrw;
  }
  if (!Number.isFinite(minAbove)) return null;
  return Math.ceil((minAbove - upper) / 10_000_000) * 10_000_000;
}

/** 원(KRW)을 "1억 5천만"·"3천만" 식 짧은 한국어로. 1천만원 단위 가정. */
function formatKrwShort(krw: number): string {
  const eok = Math.floor(krw / 1e8);
  const cheonman = Math.round((krw - eok * 1e8) / 1e7);
  if (eok > 0 && cheonman > 0) return `${eok}억 ${cheonman}천만`;
  if (eok > 0) return `${eok}억`;
  return `${cheonman}천만`;
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

  // 6. 단지별 평가 — evaluateComplex 를 commute provider 만 바꿔 2단계로 재사용한다.
  const evaluateComplex = async (
    complex: (typeof geoSurvivors)[number],
    commuteProvider: CommuteProvider,
  ): Promise<ScoredComplex | null> => {
      const medians: AreaMedian[] = mediansMap.get(complex.id) ?? [];

      const totalTransactions = medians.reduce((s, m) => s + m.count, 0);
      if (totalTransactions < MIN_TRANSACTIONS) return null;

      // pickRepresentative 의 minCount 기본값(3) 그대로 사용
      const rep = pickRepresentative(medians, minArea, maxArea);
      if (rep === null) return null;

      const complexCoord: LatLng = {
        lat: complex.latitude as number,
        lng: complex.longitude as number,
      };

      // 직장별 통근 leg 계산 — 각 직장의 commuteMode 사용
      const legPromises: Promise<CommuteLeg>[] = workplaces.map((wp, idx) => {
        const wpLabel: "A" | "B" = idx === 0 ? "A" : "B";
        return getCommuteMinutes(
          wp,
          complex.id,
          complexCoord,
          wp.commuteMode,
          commuteProvider,
        ).then(
          (minutes): CommuteLeg => ({
            workplace: wpLabel,
            workplaceLabel: wp.label,
            workplaceLat: wp.lat,
            workplaceLng: wp.lng,
            minutes,
            distanceKm: Math.round(haversineKm(wp, complexCoord) * 10) / 10,
            mode: wp.commuteMode,
            withinLimit: minutes <= wp.maxCommuteMinutes,
          }),
        );
      });
      const commuteLegs = await Promise.all(legPromises);

      // 하드 필터 — 가격은 예산 밴드 안, 통근은 허용시간의 COMMUTE_HARD_FACTOR 배 안
      const priceOutOfBand = !priceInBudgetBand(
        rep.medianKrw,
        netPurchasePowerKrw,
      );
      // 직장 없으면 통근 제약 없음 (retired)
      const commuteTooLong = commuteLegs.some((leg) => {
        const wp = workplaces.find((_, i) =>
          leg.workplace === "A" ? i === 0 : i === 1,
        );
        // scoring.ts 와 동일한 COMMUTE_HARD_FACTOR 로 통일 (구버전 ×1.5 → ×1.3)
        return leg.minutes > (wp?.maxCommuteMinutes ?? 50) * COMMUTE_HARD_FACTOR;
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
        profile.hasSchoolAgedChild,
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
        buildYear: complex.buildYear,
        isChopumah,
        scores,
        tier: "균형형", // 후처리에서 재할당
        report: buildReport(base, weights),
        rankReason: "", // 3티어 선정 후 후처리에서 채움
      };

      return { candidate, medianKrw: rep.medianKrw, passedHardFilter };
  };

  // ── 6a. 1차 평가 — geoSurvivors 전체를 mock 통근으로 평가 (즉시·무료) ───────
  const phase1 = await Promise.all(
    geoSurvivors.map((complex) => evaluateComplex(complex, mockProvider)),
  );
  const phase1Valid = phase1.filter((e): e is ScoredComplex => e !== null);

  // ── 6b. 2차 평가 — 길찾기 키가 있으면 상위 후보만 Kakao API 로 정밀화 ───────
  // geoSurvivors 전체(수천 개)에 실 API 를 쓰면 일일 쿼터(1만)·rate limit·지연이
  // 폭발한다. mock 점수 상위 REFINE_COUNT 곳만 실측으로 다시 평가하면 캐시 미스
  // 시에도 호출은 ~REFINE_COUNT×직장수 건에 그친다. 표시되는 후보(3티어+추가 10)는
  // 모두 이 정밀 구간에서 나오므로 사용자가 보는 통근 시간은 실측값이다.
  // 한계: 1차 랭킹이 mock 기반이라, mock 이 크게 빗나간 단지(직선거리는 가깝지만
  // 실제론 우회하는)가 상위 밖으로 밀리면 놓칠 수 있다.
  const realProvider = getCommuteProvider();
  let validEvaluated: ScoredComplex[];

  if (realProvider.name === "mock") {
    // 길찾기 키 없음 — 1차 평가가 곧 최종.
    validEvaluated = phase1Valid;
  } else {
    // mock 점수 상위 REFINE_COUNT 곳만 실측으로 재평가한다. 1차 나머지(rest)를
    // 섞지 않는 이유: rest 는 낙관적인 mock 통근 점수를 그대로 갖고 있어, 실측으로
    // 통근 점수가 정직하게 깎인 refined 와 한 줄로 정렬하면 rest 가 부당하게 상위로
    // 뜬다. 따라서 화면에 쓰는 풀은 refined 로 한정한다.
    const REFINE_COUNT = 40;
    const CHUNK = 10; // 동시 호출을 ~CHUNK×직장수 로 제한 — rate limit 회피
    const complexById = new Map(geoSurvivors.map((c) => [c.id, c]));
    // 실측 재평가 대상 선정: mock 하드필터 통과 단지를 점수순으로 먼저 채우고,
    // 남는 자리는 미통과 단지로 채운다. 통과 단지는 통근상 현실적인 후보이므로
    // 우선이고, 미통과분도 일부 포함해 mock 추정 오차로 놓친 경계 단지를 건진다.
    const sortedP1 = [...phase1Valid].sort(
      (a, b) => b.candidate.totalScore - a.candidate.totalScore,
    );
    const toRefine = [
      ...sortedP1.filter((e) => e.passedHardFilter),
      ...sortedP1.filter((e) => !e.passedHardFilter),
    ].slice(0, REFINE_COUNT);

    const refined: ScoredComplex[] = [];
    for (let i = 0; i < toRefine.length; i += CHUNK) {
      const chunk = toRefine.slice(i, i + CHUNK);
      const results = await Promise.all(
        chunk.map((e) =>
          evaluateComplex(complexById.get(e.candidate.complexId)!, realProvider),
        ),
      );
      for (const r of results) if (r !== null) refined.push(r);
    }
    validEvaluated = refined;
  }

  // 하드 필터 통과 단지만, 총점 내림차순
  const survivors = validEvaluated
    .filter((e) => e.passedHardFilter)
    .sort((a, b) => b.candidate.totalScore - a.candidate.totalScore);

  // "검토한 단지 수" 는 넓은 1차(mock) 통과 수 — 화면 풀(refined)이 아니라
  // 사용자 조건에 맞는 단지가 몇 곳인지를 의미하기 때문.
  const consideredComplexCount = phase1Valid.filter(
    (e) => e.passedHardFilter,
  ).length;

  // ── P0#2 — relaxationSuggestions ────────────────────────────────────────
  // 결과 0건일 때만 계산. 조건 완화 시나리오별로 몇 곳이 통과하는지 시뮬레이션.
  const relaxationSuggestions: RelaxationSuggestion[] = [];

  // 완화 시뮬레이션은 넓은 1차(mock) 평가 집합으로 한다 — refined(상위 40)만
  // 보면 "조건을 풀면 N곳"의 N 이 비현실적으로 작게 나오기 때문.
  if (survivors.length === 0 && phase1Valid.length > 0) {
    // (a) 예산 30% 추가 확보 가정
    const relaxedBudget = netPurchasePowerKrw * 1.3;
    const countBudgetRelax = countPassingHardFilter(
      phase1Valid,
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
        phase1Valid,
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
  } else if (survivors.length > 0 && phase1Valid.length > 0) {
    // 결과가 있을 때 — "더 넓게 보기": 조건을 풀면 몇 곳이 "더" 나오는지(델타).
    // 기준 모집단은 consideredComplexCount 와 동일한 1차(mock) 통과 집합.
    const currentPassing = consideredComplexCount;

    // (a) 예산 — 다음 단지를 잡는 데 필요한 최소 추가 예산
    const extra = minExtraBudgetForMoreKrw(
      phase1Valid,
      netPurchasePowerKrw,
      0,
      workplaces,
    );
    if (extra !== null) {
      const relaxedCount = countPassingHardFilter(
        phase1Valid,
        netPurchasePowerKrw + extra,
        0,
        workplaces,
      );
      const more = relaxedCount - currentPassing;
      if (more > 0) {
        relaxationSuggestions.push({
          message: `예산을 약 ${formatKrwShort(extra)} 더 확보하면 ${more}곳을 더 볼 수 있어요`,
          resultCount: more,
        });
      }
    }

    // (b) 통근 — 허용시간 +20분
    if (workplaces.length > 0) {
      const relaxedCount = countPassingHardFilter(
        phase1Valid,
        netPurchasePowerKrw,
        20,
        workplaces,
      );
      const more = relaxedCount - currentPassing;
      if (more > 0) {
        relaxationSuggestions.push({
          message: `통근 허용시간을 20분 늘리면 ${more}곳을 더 볼 수 있어요`,
          resultCount: more,
        });
      }
    }
  }

  // ── 3티어 선정 ───────────────────────────────────────────────────────────
  // [전문가 패널] 세 티어가 실제로 달라야 한다 — 차별화 조건을 각 티어에 부여한다.

  const top8 = survivors.slice(0, 8);
  const chosen: { entry: ScoredComplex; tier: CandidateTier }[] = [];

  // 균형형: 총점 최고
  const balanced = survivors[0] ?? null;
  if (balanced) chosen.push({ entry: balanced, tier: "균형형" });

  // 안정형: top8 중 모든 통근이 허용범위 내(withinLimit) + 건물연식 점수 ≥ 60(2005년 이후)
  // — retired 는 commuteLegs 가 비므로 every 가 항상 true, 연식 조건만 적용됨
  const stableCandidate =
    top8
      .filter((e) => e !== balanced)
      .filter((e) => e.candidate.commuteLegs.every((l) => l.withinLimit))
      // buildingAge 점수 60 = scoring.ts 기준 2005년 이후 준공(준신축 이상)
      .filter((e) => e.candidate.scores.buildingAge >= 60)
      .sort(
        (a, b) =>
          a.medianKrw / netPurchasePowerKrw - b.medianKrw / netPurchasePowerKrw,
      )[0] ?? null;
  if (stableCandidate) chosen.push({ entry: stableCandidate, tier: "안정형" });

  // 도전형: top8 중 예산 밴드 내에서 가장 비싸되, 균형형과 가격 차이가 2천만원 이상이어야 함
  // — 균형형·안정형과 달라야 하며, 같은 단지가 중복 선정되는 것을 방지
  const chosenEntries = new Set(chosen.map((c) => c.entry));
  const balancedPrice = balanced?.medianKrw ?? 0;
  const challengeCandidate =
    top8
      .filter((e) => !chosenEntries.has(e))
      .filter((e) => priceInBudgetBand(e.medianKrw, netPurchasePowerKrw))
      // 균형형보다 2천만원 이상 비싸야 "도전형"이라는 이름값을 한다
      .filter((e) => e.medianKrw - balancedPrice >= 20_000_000)
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

  const candidates: ComplexCandidate[] = fillRankReasons(
    chosen.map(({ entry, tier }) => ({
      ...entry.candidate,
      tier,
    })),
  );

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
