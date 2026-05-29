// A5 — 한국부동산원 R-ONE 시군구별 아파트 매매지수(A_2024_00180, 분기) → src/data/rebIndex.json.
// 결과: 시군구 → { rateAnnual(장기 CAGR), asOf }. priceScenarios.upRateFor 가 읽어 KB 권역
// 일괄(서울5/경기3) 대신 시군구별 실측 장기 상승률을 "상승 시나리오"에 쓴다(없으면 폴백).
//
// 사용:  npx tsx --env-file=.env.local scripts/build-reb-index.ts   (또는 npm run reb:build)
//        npm run reb:list   → 통계표 목록(STATBL_ID 확인용)
//
// 매핑: CLS_FULLNM("경기>안양시>만안구","서울>종로구","인천>중구") → 우리 LAWD_CODES 키.
//   서울/경기 = 구 토큰 join, 인천 중구/동구/서구만 "인천 " 접두(LAWD 키 규칙). 수도권 외 제외.
// 상승률: 최근 ~10년(40분기) CAGR, clamp [1%, 12%] — "상승" 시나리오는 장기 업사이드라 1년 노이즈
//   대신 장기 추세, 음수/과열 방지 가드.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { LAWD_CODES } from "@/lib/molit";

const BASE = "https://www.reb.or.kr/r-one/openapi";
const KEY = process.env.REB_API_KEY ?? "";
const STATBL = arg("statbl") ?? "A_2024_00180"; // (분기) 시군구별 매매지수_아파트
const CYCLE = arg("cycle") ?? "QY";
const CAGR_QUARTERS = 40; // 최대 소급 분기(~10년)
const RATE_MIN = 0.01;
const RATE_MAX = 0.12;

function arg(k: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
}
const LAWD = new Set(Object.keys(LAWD_CODES));

/** CLS_FULLNM("경기>안양시>만안구") → 우리 LAWD 키. 수도권 아니거나 미매칭이면 null. */
function toLawdKey(fullnm: string): string | null {
  const parts = (fullnm ?? "").split(">").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const sido = parts[0];
  const rest = parts.slice(1);
  let key: string;
  if (sido === "서울" || sido === "경기") key = rest.join(" ");
  else if (sido === "인천") {
    const tail = rest.join(" ");
    key = ["중구", "동구", "서구"].includes(tail) ? `인천 ${tail}` : tail;
  } else return null; // 수도권 외(부산·대전 등) 제외
  return LAWD.has(key) ? key : null;
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { cache: "no-store" });
  return (await res.json()) as Record<string, unknown>;
}

async function listTables() {
  const d = await getJson(`${BASE}/SttsApiTbl.do?KEY=${KEY}&Type=json&pIndex=1&pSize=1000`);
  const rows = ((d.SttsApiTbl as unknown[])?.[1] as { row?: Record<string, unknown>[] })?.row ?? [];
  for (const r of rows) {
    if (/매매지수|매매가격지수/.test(String(r.STATBL_NM)))
      console.log(`${r.STATBL_ID} | ${r.DTACYCLE_CD} | ${r.STATBL_NM}`);
  }
}

async function build() {
  // 페이지네이션 — 시군구 × 분기 전체.
  const rows: Record<string, unknown>[] = [];
  for (let p = 1; p <= 30; p++) {
    const d = await getJson(
      `${BASE}/SttsApiTblData.do?KEY=${KEY}&STATBL_ID=${STATBL}&DTACYCLE_CD=${CYCLE}&Type=json&pIndex=${p}&pSize=1000`,
    );
    const batch = ((d.SttsApiTblData as unknown[])?.[1] as { row?: Record<string, unknown>[] })?.row ?? [];
    if (batch.length === 0) break;
    rows.push(...batch);
  }

  // 시군구 키 → [{time, val}]
  const series = new Map<string, { time: string; val: number }[]>();
  for (const r of rows) {
    const key = toLawdKey(String(r.CLS_FULLNM ?? ""));
    if (!key) continue;
    const time = String(r.WRTTIME_IDTFR_ID ?? "");
    const val = Number(r.DTA_VAL);
    if (!time || !Number.isFinite(val) || val <= 0) continue;
    const arr = series.get(key) ?? [];
    arr.push({ time, val });
    series.set(key, arr);
  }

  const regions: Record<string, { rateAnnual: number; asOf: string }> = {};
  for (const [key, s] of series) {
    s.sort((a, b) => a.time.localeCompare(b.time));
    if (s.length < 8) continue; // 2년 미만 표본 제외
    const latest = s[s.length - 1];
    const old = s[Math.max(0, s.length - 1 - CAGR_QUARTERS)];
    const quarters = s.length - 1 - Math.max(0, s.length - 1 - CAGR_QUARTERS);
    const years = quarters / 4;
    if (years <= 0 || old.val <= 0) continue;
    const cagr = Math.pow(latest.val / old.val, 1 / years) - 1;
    const rate = Math.min(RATE_MAX, Math.max(RATE_MIN, cagr));
    regions[key] = { rateAnnual: Math.round(rate * 1e4) / 1e4, asOf: latest.time };
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: `한국부동산원 R-ONE ${STATBL} (${CYCLE}) · ${CAGR_QUARTERS / 4}년 CAGR clamp[${RATE_MIN},${RATE_MAX}]`,
    regions,
  };
  writeFileSync(resolve(process.cwd(), "src/data/rebIndex.json"), JSON.stringify(out, null, 2), "utf8");
  console.log(`rebIndex.json 생성: 수도권 시군구 ${Object.keys(regions).length}개 (전체 행 ${rows.length})`);
}

async function main() {
  if (!KEY) {
    console.error("REB_API_KEY 없음 — .env.local 에 추가하세요.");
    process.exit(1);
  }
  if (process.argv.includes("--list")) return listTables();
  await build();
}
main().catch((e) => { console.error(e); process.exit(1); });
