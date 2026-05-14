/**
 * fetch-molit.ts
 *
 * Standalone data-fetcher: pulls apartment transaction records from MOLIT
 * (국토교통부 실거래가) and upserts them into the local database.
 *
 * Usage:
 *   npx tsx scripts/fetch-molit.ts [--months=3] [--gu="강남구,서초구,송파구"]
 *
 * Defaults: months=3, gu=강남구,서초구,송파구
 */

import { PrismaClient } from "@prisma/client";
import { fetchDealsForRange, SEOUL_GU_CODES } from "@/lib/molit";
import type { MolitDeal } from "@/types/molit";

// ---------------------------------------------------------------------------
// Guard: MOLIT_API_KEY must be present before we do anything.
// ---------------------------------------------------------------------------
if (!process.env.MOLIT_API_KEY) {
  console.error(
    "오류: MOLIT_API_KEY 환경 변수가 설정되지 않았습니다.\n" +
      ".env.local 파일에 MOLIT_API_KEY=<발급받은 키> 를 추가한 후 다시 실행해 주세요."
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Arg parsing — no external libraries needed for two simple flags.
// ---------------------------------------------------------------------------

const DEFAULT_GU = ["강남구", "서초구", "송파구"];
const DEFAULT_MONTHS = 3;

function parseArgs(): { months: number; guList: string[] } {
  let months = DEFAULT_MONTHS;
  let guList = DEFAULT_GU;

  for (const arg of process.argv.slice(2)) {
    const monthsMatch = arg.match(/^--months=(\d+)$/);
    if (monthsMatch) {
      months = parseInt(monthsMatch[1], 10);
      continue;
    }

    const guMatch = arg.match(/^--gu="?([^"]+)"?$/);
    if (guMatch) {
      guList = guMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }

    console.warn(`알 수 없는 인수 무시됨: ${arg}`);
  }

  return { months, guList };
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Returns YYYYMM string for the month that is `n` months before today. */
function monthsAgoYYYYMM(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

/** Returns YYYYMM string for the current month. */
function currentYYYYMM(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

/** Parse "YYYYMMDD" or "YYYY-MM-DD" from MOLIT deal into a JS Date. */
function parseDealDate(raw: string): Date {
  // MOLIT returns dates as "YYYYMMDD" or "YYYY-MM-DD"
  const cleaned = raw.replace(/-/g, "");
  const y = parseInt(cleaned.slice(0, 4), 10);
  const mo = parseInt(cleaned.slice(4, 6), 10) - 1;
  const d = parseInt(cleaned.slice(6, 8), 10);
  return new Date(y, mo, d);
}

// ---------------------------------------------------------------------------
// Core upsert logic
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();

async function upsertComplex(
  deal: MolitDeal,
  sigungu: string
): Promise<string> {
  const complex = await prisma.complex.upsert({
    where: {
      sigungu_dongName_name: {
        sigungu,
        dongName: deal.dongName,
        name: deal.apartmentName,
      },
    },
    create: {
      sigungu,
      dongName: deal.dongName,
      name: deal.apartmentName,
      buildYear: deal.buildYear ?? null,
    },
    update: {
      // Only fill in buildYear if we now know it and didn't before.
      ...(deal.buildYear != null ? { buildYear: deal.buildYear } : {}),
    },
  });

  return complex.id;
}

async function insertTransactionIfNew(
  complexId: string,
  deal: MolitDeal
): Promise<boolean> {
  // MolitDeal.dealDate is already a Date (transformed by the molit wrapper).
  const dealDate = deal.dealDate;
  const priceKrw = deal.priceKrw;

  // SQLite doesn't support compound unique on BigInt+Float; use findFirst.
  const existing = await prisma.transaction.findFirst({
    where: {
      complexId,
      dealDate,
      area: deal.area,
      floor: deal.floor ?? null,
      priceKrw,
    },
  });

  if (existing) return false;

  await prisma.transaction.create({
    data: {
      complexId,
      dealDate,
      priceKrw,
      area: deal.area,
      floor: deal.floor ?? null,
      source: "MOLIT",
    },
  });

  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { months, guList } = parseArgs();
  const fromYearMonth = monthsAgoYYYYMM(months);
  const toYearMonth = currentYYYYMM();

  console.log(
    `MOLIT 실거래가 수집: ${fromYearMonth} ~ ${toYearMonth}, 대상 구: ${guList.join(", ")}`
  );

  for (const gu of guList) {
    const sigunguCode = SEOUL_GU_CODES[gu];
    if (!sigunguCode) {
      console.log(`  [건너뜀] "${gu}"에 대한 시군구 코드를 찾을 수 없습니다.`);
      continue;
    }

    let deals: MolitDeal[];
    try {
      deals = await fetchDealsForRange({ sigunguCode, fromYearMonth, toYearMonth });
    } catch (err) {
      console.error(`  [오류] ${gu} 데이터 수집 실패:`, err);
      continue;
    }

    let inserted = 0;
    let skipped = 0;

    for (const deal of deals) {
      const complexId = await upsertComplex(deal, gu);
      const wasInserted = await insertTransactionIfNew(complexId, deal);

      if (wasInserted) {
        inserted++;
      } else {
        skipped++;
      }
    }

    const total = deals.length.toLocaleString();
    const ins = inserted.toLocaleString();
    const skip = skipped.toLocaleString();
    console.log(`  ${gu}: ${total} 건 수집, ${ins} 건 저장, ${skip} 건 중복 건너뜀`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
