/**
 * 일회성 이관 스크립트 — SQLite(dev.db)의 Complex + Transaction 을 JSON 으로 덤프한다.
 * schema.prisma 를 Postgres 로 전환하기 *전에* 실행해야 한다 (현재 생성된 client = SQLite).
 *
 * 사용: npx tsx scripts/export-sqlite.ts
 * 출력: prisma/_dump.json  (CommuteCache 는 재생성 캐시라 제외)
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

async function main() {
  const complexes = await prisma.complex.findMany();
  const transactions = await prisma.transaction.findMany();

  const dump = {
    complexes,
    // BigInt 는 JSON 직렬화 불가 → 문자열로 변환해 보관
    transactions: transactions.map((t) => ({
      ...t,
      priceKrw: t.priceKrw.toString(),
    })),
  };

  const out = join(process.cwd(), "prisma", "_dump.json");
  writeFileSync(out, JSON.stringify(dump));
  console.log(
    `덤프 완료 → ${out}\n  complexes: ${complexes.length}\n  transactions: ${transactions.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
