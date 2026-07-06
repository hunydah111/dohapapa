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
import { computePatch, type PatchDealInput, type ComplexMedianLookup, PATCH_SCOPE_DAYS } from "@/lib/patchNote";
import complexSnapshot from "@/data/complexSnapshot.json";

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
  const patchDeals: PatchDealInput[] = []; // 패치노트용 — 이미 받아온 거래 재활용(추가 API 0)
  for (const [name, code] of codes) {
    try {
      const deals = await fetchDealsForRange({ sigunguCode: code, fromYearMonth: fromYM, toYearMonth: toYM });
      total += deals.length;
      for (const d of deals) {
        const ds = ymd(d.dealDate);
        if (ds > latest) latest = ds;
        patchDeals.push({
          apartmentName: d.apartmentName,
          dealDateISO: ds,
          priceKrw: Number(d.priceKrw),
          area: d.area,
          sigunguName: d.sigunguName,
          dongName: d.dongName,
          floor: d.floor,
          dealingGbn: d.dealingGbn,
          canceled: d.canceled,
          buildYear: d.buildYear,
        });
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

  // ── 패치노트 v0 — 오늘 처음 확인된 스코프(계약 14일) 거래를 중위가와 대조 ──
  // 전 구 폴링일 때만 (부분 폴링으로 seen을 오염시키지 않기)
  if (guArg === "all") {
    const SEEN_PATH = resolve("src/data/dailySeen.json");
    const PATCH_PATH = resolve("src/data/dailyPatch.json");
    const prevSeen: { keys?: string[] } = existsSync(SEEN_PATH)
      ? JSON.parse(readFileSync(SEEN_PATH, "utf8"))
      : {};
    const firstRun = !existsSync(SEEN_PATH);

    // 단지 자기 시세 인덱스 — "시군구|공백제거단지명" → 평형별 중위가.
    // (시군구 중위가 대비는 구조적 이탈만 잡아서 폐기 — patchNote.ts 상단 주석 참조)
    type SnapMedian = { area: number; medianKrw: number; count: number; lowConfidence?: boolean; maxKrw?: number };
    type CxEntry = { medians: SnapMedian[]; lat: number | null; lng: number | null };
    const cxIndex = new Map<string, CxEntry>();
    for (const c of (complexSnapshot as unknown as { complexes: { name: string; sigungu: string; latitude?: number | null; longitude?: number | null; medians: SnapMedian[] }[] }).complexes) {
      // 좌표 동봉 — 지면 행 미니맵·카카오맵 링크용 (2026-07-06 사장 지시).
      cxIndex.set(`${c.sigungu}|${c.name.replace(/\s+/g, "")}`, {
        medians: c.medians,
        lat: c.latitude ?? null,
        lng: c.longitude ?? null,
      });
    }
    const lookupMedian: ComplexMedianLookup = (d) => {
      const cx = cxIndex.get(`${d.sigunguName}|${d.apartmentName.replace(/\s+/g, "")}`);
      if (!cx) return null;
      // 같은 평형 최근접(±3㎡) 중위가. 신뢰 낮은 셀은 스킵.
      let best: SnapMedian | null = null;
      for (const m of cx.medians) {
        const diff = Math.abs(m.area - d.area);
        if (diff <= 3 && (!best || diff < Math.abs(best.area - d.area))) best = m;
      }
      if (!best || best.lowConfidence) return null;
      // maxKrw(최근 1년 실거래 최고가)는 주간 스냅샷 갱신 후부터 존재 — 없으면 null.
      return {
        medianKrw: best.medianKrw,
        sampleCount: best.count,
        maxKrw: best.maxKrw ?? null,
        lat: cx.lat,
        lng: cx.lng,
      };
    };

    const patch = computePatch({
      deals: patchDeals,
      seenKeys: new Set(prevSeen.keys ?? []),
      lookupMedian,
      todayISO: today,
    });

    // 첫 실행 = 창간호(부트스트랩): seen이 없어 "오늘 신규"를 못 재므로, 대신
    // "최근 3일 계약 공개분"을 정직하게 라벨링해 발행한다. seen은 전체 스코프로 시딩
    // → 다음 실행부터 자동으로 일간(신규 공개 diff) 모드.
    const BOOTSTRAP_SCOPE_DAYS = 3;
    const boot = firstRun
      ? computePatch({
          deals: patchDeals,
          seenKeys: new Set<string>(),
          lookupMedian,
          todayISO: today,
          scopeDays: BOOTSTRAP_SCOPE_DAYS,
        })
      : null;

    writeFileSync(
      PATCH_PATH,
      JSON.stringify(
        {
          generatedAt: today,
          scopeDays: boot ? BOOTSTRAP_SCOPE_DAYS : PATCH_SCOPE_DAYS,
          mode: boot ? "bootstrap" : "daily",
          newDealCount: boot ? boot.newDealCount : patch.newDealCount,
          scopeDealCount: boot ? boot.scopeDealCount : patch.scopeDealCount,
          nerf: boot ? boot.nerf : patch.nerf,
          buff: boot ? boot.buff : patch.buff,
          major: boot ? boot.major : patch.major,
          temp: boot ? boot.temp : patch.temp,
          // [약세 동네] 코너 데이터 + 대칭 강세 집계(데이터용 — UI는 약세만 게재).
          weakRegions: boot ? boot.weakRegions : patch.weakRegions,
          strongRegions: boot ? boot.strongRegions : patch.strongRegions,
          latestDealDate: latest || null,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    writeFileSync(
      SEEN_PATH,
      JSON.stringify({ updatedAt: today, keys: patch.nextSeenKeys }) + "\n",
      "utf8",
    );
    const p = boot ?? patch;
    console.log(
      `dailyPatch(${boot ? "창간호" : "일간"}): 스코프 ${p.scopeDealCount}건 · 신규 ${p.newDealCount} · 너프 ${p.nerf.length} · 버프 ${p.buff.length} · 주요 ${p.major.length} · 약세동네 ${p.weakRegions.length} · 온도 ${p.temp ? `${p.temp.above}:${p.temp.below}/${p.temp.matched}` : "표본부족"}`,
    );
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
