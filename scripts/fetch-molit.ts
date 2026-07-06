/**
 * fetch-molit.ts
 *
 * MOLIT(국토교통부) 아파트 매매 실거래가를 받아 DB 에 적재한다.
 *
 * 사용법:
 *   npx tsx --env-file=.env.local scripts/fetch-molit.ts [--months=6] [--gu="강남구,..."|--gu=all]
 *   npx tsx scripts/fetch-molit.ts --gu=all --refresh-recent=2          (주간 크론 — 증분)
 *   npx tsx scripts/fetch-molit.ts --gu=all --from=202107 --to=202206   (소급 백필 — 조각)
 *
 * 기본값: months=3, gu=강남구,서초구,송파구
 * --gu=all (또는 --gu 생략 없이 명시) 시 LAWD_CODES 전체(서울25 + 경기47 + 인천10) 수집.
 *
 * 소급 백필(--from/--to, YYYYMM 폐구간): 온도 5년 시계열(tempSeries)용 과거 월 수집.
 *   증분과 같은 원자적 교체(ingestGuIncremental)를 "그 월 구간에만" 적용 — 멱등이라
 *   조각 단위로 끊어 여러 번 실행해도 안전(재개 가능). 실행은 daily-data.yml
 *   workflow_dispatch(backfill_from/backfill_to)에서 — 키는 크론 환경에만 있다.
 *   ⚠️ MOLIT 일일 쿼터 불명 — 82구×12개월(약 1천 호출) 단위 조각 실행 권장.
 *      일일 펄스(daily-pulse, 매일 82×3호출)의 쿼터를 잠식하지 않게 하루 한 조각만.
 *
 * 주의: 기본(full) 모드는 createMany 기반 일괄 삽입이라 DB 가 비어 있다고 가정한다.
 *       실데이터로 교체할 때는 먼저 scripts/wipe.ts 를 실행할 것.
 *       fetch 후 scripts/geocode-complexes.ts 로 단지 좌표를 채워야 한다.
 */

import { PrismaClient } from "@prisma/client";
import { fetchDealsForRange, LAWD_CODES } from "@/lib/molit";
import type { MolitDeal } from "@/types/molit";

if (!process.env.MOLIT_API_KEY) {
  console.error(
    "오류: MOLIT_API_KEY 가 설정되지 않았습니다. .env.local 을 확인하세요.",
  );
  process.exit(1);
}

const DEFAULT_GU = ["강남구", "서초구", "송파구"];
const DEFAULT_MONTHS = 3;

function parseArgs(): {
  months: number;
  guList: string[];
  refreshRecent: number | null;
  backfillFrom: string | null;
  backfillTo: string | null;
} {
  let months = DEFAULT_MONTHS;
  let guList: string[] = DEFAULT_GU;
  let refreshRecent: number | null = null;
  let backfillFrom: string | null = null;
  let backfillTo: string | null = null;

  for (const arg of process.argv.slice(2)) {
    const monthsMatch = arg.match(/^--months=(\d+)$/);
    if (monthsMatch) {
      months = parseInt(monthsMatch[1], 10);
      continue;
    }
    // 증분(멱등) 모드 — 최근 N개월만 시군구별로 원자적 교체. 매일 크론용.
    const rrMatch = arg.match(/^--refresh-recent=(\d+)$/);
    if (rrMatch) {
      refreshRecent = Math.max(1, parseInt(rrMatch[1], 10));
      continue;
    }
    // 소급 백필(멱등·재개 가능) — 지정 월 구간(YYYYMM 폐구간)만 원자적 교체.
    const fromMatch = arg.match(/^--from=(\d{6})$/);
    if (fromMatch) {
      backfillFrom = fromMatch[1];
      continue;
    }
    const toMatch = arg.match(/^--to=(\d{6})$/);
    if (toMatch) {
      backfillTo = toMatch[1];
      continue;
    }
    const guMatch = arg.match(/^--gu=(.+)$/);
    if (guMatch) {
      const raw = guMatch[1].replace(/^"|"$/g, "");
      guList =
        raw === "all"
          ? Object.keys(LAWD_CODES)
          : raw.split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }
    console.warn(`알 수 없는 인수 무시됨: ${arg}`);
  }

  if ((backfillFrom === null) !== (backfillTo === null)) {
    console.error("오류: --from/--to 는 반드시 함께(YYYYMM) 지정해야 합니다.");
    process.exit(1);
  }
  if (backfillFrom && backfillTo && backfillFrom > backfillTo) {
    console.error(`오류: --from(${backfillFrom}) 이 --to(${backfillTo}) 보다 뒤입니다.`);
    process.exit(1);
  }
  if (backfillFrom && refreshRecent !== null) {
    console.error("오류: --from/--to 와 --refresh-recent 는 동시에 쓸 수 없습니다.");
    process.exit(1);
  }

  return { months, guList, refreshRecent, backfillFrom, backfillTo };
}

function monthsAgoYYYYMM(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentYYYYMM(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const prisma = new PrismaClient();

// ── 유효 거래 적재 규칙 (2026-07-06, 동네면 시계열 "해제·직거래 제외" 각주의 근거) ──
// Transaction 스키마에 해제/거래유형 컬럼이 없으므로:
//  - 해제(canceled): 법적으로 무효가 된 계약 — 적재 자체를 안 한다(스킵).
//    (해제 "뉴스"는 daily-pulse 가 API 원본에서 직접 다룬다 — DB 무관.)
//  - 직거래: source="MOLIT_DIRECT" 로 태깅해 보존 — 집계 스크립트가 걸러 쓸 수 있게.
//    (기존 소비자(스냅샷 중위가 등)는 source 를 필터하지 않으므로 동작 불변.)
// ⚠️ 이 규칙 이전 적재분은 해제·직거래가 "MOLIT" 으로 남아 있다 — 주간 증분 창(최근
// 2개월)은 매주 원자적 재적재로 자연 정화되고, 과거 월 정화는 workflow_dispatch 에서
// refresh_months=13 1회 실행으로 백필한다.
/** MOLIT 매매가 적재 시 갖는 source 값들 — 증분 교체(deleteMany) 대상. */
const MOLIT_SOURCES = ["MOLIT", "MOLIT_DIRECT"];

function txSourceOf(d: MolitDeal): string {
  return d.dealingGbn === "직거래" ? "MOLIT_DIRECT" : "MOLIT";
}

/** SQLite 변수 한도를 피하려고 createMany 를 청크로 나눠 실행. */
async function createTransactionsChunked(
  data: {
    complexId: string;
    dealDate: Date;
    priceKrw: bigint;
    area: number;
    floor: number | null;
    source: string;
  }[],
): Promise<void> {
  const CHUNK = 1000;
  for (let i = 0; i < data.length; i += CHUNK) {
    await prisma.transaction.createMany({ data: data.slice(i, i + CHUNK) });
  }
}

/** 한 시군구의 deals 를 일괄 적재. DB 가 비어 있다고 가정한다. */
async function ingestGu(
  gu: string,
  deals: MolitDeal[],
): Promise<{ complexes: number; transactions: number }> {
  if (deals.length === 0) return { complexes: 0, transactions: 0 };

  // 1. 고유 단지 추출 (dongName|aptName 기준).
  const complexMap = new Map<
    string,
    { dongName: string; name: string; buildYear: number | null }
  >();
  for (const d of deals) {
    const key = `${d.dongName}|${d.apartmentName}`;
    const existing = complexMap.get(key);
    if (!existing) {
      complexMap.set(key, {
        dongName: d.dongName,
        name: d.apartmentName,
        buildYear: d.buildYear,
      });
    } else if (existing.buildYear === null && d.buildYear !== null) {
      existing.buildYear = d.buildYear;
    }
  }

  // 2. 단지 일괄 생성.
  await prisma.complex.createMany({
    data: [...complexMap.values()].map((c) => ({
      sigungu: gu,
      dongName: c.dongName,
      name: c.name,
      buildYear: c.buildYear,
    })),
  });

  // 3. 이름 → id 맵 조회 (createMany 는 id 를 반환하지 않으므로).
  const rows = await prisma.complex.findMany({
    where: { sigungu: gu },
    select: { id: true, dongName: true, name: true },
  });
  const idMap = new Map<string, string>();
  for (const r of rows) idMap.set(`${r.dongName}|${r.name}`, r.id);

  // 4. 거래 일괄 생성 — 해제는 스킵, 직거래는 source 태깅(위 적재 규칙).
  const txData = deals
    .map((d) => {
      if (d.canceled) return null;
      const complexId = idMap.get(`${d.dongName}|${d.apartmentName}`);
      if (!complexId) return null;
      return {
        complexId,
        dealDate: d.dealDate,
        priceKrw: d.priceKrw,
        area: d.area,
        floor: d.floor ?? null,
        source: txSourceOf(d),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  await createTransactionsChunked(txData);

  return { complexes: complexMap.size, transactions: txData.length };
}

/**
 * 증분(멱등) 적재 — 한 시군구의 창(fromDate 이후, toDateExclusive 미만) MOLIT 매매를
 * 원자적으로 교체한다. 단지는 find-or-create(중복 생성 방지), 거래는 "그 시군구·창 내
 * 삭제 → 재삽입"을 한 트랜잭션으로 처리해 빈 구간 없이 멱등하게 만든다.
 * toDateExclusive 생략 시 열린 창(fromDate~∞) — 주간 최근창 갱신용.
 * toDateExclusive 지정 시 닫힌 창 — 소급 백필(조각 실행)이 창 밖 데이터를 건드리지 않게.
 * (TZ 주의: 워크플로에서 TZ=Asia/Seoul 로 실행해야 기존 KST 적재분과 dealDate 가 일치한다.)
 */
async function ingestGuIncremental(
  gu: string,
  deals: MolitDeal[],
  fromDate: Date,
  toDateExclusive?: Date,
): Promise<{ complexes: number; transactions: number }> {
  // 1. 단지 find-or-create (unique [sigungu,dongName,name] → skipDuplicates).
  const complexMap = new Map<
    string,
    { dongName: string; name: string; buildYear: number | null }
  >();
  for (const d of deals) {
    const key = `${d.dongName}|${d.apartmentName}`;
    const existing = complexMap.get(key);
    if (!existing) {
      complexMap.set(key, {
        dongName: d.dongName,
        name: d.apartmentName,
        buildYear: d.buildYear,
      });
    } else if (existing.buildYear === null && d.buildYear !== null) {
      existing.buildYear = d.buildYear;
    }
  }
  if (complexMap.size > 0) {
    await prisma.complex.createMany({
      data: [...complexMap.values()].map((c) => ({
        sigungu: gu,
        dongName: c.dongName,
        name: c.name,
        buildYear: c.buildYear,
      })),
      skipDuplicates: true,
    });
  }

  const rows = await prisma.complex.findMany({
    where: { sigungu: gu },
    select: { id: true, dongName: true, name: true },
  });
  const idMap = new Map<string, string>();
  for (const r of rows) idMap.set(`${r.dongName}|${r.name}`, r.id);

  const txData = deals
    .map((d) => {
      if (d.canceled) return null; // 해제 — 유효 거래 아님, 적재 스킵.
      const complexId = idMap.get(`${d.dongName}|${d.apartmentName}`);
      if (!complexId) return null;
      return {
        complexId,
        dealDate: d.dealDate,
        priceKrw: d.priceKrw,
        area: d.area,
        floor: d.floor ?? null,
        source: txSourceOf(d),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // 2. 원자적 교체: 이 시군구의 창 내 매매(MOLIT + MOLIT_DIRECT) 삭제 → 재삽입.
  const CHUNK = 1000;
  const ops = [
    prisma.transaction.deleteMany({
      where: {
        source: { in: MOLIT_SOURCES },
        dealDate: toDateExclusive
          ? { gte: fromDate, lt: toDateExclusive }
          : { gte: fromDate },
        complex: { sigungu: gu },
      },
    }),
    ...Array.from({ length: Math.ceil(txData.length / CHUNK) }, (_, k) =>
      prisma.transaction.createMany({
        data: txData.slice(k * CHUNK, (k + 1) * CHUNK),
      }),
    ),
  ];
  await prisma.$transaction(ops);

  return { complexes: complexMap.size, transactions: txData.length };
}

async function main(): Promise<void> {
  const { months, guList, refreshRecent, backfillFrom, backfillTo } = parseArgs();
  const backfill = backfillFrom !== null && backfillTo !== null;
  const incremental = refreshRecent !== null || backfill;
  // 백필이면 지정 월 구간(YYYYMM 폐구간), 증분이면 최근 refreshRecent 개월(당월 포함),
  // 아니면 기존 full 모드.
  const fromYearMonth = backfill
    ? backfillFrom!
    : refreshRecent !== null
      ? monthsAgoYYYYMM(refreshRecent - 1)
      : monthsAgoYYYYMM(months);
  const toYearMonth = backfill ? backfillTo! : currentYYYYMM();
  // 삭제 하한 — fromYearMonth 1일 0시(로컬=KST). 이후 거래만 교체 대상.
  const fromDate = new Date(
    Number(fromYearMonth.slice(0, 4)),
    Number(fromYearMonth.slice(4, 6)) - 1,
    1,
  );
  // 백필 전용 삭제 상한 — toYearMonth "다음 달" 1일 0시 미만. 구간 밖 적재분 보호.
  const toDateExclusive = backfill
    ? new Date(
        Number(toYearMonth.slice(0, 4)),
        Number(toYearMonth.slice(4, 6)), // 0-based라 그대로 쓰면 +1개월
        1,
      )
    : undefined;

  console.log(
    `MOLIT 실거래가 수집[${backfill ? "백필" : incremental ? "증분" : "전체"}]: ${fromYearMonth}~${toYearMonth}, 대상 ${guList.length}개 시군구`,
  );

  let totalComplexes = 0;
  let totalTransactions = 0;

  for (const gu of guList) {
    const sigunguCode = LAWD_CODES[gu];
    if (!sigunguCode) {
      console.log(`  [건너뜀] "${gu}" — 시군구 코드를 찾을 수 없습니다.`);
      continue;
    }

    let deals: MolitDeal[];
    try {
      deals = await fetchDealsForRange({
        sigunguCode,
        fromYearMonth,
        toYearMonth,
      });
    } catch (err) {
      console.error(
        `  [오류] ${gu} 수집 실패:`,
        err instanceof Error ? err.message : err,
      );
      continue;
    }

    const { complexes, transactions } = incremental
      ? await ingestGuIncremental(gu, deals, fromDate, toDateExclusive)
      : await ingestGu(gu, deals);
    totalComplexes += complexes;
    totalTransactions += transactions;
    console.log(
      `  ${gu}: ${complexes.toLocaleString()} 단지, ${transactions.toLocaleString()} 거래`,
    );
  }

  console.log(
    `\n완료: 총 ${totalComplexes.toLocaleString()} 단지, ${totalTransactions.toLocaleString()} 거래`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
