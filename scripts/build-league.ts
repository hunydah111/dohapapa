// 동네 자존심 리그 테이블 빌더 — 시군구별 4개 보드 지표 + 순위를 src/data/leagueTable.json 으로 굽는다.
// 번들된 trendIndex.json + complexSnapshot.json 만 읽어 계산(DB0·외부호출0). 데이터 rebake 후 재실행+커밋.
//
//   npx tsx scripts/build-league.ts
//
// 보드(전부 실거래 신호 — price-first, 손수 프록시 없음):
//   momentum  🔥 상승 모멘텀   : trendIndex 최근 3개월 상승률(시군구 = 보유 tier 평균)
//   trades    📈 거래 활발     : snapshot 시군구 총 거래수(median window)
//   value     🌙 가성비 강세   : 낮은 평단가 + 양(+) 모멘텀 (z-score 합)
//   fresh     ✨ 신축 강세      : 최근 10년 신축 비율 높을수록 상위(준공연도, 커버리지 100%)
//
// 컴플라이언스: 동네(시군구) 줄세우기지 개인 아님. 과거 실거래 기반·미래예측 아님.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PY = 3.3058; // ㎡ → 평
const MOMENTUM_LOOKBACK = 3; // 개월

interface Median { area: number; medianKrw: number; count: number; volatility?: number }
interface Complex { sigungu: string; buildYear: number | null; medians: Median[] }
interface TrendIndex { months: string[]; latestMonth: string; series: Record<string, { index: Record<string, number> }> }

const ti: TrendIndex = JSON.parse(readFileSync(resolve("src/data/trendIndex.json"), "utf8"));
const snapRaw = JSON.parse(readFileSync(resolve("src/data/complexSnapshot.json"), "utf8"));
const complexes: Complex[] = Array.isArray(snapRaw) ? snapRaw : snapRaw.complexes;

const months = ti.months;
const latest = ti.latestMonth;
const fromMonth = months[Math.max(0, months.length - 1 - MOMENTUM_LOOKBACK)];

// 신축 보드 기준: 최근 N년(준공연도) 안에 지어진 단지를 '신축'으로 본다.
const NEW_LOOKBACK = 10; // 년
const latestYear = Number(latest.split("-")[0]) || new Date().getFullYear();
const newCutoffYear = latestYear - NEW_LOOKBACK;

// ── 1) 모멘텀 (trendIndex, 시군구 = 보유 tier 상승률 평균) ──
const momentum: Record<string, number> = {};
const bySgg: Record<string, number[]> = {};
for (const [key, ser] of Object.entries(ti.series)) {
  const [sgg, tier] = key.split("|");
  if (!sgg || sgg === "수도권" || !tier) continue;
  const a = ser.index[fromMonth];
  const b = ser.index[latest];
  if (!(a > 0) || !(b > 0)) continue;
  (bySgg[sgg] = bySgg[sgg] || []).push(b / a - 1);
}
for (const [sgg, arr] of Object.entries(bySgg)) {
  momentum[sgg] = arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ── 2) snapshot 집계: 거래수·평단가(만원/평)·준공연도 ──
const agg: Record<string, { trades: number; complexCount: number; perPy: number[]; years: number[] }> = {};
for (const c of complexes) {
  if (!c.sigungu || !c.medians?.length) continue;
  const a = (agg[c.sigungu] = agg[c.sigungu] || { trades: 0, complexCount: 0, perPy: [], years: [] });
  // 대표 평형 = 거래수 최대
  const rep = c.medians.reduce((m, x) => (x.count > m.count ? x : m), c.medians[0]);
  let cTrades = 0;
  for (const m of c.medians) cTrades += m.count || 0;
  a.trades += cTrades;
  a.complexCount += 1;
  if (c.buildYear != null) a.years.push(c.buildYear);
  if (rep.area > 0 && rep.medianKrw > 0) a.perPy.push((rep.medianKrw / rep.area) * PY / 1e4);
}
const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((p, q) => p - q);
  return s[Math.floor(s.length / 2)];
};

// 공통 시군구 = momentum 과 snapshot 둘 다 있는 곳
const sggs = Object.keys(agg).filter((s) => momentum[s] != null);

const metricsAll = sggs.map((sgg) => {
  const a = agg[sgg];
  const recent = a.years.filter((y) => y >= newCutoffYear).length;
  return {
    sigungu: sgg,
    momentumPct: momentum[sgg],
    trades: a.trades,
    complexCount: a.complexCount,
    pricePerPy: Math.round(median(a.perPy)), // 만원/평
    recentShare: a.years.length ? recent / a.years.length : NaN, // 최근 10년 신축 비율
    medianBuildYear: a.years.length ? median(a.years) : NaN,
  };
});
// 표본부족 가드: 평단가/신축비율이 결측(NaN)이면 NaN→JSON null 로 직렬화돼 화면이 깨지고
// 정렬 비교(NaN)도 깨진다. 그런 시군구는 리그에서 제외(리그 = 표본 충분한 동네만).
const metrics = metricsAll.filter(
  (m) => Number.isFinite(m.pricePerPy) && Number.isFinite(m.recentShare) && Number.isFinite(m.momentumPct),
);
const dropped = metricsAll.length - metrics.length;
if (dropped > 0) console.log(`⚠️ 표본부족 ${dropped}개 시군구 제외(평단가·신축비율·모멘텀 결측)`);

// ── 3) value (가성비 강세) = z(모멘텀) + z(-평단가) ──
const z = (vals: number[]) => {
  const m = vals.reduce((s, v) => s + v, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length) || 1;
  return (v: number) => (v - m) / sd;
};
const zMom = z(metrics.map((m) => m.momentumPct));
const zCheap = z(metrics.map((m) => -m.pricePerPy));
const withValue = metrics.map((m) => ({ ...m, valueScore: zMom(m.momentumPct) + zCheap(-m.pricePerPy) }));

// ── 4) 보드별 순위 부여 ──
const rankBy = <T,>(arr: T[], key: (t: T) => number, desc = true): Map<T, number> => {
  const sorted = [...arr].sort((p, q) => (desc ? key(q) - key(p) : key(p) - key(q)));
  const r = new Map<T, number>();
  sorted.forEach((t, i) => r.set(t, i + 1));
  return r;
};
const rMom = rankBy(withValue, (m) => m.momentumPct);
const rTrades = rankBy(withValue, (m) => m.trades);
const rValue = rankBy(withValue, (m) => m.valueScore);
const rFresh = rankBy(withValue, (m) => m.recentShare); // 신축 비율 높을수록 상위

const regions = withValue.map((m) => ({
  sigungu: m.sigungu,
  momentumPct: Math.round(m.momentumPct * 1000) / 10, // %
  trades: m.trades,
  complexCount: m.complexCount,
  pricePerPy: m.pricePerPy,
  recentSharePct: Math.round(m.recentShare * 100), // 최근 10년 신축 비율(%)
  medianBuildYear: m.medianBuildYear,
  ranks: {
    momentum: rMom.get(m)!,
    trades: rTrades.get(m)!,
    value: rValue.get(m)!,
    fresh: rFresh.get(m)!,
  },
}));

const out = {
  generatedAt: new Date().toISOString(),
  asOf: latest,
  momentumWindow: `${fromMonth}~${latest}`,
  total: regions.length,
  regions,
};
const path = resolve("src/data/leagueTable.json");
writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
console.log(`leagueTable.json 생성: ${regions.length}개 시군구, 모멘텀창 ${fromMonth}~${latest} → ${path}`);

// ── 검증 출력: 각 보드 top5 (다양성 눈으로 확인) ──
const board = (label: string, key: "momentum" | "trades" | "value" | "fresh") =>
  console.log(`\n[${label}] ` + regions
    .slice()
    .sort((p, q) => p.ranks[key] - q.ranks[key])
    .slice(0, 5)
    .map((r) => `${r.sigungu}(${key === "momentum" ? r.momentumPct + "%" : key === "trades" ? r.trades + "건" : key === "value" ? r.pricePerPy + "만/평" : "신축" + r.recentSharePct + "%"})`)
    .join(" · "));
board("🔥상승모멘텀", "momentum");
board("📈거래활발", "trades");
board("🌙가성비강세", "value");
board("✨신축강세", "fresh");
