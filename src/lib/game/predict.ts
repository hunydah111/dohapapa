// 부동산 촉 게임 — peer 아웃퍼폼 예측 채점 (순수, 번들 trendIndex만, DB0).
// "이 동네(가격대)가 같은 가격대 평균(수도권 peer)보다 더 오를까?" UP/DOWN.
// 채점 = cellΔ vs peerΔ. 동률/결측은 무효 라운드. 복기(과거 즉시채점)·라이브(미래 대기) 공용.
// 스펙: docs/prediction-game-spec.md

import {
  ALL_SCOPE,
  trendSeriesKeys,
  getTrendSeries,
  trendLatestMonth,
  type PriceTier,
} from "@/lib/recommend/trendIndex";

export type Pick = "UP" | "DOWN";

/** 출제 가능 셀에 필요한 최소 개월 수(히스토리 짧으면 복기 풀 부족). */
const MIN_MONTHS = 6;

/**
 * 접전 데드존 — 셀과 peer의 변동률 격차가 이보다 작으면 "사실상 비김"으로 보고 무효(resolvable=false).
 * 월 단위로 끊은 지수라 미세한 격차(노이즈·몇 주 차이로 따라잡는 동네)는 UP/DOWN 단정이 동전던지기에
 * 가까워 촉을 측정 못 한다. 데이터(국면×tier 격차분포)상 1.0%p 미만이 그 노이즈 군집 → 출제 제외.
 * regimeRound가 무효 라운드를 재추첨하므로, 자동으로 "격차 확실한 동네"만 출제된다.
 */
export const DEAD_ZONE = 0.01;

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
  if (Math.abs(cellPct - peerPct) < DEAD_ZONE) return { resolvable: false }; // 접전(노이즈) = 무효
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

// 명명된 시장 국면(복기 시기 선택) — 실데이터 분석으로 끊은 3국면(docs/prediction-game-spec.md).
// 국면을 알면 맞히는 = 진짜 촉. trendIndex(2025-04~2026-05)가 3국면 다 커버.
export interface Regime {
  id: string;
  label: string;
  short: string;
  desc: string;
  from: string;
  to: string;
}
// 경계는 임의가 아니라 수도권 tier별 지수(trendIndex) 흐름이 실제로 바뀌는 지점으로 잡음.
// 누적 변동(검증): rally24 low+3.1/mid2+13.1/high+14.1 · high25 low+1.6/mid2+18.4/high+19.7
//   · mid25 low+3.7/mid1+12.0/high+3.9 · low26 low+0.9/mid2-4.7/high-2.9. (build 시점 재확인)
export const REGIMES: Regime[] = [
  { id: "rally24", label: "바닥 찍고 반등", short: "24.2~8", desc: "2022~23년 하락 끝, 집값 반등 시작 — 중·고가가 먼저 오르고 저가는 소외", from: "2024-02", to: "2024-08" },
  { id: "high25", label: "고가 폭등기", short: "25.2~7", desc: "초고가가 단독 폭등(+20%), 저가는 거의 제자리", from: "2025-02", to: "2025-07" },
  { id: "mid25", label: "중가 키맞추기", short: "25.8~26.1", desc: "고가 정점·횡보, 소외됐던 중가가 따라잡기", from: "2025-08", to: "2026-01" },
  { id: "low26", label: "고가조정·저가강세", short: "26.2~5", desc: "고가·중상가 꺾이고 저가가 상대 강세", from: "2026-02", to: "2026-05" },
];

/** 국면 라운드 출제 — 그 국면 기간(from→to) 안에서 채점 가능한 셀을 seed로 결정적 선택. */
export function regimeRound(regime: Regime, seed: number): Round {
  const cells = playableCells();
  for (let i = 0; i < 64; i++) {
    const cell = cells[hash(seed * 1000 + i) % cells.length];
    const round: Round = { cellKey: cell.key, fromMonth: regime.from, toMonth: regime.to };
    if (scoreRound({ ...round, pick: "UP" }).resolvable) return round;
  }
  return { cellKey: cells[0]?.key ?? "", fromMonth: regime.from, toMonth: regime.to };
}

const LIVE_HORIZON_MONTHS = 1; // 라이브 예측 기본 1개월(빠른 resolve). 스펙서 조정 가능.

/** 라이브 라운드 출제 — 현재(latest)부터 미래. 다음 trendIndex 갱신 때 resolve. */
export function liveRound(seed: number): Round {
  const cells = playableCells();
  const cell = cells[hash(seed) % cells.length];
  const latest = trendLatestMonth();
  return { cellKey: cell?.key ?? "", fromMonth: latest, toMonth: addMonths(latest, LIVE_HORIZON_MONTHS) };
}

// ── 세트(7문제) → 등급 결과 ───────────────────────────────────────────────
/** 한 판 = 이만큼 문제(쭉 무한 출제 대신 끊어서 결과·공유). */
export const SET_SIZE = 7;

export interface Grade {
  id: string;
  label: string;
  emoji: string;
  blurb: string;
  /** 등급 비지 이미지 경로(없으면 emoji 폴백). 자산: public/biji/chok/<id>.png */
  image: string;
}
/** 세트 적중 수(0~SET_SIZE) → 등급. 7=촉신. 자산 파일명 = id. */
export function setGrade(correct: number): Grade {
  const g = (id: string, label: string, emoji: string, blurb: string): Grade => ({
    id, label, emoji, blurb, image: `/biji/chok/${id}.png`,
  });
  if (correct >= 7) return g("god", "촉신", "🏆", "실거래가를 꿰뚫는 눈");
  if (correct >= 6) return g("master", "촉고수", "🔥", "시장을 거의 다 읽었다");
  if (correct >= 5) return g("pro", "촉상수", "😎", "감이 제대로 섰다");
  if (correct >= 4) return g("mid", "촉중수", "🙂", "반은 넘겼다");
  return g("rookie", "촉린이", "🐣", "이제 막 감 잡는 중");
}

/** 같은 가격대(tier)에서 그 기간 가장 많이 오른 시군구 — "왜 졌나" 납득용. 없으면 null. */
export function topPerformer(
  tier: string,
  fromMonth: string,
  toMonth: string,
): { sigungu: string; pct: number } | null {
  let best: { sigungu: string; pct: number } | null = null;
  for (const key of trendSeriesKeys()) {
    const [scope, t] = key.split("|");
    if (!scope || t !== tier || scope === ALL_SCOPE) continue;
    const from = valueAt(key, fromMonth);
    const to = valueAt(key, toMonth);
    if (!(from > 0) || !(to > 0)) continue;
    const p = to / from - 1;
    if (!best || p > best.pct) best = { sigungu: scope, pct: p };
  }
  return best;
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
