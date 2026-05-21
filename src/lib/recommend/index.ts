import { estimateBudget } from "@/lib/budget";
import {
  getCommuteMinutes,
  getCommuteProvider,
  mockProvider,
} from "@/lib/commute";
import type { CommuteProvider } from "@/lib/commute";
import { db } from "@/lib/db";
import { haversineKm } from "@/lib/geo";
import {
  AREA_RANGES,
  AREA_RANGE_ORDER,
  LOCATION_VIBE_LABELS,
  LOCATION_VIBE_LEVEL_LABELS,
} from "@/types/profile";
import type {
  AreaRangeKey,
  BudgetFlex,
  CoupleProfile,
  LatLng,
  LocationVibe,
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
import { estimateRepFromComps, riverDistanceKm } from "./estimateRep";
import type { CompPoint } from "./estimateRep";
import { trendLatestMonth } from "./trendIndex";
import {
  COMMUTE_HARD_FACTOR,
  scoreBudgetFit,
  scoreBuildingAge,
  scoreCommute,
  scoreLargeComplex,
  scoreSchool,
} from "./scoring";
import {
  scoreLocationVibe,
  vibeBadgeLabel,
  vibeDistanceKm,
  VIBE_LEVEL_BONUS,
  VIBE_BONUS_CAP,
} from "./locationVibe";

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
  const userKeys: PriorityKey[] = [
    "commute",
    "school",
    "buildingAge",
    "largeComplex",
  ];
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
    largeComplex: userVals[3],
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
 * 추천 단지 가격 밴드 — 예산 근접도(flex)별 비율 밴드.
 * WHY 비율(절대 ±1억 폐기): 절대 ±1억은 저예산에선 너무 넓어 못 살 집을 노출하고
 *   (1억 예산에 1.9억 노출), 고예산에선 너무 좁아 결과가 0이 됐다(47억 예산 ±2%).
 *   비율로 통일하면 모든 예산대에서 일관된다. 가격은 complexMedian 의 "추정 현재가".
 */
// 예산 근접도(flex)에 따른 가격 밴드 하/상한. 지역 고정(dropLowerBound) 시 하한은 0.
function bandBounds(
  netPurchasePowerKrw: number,
  dropLowerBound: boolean,
  flex: BudgetFlex,
): { lower: number; upper: number } {
  let lower: number;
  let upper: number;
  if (flex === "tight") {
    lower = netPurchasePowerKrw * 0.95;
    upper = netPurchasePowerKrw * 1.05;
  } else if (flex === "normal") {
    lower = netPurchasePowerKrw * 0.9;
    upper = netPurchasePowerKrw * 1.1;
  } else {
    // relaxed (기본) — 가장 넓게. 살짝 무리(+12%)까지, 아래로는 넉넉히(−25%)
    // 보여줘 예산보다 싼 좋은 단지도 노출한다.
    lower = netPurchasePowerKrw * 0.75;
    upper = netPurchasePowerKrw * 1.12;
  }
  if (dropLowerBound) lower = 0;
  return { lower, upper };
}

function priceInBudgetBand(
  priceKrw: number,
  netPurchasePowerKrw: number,
  dropLowerBound = false,
  flex: BudgetFlex = "relaxed",
): boolean {
  const { lower, upper } = bandBounds(netPurchasePowerKrw, dropLowerBound, flex);
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
  // 대중교통은 서버 mock 분이 화면(ODsay 실측)과 어긋나므로 분 대신 "대중교통"으로만 표기.
  const legText =
    c.commuteLegs.length > 0
      ? " 통근은 " +
        c.commuteLegs
          .map(
            (l) =>
              `${l.workplaceLabel} ${l.mode === "transit" ? "대중교통" : `${l.minutes}분`}`,
          )
          .join(", ") +
        "."
      : "";

  const head = `${c.sigungu} ${c.dongName} ${c.complexName}, 전용 ${c.representativeArea}㎡ 실거래 기반 추정가 ${eok}억(최근 6개월).${legText}`;

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

  // 대중교통 leg 가 끼면 서버 통근분이 mock 이라 비교가 부정확 → 통근 비교 문구 생략.
  const anyTransit =
    a.commuteLegs.some((l) => l.mode === "transit") ||
    b.commuteLegs.some((l) => l.mode === "transit");
  const commuteA = a.commuteLegs.reduce((s, l) => s + l.minutes, 0);
  const commuteB = b.commuteLegs.reduce((s, l) => s + l.minutes, 0);
  if (!anyTransit && commuteA > 0 && commuteB > 0 && Math.abs(commuteA - commuteB) >= 5) {
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
  // 대중교통 분은 서버에선 mock(직선거리)이고 보조 리스트는 ODsay 실측을 안 거치므로
  // 구체 분 대신 "대중교통(추정)"으로 표기. 자동차는 실측(카카오) 분 그대로.
  return commuteLegs
    .map((l) =>
      l.mode === "transit"
        ? `${l.workplaceLabel} 대중교통(추정)`
        : `${l.workplaceLabel} ${l.minutes}분`,
    )
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
// extraMinutes 는 직장별로 다르게 줄 수 있다(예: 본인 직장만 +20분 완화).
type CommuteExtra = { A: number; B: number };

function commuteExceedsLimit(
  legs: CommuteLeg[],
  workplaces: Workplace[],
  extra: CommuteExtra,
): boolean {
  return legs.some((leg) => {
    const wp = leg.workplace === "A" ? workplaces[0] : workplaces[1];
    const add = leg.workplace === "A" ? extra.A : extra.B;
    const limit = (wp?.maxCommuteMinutes ?? 50) + add;
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
  commuteExtra: CommuteExtra,
  workplaces: Workplace[],
  dropLowerBound = false,
  flex: BudgetFlex = "relaxed",
): number {
  return evaluated.filter(
    (e) =>
      priceInBudgetBand(e.medianKrw, netPurchasePowerKrw, dropLowerBound, flex) &&
      !commuteExceedsLimit(e.candidate.commuteLegs, workplaces, commuteExtra),
  ).length;
}

/**
 * 통근 조건은 만족하지만 가격이 예산 밴드 상한을 넘어 탈락한 단지 중 가장 싼 것을
 * 잡기 위해 필요한 "최소 추가 예산(원)"을 반환한다. 없으면 null. 1천만원 단위 올림.
 */
function minExtraBudgetForMoreKrw(
  evaluated: ScoredComplex[],
  netPurchasePowerKrw: number,
  commuteExtra: CommuteExtra,
  workplaces: Workplace[],
  flex: BudgetFlex = "relaxed",
): number | null {
  const upper = bandBounds(netPurchasePowerKrw, false, flex).upper;
  let minAbove = Number.POSITIVE_INFINITY;
  for (const e of evaluated) {
    if (commuteExceedsLimit(e.candidate.commuteLegs, workplaces, commuteExtra)) {
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
  // 추가 조건(하드) — 필수 지역·신축만·초품아만 을 DB 단계에서 적용
  const requiredRegions = profile.requiredRegions ?? [];
  // 필수 지역을 고른 경우 예산 하한("너무 쌈")을 풀어 그 지역 저가 단지도 노출
  const dropLowerBand = requiredRegions.length > 0;
  // 예산 근접도 — 결과 가격 밴드 폭(딱맞게/적당히/넉넉히). 미지정 시 넉넉히(기존).
  const budgetFlex: BudgetFlex = profile.budgetFlex ?? "relaxed";
  const allComplexes = await db.complex.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
      ...(requiredRegions.length > 0
        ? { sigungu: { in: requiredRegions } }
        : {}),
    },
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

  // 5. 중위가 일괄 조회 — sigunguById 를 넘겨 (지역×가격대) 추세 시점 보정 적용.
  const sigunguById = new Map(geoSurvivors.map((c) => [c.id, c.sigungu]));
  const mediansMap = await getAreaMediansForMany(
    geoSurvivors.map((c) => c.id),
    sigunguById,
  );

  const areaRange = AREA_RANGES[profile.preferredAreaRange];
  const minArea = areaRange.minM2;
  const maxArea = areaRange.maxM2 ?? Number.POSITIVE_INFINITY;

  // 소규모 건물 배제 — 6개월 거래 건수를 대단지 프록시로 사용
  const MIN_TRANSACTIONS = 8;

  // 인근 단지 환산 추정 허용 연식 — 등기지연은 신축만의 현상. 최근 N년 내 준공만 추정한다.
  // (옛 단지가 특정 평형이 없는 건 등기문제가 아니라 그냥 그 평형이 없는 것 → 추정 금지.)
  const ESTIMATE_MAX_AGE_YEARS = 3;
  const nowYear = new Date().getFullYear();

  // ── 또래 평단가 벤치마크 — '동네 또래단지보다 비싸요' 배지용 ──────────────────
  // 같은 동·비슷한 연식(5년 버킷) 단지들의 ㎡당 단가 중위값. geoSurvivors 전체로
  // 계산(예산/통근 필터 전이라 동네 전반 반영). '재건축 기대' 같은 미검증 해석 대신,
  // 시장이 또래보다 높게 평가한다는 '사실'만 표시한다.
  const PEER_AGE_BUCKET = 5;
  const PEER_MIN_COUNT = 3;
  const PEER_PREMIUM_RATIO = 1.15; // 또래 중위 평단가 대비 +15%↑면 '비쌈'
  const peerKey = (dong: string, by: number) =>
    `${dong}|${Math.floor(by / PEER_AGE_BUCKET) * PEER_AGE_BUCKET}`;
  const peerPerM2 = new Map<string, number[]>();
  // 환산 추정용 비교점(거리·연식·한강근접 가중) — 직접 실거래 없는 신축의 가격을 잇는다.
  const comps: CompPoint[] = [];
  for (const c of geoSurvivors) {
    if (c.buildYear == null || !c.dongName) continue;
    const ms = mediansMap.get(c.id);
    if (!ms) continue;
    const r = pickRepresentative(ms, minArea, maxArea);
    if (!r || r.area <= 0) continue;
    const perM2 = r.medianKrw / r.area;
    const k = peerKey(c.dongName, c.buildYear);
    const arr = peerPerM2.get(k);
    if (arr) arr.push(perM2);
    else peerPerM2.set(k, [perM2]);
    // 비교점 — 직접 실거래로 대표 평형이 잡힌 단지만(추정 단지는 제외).
    // ㎡단가는 브리지 전 raw 를 쓴다(활발한 인근 comp 를 coarse 브리지로 깎지 않기 위해).
    if (!r.estimated && c.latitude != null && c.longitude != null) {
      comps.push({
        buildYear: c.buildYear,
        perM2: r.rawMedianKrw / r.area,
        area: r.area,
        lat: c.latitude,
        lng: c.longitude,
        riverKm: riverDistanceKm(c.latitude, c.longitude),
      });
    }
  }
  const latestMonth = trendLatestMonth();
  const peerMedianPerM2 = new Map<string, { median: number; count: number }>();
  for (const [k, arr] of peerPerM2) {
    const sorted = [...arr].sort((a, b) => a - b);
    peerMedianPerM2.set(k, {
      median: sorted[Math.floor(sorted.length / 2)],
      count: arr.length,
    });
  }

  // 6. 단지별 평가 — evaluateComplex 를 commute provider 만 바꿔 2단계로 재사용한다.
  const evaluateComplex = async (
    complex: (typeof geoSurvivors)[number],
    commuteProvider: CommuteProvider,
  ): Promise<ScoredComplex | null> => {
      const medians: AreaMedian[] = mediansMap.get(complex.id) ?? [];

      const totalTransactions = medians.reduce((s, m) => s + m.count, 0);

      // pickRepresentative 의 minCount 기본값(3) 그대로 사용
      let rep = pickRepresentative(medians, minArea, maxArea);
      if (rep !== null) {
        // 직접 실거래 대표 — 소규모 건물 배제(대단지 프록시) 적용.
        if (totalTransactions < MIN_TRANSACTIONS) return null;
      } else {
        // 해당 평형 직접 실거래 없음 — 등기지연 신축 등. 인근 단지 환산 추정 시도.
        // 가드: ① MOLIT 에 한 건이라도 등록(실재 확인) ② 최근 N년 내 준공(등기지연 신축만).
        if (totalTransactions < 1) return null;
        if (
          complex.buildYear == null ||
          complex.buildYear < nowYear - ESTIMATE_MAX_AGE_YEARS
        )
          return null;
        const tLat = complex.latitude as number;
        const tLng = complex.longitude as number;
        const est = estimateRepFromComps(comps, {
          buildYear: complex.buildYear,
          lat: tLat,
          lng: tLng,
          riverKm: riverDistanceKm(tLat, tLng),
        });
        if (est === null) return null;
        rep = {
          area: est.area,
          medianKrw: est.priceKrw,
          rawMedianKrw: est.priceKrw,
          priceLow: Math.round(est.priceKrw * 0.92),
          priceHigh: Math.round(est.priceKrw * 1.08),
          midpointMonth: latestMonth,
          count: 0,
          volatility: 0,
          sparse: true,
          lowConfidence: true,
          estimated: true,
          estimateBasis: est.basis,
        };
      }

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
            maxCommuteMinutes: wp.maxCommuteMinutes,
            withinLimit: minutes <= wp.maxCommuteMinutes,
          }),
        );
      });
      const commuteLegs = await Promise.all(legPromises);

      // 하드 필터 — 가격은 예산 밴드 안, 통근은 허용시간의 COMMUTE_HARD_FACTOR 배 안
      const priceOutOfBand = !priceInBudgetBand(
        rep.medianKrw,
        netPurchasePowerKrw,
        dropLowerBand,
        budgetFlex,
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
      const largeResult = scoreLargeComplex(totalTransactions);

      const scores: Record<CandidateSignalKey, number> = {
        commute: commuteResult.score,
        budgetFit: budgetResult.score,
        school: schoolResult.score,
        buildingAge: ageResult.score,
        largeComplex: largeResult.score,
      };
      const reasoning: Record<CandidateSignalKey, string> = {
        commute: commuteResult.reason,
        budgetFit: budgetResult.reason,
        school: schoolResult.reason,
        buildingAge: ageResult.reason,
        largeComplex: largeResult.reason,
      };

      const baseTotalScore = Math.round(
        (Object.keys(scores) as CandidateSignalKey[]).reduce(
          (sum, k) => sum + scores[k] * weights[k],
          0,
        ),
      );

      // 선호 입지(분위기) 소프트 가점 — 키별 강도(1~3) 합산, 상한 적용.
      const vibes = profile.locationVibes ?? {};
      let vibeBonus = 0;
      let badgeKey: LocationVibe | undefined;
      let bestStrength = 0;
      for (const key of Object.keys(vibes) as LocationVibe[]) {
        const level = vibes[key];
        if (!level) continue;
        const s = scoreLocationVibe(key, complexCoord, level);
        vibeBonus += s * (VIBE_LEVEL_BONUS[level] ?? 0);
        // 배지는 quiet(새소리) 제외, 매칭(≥0.5)된 것 중 강도×점수 최고만
        if (key !== "quiet" && s >= 0.5) {
          const strength = s * level;
          if (strength > bestStrength) {
            bestStrength = strength;
            badgeKey = key;
          }
        }
      }
      const vibeBadge = badgeKey
        ? vibeBadgeLabel(badgeKey, complexCoord)
        : undefined;
      // 거래량·안정성 기본 가점 — 우선순위와 무관하게 환금성·대단지 중요성을 살짝 깐다.
      // 거래 활발(유동성) + 가격 변동성 낮음(안정) → 최대 +5. (priority=0 이어도 적용)
      const liquidityBase = Math.min(1, totalTransactions / 40);
      const stabilityBase = 1 - Math.min(1, rep.volatility / 0.25);
      const baselineBonus = Math.round(liquidityBase * 3 + stabilityBase * 2);
      const totalScore = Math.min(
        100,
        baseTotalScore +
          Math.round(Math.min(VIBE_BONUS_CAP, vibeBonus)) +
          baselineBonus,
      );

      // 초품아 — 초등학교가 단지에서 직선 150m 이내 (전문가 패널: 100m 는 너무 좁음)
      const isChopumah =
        complex.nearestElemSchoolM !== null &&
        complex.nearestElemSchoolM <= 150;

      // '동네 또래단지보다 비싸요' — 같은 동·비슷한 연식 대비 ㎡당이 +15%↑면 표시.
      let pricierThanPeers = false;
      if (complex.buildYear != null && complex.dongName && rep.area > 0) {
        const peer = peerMedianPerM2.get(
          peerKey(complex.dongName, complex.buildYear),
        );
        if (peer && peer.count >= PEER_MIN_COUNT && peer.median > 0) {
          pricierThanPeers =
            rep.medianKrw / rep.area >= peer.median * PEER_PREMIUM_RATIO;
        }
      }

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
        priceLowKrw: rep.priceLow,
        priceHighKrw: rep.priceHigh,
        latitude: complex.latitude as number,
        longitude: complex.longitude as number,
        transactionCount: rep.count,
        lowDataConfidence: rep.sparse,
        priceEstimated: rep.estimated,
        estimateBasis: rep.estimateBasis,
        priceFromPresale: rep.presale,
        buildYear: complex.buildYear,
        isChopumah,
        pricierThanPeers,
        scores,
        vibeBadge,
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
  // 시에도 호출은 ~REFINE_COUNT×직장수 건에 그친다. 표시되는 후보(3티어+추가 24)는
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
    const REFINE_COUNT = 60;
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

  // #2 — 통근 한도(이용자 설정 maxCommuteMinutes) 이내 vs 살짝 초과(~×1.3) 분리.
  // 메인 3티어는 한도 이내에서만 뽑고, 초과분은 별도 섹션으로.
  const isWithinStatedLimit = (e: ScoredComplex) =>
    e.candidate.commuteLegs.every((l) => l.withinLimit);
  const withinLimitSurvivors = survivors.filter(isWithinStatedLimit);
  const overLimitSurvivors = survivors.filter((e) => !isWithinStatedLimit(e));

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
  const NO_EXTRA: CommuteExtra = { A: 0, B: 0 };
  const COMMUTE_ADD = 20;
  const wpLabel = (i: number) =>
    workplaces[i]?.label?.trim() || (i === 0 ? "본인 직장" : "배우자 직장");

  if (survivors.length === 0 && phase1Valid.length > 0) {
    // (a) 예산 30% 추가 확보 가정
    const relaxedBudget = netPurchasePowerKrw * 1.3;
    const countBudgetRelax = countPassingHardFilter(
      phase1Valid,
      relaxedBudget,
      NO_EXTRA,
      workplaces,
      dropLowerBand,
      budgetFlex,
    );
    if (countBudgetRelax > 0) {
      const addKrw = Math.round(relaxedBudget - netPurchasePowerKrw);
      relaxationSuggestions.push({
        message: `💰 예산 ${formatKrwShort(addKrw)} 더 있다 치면 → ${countBudgetRelax}곳`,
        resultCount: countBudgetRelax,
        action: { kind: "budget", addKrw },
      });
    }

    // (b) 직장별 통근 허용시간 +20분 (직장마다 따로)
    for (let i = 0; i < workplaces.length; i++) {
      const extra: CommuteExtra = {
        A: i === 0 ? COMMUTE_ADD : 0,
        B: i === 1 ? COMMUTE_ADD : 0,
      };
      const count = countPassingHardFilter(
        phase1Valid,
        netPurchasePowerKrw,
        extra,
        workplaces,
        dropLowerBand,
        budgetFlex,
      );
      if (count > 0) {
        relaxationSuggestions.push({
          message: `🏃 ${wpLabel(i)} 통근 +${COMMUTE_ADD}분 → ${count}곳`,
          resultCount: count,
          action: {
            kind: "commute",
            workplace: i === 0 ? "A" : "B",
            addMinutes: COMMUTE_ADD,
          },
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
      let countAreaRelax = 0;
      for (const c of geoSurvivors) {
        const medians = mediansMap.get(c.id) ?? [];
        const totalTx = medians.reduce((s, m) => s + m.count, 0);
        if (totalTx < MIN_TRANSACTIONS) continue;
        const rep = pickRepresentative(medians, nextMin, nextMax);
        if (rep === null) continue;
        if (
          !priceInBudgetBand(
            rep.medianKrw,
            netPurchasePowerKrw,
            dropLowerBand,
            budgetFlex,
          )
        )
          continue;
        countAreaRelax++;
      }
      if (countAreaRelax > 0) {
        relaxationSuggestions.push({
          message: `📐 평수 "${nextRange.label}"로 넓히면 → ${countAreaRelax}곳`,
          resultCount: countAreaRelax,
          action: { kind: "area", areaRange: nextAreaKey },
        });
      }
    }
  } else if (survivors.length > 0 && phase1Valid.length > 0) {
    // 결과가 있을 때 — "더 넓게 보기": 조건을 풀면 몇 곳이 "더" 나오는지(델타).
    const currentPassing = consideredComplexCount;

    // (a) 예산 — 다음 단지를 잡는 데 필요한 최소 추가 예산
    const extra = minExtraBudgetForMoreKrw(
      phase1Valid,
      netPurchasePowerKrw,
      NO_EXTRA,
      workplaces,
      budgetFlex,
    );
    if (extra !== null) {
      const relaxedCount = countPassingHardFilter(
        phase1Valid,
        netPurchasePowerKrw + extra,
        NO_EXTRA,
        workplaces,
        dropLowerBand,
        budgetFlex,
      );
      const more = relaxedCount - currentPassing;
      if (more > 0) {
        relaxationSuggestions.push({
          message: `💰 예산 ${formatKrwShort(extra)} 더 → ${more}곳 더`,
          resultCount: more,
          action: { kind: "budget", addKrw: extra },
        });
      }
    }

    // (b) 직장별 통근 +20분
    for (let i = 0; i < workplaces.length; i++) {
      const cextra: CommuteExtra = {
        A: i === 0 ? COMMUTE_ADD : 0,
        B: i === 1 ? COMMUTE_ADD : 0,
      };
      const relaxedCount = countPassingHardFilter(
        phase1Valid,
        netPurchasePowerKrw,
        cextra,
        workplaces,
        dropLowerBand,
        budgetFlex,
      );
      const more = relaxedCount - currentPassing;
      if (more > 0) {
        relaxationSuggestions.push({
          message: `🏃 ${wpLabel(i)} 통근 +${COMMUTE_ADD}분 → ${more}곳 더`,
          resultCount: more,
          action: {
            kind: "commute",
            workplace: i === 0 ? "A" : "B",
            addMinutes: COMMUTE_ADD,
          },
        });
      }
    }
  }

  // ── 3티어 선정 ───────────────────────────────────────────────────────────
  // [전문가 패널] 세 티어가 실제로 달라야 한다 — 차별화 조건을 각 티어에 부여한다.

  const top8 = withinLimitSurvivors.slice(0, 8);
  const chosen: { entry: ScoredComplex; tier: CandidateTier }[] = [];

  // 균형형: 총점 최고
  const balanced = withinLimitSurvivors[0] ?? null;
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
      .filter((e) =>
        priceInBudgetBand(
          e.medianKrw,
          netPurchasePowerKrw,
          dropLowerBand,
          budgetFlex,
        ),
      )
      // 균형형보다 2천만원 이상 비싸야 "도전형"이라는 이름값을 한다
      .filter((e) => e.medianKrw - balancedPrice >= 20_000_000)
      .sort((a, b) => b.medianKrw - a.medianKrw)[0] ?? null;
  if (challengeCandidate)
    chosen.push({ entry: challengeCandidate, tier: "도전형" });

  // 3개 미만이면 남은 survivors 로 보충
  const tierOrder: CandidateTier[] = ["균형형", "안정형", "도전형"];
  if (chosen.length < 3) {
    const usedEntries = new Set(chosen.map((c) => c.entry));
    for (const e of withinLimitSurvivors) {
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

  // ── moreCandidates — 상위 3개 다음 최대 24개, commuteSummary 포함 ──────────
  // (조건을 살짝 바꿔 재검색해도 보던 단지가 목록에서 사라지지 않도록 넉넉히)

  const chosenIds = new Set(candidates.map((c) => c.complexId));
  const toMore = (e: ScoredComplex): MoreCandidate => ({
    complexId: e.candidate.complexId,
    complexName: e.candidate.complexName,
    sigungu: e.candidate.sigungu,
    dongName: e.candidate.dongName,
    representativeArea: e.candidate.representativeArea,
    medianPriceKrw: e.candidate.medianPriceKrw,
    totalScore: e.candidate.totalScore,
    commuteSummary: buildCommuteSummary(e.candidate.commuteLegs),
  });
  const moreCandidates: MoreCandidate[] = withinLimitSurvivors
    .filter((e) => !chosenIds.has(e.candidate.complexId))
    .slice(0, 24)
    .map(toMore);

  // #2 — 통근 한도를 살짝 넘는 후보(별도 섹션). 최대 5곳.
  const overLimitCandidates: MoreCandidate[] = overLimitSurvivors
    .slice(0, 5)
    .map(toMore);

  // ── 입지 미스 안내(C) — 점지 입지(quiet 제외)를 골랐는데 결과에 안 잡혔을 때 ──
  // 강도 가장 센 입지 1개 기준. 표시 단지(top3) 중 매칭이 없으면 가장 가까운 후보를 솔직히 안내.
  let vibeNote:
    | { message: string; complexName: string; dongName: string }
    | undefined;
  const pickedVibes = (
    Object.keys(profile.locationVibes ?? {}) as LocationVibe[]
  )
    .filter((k) => k !== "quiet" && (profile.locationVibes?.[k] ?? 0) > 0)
    .sort(
      (a, b) =>
        (profile.locationVibes![b] ?? 0) - (profile.locationVibes![a] ?? 0),
    );
  const wish = pickedVibes[0];
  if (wish && survivors.length > 0) {
    const matchedInTop = candidates.some(
      (c) =>
        scoreLocationVibe(
          wish,
          { lat: c.latitude, lng: c.longitude },
          profile.locationVibes?.[wish],
        ) >= 0.5,
    );
    if (!matchedInTop) {
      let nearest = survivors[0];
      let nearestD = Number.POSITIVE_INFINITY;
      for (const e of survivors) {
        const d = vibeDistanceKm(wish, {
          lat: e.candidate.latitude,
          lng: e.candidate.longitude,
        });
        if (d < nearestD) {
          nearestD = d;
          nearest = e;
        }
      }
      const level = profile.locationVibes![wish] ?? 1;
      const badge = vibeBadgeLabel(wish, {
        lat: nearest.candidate.latitude,
        lng: nearest.candidate.longitude,
      });
      vibeNote = {
        message: `😅 '${LOCATION_VIBE_LEVEL_LABELS[level]} ${LOCATION_VIBE_LABELS[wish]}' — 예산·통근에 맞는 단지는 그 동네엔 없었어요. 가장 가까운 후보는 ${nearest.candidate.complexName} (${badge}).`,
        complexName: nearest.candidate.complexName,
        dongName: nearest.candidate.dongName,
      };
    }
  }

  // 0건일 때 — 어떤 추가 조건(하드)이 결과를 좁혔는지 유쾌하게 지목
  let emptyReason: string | undefined;
  if (candidates.length === 0) {
    const causes: string[] = [];
    if (requiredRegions.length > 0)
      causes.push(`지역(${requiredRegions.join("·")})`);
    if (causes.length > 0) {
      emptyReason = `🧐 이 조건들이 좀 타이트했나봐요 — ${causes.join(", ")}. 하나만 살짝 풀어볼까요?`;
    }
  }

  return {
    budget,
    candidates,
    moreCandidates,
    overLimitCandidates,
    relaxationSuggestions,
    consideredComplexCount,
    vibeNote,
    emptyReason,
    disclaimer: DISCLAIMER,
  };
}
