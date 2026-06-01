// A — 일간 실거래 펄스(하이브리드의 '가벼운' 쪽). 최근 N개월 거래월만 매일 다시 폴링해
// "오늘 확인 기준 신규 신고분"을 잡는다. 무거운 snapshot/trendIndex는 건드리지 않음(주간 담당).
// 호가 아님 — 국토부 실거래(계약일 기준). MOLIT는 '신고일'을 안 주므로 '오늘 카운트 증가분'으로 신규를 잰다.
//
//   npx tsx --env-file=.env.local scripts/daily-pulse.ts --gu=all   (크론)
//   npx tsx --env-file=.env.local scripts/daily-pulse.ts --gu=강남구 --months=1   (로컬 검증)
//
// 정직성: 표시 문구는 "거래월 X~Y 신고분을 오늘 다시 확인 · 최신 거래일 Z · 어제 대비 +N건"으로만.
// 누적 전체(snapshot)와 섞지 않는다(daily=최근창 증분, weekly=전체 재계산).

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { LAWD_CODES, fetchDealsForRange } from "@/lib/molit";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const MONTHS_BACK = Number(arg("months") ?? 2); // 현재월 포함 뒤로 N개월(지연 신고 포착)
const guArg = arg("gu") ?? "all";

const ymCompact = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
const ymDash = (c: string) => `${c.slice(0, 4)}-${c.slice(4, 6)}`;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function main() {
  const now = new Date(); // 크론 TZ=Asia/Seoul
  const toYM = ymCompact(now);
  const fromYM = ymCompact(new Date(now.getFullYear(), now.getMonth() - MONTHS_BACK, 1));
  const today = ymd(now);

  const codes: [string, string][] =
    guArg === "all"
      ? Object.entries(LAWD_CODES)
      : guArg.split(",").map((g) => [g.trim(), LAWD_CODES[g.trim()]] as [string, string]).filter(([, c]) => c);

  let total = 0;
  let latest = ""; // 최신 거래일 YYYY-MM-DD
  let failed = 0;
  for (const [name, code] of codes) {
    try {
      const deals = await fetchDealsForRange({ sigunguCode: code, fromYearMonth: fromYM, toYearMonth: toYM });
      total += deals.length;
      for (const d of deals) {
        const ds = ymd(d.dealDate);
        if (ds > latest) latest = ds;
      }
    } catch (e) {
      failed++;
      console.error(`  ${name} 실패: ${(e as Error).message}`);
    }
  }

  const PATH = resolve("src/data/dailyPulse.json");
  const prev = existsSync(PATH) ? JSON.parse(readFileSync(PATH, "utf8")) : null;
  // 같은 거래월 창일 때만 증분 비교(월 롤오버/구 범위 변화 시 null = '신규' 표기 생략).
  const sameWindow = prev && prev.windowToMonth === ymDash(toYM) && prev.windowFromMonth === ymDash(fromYM) && prev.guCount === codes.length;
  const newSincePrev = sameWindow ? Math.max(0, total - prev.recentCount) : null;

  const out = {
    checkedAt: today,
    windowFromMonth: ymDash(fromYM),
    windowToMonth: ymDash(toYM),
    latestDealDate: latest || null,
    recentCount: total,
    newSincePrev,
    prevCheckedAt: prev?.checkedAt ?? null,
    guCount: codes.length,
  };
  writeFileSync(PATH, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(
    `dailyPulse: ${today} · 거래월 ${out.windowFromMonth}~${out.windowToMonth} · 최신거래 ${latest || "-"} · ${total.toLocaleString()}건 (신규 ${newSincePrev == null ? "첫 폴링" : "+" + newSincePrev}) · ${codes.length}구${failed ? ` · 실패 ${failed}` : ""}`,
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
