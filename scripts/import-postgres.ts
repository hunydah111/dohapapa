/**
 * 일회성 이관 스크립트 — export-sqlite.ts 가 만든 prisma/_dump.json 을
 * 현재 DATABASE_URL(Postgres/Neon) 에 createMany 배치로 적재한다.
 * schema.prisma 가 postgresql 로 전환되고 client 가 재생성된 *후* 실행.
 *
 * 사용: set -a; . ./.env.local; set +a; npx tsx scripts/import-postgres.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();
const CHUNK = 5000;

type DumpComplex = {
  id: string;
  name: string;
  sigungu: string;
  dongName: string;
  buildYear: number | null;
  totalHouseholds: number | null;
  latitude: number | null;
  longitude: number | null;
  nearestElemSchoolM: number | null;
  nearestSubwayM: number | null;
  createdAt: string;
};
type DumpTx = {
  id: string;
  complexId: string;
  dealDate: string;
  priceKrw: string;
  area: number;
  floor: number | null;
  source: string;
};

async function main() {
  const raw = readFileSync(join(process.cwd(), "prisma", "_dump.json"), "utf8");
  const dump = JSON.parse(raw) as {
    complexes: DumpComplex[];
    transactions: DumpTx[];
  };

  console.log(
    `적재 시작 — complexes ${dump.complexes.length}, transactions ${dump.transactions.length}`,
  );

  const complexRows = dump.complexes.map((c) => ({
    ...c,
    createdAt: new Date(c.createdAt),
  }));
  for (let i = 0; i < complexRows.length; i += CHUNK) {
    const batch = complexRows.slice(i, i + CHUNK);
    await prisma.complex.createMany({ data: batch, skipDuplicates: true });
    console.log(`  complexes ${Math.min(i + CHUNK, complexRows.length)}/${complexRows.length}`);
  }

  const txRows = dump.transactions.map((t) => ({
    ...t,
    dealDate: new Date(t.dealDate),
    priceKrw: BigInt(t.priceKrw),
  }));
  for (let i = 0; i < txRows.length; i += CHUNK) {
    const batch = txRows.slice(i, i + CHUNK);
    await prisma.transaction.createMany({ data: batch, skipDuplicates: true });
    console.log(`  transactions ${Math.min(i + CHUNK, txRows.length)}/${txRows.length}`);
  }

  const [nc, nt] = await Promise.all([
    prisma.complex.count(),
    prisma.transaction.count(),
  ]);
  console.log(`적재 완료 — DB count: complexes ${nc}, transactions ${nt}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
