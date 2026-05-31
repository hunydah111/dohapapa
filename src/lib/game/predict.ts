// 부동산 촉 게임 — peer 아웃퍼폼 예측 채점 (순수, 번들 trendIndex만, DB0).
// "이 동네(가격대)가 같은 가격대 평균(수도권 peer)보다 더 오를까?" UP/DOWN.
// 채점 = cellΔ vs peerΔ. 동률/결측은 무효 라운드. 복기(과거 즉시채점)·라이브(미래 대기) 공용.
// 스펙: docs/prediction-game-spec.md

import {
  ALL_SCOPE,
  trendMonths,
  trendSeriesKeys,
  getTrendSeries,
  trendLatestMonth,
  type PriceTier,
} from "@/lib/recommend/trendIndex";

export type Pick = "UP" | "DOWN";

/** 출제 가능 셀에 필요한 최소 개월 수(히스토리 짧으면 복기 풀 부족). */
const MIN_MONTHS = 6;

export interface PlayCell {
  /** `${시군구}|${tier}`. */
  key: string;
  sigungu: string;
  tier: PriceTier;
}

export interface RoundResult {
  /** 채점 가능 여부(결측·동률이면 false = 무효 라운드). */
  resolvable: boolean;
  /** 대상 셀이 peer보다 더 올랐나. */
  outperform?: boolean;
  /** 예측 적중 여부. */
  correct?: boolean;
  /** 대상 셀 변동률(소수). */
  cellPct?: number;
  /** peer(같은 가격대 수도권 평균) 변동률(소수). */
  peerPct?: number;
}

export interface Round {
  cellKey: string;
  fromMonth: string;
  toMonth: string;
}

export function peerKeyOf(tier: string): string {
  return `${ALL_SCOPE}|${tier}`;
}

/** 순수 채점 — 지수 4값 + 예측. 데이터/동률 무효는 resolvable=false. (DI 없이 완전 테스트 가능) */
export function judge(
  cellFrom: number,
  cellTo: number,
  peerFrom: number,
  peerTo: number,
  pick: Pick,
): RoundResult {
  const ok = [cellFrom, cellTo, peerFrom, peerTo].every(
    (v) => typeof v === "number" && Number.isFinite(v) && v > 0,
  );
  if (!ok) return { resolvable: false };
  const cellPct = cellTo / cellFrom - 1;
  const peerPct = peerTo / peerFrom - 1;
  if (cellPct === peerPct) return { resolvable: false }; // 동률 = 무효
  const outperform = cellPct > peerPct;
  const correct = (pick === "UP") === outperform;
  return { resolvable: true, outperform, correct, cellPct, peerPct };
}

function valueAt(key: string, month: string): number {
  const v = getTrendSeries(key)?.index[month];
  return typeof v === "number" ? v : NaN;
}

/** 한 라운드(셀·기간·예측)를 실데이터로 채점. */
export function scoreRound(opts: Round & { pick: Pick }): RoundResult {
  const tier = opts.cellKey.split("|")[1] ?? "";
  const peerKey = peerKeyOf(tier);
  return judge(
    valueAt(opts.cellKey, opts.fromMonth),
    valueAt(opts.cellKey, opts.toMonth),
    valueAt(peerKey, opts.fromMonth),
    valueAt(peerKey, opts.toMonth),
    opts.pick,
  );
}

/** 출제 가능한 (시군구×가격대) 셀 — 수도권(peer 자신)·자기 series 없음·히스토리 짧음 제외. */
export function playableCells(): PlayCell[] {
  const out: PlayCell[] = [];
  for (const key of trendSeriesKeys()) {
    const [scope, tier] = key.split("|");
    if (!scope || !tier || scope === ALL_SCOPE) continue;
    if (!getTrendSeries(peerKeyOf(tier))) continue; // peer 없으면 채점 불가
    const self = getTrendSeries(key);
    if (!self || Object.keys(self.index).length < MIN_MONTHS) continue;
    out.push({ key, sigungu: scope, tier: tier as PriceTier });
  }
  return out;
}

// 결정적 해시(seed → 0..n) — Date.now/Math.random 없이 재현 가능(테스트·SSR 안전).
function hash(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

const BACKTEST_HORIZON = 3; // 복기 윈도우 3개월 — 1개월은 ±0.0% 노이즈라 결정적 라운드 위해 키움

/** 복기 라운드 출제 — seed로 결정적. 채점 가능한 (셀, 과거 from→to) 보장. */
export function backtestRound(seed: number): Round {
  const cells = playableCells();
  const months = trendMonths();
  // 채점 가능한 조합을 찾을 때까지 seed 변주(유한 시도, 결정적).
  for (let i = 0; i < 64; i++) {
    const h = hash(seed * 1000 + i);
    const cell = cells[h % cells.length];
    // toMonth = horizon 이후 ~ 최신. fromMonth = toMonth - horizon.
    const maxToIdx = months.length - 1;
    const minToIdx = BACKTEST_HORIZON;
    const span = maxToIdx - minToIdx + 1;
    const toIdx = minToIdx + ((hash(h) % span + span) % span);
    const fromIdx = toIdx - BACKTEST_HORIZON;
    const round: Round = {
      cellKey: cell.key,
      fromMonth: months[fromIdx],
      toMonth: months[toIdx],
    };
    if (scoreRound({ ...round, pick: "UP" }).resolvable) return round;
  }
  // 폴백(거의 안 옴): 첫 셀 + 마지막 두 달.
  return {
    cellKey: cells[0]?.key ?? "",
    fromMonth: months[months.length - 2] ?? "",
    toMonth: months[months.length - 1] ?? "",
  };
}

const LIVE_HORIZON_MONTHS = 1; // 라이브 예측 기본 1개월(빠른 resolve). 스펙서 조정 가능.

/** 라이브 라운드 출제 — 현재(latest)부터 미래. 다음 trendIndex 갱신 때 resolve. */
export function liveRound(seed: number): Round {
  const cells = playableCells();
  const cell = cells[hash(seed) % cells.length];
  const latest = trendLatestMonth();
  return { cellKey: cell?.key ?? "", fromMonth: latest, toMonth: addMonths(latest, LIVE_HORIZON_MONTHS) };
}

/** "YYYY-MM" + n개월. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}
