/**
 * build-region-series.ts
 *
 * 동네면(/r/[시군구]) 12개월 추이용 — DB 전체 거래에서 시군구별 최근 13개월
 * (완료월 12 + 당월) 월 버킷을 집계해 src/data/regionSeries.json 으로 굽는다(작음, 커밋).
 *
 * 편집 헌장: 이 파일의 숫자는 "실거래 관측값"이다 — 시세 지수가 아니다.
 *  - 중위가: 그 달 유효 거래(해제·직거래·분양권 제외) 전체의 중위(평형 혼합 — 각주 명시).
 *  - 표본 3건 미만인 달은 medianKrw null(표본 부족 — 인쇄 안 함). 거래량(counts)은 그대로.
 *  - 만원 단위 반올림 — 파일 크기 억제 + 원 단위 정밀도라는 허위 신호 방지.
 *
 * 유효 거래 필터(적재 스키마 의존):
 *  - 분양권/입주권: source "분양권"|"입주권" (fetch-presale) — 매매 아님, 제외.
 *  - 직거래: source "MOLIT_DIRECT" (fetch-molit 2026-07-06 태깅) — 증여성 의심, 제외.
 *  - 해제: 2026-07-06부터 fetch-molit 적재 단계에서 아예 제외(DB에 안 들어옴).
 *    ⚠️ 그 이전 적재분(주간 refresh 창 밖 과거 월)에는 해제·직거래가 "MOLIT"으로 남아
 *    있을 수 있다 — 정화 백필은 weekly-data-refresh workflow_dispatch 에서
 *    refresh_months=13 으로 1회 수동 실행(fetch-molit 이 그 창을 원자적 재적재).
 *
 * 함께 굽는 것 1: 온도 시계열(src/data/tempSeries.json) — 직전 거래(같은 단지×평형 밴드,
 *   60일 내) 대비 월별 above/below/matched, 최대 약 6년('20.9~)+당월(--months= 오버라이드).
 *   같은 DB 조회를 재사용한다(추가 쿼리 0). 로직은 @/lib/tempSeries (순수 함수).
 *
 * 함께 굽는 것 2: [최근 거래 상위](src/data/regionTop.json) — 시군구 × 평형 밴드
 *   (59㎡급=p19_25 / 84㎡급=p32_35) 최근 60일 유효 거래 중 단지당 대표 1건, 가격
 *   내림차순 TOP10 + 직전 거래(60일 규칙 동일). 단지명·동·층이 필요해 별도의 좁은
 *   조회(120일 창 — 직전 후보 포함)를 한 번 더 한다. 로직은 @/lib/regionTop (순수 함수).
 *
 * 실행: 주간 크론(.github/workflows/daily-data.yml) 전용 — DB(Neon)는 크론에서만 접근 가능.
 *   npx tsx scripts/build-region-series.ts [--months=61]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { SIGUNGU_NAMES } from "@/lib/molit";
import {
  REGION_SERIES_MONTHS,
  bucketRegionSeries,
  lastMonths,
  ymOf,
  type RegionSeriesFile,
  type RegionSeriesTx,
} from "@/lib/regionSeries";
import { bandOfArea } from "@/lib/plan/dday";
import {
  TEMP_SERIES_DEFAULT_MONTHS,
  bucketTempSeries,
  trimLeadingEmptyMonths,
  type TempSeriesFile,
  type TempSeriesTx,
} from "@/lib/tempSeries";
import {
  REGION_TOP_WINDOW_DAYS,
  buildRegionTop,
  type RegionTopFile,
  type RegionTopTx,
} from "@/lib/regionTop";
import {
  computeRegionPeaks,
  type RegionPeaksFile,
  type RegionPeakTx,
} from "@/lib/regionPeaks";

/** 매매 관측에서 제외하는 source — 분양권 전매(별도 시장) + 직거래(증여성 의심). */
const EXCLUDED_SOURCES = new Set(["분양권", "입주권", "MOLIT_DIRECT"]);

const argOf = (k: string) =>
  process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];

async function main() {
  const months = lastMonths(new Date(), REGION_SERIES_MONTHS);
  // 첫 달 1일 0시(로컬=KST — 크론 TZ와 기존 적재분 일치) 이후 거래만.
  const [y, m] = months[0].split("-").map(Number);
  const since = new Date(y, m - 1, 1);
  // 온도 시계열 창 — 기본 약 6년+당월(73, '20.9~ 커버). DB에 없는 앞쪽 달은 굽기 전에 잘라낸다
  // (--months= 오버라이드 가능 — 소급 백필 진행 상황과 무관하게 멱등).
  const tempMonthsWanted = Math.max(
    1,
    Number(argOf("months") ?? TEMP_SERIES_DEFAULT_MONTHS),
  );
  const tempMonthsAll = lastMonths(new Date(), tempMonthsWanted);
  const [ty, tm] = tempMonthsAll[0].split("-").map(Number);
  // 온도 시계열의 첫 달이 안 비틀리게 2개월(직전 거래 비교 창=60일) 더 이른 거래까지 가져온다.
  // regionSeries 버킷은 months 밖 거래를 스스로 무시하므로 영향 없음.
  const sincePrev = new Date(ty, tm - 3, 1);

  // [최근 거래 상위] 창 — 대표는 최근 60일, 직전 거래 후보는 그 60일 전까지(총 120일).
  const now = new Date();
  const topWindowStart = new Date(now);
  topWindowStart.setDate(now.getDate() - REGION_TOP_WINDOW_DAYS);
  const topSince = new Date(now);
  topSince.setDate(now.getDate() - REGION_TOP_WINDOW_DAYS * 2);
  const isoOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const { db } = await import("@/lib/db");
  let rows: RegionSeriesTx[];
  let tempRows: TempSeriesTx[];
  let peakRows: RegionPeakTx[]; // 5년 전고점/회복률 집계 입력 — tempSeries와 같은 창·필터
  let validYms: string[]; // 유효 거래(밴드 무관)의 계약월 — 앞쪽 빈 달 잘라내기 판정용
  let topTxs: RegionTopTx[];
  try {
    const txs = await db.transaction.findMany({
      where: { dealDate: { gte: sincePrev } },
      select: {
        id: true,
        priceKrw: true,
        dealDate: true,
        area: true,
        source: true,
        complexId: true,
        complex: { select: { sigungu: true } },
      },
    });
    const valid = txs.filter(
      (t) =>
        !EXCLUDED_SOURCES.has(t.source) && SIGUNGU_NAMES.has(t.complex.sigungu),
    );
    validYms = valid.map((t) => ymOf(t.dealDate));
    rows = valid
      .filter((t) => t.dealDate >= since)
      .map((t) => ({
        sigungu: t.complex.sigungu,
        ym: ymOf(t.dealDate),
        priceKrw: Number(t.priceKrw),
      }));
    // 전고점/회복률 입력 — tempSeries와 같은 5년+ 조회 전체(계약월·시군구·가격만).
    // computeRegionPeaks 가 months 밖 거래를 스스로 무시하므로 필터 없이 전량 넘긴다.
    peakRows = valid.map((t) => ({
      sigungu: t.complex.sigungu,
      ym: ymOf(t.dealDate),
      priceKrw: Number(t.priceKrw),
    }));
    // 온도 시계열 입력 — 단지×평형 밴드 그룹. 밴드 밖 면적(초소형 등)은 스킵.
    tempRows = valid.flatMap((t) => {
      const band = bandOfArea(t.area);
      if (!band) return [];
      const d = t.dealDate;
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return [
        {
          groupKey: `${t.complexId}|${band}`,
          id: t.id,
          dealDateISO: iso,
          priceKrw: Number(t.priceKrw),
        },
      ];
    });

    // [최근 거래 상위] 입력 — 단지명·동·층까지 필요해 좁은 창(120일)으로 별도 조회.
    // 온도용 약 6년 조회에 문자열 컬럼을 얹으면 메모리가 불어나 분리했다(작고 싼 쿼리).
    const recent = await db.transaction.findMany({
      where: { dealDate: { gte: topSince } },
      select: {
        id: true,
        priceKrw: true,
        dealDate: true,
        area: true,
        floor: true,
        source: true,
        complexId: true,
        complex: { select: { sigungu: true, name: true, dongName: true } },
      },
    });
    topTxs = recent
      .filter(
        (t) =>
          !EXCLUDED_SOURCES.has(t.source) && SIGUNGU_NAMES.has(t.complex.sigungu),
      )
      .map((t) => ({
        id: t.id,
        complexId: t.complexId,
        sigungu: t.complex.sigungu,
        dong: t.complex.dongName,
        apt: t.complex.name,
        areaM2: t.area,
        priceKrw: Number(t.priceKrw),
        dealDateISO: isoOf(t.dealDate),
        floor: t.floor,
      }));
  } finally {
    await db.$disconnect();
  }

  const regions = bucketRegionSeries(rows, months);

  const out: RegionSeriesFile = {
    generatedAt: new Date().toISOString(),
    months,
    regions,
  };

  const dest = resolve(process.cwd(), "src/data/regionSeries.json");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(out) + "\n", "utf8");

  const totalDeals = rows.length;
  const kb = Math.round(JSON.stringify(out).length / 102.4) / 10;
  console.log(
    `regionSeries: 시군구 ${Object.keys(regions).length}곳 · ${months[0]}~${months[months.length - 1]} · 유효 거래 ${totalDeals.toLocaleString()}건 · ${kb}KB → ${dest}`,
  );

  // ── 온도 시계열(최대 약 6년) — 직전 거래(같은 단지×밴드, 60일 내) 대비 월별 집계 ──
  // DB에 데이터가 없는 앞쪽 달은 배열에서 제외(null 패딩 금지 — months = 실제 데이터 구간).
  // 소급 백필(fetch-molit --from/--to)이 과거 월을 채우면 다음 주간 실행에서 자동 연장.
  const monthTotals = tempMonthsAll.map(() => 0);
  {
    const totalIdx = new Map(tempMonthsAll.map((ym, i) => [ym, i]));
    for (const ym of validYms) {
      const i = totalIdx.get(ym);
      if (i !== undefined) monthTotals[i] += 1;
    }
  }
  const start = trimLeadingEmptyMonths(monthTotals);
  const tempMonths = tempMonthsAll.slice(start);
  const buckets = bucketTempSeries(tempRows, tempMonthsAll);
  const tempOut: TempSeriesFile = {
    generatedAt: new Date().toISOString(),
    months: tempMonths,
    above: buckets.above.slice(start),
    below: buckets.below.slice(start),
    matched: buckets.matched.slice(start),
  };
  const tempDest = resolve(process.cwd(), "src/data/tempSeries.json");
  writeFileSync(tempDest, JSON.stringify(tempOut) + "\n", "utf8");
  const totalMatched = tempOut.matched.reduce((a, b) => a + b, 0);
  console.log(
    `tempSeries: ${tempMonths[0] ?? "-"}~${tempMonths[tempMonths.length - 1] ?? "-"} (${tempMonths.length}/${tempMonthsWanted}개월) · matched ${totalMatched.toLocaleString()}건 → ${tempDest}`,
  );

  // ── 전고점/회복률 — 시군구 5년 전고점 대비 현재 회복률(tempSeries와 동일 창) ─────
  //   creator/소비 사상: regionPeaks.ts 상단 주석(관측 중위·평형 혼합·시세 지수 아님).
  //   창은 tempSeries가 trimLeadingEmptyMonths 후 확정한 실데이터 구간과 동일하게 맞춘다.
  const peakRegions = computeRegionPeaks(peakRows, tempMonths);
  const peaksOut: RegionPeaksFile = {
    generatedAt: new Date().toISOString(),
    windowFrom: tempMonths[0] ?? "",
    windowTo: tempMonths[tempMonths.length - 1] ?? "",
    regions: peakRegions,
  };
  const peaksDest = resolve(process.cwd(), "src/data/regionPeaks.json");
  writeFileSync(peaksDest, JSON.stringify(peaksOut) + "\n", "utf8");
  const peaksKb = Math.round(JSON.stringify(peaksOut).length / 102.4) / 10;
  console.log(
    `regionPeaks: 시군구 ${Object.keys(peakRegions).length}곳 · 창 ${peaksOut.windowFrom}~${peaksOut.windowTo} · ${peaksKb}KB → ${peaksDest}`,
  );

  // ── [최근 거래 상위] — 시군구 × 밴드(59㎡급/84㎡급) 최근 60일 TOP10 ────────────
  const topRegions = buildRegionTop(topTxs, isoOf(topWindowStart));
  const topOut: RegionTopFile = {
    generatedAt: new Date().toISOString(),
    windowDays: REGION_TOP_WINDOW_DAYS,
    regions: topRegions,
  };
  const topDest = resolve(process.cwd(), "src/data/regionTop.json");
  writeFileSync(topDest, JSON.stringify(topOut) + "\n", "utf8");
  const topCount = Object.values(topRegions).reduce(
    (a, bands) =>
      a + Object.values(bands).reduce((x, cell) => x + (cell?.items.length ?? 0), 0),
    0,
  );
  const topKb = Math.round(JSON.stringify(topOut).length / 102.4) / 10;
  console.log(
    `regionTop: 시군구 ${Object.keys(topRegions).length}곳 · 행 ${topCount.toLocaleString()}개 · 창 ${isoOf(topWindowStart)}~ · ${topKb}KB → ${topDest}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
