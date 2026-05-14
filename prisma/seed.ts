import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Deterministic fake-transaction generator
// ---------------------------------------------------------------------------

/** Returns a Date N months before today, clamped to the 1st of that month. */
function monthsAgo(n: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface TransactionSeed {
  dealDate: Date;
  priceKrw: bigint;
  area: number;
  floor: number;
}

/**
 * Generate ~12 fake transactions for a complex.
 * Prices are realistic for a mid-to-upper-Seoul 아파트 — but one is
 * deliberately low so the price-anomaly scorer has a real outlier to flag.
 */
function makeFakeTransactions(): TransactionSeed[] {
  // [monthsBack, area, priceKrw, floor]
  const rows: [number, number, bigint, number][] = [
    [0, 84, 1_850_000_000n, 12],
    [0, 59, 1_350_000_000n, 5],
    [1, 114, 2_400_000_000n, 18],
    [1, 84, 1_900_000_000n, 7],
    [1, 59, 1_380_000_000n, 3],
    [2, 84, 1_820_000_000n, 10],
    [2, 114, 2_350_000_000n, 21],
    [2, 59, 1_420_000_000n, 8],
    // Outlier — suspiciously cheap 84㎡ (about 30% below median)
    [3, 84, 1_280_000_000n, 2],
    [3, 84, 1_870_000_000n, 15],
    [4, 59, 1_390_000_000n, 6],
    [5, 114, 2_320_000_000n, 19],
  ];

  return rows.map(([mb, area, priceKrw, floor]) => ({
    dealDate: monthsAgo(mb),
    priceKrw,
    area,
    floor,
  }));
}

// ---------------------------------------------------------------------------
// Complexes to seed
// ---------------------------------------------------------------------------

const COMPLEXES = [
  {
    name: "잠실엘스",
    sigungu: "송파구",
    dongName: "잠실동",
    buildYear: 2008,
    totalHouseholds: 5678,
  },
  {
    name: "반포자이",
    sigungu: "서초구",
    dongName: "반포동",
    buildYear: 2009,
    totalHouseholds: 3410,
  },
  {
    name: "마포래미안푸르지오",
    sigungu: "마포구",
    dongName: "아현동",
    buildYear: 2014,
    totalHouseholds: 3885,
  },
] as const;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  let totalTransactions = 0;

  for (const complex of COMPLEXES) {
    const upserted = await prisma.complex.upsert({
      where: {
        sigungu_dongName_name: {
          sigungu: complex.sigungu,
          dongName: complex.dongName,
          name: complex.name,
        },
      },
      create: complex,
      update: {
        buildYear: complex.buildYear,
        totalHouseholds: complex.totalHouseholds,
      },
    });

    const txRows = makeFakeTransactions();

    for (const tx of txRows) {
      // Use findFirst + create rather than upsert because Transaction has no
      // suitable compound unique key in the schema (BigInt + Float combo).
      const existing = await prisma.transaction.findFirst({
        where: {
          complexId: upserted.id,
          dealDate: tx.dealDate,
          area: tx.area,
          floor: tx.floor,
          priceKrw: tx.priceKrw,
        },
      });

      if (!existing) {
        await prisma.transaction.create({
          data: {
            complexId: upserted.id,
            dealDate: tx.dealDate,
            priceKrw: tx.priceKrw,
            area: tx.area,
            floor: tx.floor,
            source: "SEED",
          },
        });
        totalTransactions++;
      }
    }
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
