/**
 * build-data-meta.ts
 *
 * 첫화면 "최근 실거래 반영일 / 갱신" 표시용 메타를 src/data/dataMeta.json 으로 굽는다.
 * 데이터 파이프라인 마지막 단계에서 실행(매일 크론 포함). 런타임 DB 쿼리 0 — 번들에 박힌다.
 *
 * 실행: npx tsx --env-file=.env.local scripts/build-data-meta.ts
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const agg = await prisma.transaction.aggregate({
    _max: { dealDate: true },
    _count: true,
  });
  const latest = agg._max.dealDate;
  // YYYY-MM-DD (KST 기준 로컬). 워크플로 TZ=Asia/Seoul 가정.
  const latestDealDate = latest
    ? `${latest.getFullYear()}-${String(latest.getMonth() + 1).padStart(2, "0")}-${String(latest.getDate()).padStart(2, "0")}`
    : null;

  const meta = {
    generatedAt: new Date().toISOString(),
    latestDealDate,
    txCount: agg._count,
  };

  const out = path.resolve("src/data/dataMeta.json");
  writeFileSync(out, JSON.stringify(meta, null, 2) + "\n");
  console.log(
    `dataMeta 작성: 최근 실거래 ${latestDealDate ?? "없음"}, 거래 ${agg._count.toLocaleString()}건 → ${out}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
