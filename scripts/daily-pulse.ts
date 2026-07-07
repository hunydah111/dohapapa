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
import {
  computePatch,
  pickHeadlines,
  subtractRecentFromSeen,
  shouldSkipPatchOverwrite,
  type PatchDealInput,
  type ComplexMedianLookup,
  PATCH_SCOPE_DAYS,
  PATCH_MERGED_MIN_FRESH,
  DAILY_RECENT_KEEP_DAYS,
} from "@/lib/patchNote";
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
  // dailyPulse 기록 — 전 구(all) 경로에선 모노토닉 가드 판정 뒤로 미룬다: 검증판이
  // 갱신 생략(skip)하는 회차에 pulse 만 갱신되면 newSincePrev 가 0으로 덮이고
  // 무의미한 커밋·재배포가 생긴다(2단 발행 프로토콜, 2026-07-07).
  const writePulse = () => {
    writeFileSync(PATH, JSON.stringify(out, null, 2) + "\n", "utf8");
    console.log(
      `dailyPulse: ${today} · 거래월 ${out.windowFromMonth}~${out.windowToMonth} · 최신거래 ${latest || "-"} · ${total.toLocaleString()}건 (신규 ${newSincePrev == null ? "첫 폴링" : "+" + newSincePrev}) · ${codes.length}구${failed ? ` · 실패 ${failed}` : ""}`,
    );
  };
  if (guArg !== "all") writePulse();

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
    type SnapMedian = { area: number; medianKrw: number; count: number; lowConfidence?: boolean; maxKrw?: number; maxDate?: string; maxFloor?: number | null };
    type CxEntry = { medians: SnapMedian[]; lat: number | null; lng: number | null; nearestSubwayM: number | null };
    const cxIndex = new Map<string, CxEntry>();
    for (const c of (complexSnapshot as unknown as { complexes: { name: string; sigungu: string; latitude?: number | null; longitude?: number | null; nearestSubwayM?: number | null; medians: SnapMedian[] }[] }).complexes) {
      // 좌표·역거리 동봉 — 지면 행 미니맵·카카오맵 링크·"역 350m" 태그용.
      cxIndex.set(`${c.sigungu}|${c.name.replace(/\s+/g, "")}`, {
        medians: c.medians,
        lat: c.latitude ?? null,
        lng: c.longitude ?? null,
        nearestSubwayM: c.nearestSubwayM ?? null,
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
      // maxDate·maxFloor(최고가 거래의 계약일·층)는 그보다 새 스냅샷부터 — 없으면 null.
      return {
        medianKrw: best.medianKrw,
        sampleCount: best.count,
        maxKrw: best.maxKrw ?? null,
        maxDate: best.maxDate ?? null,
        maxFloor: best.maxFloor ?? null,
        lat: cx.lat,
        lng: cx.lng,
        nearestSubwayM: cx.nearestSubwayM,
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

    // ── 모노토닉 덮어쓰기 가드 (2단 발행 프로토콜 — 05:20 본판 + 05:50/06:12 검증판) ──
    // 오늘 이미 발행된 판이 이번 실행보다 풍부하면 아무것도 쓰지 않고 종료 —
    // dailyPulse·dailyPatch·dailySeen·dailyRecent 전부 미기록 → 워크플로우 커밋 스텝이
    // "변경 없음"으로 자연 스킵된다. 창간호(boot)·부분 폴링(--gu)엔 적용하지 않는다.
    const prevPatchRaw: { generatedAt?: string | null; newDealCount?: number } | null =
      existsSync(PATCH_PATH) ? JSON.parse(readFileSync(PATCH_PATH, "utf8")) : null;
    if (
      !boot &&
      shouldSkipPatchOverwrite({
        prevGeneratedAt: prevPatchRaw?.generatedAt ?? null,
        prevNewDealCount: prevPatchRaw?.newDealCount ?? 0,
        todayISO: today,
        freshCount: patch.newDealCount,
      })
    ) {
      console.log(
        `dailyPatch: 이미 오늘 발행분이 더 풍부(기존 ${prevPatchRaw!.newDealCount}건 ≥ 이번 fresh ${patch.newDealCount}건) — 갱신 생략 (pulse·patch·seen·recent 전부 미기록)`,
      );
      return;
    }
    writePulse();

    // ── seen 스키마 v2 마이그레이션 가드 — 구 seen(스코프 유효 거래만, 해제 키 없음)으로
    // 첫 v2.3 실행을 하면 window 내 모든 해제가 한꺼번에 '오늘 처음 확인'으로 쏟아진다.
    // 그 회차(+창간호)는 해제 코너를 비우고 seen만 시딩 → 다음 회차부터 정상 감지.
    const prevSeenSchema = (prevSeen as { schema?: number }).schema ?? 1;
    const cancellationsReady = !firstRun && prevSeenSchema >= 2;

    // ── 주말 저볼륨 폴백 ④ — dailyRecent.json 롤링(오늘 fresh 요약 append, 3일 초과분 prune)
    const RECENT_PATH = resolve("src/data/dailyRecent.json");
    type RecentDay = { date: string; items: PatchDealInput[] };
    const ageDays = (fromISO: string, toISO: string) =>
      Math.round((new Date(`${toISO}T00:00:00Z`).getTime() - new Date(`${fromISO}T00:00:00Z`).getTime()) / 86_400_000);
    const prevRecent: { days?: RecentDay[] } = existsSync(RECENT_PATH)
      ? JSON.parse(readFileSync(RECENT_PATH, "utf8"))
      : {};
    // 오늘 재실행(workflow_dispatch) 시 같은 날짜 항목은 교체. 보존 창(오늘 포함 3일) 밖은 prune.
    const recentDays: RecentDay[] = (prevRecent.days ?? []).filter(
      (d) => d.date !== today && ageDays(d.date, today) >= 1 && ageDays(d.date, today) < DAILY_RECENT_KEEP_DAYS,
    );
    // 오늘 항목 — 유효 fresh + (감지 준비된 회차에만) 신규 해제. 마이그레이션/창간 회차의
    // 해제 홍수가 롤링 파일로 번지지 않게 canceled는 cancellationsReady일 때만 담는다.
    const todayItems = (boot ?? patch).freshDeals.filter((d) => !d.canceled || cancellationsReady);
    recentDays.push({ date: today, items: todayItems });
    recentDays.sort((a, b) => a.date.localeCompare(b.date));
    writeFileSync(
      RECENT_PATH,
      JSON.stringify({ updatedAt: today, days: recentDays }) + "\n",
      "utf8",
    );

    // merged 판정 — 오늘 fresh 유효 거래가 문턱(80) 미만이고 합산할 이전 일자가 있을 때.
    // 이전 며칠 fresh의 seen 키를 빼고 다시 computePatch → 코너 전부(주요·강세·약세·온도·해제)
    // 를 합산분 기준으로 재계산한다. 개별 아이템 날짜(dealDate)는 그대로 병기된다.
    const freshValidCount = patch.newDealCount;
    const canMerge = !boot && freshValidCount < PATCH_MERGED_MIN_FRESH && recentDays.length >= 2;
    const merged = canMerge
      ? computePatch({
          deals: patchDeals,
          seenKeys: subtractRecentFromSeen(
            new Set(prevSeen.keys ?? []),
            recentDays.flatMap((d) => d.items),
          ),
          lookupMedian,
          todayISO: today,
        })
      : null;

    const active = boot ?? merged ?? patch;
    const mode = boot ? "bootstrap" : merged ? "merged" : "daily";
    const cancellations = cancellationsReady ? active.cancellations : [];
    // 헤드라인 묶음 ⑤ — 톱 1 + 세그먼트 서브(서울/경기·인천/9억 이하) 빌드타임 확정.
    const headlines = pickHeadlines({
      major: active.major,
      nerf: active.nerf,
      newDealCount: active.newDealCount,
      todayISO: today,
    });

    writeFileSync(
      PATCH_PATH,
      JSON.stringify(
        {
          generatedAt: today,
          scopeDays: boot ? BOOTSTRAP_SCOPE_DAYS : PATCH_SCOPE_DAYS,
          mode,
          // merged 라벨용 합산 구간 — "주말 합산 · {M/D}~{M/D} 공개분".
          mergedFromDate: merged ? recentDays[0].date : null,
          mergedToDate: merged ? today : null,
          newDealCount: active.newDealCount,
          scopeDealCount: active.scopeDealCount,
          nerf: active.nerf,
          buff: active.buff,
          major: active.major,
          temp: active.temp,
          // [약세 동네] 코너 데이터 + 대칭 강세 집계(데이터용 — UI는 약세만 게재).
          weakRegions: active.weakRegions,
          strongRegions: active.strongRegions,
          // [오늘의 해제] ① — 마이그레이션/창간 회차는 [](다음 회차부터 감지).
          cancellations,
          // 오늘 최다 공개 동네 ② — fresh 유효 거래 시군구 상위 3.
          busiestRegions: active.busiestRegions,
          // [오늘의 거래 지도] — fresh 유효 거래의 시군구별 전체 집계(0건 제외).
          regionCounts: active.regionCounts,
          headlines,
          latestDealDate: latest || null,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    // seen은 항상 "오늘 폴링 전체 window"(해제 포함) 기준 — merged/boot와 무관.
    writeFileSync(
      SEEN_PATH,
      JSON.stringify({ updatedAt: today, schema: 2, keys: patch.nextSeenKeys }) + "\n",
      "utf8",
    );
    const p = active;
    console.log(
      `dailyPatch(${boot ? "창간호" : merged ? "주말합산" : "일간"}): 스코프 ${p.scopeDealCount}건 · 신규 ${p.newDealCount} · 너프 ${p.nerf.length} · 버프 ${p.buff.length} · 주요 ${p.major.length} · 약세동네 ${p.weakRegions.length} · 해제 ${cancellations.length}${cancellationsReady ? "" : "(시딩)"} · 최다동네 ${p.busiestRegions.map((b) => `${b.sigungu} ${b.count}`).join("/") || "-"} · 온도 ${p.temp ? `${p.temp.above}:${p.temp.below}/${p.temp.matched}` : "표본부족"}`,
    );
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
