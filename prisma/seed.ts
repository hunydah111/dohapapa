import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Synthetic but realistic Seoul apartment seed (~1,000+ transactions).
//
// Prices follow market ranges observed in 2024–2025 (rough estimates). Real
// MOLIT data should replace this once MOLIT_API_KEY is configured and
// `npx tsx scripts/fetch-molit.ts` is run.
//
// Coordinates are approximate (good enough for the mock commute provider).
// When real MOLIT data lands, complexes need geocoding (Kakao Local API).
//
// Deterministic via a seeded LCG so repeated `db:seed` runs produce identical
// rows.
// ---------------------------------------------------------------------------

let rngState = 0xc0ffee_5eed;
function rand(): number {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 0x1_0000_0000;
}
function randInt(loInclusive: number, hiInclusive: number): number {
  return loInclusive + Math.floor(rand() * (hiInclusive - loInclusive + 1));
}

interface ComplexSeed {
  name: string;
  sigungu: string;
  dongName: string;
  buildYear: number;
  totalHouseholds: number;
  lat: number;
  lng: number;
  base84Eok: number; // 84㎡ 대표 시세 (억)
  nearestElemSchoolM: number;
  nearestSubwayM: number;
}

const COMPLEXES: ComplexSeed[] = [
  // 송파구 — 잠실 일대
  { name: "잠실엘스",          sigungu: "송파구", dongName: "잠실동",   buildYear: 2008, totalHouseholds: 5678, lat: 37.5133, lng: 127.0857, base84Eok: 19.5, nearestElemSchoolM: 280, nearestSubwayM: 350 },
  { name: "잠실리센츠",        sigungu: "송파구", dongName: "잠실동",   buildYear: 2008, totalHouseholds: 5563, lat: 37.5118, lng: 127.0833, base84Eok: 19.8, nearestElemSchoolM: 220, nearestSubwayM: 300 },
  { name: "잠실파크리오",      sigungu: "송파구", dongName: "신천동",   buildYear: 2008, totalHouseholds: 6864, lat: 37.5165, lng: 127.0985, base84Eok: 18.5, nearestElemSchoolM: 310, nearestSubwayM: 250 },
  { name: "헬리오시티",        sigungu: "송파구", dongName: "가락동",   buildYear: 2018, totalHouseholds: 9510, lat: 37.4979, lng: 127.1158, base84Eok: 18.2, nearestElemSchoolM: 180, nearestSubwayM: 200 },
  // 서초구 — 반포·서초
  { name: "반포자이",          sigungu: "서초구", dongName: "반포동",   buildYear: 2009, totalHouseholds: 3410, lat: 37.5048, lng: 127.0066, base84Eok: 38.0, nearestElemSchoolM: 250, nearestSubwayM: 400 },
  { name: "래미안퍼스티지",    sigungu: "서초구", dongName: "반포동",   buildYear: 2009, totalHouseholds: 2444, lat: 37.5037, lng: 127.0103, base84Eok: 42.0, nearestElemSchoolM: 300, nearestSubwayM: 450 },
  { name: "아크로리버파크",    sigungu: "서초구", dongName: "반포동",   buildYear: 2016, totalHouseholds: 1612, lat: 37.5118, lng: 126.9966, base84Eok: 46.0, nearestElemSchoolM: 350, nearestSubwayM: 280 },
  { name: "반포래미안원베일리", sigungu: "서초구", dongName: "반포동",  buildYear: 2023, totalHouseholds: 2990, lat: 37.5085, lng: 127.0006, base84Eok: 50.0, nearestElemSchoolM: 200, nearestSubwayM: 320 },
  // 강남구 — 대치·도곡
  { name: "래미안대치팰리스",  sigungu: "강남구", dongName: "대치동",   buildYear: 2016, totalHouseholds: 1608, lat: 37.4944, lng: 127.0608, base84Eok: 36.0, nearestElemSchoolM: 150, nearestSubwayM: 300 },
  { name: "도곡렉슬",          sigungu: "강남구", dongName: "도곡동",   buildYear: 2006, totalHouseholds: 3002, lat: 37.4906, lng: 127.0455, base84Eok: 28.5, nearestElemSchoolM: 220, nearestSubwayM: 250 },
  { name: "은마아파트",        sigungu: "강남구", dongName: "대치동",   buildYear: 1979, totalHouseholds: 4424, lat: 37.4993, lng: 127.0608, base84Eok: 27.0, nearestElemSchoolM: 280, nearestSubwayM: 200 },
  { name: "타워팰리스1차",     sigungu: "강남구", dongName: "도곡동",   buildYear: 2002, totalHouseholds: 1297, lat: 37.4889, lng: 127.0545, base84Eok: 29.0, nearestElemSchoolM: 320, nearestSubwayM: 280 },
  // 마포구
  { name: "마포래미안푸르지오", sigungu: "마포구", dongName: "아현동",  buildYear: 2014, totalHouseholds: 3885, lat: 37.5556, lng: 126.9555, base84Eok: 16.5, nearestElemSchoolM: 240, nearestSubwayM: 350 },
  { name: "공덕자이",          sigungu: "마포구", dongName: "공덕동",   buildYear: 2015, totalHouseholds: 1164, lat: 37.5435, lng: 126.9525, base84Eok: 15.8, nearestElemSchoolM: 300, nearestSubwayM: 200 },
  { name: "마포자이3차",       sigungu: "마포구", dongName: "염리동",   buildYear: 2018, totalHouseholds: 927,  lat: 37.5495, lng: 126.9445, base84Eok: 17.2, nearestElemSchoolM: 280, nearestSubwayM: 400 },
  // 용산구
  { name: "한남더힐",          sigungu: "용산구", dongName: "한남동",   buildYear: 2011, totalHouseholds: 600,  lat: 37.5365, lng: 127.0015, base84Eok: 60.0, nearestElemSchoolM: 450, nearestSubwayM: 600 },
  { name: "이촌현대",          sigungu: "용산구", dongName: "이촌동",   buildYear: 1974, totalHouseholds: 653,  lat: 37.5225, lng: 126.9745, base84Eok: 22.0, nearestElemSchoolM: 200, nearestSubwayM: 250 },
  // 성동구
  { name: "트리마제",          sigungu: "성동구", dongName: "성수동1가", buildYear: 2017, totalHouseholds: 688,  lat: 37.5435, lng: 127.0445, base84Eok: 32.0, nearestElemSchoolM: 350, nearestSubwayM: 300 },
  { name: "서울숲리버뷰자이",  sigungu: "성동구", dongName: "성수동1가", buildYear: 2019, totalHouseholds: 642,  lat: 37.5455, lng: 127.0395, base84Eok: 25.5, nearestElemSchoolM: 320, nearestSubwayM: 280 },
  // 광진·동작·양천
  { name: "광장힐스테이트",    sigungu: "광진구", dongName: "광장동",   buildYear: 2013, totalHouseholds: 668,  lat: 37.5475, lng: 127.1045, base84Eok: 17.5, nearestElemSchoolM: 260, nearestSubwayM: 500 },
  { name: "흑석한강푸르지오",  sigungu: "동작구", dongName: "흑석동",   buildYear: 2012, totalHouseholds: 893,  lat: 37.5085, lng: 126.9635, base84Eok: 18.0, nearestElemSchoolM: 240, nearestSubwayM: 350 },
  { name: "목동신시가지7단지", sigungu: "양천구", dongName: "목동",     buildYear: 1986, totalHouseholds: 2550, lat: 37.5305, lng: 126.8755, base84Eok: 20.0, nearestElemSchoolM: 180, nearestSubwayM: 300 },
  // 강동
  { name: "고덕그라시움",      sigungu: "강동구", dongName: "고덕동",   buildYear: 2019, totalHouseholds: 4932, lat: 37.5565, lng: 127.1545, base84Eok: 17.0, nearestElemSchoolM: 200, nearestSubwayM: 250 },
  { name: "올림픽파크포레온",  sigungu: "강동구", dongName: "둔촌동",   buildYear: 2024, totalHouseholds: 12032, lat: 37.5275, lng: 127.1395, base84Eok: 16.8, nearestElemSchoolM: 220, nearestSubwayM: 300 },
  // 노원 — 중저가 segment
  { name: "상계주공7단지",     sigungu: "노원구", dongName: "상계동",   buildYear: 1988, totalHouseholds: 2634, lat: 37.6645, lng: 127.0705, base84Eok: 9.5,  nearestElemSchoolM: 150, nearestSubwayM: 200 },
];

const SIZE_VARIANTS: { area: number; multiplier: number }[] = [
  { area: 59,  multiplier: 0.72 },
  { area: 74,  multiplier: 0.88 },
  { area: 84,  multiplier: 1.0 },
  { area: 114, multiplier: 1.3 },
];

interface TransactionRow {
  dealDate: Date;
  priceKrw: bigint;
  area: number;
  floor: number;
}

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
    const count = randInt(8, 14);

    for (let i = 0; i < count; i++) {
      const monthsBack = randInt(0, 11);
      const day = randInt(2, 28);
      const noise = 0.94 + rand() * 0.12;
      const isOutlier = rand() < 0.05;
      const outlierAdj = isOutlier ? 0.75 + rand() * 0.1 : 1.0;
      const priceEok = baseEok * noise * outlierAdj;
      const priceKrw = BigInt(Math.round(priceEok * 1_000_000)) * 100n;

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

async function main(): Promise<void> {
  // Clean reset.
  await prisma.commuteCache.deleteMany({});
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
        latitude: c.lat,
        longitude: c.lng,
        nearestElemSchoolM: c.nearestElemSchoolM,
        nearestSubwayM: c.nearestSubwayM,
      },
      update: {
        buildYear: c.buildYear,
        totalHouseholds: c.totalHouseholds,
        latitude: c.lat,
        longitude: c.lng,
        nearestElemSchoolM: c.nearestElemSchoolM,
        nearestSubwayM: c.nearestSubwayM,
      },
    });

    const txRows = makeTransactionsForComplex(c);
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
