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
 * 실행: 주간 크론(.github/workflows/daily-data.yml) 전용 — DB(Neon)는 크론에서만 접근 가능.
 *   npx tsx scripts/build-region-series.ts
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

/** 매매 관측에서 제외하는 source — 분양권 전매(별도 시장) + 직거래(증여성 의심). */
const EXCLUDED_SOURCES = new Set(["분양권", "입주권", "MOLIT_DIRECT"]);

async function main() {
  const months = lastMonths(new Date(), REGION_SERIES_MONTHS);
  // 첫 달 1일 0시(로컬=KST — 크론 TZ와 기존 적재분 일치) 이후 거래만.
  const [y, m] = months[0].split("-").map(Number);
  const since = new Date(y, m - 1, 1);

  const { db } = await import("@/lib/db");
  let rows: RegionSeriesTx[];
  try {
    const txs = await db.transaction.findMany({
      where: { dealDate: { gte: since } },
      select: {
        priceKrw: true,
        dealDate: true,
        source: true,
        complex: { select: { sigungu: true } },
      },
    });
    rows = txs
      .filter(
        (t) =>
          !EXCLUDED_SOURCES.has(t.source) &&
          SIGUNGU_NAMES.has(t.complex.sigungu),
      )
      .map((t) => ({
        sigungu: t.complex.sigungu,
        ym: ymOf(t.dealDate),
        priceKrw: Number(t.priceKrw),
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
