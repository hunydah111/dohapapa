// 합성 시드 데이터 제거 — 실거래 데이터로 교체하기 전 초기화.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const c = await prisma.commuteCache.deleteMany({});
  const t = await prisma.transaction.deleteMany({});
  const x = await prisma.complex.deleteMany({});
  console.log(`삭제: complex ${x.count}, transaction ${t.count}, commuteCache ${c.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
