import { ComparableSet } from "@/types/listing";
import { db } from "@/lib/db";

export async function buildComparables(opts: {
  complexId: string;
  area: number;
  areaTolerance?: number; // default ±3 ㎡
  windowMonths?: number;  // default 6
}): Promise<ComparableSet | null> {
  const { complexId, area } = opts;
  const tol = opts.areaTolerance ?? 3;
  // 6 months balances sample size (need >=3 for stable median/stdev) vs market
  // freshness. Real MOLIT data is dense enough that 3 months also works.
  const windowMonths = opts.windowMonths ?? 6;

  const since = new Date();
  since.setMonth(since.getMonth() - windowMonths);

  const rows = await db.transaction.findMany({
    where: {
      complexId,
      area: { gte: area - tol, lte: area + tol },
      dealDate: { gte: since },
    },
    select: { priceKrw: true },
  });

  if (rows.length < 3) return null;

  // Sort ascending by price for median / stdev computation.
  const prices = rows
    .map((r) => r.priceKrw as bigint)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const count = prices.length;

  // Median: middle element for odd count, average of two middles for even.
  let medianKrw: bigint;
  const mid = Math.floor(count / 2);
  if (count % 2 === 1) {
    medianKrw = prices[mid];
  } else {
    // Integer average — add then shift right by 1 (floor division by 2).
    medianKrw = (prices[mid - 1] + prices[mid]) / 2n;
  }

  // Population standard deviation in bigint arithmetic.
  // stdev = sqrt( sum((x - mean)^2) / N )
  // We compute the mean as a bigint (floored) and work in integer space,
  // then call Math.sqrt on the Number representation at the very end.
  const sum = prices.reduce((acc, p) => acc + p, 0n);
  const mean = sum / BigInt(count);

  const variance =
    prices.reduce((acc, p) => {
      const diff = p - mean;
      return acc + diff * diff;
    }, 0n) / BigInt(count);

  // Convert to Number for sqrt, then round back to bigint.
  const stdevKrw = BigInt(Math.round(Math.sqrt(Number(variance))));

  return {
    complexId,
    area,
    windowMonths,
    prices,
    medianKrw,
    stdevKrw,
    count,
  };
}
