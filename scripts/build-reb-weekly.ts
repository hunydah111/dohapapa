// B — 한국부동산원 R-ONE 주간 아파트 매매가격지수(T244183132827305, WK) → src/data/rebWeekly.json.
// "이번 주 시세 흐름"(공식·합법·무료)을 생동감 신호로. 호가 아님 — 공식 가격지수의 주간 변동률.
//
//   npx tsx --env-file=.env.local scripts/build-reb-weekly.ts   (또는 npm run reb:weekly)
//
// 비용: 데이터가 과거→현재 오름차순이라 마지막 페이지들(tail)만 받아 최신 주 추출 = ~4콜.
// 권역(전국/수도권/서울/경기/인천) 최근 2주 지수 → 주간 변동률(%). WRTTIME_DESC = 그 주 기준일.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = "https://www.reb.or.kr/r-one/openapi";
const KEY = process.env.REB_API_KEY ?? "";
const STATBL = "T244183132827305";
const CYCLE = "WK";
const PSIZE = 1000;
const WANT = ["전국", "수도권", "서울", "경기", "인천"];

interface Row { CLS_NM: string; WRTTIME_IDTFR_ID: string; WRTTIME_DESC: string; DTA_VAL: number }

async function page(pIndex: number, pSize: number): Promise<{ rows: Row[]; total: number }> {
  const url = `${BASE}/SttsApiTblData.do?KEY=${KEY}&STATBL_ID=${STATBL}&DTACYCLE_CD=${CYCLE}&Type=json&pIndex=${pIndex}&pSize=${pSize}`;
  const d = (await (await fetch(url, { cache: "no-store" })).json()) as Record<string, unknown[]>;
  const container = d.SttsApiTblData as unknown[] | undefined;
  const head = (container?.[0] as { head?: { list_total_count?: number }[] })?.head;
  const total = head?.[0]?.list_total_count ?? 0;
  const rows = ((container?.[1] as { row?: Row[] })?.row ?? []) as Row[];
  return { rows, total };
}

async function main() {
  if (!KEY) { console.error("REB_API_KEY 없음"); process.exit(1); }

  const { total } = await page(1, 1);
  const lastPage = Math.ceil(total / PSIZE);
  // 마지막 3페이지(tail) = 최신 주 보장.
  const rows: Row[] = [];
  for (const p of [lastPage - 2, lastPage - 1, lastPage].filter((p) => p >= 1)) {
    rows.push(...(await page(p, PSIZE)).rows);
  }

  const regions: Record<string, { index: number; changePct: number; week: string; date: string }> = {};
  let asOfWeek = "";
  let asOfDate = "";
  for (const name of WANT) {
    const series = rows
      .filter((r) => r.CLS_NM === name && Number.isFinite(Number(r.DTA_VAL)))
      .sort((a, b) => String(a.WRTTIME_IDTFR_ID).localeCompare(String(b.WRTTIME_IDTFR_ID)));
    if (series.length < 2) continue;
    const latest = series[series.length - 1];
    const prev = series[series.length - 2];
    const changePct = Math.round((Number(latest.DTA_VAL) / Number(prev.DTA_VAL) - 1) * 1000) / 10;
    regions[name] = {
      index: Math.round(Number(latest.DTA_VAL) * 100) / 100,
      changePct,
      week: latest.WRTTIME_IDTFR_ID,
      date: latest.WRTTIME_DESC,
    };
    if (latest.WRTTIME_IDTFR_ID > asOfWeek) { asOfWeek = latest.WRTTIME_IDTFR_ID; asOfDate = latest.WRTTIME_DESC; }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: `한국부동산원 R-ONE ${STATBL} (주간 아파트 매매가격지수)`,
    asOfWeek,
    asOfDate,
    regions,
  };
  writeFileSync(resolve("src/data/rebWeekly.json"), JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`rebWeekly.json: ${asOfDate} 기준 주 · ${Object.keys(regions).length}권역`);
  for (const [k, v] of Object.entries(regions)) console.log(`  ${k}: 지수 ${v.index} (주간 ${v.changePct >= 0 ? "+" : ""}${v.changePct}%)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
