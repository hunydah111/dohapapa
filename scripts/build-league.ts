// 동네 리그 테이블 빌더 — 동(읍면동)·시군구 2단위 × 4개 보드 지표+순위를 src/data/leagueTable.json 으로 굽는다.
// 번들된 trendIndex.json + complexSnapshot.json 만 읽어 계산(DB0·외부호출0). 데이터 rebake 후 재실행+커밋.
//
//   npx tsx scripts/build-league.ts
//
// 보드(전부 실거래 신호 — price-first, 손수 프록시 없음):
//   momentum  🔥 상승 모멘텀   : trendIndex 최근 3개월 상승률(시군구 = 보유 tier 평균)
//   trades    📈 거래 활발     : 총 거래수(median window)
//   value     🌙 가성비 강세   : 낮은 평단가 + 양(+) 모멘텀 (z-score 합)
//   fresh     ✨ 신축 강세      : 최근 10년 신축 비율 높을수록 상위(준공연도, 커버리지 100%)
//
// 2단위(동 기본 + 시군구 폴백/토글):
//   · 동(dong)    : 표본 충분(단지≥5 & 거래≥30)한 읍면동만. "강남구 대치동" 식 세분.
//   · 시군구(sgg) : 전 구. 동이 표본부족이라 빠지는 동네(특히 군 지역)도 항상 어딘가엔 표시.
//   · momentum 은 trendIndex 가 시군구×tier 키라 동별 산출 불가 → 동은 부모 시군구 모멘텀을 차용
//     (동끼리 동률이 되므로 거래수로 타이브레이크). 런타임 recommend 가 읽는 trendIndex 는 안 건드림.
//
// 컴플라이언스: 동네 줄세우기지 개인 아님. 과거 실거래 기반·미래예측 아님.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PY = 3.3058; // ㎡ → 평
const MOMENTUM_LOOKBACK = 3; // 개월
const NEW_LOOKBACK = 10; // 신축 기준: 최근 N년 준공
// 표본 임계 — 거래가 너무 적어 순위 신뢰가 안 서는 동네는 리그에서 제외(신뢰도 우선).
const DONG_MIN_COMPLEXES = 8; // 동 리그 편입 — 단지 수
const DONG_MIN_TRADES = 50; // 동 리그 편입 — 총 거래수
const SGG_MIN_TRADES = 200; // 시군구 리그 편입 — 총 거래수(강화·연천 등 표본 희박 지역 제외)

interface Median { area: number; medianKrw: number; count: number; volatility?: number }
interface Complex { sigungu: string; dongName: string; buildYear: number | null; medians: Median[] }
interface TrendIndex { months: string[]; latestMonth: string; series: Record<string, { index: Record<string, number> }> }

const ti: TrendIndex = JSON.parse(readFileSync(resolve("src/data/trendIndex.json"), "utf8"));
const snapRaw = JSON.parse(readFileSync(resolve("src/data/complexSnapshot.json"), "utf8"));
const complexes: Complex[] = Array.isArray(snapRaw) ? snapRaw : snapRaw.complexes;

const months = ti.months;
const latest = ti.latestMonth;
const fromMonth = months[Math.max(0, months.length - 1 - MOMENTUM_LOOKBACK)];
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

// ── 2) snapshot 집계: 동·시군구 두 단위로 거래수·평단가(만원/평)·준공연도 누적 ──
interface Agg { sigungu: string; dongName: string | null; trades: number; complexCount: number; perPy: number[]; years: number[] }
const newAgg = (sigungu: string, dongName: string | null): Agg => ({ sigungu, dongName, trades: 0, complexCount: 0, perPy: [], years: [] });
const aggSgg: Record<string, Agg> = {};
const aggDong: Record<string, Agg> = {};

for (const c of complexes) {
  if (!c.sigungu || !c.medians?.length) continue;
  // 대표 평형 = 거래수 최대
  const rep = c.medians.reduce((m, x) => (x.count > m.count ? x : m), c.medians[0]);
  let cTrades = 0;
  for (const m of c.medians) cTrades += m.count || 0;
  const perPy = rep.area > 0 && rep.medianKrw > 0 ? (rep.medianKrw / rep.area) * PY / 1e4 : null;

  const push = (a: Agg) => {
    a.trades += cTrades;
    a.complexCount += 1;
    if (c.buildYear != null) a.years.push(c.buildYear);
    if (perPy != null) a.perPy.push(perPy);
  };
  push((aggSgg[c.sigungu] = aggSgg[c.sigungu] || newAgg(c.sigungu, null)));
  if (c.dongName) {
    const k = `${c.sigungu}|${c.dongName}`;
    push((aggDong[k] = aggDong[k] || newAgg(c.sigungu, c.dongName)));
  }
}

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((p, q) => p - q);
  return s[Math.floor(s.length / 2)];
};
const z = (vals: number[]) => {
  const m = vals.reduce((s, v) => s + v, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length) || 1;
  return (v: number) => (v - m) / sd;
};
const rankBy = <T,>(arr: T[], key: (t: T) => number, desc = true): Map<T, number> => {
  const sorted = [...arr].sort((p, q) => (desc ? key(q) - key(p) : key(p) - key(q)));
  const r = new Map<T, number>();
  sorted.forEach((t, i) => r.set(t, i + 1));
  return r;
};

interface Region {
  sigungu: string;
  dongName: string | null;
  momentumPct: number;
  trades: number;
  complexCount: number;
  pricePerPy: number;
  recentSharePct: number;
  medianBuildYear: number;
  ranks: { momentum: number; trades: number; value: number; fresh: number };
}

// ── 3) 한 단위(동 또는 시군구)의 지표 산출 → 임계 필터 → 보드별 순위 ──
function buildRegions(entries: Agg[], minComplexes: number, minTrades: number, gradeName: string): Region[] {
  const metricsAll = entries
    .filter((a) => momentum[a.sigungu] != null) // 부모 시군구 모멘텀 있어야 함(동은 차용)
    .map((a) => {
      const recent = a.years.filter((y) => y >= newCutoffYear).length;
      return {
        sigungu: a.sigungu,
        dongName: a.dongName,
        momentumPct: momentum[a.sigungu],
        trades: a.trades,
        complexCount: a.complexCount,
        pricePerPy: Math.round(median(a.perPy)),
        recentShare: a.years.length ? recent / a.years.length : NaN,
        medianBuildYear: a.years.length ? median(a.years) : NaN,
      };
    });
  const metrics = metricsAll.filter(
    (m) =>
      m.complexCount >= minComplexes &&
      m.trades >= minTrades &&
      Number.isFinite(m.pricePerPy) &&
      Number.isFinite(m.recentShare) &&
      Number.isFinite(m.momentumPct),
  );
  const dropped = metricsAll.length - metrics.length;
  if (dropped > 0) console.log(`⚠️ [${gradeName}] 표본부족 ${dropped}개 제외(임계 단지≥${minComplexes}·거래≥${minTrades} 또는 결측)`);

  // value(가성비) = z(모멘텀) + z(-평단가), 같은 단위 코호트 안에서 표준화
  const zMom = z(metrics.map((m) => m.momentumPct));
  const zCheap = z(metrics.map((m) => -m.pricePerPy));
  const withValue = metrics.map((m) => ({ ...m, valueScore: zMom(m.momentumPct) + zCheap(-m.pricePerPy) }));

  // 모멘텀은 동끼리 부모 시군구 값을 공유해 동률 → 거래수로 결정적 타이브레이크(차이 ~1e-9 라 동률만 가름).
  const rMom = rankBy(withValue, (m) => m.momentumPct + m.trades * 1e-9);
  const rTrades = rankBy(withValue, (m) => m.trades);
  const rValue = rankBy(withValue, (m) => m.valueScore);
  const rFresh = rankBy(withValue, (m) => m.recentShare);

  return withValue.map((m) => ({
    sigungu: m.sigungu,
    dongName: m.dongName,
    momentumPct: Math.round(m.momentumPct * 1000) / 10, // %
    trades: m.trades,
    complexCount: m.complexCount,
    pricePerPy: m.pricePerPy,
    recentSharePct: Math.round(m.recentShare * 100),
    medianBuildYear: m.medianBuildYear,
    ranks: { momentum: rMom.get(m)!, trades: rTrades.get(m)!, value: rValue.get(m)!, fresh: rFresh.get(m)! },
  }));
}

const dongRegions = buildRegions(Object.values(aggDong), DONG_MIN_COMPLEXES, DONG_MIN_TRADES, "동");
const sigunguRegions = buildRegions(Object.values(aggSgg), 0, SGG_MIN_TRADES, "시군구");

const out = {
  generatedAt: new Date().toISOString(),
  asOf: latest,
  momentumWindow: `${fromMonth}~${latest}`,
  dongTotal: dongRegions.length,
  sigunguTotal: sigunguRegions.length,
  regions: dongRegions, // 기본 = 동 단위
  sigunguRegions, // 폴백/토글 = 시군구
};
const path = resolve("src/data/leagueTable.json");
writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
console.log(`leagueTable.json 생성: 동 ${dongRegions.length}곳 + 시군구 ${sigunguRegions.length}곳, 모멘텀창 ${fromMonth}~${latest} → ${path}`);

// ── 검증 출력: 각 보드 top5 (다양성 눈으로 확인) ──
const board = (regions: Region[], label: string, key: "momentum" | "trades" | "value" | "fresh") => {
  const name = (r: Region) => (r.dongName ? `${r.sigungu} ${r.dongName}` : r.sigungu);
  console.log(`\n[${label}] ` + regions
    .slice()
    .sort((p, q) => p.ranks[key] - q.ranks[key])
    .slice(0, 5)
    .map((r) => `${name(r)}(${key === "momentum" ? r.momentumPct + "%" : key === "trades" ? r.trades + "건" : key === "value" ? r.pricePerPy + "만/평" : "신축" + r.recentSharePct + "%"})`)
    .join(" · "));
};
console.log("\n=== 동 단위 ===");
board(dongRegions, "🔥상승모멘텀", "momentum");
board(dongRegions, "📈거래활발", "trades");
board(dongRegions, "🌙가성비강세", "value");
board(dongRegions, "✨신축강세", "fresh");
