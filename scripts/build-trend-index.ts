// (지역 × 가격대) 반복매매 추세 지수 빌더.
// Neon 실거래로 (시군구 × 가격대 × 월) 연쇄지수를 계산해 src/data/trendIndex.json 에 굽는다.
// 데이터 파이프라인의 마지막 단계로 실행 (fetch-molit → geocode → enrich-schools 다음).
//
//   npx tsx --env-file=.env.local scripts/build-trend-index.ts
//
// 엔진(src/lib/recommend/trendIndex.ts)이 이 JSON 을 번들로 읽어 시점 보정에 쓴다.
// 새 실거래를 적재하면 다시 굽고 커밋·배포하면 된다.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { db } from "@/lib/db";
import {
  ALL_SCOPE,
  tierOf,
  type PriceTier,
  type TrendIndexData,
} from "@/lib/recommend/trendIndex";

const LOOKBACK_MONTHS = 30; // 2024-01~ 전 이력 활용 — 반복매매 페어↑로 지수 안정·게임 국면 폭 확장
                            // (스냅샷 median/budgetPercentile은 별도 12~13개월 윈도라 현재시세는 그대로)
const MIN_PAIRS = 5; // 인접월 매칭쌍이 이만큼은 돼야 추세 신뢰
const MIN_RELIABLE_MONTHS = 3; // 시군구×tier 시리즈는 신뢰월이 이만큼일 때만 emit(아니면 수도권 폴백)
const TIERS: PriceTier[] = ["low", "mid1", "mid2", "high"];

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

interface Cell {
  sigungu: string;
  tier: PriceTier;
  byMonth: Map<string, number[]>; // month → 거래가들(원)
}

interface TxRow { complexId: string; area: number; priceKrw: number; dealDate: Date }

// Neon(기본) 또는 로컬 dev.db(--from-sqlite=) 에서 단지·거래를 읽는다 — Neon 쿼터 우회.
async function load(since: Date): Promise<{
  complexes: { id: string; sigungu: string }[];
  txs: TxRow[];
}> {
  const sqliteArg = process.argv.find((a) => a.startsWith("--from-sqlite="));
  if (sqliteArg) {
    const path = sqliteArg.slice("--from-sqlite=".length);
    const { DatabaseSync } = await import("node:sqlite");
    const sdb = new DatabaseSync(path, { readOnly: true }) as unknown as {
      prepare: (s: string) => { all: (...p: unknown[]) => Record<string, unknown>[] };
      close: () => void;
    };
    const complexes = sdb
      .prepare("SELECT id, sigungu FROM Complex")
      .all()
      .map((r) => ({ id: String(r.id), sigungu: String(r.sigungu) }));
    const txs = sdb
      .prepare(`SELECT complexId, area, priceKrw, dealDate FROM "Transaction" WHERE dealDate >= ?`)
      .all(since.getTime())
      .map((r) => ({
        complexId: String(r.complexId),
        area: Number(r.area),
        priceKrw: Number(r.priceKrw),
        dealDate: new Date(Number(r.dealDate)),
      }));
    sdb.close();
    return { complexes, txs };
  }
  const complexes = await db.complex.findMany({ select: { id: true, sigungu: true } });
  const txs = (
    await db.transaction.findMany({
      where: { dealDate: { gte: since } },
      select: { complexId: true, area: true, priceKrw: true, dealDate: true },
    })
  ).map((t) => ({
    complexId: t.complexId,
    area: t.area,
    priceKrw: Number(t.priceKrw),
    dealDate: t.dealDate,
  }));
  return { complexes, txs };
}

async function main() {
  const since = new Date();
  since.setMonth(since.getMonth() - LOOKBACK_MONTHS);

  const { complexes, txs } = await load(since);
  const sigunguById = new Map(complexes.map((c) => [c.id, c.sigungu]));

  // (단지×평형) 셀로 묶는다.
  const cells = new Map<string, Cell>();
  const monthSet = new Set<string>();
  for (const t of txs) {
    if (!t.area) continue;
    const sigungu = sigunguById.get(t.complexId);
    if (!sigungu) continue;
    const key = `${t.complexId}|${Math.floor(t.area)}`;
    const month = monthKey(t.dealDate);
    monthSet.add(month);
    let cell = cells.get(key);
    if (!cell) {
      cell = { sigungu, tier: "mid1", byMonth: new Map() }; // 기본값 — 아래서 tierOf(중위)로 재할당
      cells.set(key, cell);
    }
    const arr = cell.byMonth.get(month) ?? cell.byMonth.set(month, []).get(month)!;
    arr.push(Number(t.priceKrw));
  }
  // 각 셀의 가격대 = 그 셀 전체 거래가 중위(연중 안정 — 셀이 경계 넘나드는 일은 드묾).
  for (const cell of cells.values()) {
    const all: number[] = [];
    for (const arr of cell.byMonth.values()) all.push(...arr);
    cell.tier = tierOf(median(all));
  }

  const months = [...monthSet].sort();
  const scopes = new Set<string>([ALL_SCOPE, ...complexes.map((c) => c.sigungu)]);

  const series: TrendIndexData["series"] = {};

  for (const scope of scopes) {
    for (const tier of TIERS) {
      const scopeCells = [...cells.values()].filter(
        (c) => c.tier === tier && (scope === ALL_SCOPE || c.sigungu === scope),
      );
      if (scopeCells.length === 0) continue;

      // 셀별 월 중위가
      const cellMonthMed = scopeCells.map((c) => {
        const m = new Map<string, number>();
        for (const [mo, arr] of c.byMonth) m.set(mo, median(arr));
        return m;
      });

      const index: Record<string, number> = {};
      let idx = 100;
      index[months[0]] = idx;
      let reliableMonths = 0;
      for (let i = 1; i < months.length; i++) {
        const prev = months[i - 1];
        const cur = months[i];
        const ratios: number[] = [];
        for (const cm of cellMonthMed) {
          const a = cm.get(prev);
          const b = cm.get(cur);
          if (a !== undefined && b !== undefined && a > 0) ratios.push(b / a);
        }
        let factor = 1;
        if (ratios.length >= MIN_PAIRS) {
          factor = median(ratios);
          reliableMonths++;
        }
        idx *= factor;
        index[cur] = Math.round(idx * 100) / 100;
      }

      // 시군구×tier 는 신뢰월이 충분할 때만 — 아니면 수도권×tier 폴백에 맡긴다.
      if (scope !== ALL_SCOPE && reliableMonths < MIN_RELIABLE_MONTHS) continue;
      series[`${scope}|${tier}`] = { index };
    }
  }

  const out: TrendIndexData = {
    generatedAt: new Date().toISOString(),
    months,
    latestMonth: months[months.length - 1] ?? "",
    series,
  };

  const outPath = resolve(process.cwd(), "src/data/trendIndex.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

  const sigunguSeries = Object.keys(series).filter(
    (k) => !k.startsWith(`${ALL_SCOPE}|`),
  ).length;
  console.log(
    `trendIndex.json 생성: ${months.length}개월(${months[0]}~${out.latestMonth}), ` +
      `시리즈 ${Object.keys(series).length}개(수도권 ${TIERS.length} + 시군구×tier ${sigunguSeries}), ` +
      `셀 ${cells.size}개, 거래 ${txs.length}건`,
  );
}

main().finally(() => db.$disconnect());
