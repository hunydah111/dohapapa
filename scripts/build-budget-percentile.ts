// 수도권 실거래가 분포 → 예산 백분위 테이블 빌더.
// 사용자의 추정 구매력(netPurchasePowerKrw)을 "최근 수도권 실거래가 중 어느 가격대까지
// 닿는지"로 줄 세우기 위한 정적 분포. build-trend-index 와 같은 패턴 — Neon 실데이터로
// src/data/budgetPercentile.json 에 굽고 커밋·배포한다. 비어 있으면 백분위 표시는 자동 숨김.
//
//   npx tsx --env-file=.env.local scripts/build-budget-percentile.ts
//
// 컴플라이언스: 가격 분포(공개 실거래가)일 뿐 투자권유·미래예측 아님. 사용자(예산)를 줄 세우며
// 특정 단지/동네를 줄 세우지 않는다.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { db } from "@/lib/db";
import type { BudgetPercentileData } from "@/lib/budgetPercentile";

const LOOKBACK_MONTHS = 13; // 최근 1년+ — 시세 변동 반영하되 표본 충분

async function main() {
  const since = new Date();
  since.setMonth(since.getMonth() - LOOKBACK_MONTHS);

  const txs = await db.transaction.findMany({
    where: { dealDate: { gte: since } },
    select: { priceKrw: true },
  });

  const prices = txs
    .map((t) => Number(t.priceKrw))
    .filter((p) => p > 0)
    .sort((a, b) => a - b);

  // 백분위 0~100 각 지점의 가격(원). p% 지점 = 그 가격 이하 거래가 p%.
  const percentiles: number[] = [];
  if (prices.length > 0) {
    for (let p = 0; p <= 100; p++) {
      const idx = Math.min(
        prices.length - 1,
        Math.floor((p / 100) * (prices.length - 1)),
      );
      percentiles.push(prices[idx]);
    }
  }

  const out: BudgetPercentileData = {
    generatedAt: new Date().toISOString(),
    count: prices.length,
    percentiles,
  };

  const outPath = resolve(process.cwd(), "src/data/budgetPercentile.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(
    `budgetPercentile.json 생성: 거래 ${prices.length}건` +
      (prices.length > 0
        ? ` (중위 ${(percentiles[50] / 1e8).toFixed(1)}억, ` +
          `상위10% 경계 ${(percentiles[90] / 1e8).toFixed(1)}억)`
        : " — 데이터 없음(백분위 표시 자동 숨김)"),
  );
}

main().finally(() => db.$disconnect());
