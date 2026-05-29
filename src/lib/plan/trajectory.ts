// 트라젝토리(사다리) — "지금 어디" 가 아니라 "시간이 지나면 어디로 올라가나".
// 80인 패널 #1·차별화 핵심. 호갱노노/아실은 데이터 열람뿐, "내 통장 → 미래 동네 사다리"는 비집고만.
//
// 전부 번들 데이터(regionPrices.json)+순수계산 — 런타임 DB 0 (Neon 쿼터 무관).
// 컴플라이언스: 모든 값 추정, 미래가치 예측·투자권유 아님. 가격=공개 실거래(시장의 평가).
//
// 결정(docs/trajectory-spec.md D1~D7):
//  D1 진입 기준 = stable(P40) "발 들임" 가격.
//  D2 정렬 = 가격/시점 오름차순(통근 필터는 /plan에 직장 입력이 없어 불가 — 싼 외곽은 이미
//     '아래칸'이라 자동 배제돼 사다리가 위로만 향함. 통근 기반 필터는 후속).
//  D3 상승률 = flat 기본(보합), up 토글 시 지역 권역 연평균.
//  D4 미래 대출 = 소득 고정(자기자본만 저축으로 증가) — computePlan 기본 거동. 과약속 방지.
//  D6 칸 수 = 현재 + 최대 3 (총 4).
//  D7 막다른 길 금지 — 폴백 note.

import type { CoupleProfile, AreaRangeKey } from "@/types/profile";
import { AREA_RANGES } from "@/types/profile";
import { estimateBudget } from "@/lib/budget";
import regionPrices from "@/data/regionPrices.json";
import {
  computePlan,
  regionScenarios,
  DEFAULT_APPRECIATION,
  type ScenarioKey,
} from "./index";

type TierKey = "stable" | "balanced" | "challenge";
interface Rep {
  name: string;
  dong: string | null;
  year: number | null;
  krw: number;
}
interface Tier {
  key: TierKey;
  label: string;
  krw: number;
  reps: Rep[];
}
interface Cell {
  medianKrw: number;
  sampleCount: number;
  tiers?: Tier[];
}
const REGIONS = regionPrices.regions as Record<
  string,
  Partial<Record<AreaRangeKey, Cell>>
>;

export interface LadderRung {
  sigungu: string;
  /** 진입가(P40 stable, 현재 시세·미상승). */
  entryKrw: number;
  /** 도달까지 개월. 0 = 지금 가능. null = 지평(25년) 밖 — 현 조건으론 도달 어려움. */
  monthsAway: number | null;
  affordableNow: boolean;
  /** 대표단지 1개(있으면) — "예: ○○아파트". */
  repName: string | null;
  repYear: number | null;
}

export interface Ladder {
  band: AreaRangeKey;
  bandLabel: string;
  scenarioKey: ScenarioKey;
  /** 첫 칸 = 현재(또는 가장 가까운), 이후 미래 칸 시점 오름차순. */
  rungs: LadderRung[];
  /** D7 폴백·맥락 안내. 없으면 null. */
  note: string | null;
}

export interface LadderInput {
  band: AreaRangeKey;
  monthlySavingKrw: number;
  monthlySideKrw: number;
  /** "flat"(기본) | "up". down은 사다리에서 미제공(혼란 방지). */
  scenarioKey: ScenarioKey;
  interestRateAnnual?: number;
}

const MAX_RUNGS = 4; // 현재 + 최대 3 (D6)
const MIN_MONTH_GAP = 9; // 미래 칸 최소 간격(개월) — 비슷한 시점 동네 뭉침 방지
const HORIZON_MONTHS = 300; // 25년 — 그 이상 도달은 사다리로 안 보여줌(현실성)

function entryOf(cell: Cell | undefined): { krw: number; rep: Rep | null } | null {
  if (!cell?.tiers) return null;
  const t = cell.tiers.find((x) => x.key === "stable"); // D1: P40 진입
  if (!t || !(t.krw > 0)) return null;
  return { krw: t.krw, rep: t.reps?.[0] ?? null };
}

/** 사용자 프로필+저축으로 "시간이 갈수록 열리는 동네 사다리"를 만든다. 순수 함수. */
export function buildLadder(profile: CoupleProfile, input: LadderInput): Ladder {
  const { band, monthlySavingKrw, monthlySideKrw, scenarioKey, interestRateAnnual } =
    input;
  const bandLabel = AREA_RANGES[band]?.label ?? band;

  // 1) 데이터 있는 시군구별 진입가 + 도달 개월
  type Calc = {
    sigungu: string;
    entryKrw: number;
    months: number | null;
    rep: Rep | null;
  };
  const calcs: Calc[] = [];
  for (const [sgg, cell] of Object.entries(REGIONS)) {
    const entry = entryOf(cell[band]);
    if (!entry) continue;
    // 지역 권역 상승률 — flat이면 0(보합), up이면 서울5%/경기3%.
    const appreciation = {
      down: DEFAULT_APPRECIATION.down,
      flat: 0,
      up: regionScenarios(sgg).up.rateAnnual,
    };
    const budget = estimateBudget(profile, {
      targetPriceKrw: entry.krw,
      sigungu: sgg,
    });
    const plan = computePlan(budget, profile, {
      targetPriceKrw: entry.krw,
      monthlySavingKrw,
      monthlySideKrw,
      appreciation,
      headlineKey: scenarioKey,
      interestRateAnnual,
    });
    const months = plan.scenarios.find((s) => s.key === scenarioKey)?.months ?? null;
    calcs.push({ sigungu: sgg, entryKrw: entry.krw, months, rep: entry.rep });
  }

  const affordable = calcs
    .filter((c) => c.months === 0)
    .sort((a, b) => b.entryKrw - a.entryKrw); // 지금 가능한 가장 비싼 동네
  const future = calcs
    .filter((c) => c.months !== null && c.months > 0 && c.months <= HORIZON_MONTHS)
    .sort((a, b) => a.months! - b.months!); // 가까운 시점 먼저

  const rungs: LadderRung[] = [];
  const push = (c: Calc) =>
    rungs.push({
      sigungu: c.sigungu,
      entryKrw: c.entryKrw,
      monthsAway: c.months, // null = 지평 밖
      affordableNow: c.months === 0,
      repName: c.rep?.name ?? null,
      repYear: c.rep?.year ?? null,
    });

  // 2) 현재 칸 — 지금 발 들일 수 있는 가장 비싼 동네
  let lastMonth = 0;
  let lastPrice = 0;
  if (affordable.length > 0) {
    push(affordable[0]);
    lastPrice = affordable[0].entryKrw;
  }

  // 3) 미래 칸 — 시점 오름차순, 더 비싸고(위로) 충분히 벌어진 시점만 (D6)
  for (const c of future) {
    if (rungs.length >= MAX_RUNGS) break;
    if (c.months! - lastMonth < MIN_MONTH_GAP) continue;
    if (c.entryKrw <= lastPrice) continue;
    push(c);
    lastMonth = c.months!;
    lastPrice = c.entryKrw;
  }

  // 4) D7 — 막다른 길 금지
  let note: string | null = null;
  if (rungs.length === 0) {
    // 도달 가능한 동네가 하나도 없음 → 가장 가까운(있으면), 없으면 가장 싼 목표라도 1개 보여줌.
    const soonest = calcs
      .filter((c) => c.months !== null)
      .sort((a, b) => a.months! - b.months!)[0];
    const cheapest = [...calcs].sort((a, b) => a.entryKrw - b.entryKrw)[0];
    const fallback = soonest ?? cheapest;
    if (fallback) push(fallback);
    note =
      "지금 예산대에선 이 평형 진입이 빠듯해요 — 평형을 한 단계 낮추거나 저축(현금흐름)부터 키우면 사다리가 열려요.";
  } else if (!rungs[0].affordableNow) {
    note = "지금 당장은 빠듯하지만, 저축을 이어가면 아래 순서로 동네가 열려요 (추정).";
  } else if (rungs.length === 1) {
    note =
      "지금 동네에서 평형을 키우거나, 저축 속도를 높이면 더 위 동네로 사다리가 이어져요.";
  }

  return { band, bandLabel, scenarioKey, rungs, note };
}
