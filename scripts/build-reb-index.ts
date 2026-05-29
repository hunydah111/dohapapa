// A5 — 한국부동산원 R-ONE 시군구별 아파트 실거래가격지수 → src/data/rebIndex.json 굽기.
// 결과: 시군구 → { rateAnnual(최근 추세 연환산), asOf }. priceScenarios.upRateFor 가 읽어
// KB 권역 일괄(서울5/경기3) 대신 시군구 실측 추세를 쓴다(없으면 폴백, 빈 파일=현재 동작).
//
// 사용:
//   1) reb.or.kr/r-one 에서 무료 인증키 발급 → .env.local 에 REB_API_KEY=...
//   2) 통계표ID 확인:  npx tsx --env-file=.env.local scripts/build-reb-index.ts --list | grep 실거래가격지수
//   3) 굽기:          npx tsx --env-file=.env.local scripts/build-reb-index.ts --statbl=<ID> --cycle=QY
//
// ⚠️ STATBL_ID(아파트 실거래가격지수 시군구 매매)는 키 발급 후 --list 로 확인해 확정.
//    (sample 키로는 API가 ERROR-290 거부 — 실 검증은 키 필요. 그전엔 빈 rebIndex로 폴백.)

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = "https://www.reb.or.kr/r-one/openapi";
const KEY = process.env.REB_API_KEY ?? "";

const arg = (k: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const has = (k: string): boolean => process.argv.includes(`--${k}`);

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store" });
  return res.json();
}

async function listTables() {
  // 통계표 목록 — 실거래가격지수 STATBL_ID 찾기용.
  const url = `${BASE}/SttsApiTbl.do?KEY=${KEY}&Type=json&pIndex=1&pSize=1000`;
  const data = (await getJson(url)) as Record<string, unknown>;
  console.log(JSON.stringify(data, null, 2).slice(0, 4000));
}

async function build(statblId: string, cycle: string) {
  // 페이지네이션으로 전체 행 수집(시군구 × 기간).
  const rows: Record<string, unknown>[] = [];
  for (let p = 1; p <= 50; p++) {
    const url = `${BASE}/SttsApiTblData.do?KEY=${KEY}&STATBL_ID=${statblId}&DTACYCLE_CD=${cycle}&Type=json&pIndex=${p}&pSize=1000`;
    const data = (await getJson(url)) as Record<string, unknown>;
    const block = (data.SttsApiTblData as unknown[])?.[1] as { row?: Record<string, unknown>[] } | undefined;
    const batch = block?.row ?? [];
    if (batch.length === 0) break;
    rows.push(...batch);
  }
  // 시군구별 최신 vs 1년 전 지수 → 연환산 상승률. (필드명은 응답 확인 후 조정: CLS_NM=지역,
  // WRTTIME_IDTFR_ID=기간, DTA_VAL=지수값. 확정 전까지 best-effort.)
  const byRegion = new Map<string, { time: string; val: number }[]>();
  for (const r of rows) {
    const region = String(r.CLS_NM ?? r.UI_NM ?? "").trim();
    const time = String(r.WRTTIME_IDTFR_ID ?? "");
    const val = Number(r.DTA_VAL ?? r.DATA_VALUE);
    if (!region || !time || !Number.isFinite(val)) continue;
    const arr = byRegion.get(region) ?? [];
    arr.push({ time, val });
    byRegion.set(region, arr);
  }
  const regions: Record<string, { rateAnnual: number; asOf: string }> = {};
  for (const [region, series] of byRegion) {
    series.sort((a, b) => a.time.localeCompare(b.time));
    if (series.length < 2) continue;
    const latest = series[series.length - 1];
    // 4분기 전(≈1년) 또는 가용한 가장 먼 점.
    const prior = series[Math.max(0, series.length - 5)];
    if (!(prior.val > 0)) continue;
    const yrs = Math.max(0.25, (series.length - 1 - Math.max(0, series.length - 5)) / 4);
    const rateAnnual = Math.pow(latest.val / prior.val, 1 / yrs) - 1;
    regions[region] = { rateAnnual: Math.round(rateAnnual * 1e4) / 1e4, asOf: latest.time };
  }
  const out = { generatedAt: new Date().toISOString(), source: `R-ONE ${statblId}`, regions };
  const path = resolve(process.cwd(), "src/data/rebIndex.json");
  writeFileSync(path, JSON.stringify(out, null, 2), "utf8");
  console.log(`rebIndex.json 생성: 시군구 ${Object.keys(regions).length}개 (${statblId})`);
}

async function main() {
  if (!KEY) {
    console.error("REB_API_KEY 없음 — reb.or.kr/r-one 무료 인증키 발급 후 .env.local 에 추가하세요.");
    process.exit(1);
  }
  if (has("list")) return listTables();
  const statbl = arg("statbl");
  if (!statbl) {
    console.error("--statbl=<STATBL_ID> 필요. 먼저 --list 로 '아파트 실거래가격지수 시군구 매매' ID 확인.");
    process.exit(1);
  }
  await build(statbl, arg("cycle") ?? "QY");
}
main().catch((e) => { console.error(e); process.exit(1); });
