import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Synthetic but realistic Seoul apartment transaction seed (~1,000+ rows).
//
// Prices follow market ranges observed in 2024–2025 (rough estimates; real
// MOLIT data should replace this once MOLIT_API_KEY is configured and
// `npx tsx scripts/fetch-molit.ts` is run).
//
// Each complex has 4 size variants (전용 59/74/84/114㎡) and 8–14 transactions
// per variant spread across the last 12 months, plus a 5% chance per row of
// being an "outlier" priced 15–25% below the complex's median — gives the
// price-anomaly scorer real signal to flag.
//
// Deterministic via a seeded LCG so repeated `db:seed` runs produce identical
// rows (helpful for testing / demo reproducibility).
// ---------------------------------------------------------------------------

// Linear congruential generator (Numerical Recipes constants) — deterministic.
let rngState = 0xc0ffee_5eed;
function rand(): number {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 0x1_0000_0000;
}
function randInt(loInclusive: number, hiInclusive: number): number {
  return loInclusive + Math.floor(rand() * (hiInclusive - loInclusive + 1));
}

// ---------------------------------------------------------------------------
// Complex roster — realistic Seoul market segments.
//
// `base84Eok` is the rough mid-price of the 84㎡ supply unit in 억(=1e8 원).
// Size multipliers below derive 59/74/114 prices from this anchor.
// ---------------------------------------------------------------------------
interface ComplexSeed {
  name: string;
  sigungu: string;
  dongName: string;
  buildYear: number;
  totalHouseholds: number;
  base84Eok: number;
}

const COMPLEXES: ComplexSeed[] = [
  // 송파구 — 잠실 일대
  { name: "잠실엘스",          sigungu: "송파구", dongName: "잠실동",   buildYear: 2008, totalHouseholds: 5678, base84Eok: 19.5 },
  { name: "잠실리센츠",        sigungu: "송파구", dongName: "잠실동",   buildYear: 2008, totalHouseholds: 5563, base84Eok: 19.8 },
  { name: "잠실파크리오",      sigungu: "송파구", dongName: "신천동",   buildYear: 2008, totalHouseholds: 6864, base84Eok: 18.5 },
  { name: "헬리오시티",        sigungu: "송파구", dongName: "가락동",   buildYear: 2018, totalHouseholds: 9510, base84Eok: 18.2 },
  // 서초구 — 반포·서초
  { name: "반포자이",          sigungu: "서초구", dongName: "반포동",   buildYear: 2009, totalHouseholds: 3410, base84Eok: 38.0 },
  { name: "래미안퍼스티지",    sigungu: "서초구", dongName: "반포동",   buildYear: 2009, totalHouseholds: 2444, base84Eok: 42.0 },
  { name: "아크로리버파크",    sigungu: "서초구", dongName: "반포동",   buildYear: 2016, totalHouseholds: 1612, base84Eok: 46.0 },
  { name: "반포래미안원베일리", sigungu: "서초구", dongName: "반포동",   buildYear: 2023, totalHouseholds: 2990, base84Eok: 50.0 },
  // 강남구 — 대치·도곡·압구정
  { name: "래미안대치팰리스",  sigungu: "강남구", dongName: "대치동",   buildYear: 2016, totalHouseholds: 1608, base84Eok: 36.0 },
  { name: "도곡렉슬",          sigungu: "강남구", dongName: "도곡동",   buildYear: 2006, totalHouseholds: 3002, base84Eok: 28.5 },
  { name: "은마아파트",        sigungu: "강남구", dongName: "대치동",   buildYear: 1979, totalHouseholds: 4424, base84Eok: 27.0 },
  { name: "타워팰리스1차",     sigungu: "강남구", dongName: "도곡동",   buildYear: 2002, totalHouseholds: 1297, base84Eok: 29.0 },
  // 마포구
  { name: "마포래미안푸르지오", sigungu: "마포구", dongName: "아현동",   buildYear: 2014, totalHouseholds: 3885, base84Eok: 16.5 },
  { name: "공덕자이",          sigungu: "마포구", dongName: "공덕동",   buildYear: 2015, totalHouseholds: 1164, base84Eok: 15.8 },
  { name: "마포자이3차",       sigungu: "마포구", dongName: "염리동",   buildYear: 2018, totalHouseholds: 927,  base84Eok: 17.2 },
  // 용산구
  { name: "한남더힐",          sigungu: "용산구", dongName: "한남동",   buildYear: 2011, totalHouseholds: 600,  base84Eok: 60.0 },
  { name: "이촌현대",          sigungu: "용산구", dongName: "이촌동",   buildYear: 1974, totalHouseholds: 653,  base84Eok: 22.0 },
  // 성동구
  { name: "트리마제",          sigungu: "성동구", dongName: "성수동1가", buildYear: 2017, totalHouseholds: 688,  base84Eok: 32.0 },
  { name: "서울숲리버뷰자이",  sigungu: "성동구", dongName: "성수동1가", buildYear: 2019, totalHouseholds: 642,  base84Eok: 25.5 },
  // 광진구·동작구·양천구 등 인기 지역
  { name: "광장힐스테이트",    sigungu: "광진구", dongName: "광장동",   buildYear: 2013, totalHouseholds: 668,  base84Eok: 17.5 },
  { name: "흑석한강푸르지오",  sigungu: "동작구", dongName: "흑석동",   buildYear: 2012, totalHouseholds: 893,  base84Eok: 18.0 },
  { name: "목동신시가지7단지", sigungu: "양천구", dongName: "목동",     buildYear: 1986, totalHouseholds: 2550, base84Eok: 20.0 },
  // 강동구
  { name: "고덕그라시움",      sigungu: "강동구", dongName: "고덕동",   buildYear: 2019, totalHouseholds: 4932, base84Eok: 17.0 },
  { name: "둔촌주공",          sigungu: "강동구", dongName: "둔촌동",   buildYear: 2024, totalHouseholds: 12032, base84Eok: 16.8 },
  // 노원·은평 — 중저가 segment
  { name: "상계주공7단지",     sigungu: "노원구", dongName: "상계동",   buildYear: 1988, totalHouseholds: 2634, base84Eok: 9.5 },
];

// Size multipliers vs 84㎡ anchor. Smaller units have a price premium per ㎡
// while larger units have a discount per ㎡ but still cost more absolutely.
const SIZE_VARIANTS: { area: number; multiplier: number }[] = [
  { area: 59,  multiplier: 0.72 },
  { area: 74,  multiplier: 0.88 },
  { area: 84,  multiplier: 1.00 },
  { area: 114, multiplier: 1.30 },
];

interface TransactionRow {
  dealDate: Date;
  priceKrw: bigint;
  area: number;
  floor: number;
}

/** YYYY-MM-15 N months ago (15th of the month, deterministic). */
function dateMonthsAgo(monthsBack: number, dayOfMonth: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  d.setDate(dayOfMonth);
  d.setHours(0, 0, 0, 0);
  return d;
}

function makeTransactionsForComplex(c: ComplexSeed): TransactionRow[] {
  const rows: TransactionRow[] = [];

  for (const variant of SIZE_VARIANTS) {
    const baseEok = c.base84Eok * variant.multiplier;
    const count = randInt(8, 14); // 8–14 transactions per size

    for (let i = 0; i < count; i++) {
      const monthsBack = randInt(0, 11);
      const day = randInt(2, 28);

      // Base noise ±6% (normal market spread, floor effects etc.)
      const noise = 0.94 + rand() * 0.12;

      // 5% chance of a low outlier (-25 to -15%) so price-anomaly scorer has signal
      const isOutlier = rand() < 0.05;
      const outlierAdj = isOutlier ? 0.75 + rand() * 0.10 : 1.0;

      const priceEok = baseEok * noise * outlierAdj;
      // 원 단위로 변환: 1억 = 100_000_000원, 10만원 단위 반올림
      const priceKrw =
        BigInt(Math.round(priceEok * 1_000_000)) * 100n; // (×1e6 × 1e2 = ×1e8)

      rows.push({
        dealDate: dateMonthsAgo(monthsBack, day),
        priceKrw,
        area: variant.area,
        floor: randInt(1, 25),
      });
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Reset to a clean slate so repeated runs converge on the same state.
  await prisma.report.deleteMany({});
  await prisma.score.deleteMany({});
  await prisma.listing.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.complex.deleteMany({});

  let totalTransactions = 0;

  for (const c of COMPLEXES) {
    const upserted = await prisma.complex.upsert({
      where: {
        sigungu_dongName_name: {
          sigungu: c.sigungu,
          dongName: c.dongName,
          name: c.name,
        },
      },
      create: {
        name: c.name,
        sigungu: c.sigungu,
        dongName: c.dongName,
        buildYear: c.buildYear,
        totalHouseholds: c.totalHouseholds,
      },
      update: {
        buildYear: c.buildYear,
        totalHouseholds: c.totalHouseholds,
      },
    });

    const txRows = makeTransactionsForComplex(c);

    // Bulk insert via createMany (SQLite supports it via Prisma since 5.x).
    await prisma.transaction.createMany({
      data: txRows.map((tx) => ({
        complexId: upserted.id,
        dealDate: tx.dealDate,
        priceKrw: tx.priceKrw,
        area: tx.area,
        floor: tx.floor,
        source: "SEED",
      })),
    });

    totalTransactions += txRows.length;
  }

  console.log(
    `Seeded ${COMPLEXES.length} complexes, ${totalTransactions} transactions`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
