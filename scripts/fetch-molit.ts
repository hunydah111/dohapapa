/**
 * fetch-molit.ts
 *
 * MOLIT(국토교통부) 아파트 매매 실거래가를 받아 DB 에 적재한다.
 *
 * 사용법:
 *   npx tsx --env-file=.env.local scripts/fetch-molit.ts [--months=6] [--gu="강남구,..."|--gu=all]
 *
 * 기본값: months=3, gu=강남구,서초구,송파구
 * --gu=all (또는 --gu 생략 없이 명시) 시 LAWD_CODES 전체(서울25 + 경기47) 수집.
 *
 * 주의: createMany 기반 일괄 삽입이라 DB 가 비어 있다고 가정한다.
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

function parseArgs(): { months: number; guList: string[] } {
  let months = DEFAULT_MONTHS;
  let guList: string[] = DEFAULT_GU;

  for (const arg of process.argv.slice(2)) {
    const monthsMatch = arg.match(/^--months=(\d+)$/);
    if (monthsMatch) {
      months = parseInt(monthsMatch[1], 10);
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

  return { months, guList };
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

  // 4. 거래 일괄 생성.
  const txData = deals
    .map((d) => {
      const complexId = idMap.get(`${d.dongName}|${d.apartmentName}`);
      if (!complexId) return null;
      return {
        complexId,
        dealDate: d.dealDate,
        priceKrw: d.priceKrw,
        area: d.area,
        floor: d.floor ?? null,
        source: "MOLIT",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  await createTransactionsChunked(txData);

  return { complexes: complexMap.size, transactions: txData.length };
}

async function main(): Promise<void> {
  const { months, guList } = parseArgs();
  const fromYearMonth = monthsAgoYYYYMM(months);
  const toYearMonth = currentYYYYMM();

  console.log(
    `MOLIT 실거래가 수집: ${fromYearMonth}~${toYearMonth}, 대상 ${guList.length}개 시군구`,
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

    const { complexes, transactions } = await ingestGu(gu, deals);
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
