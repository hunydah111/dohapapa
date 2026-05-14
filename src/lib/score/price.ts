import { ListingInput, ComparableSet, SignalResult } from "@/types/listing";

export default function scorePrice(
  input: ListingInput,
  comp: ComparableSet | null
): SignalResult {
  if (comp === null || comp.count < 3) {
    return {
      points: 0,
      reason: "비교 거래 표본 부족",
      detail: { sampleCount: comp?.count ?? 0 },
    };
  }

  // Convert bigint to number — precision loss is acceptable at KRW scale (~billions)
  const ask = Number(input.askPriceKrw);
  const median = Number(comp.medianKrw);
  const stdev = Number(comp.stdevKrw);

  // Avoid division by zero if all comparables are identical
  if (stdev === 0) {
    return { points: 0, reason: "" };
  }

  const z = (ask - median) / stdev;
  const percentVsMedian = Math.round(((ask - median) / median) * 100);

  const detail = {
    zScore: Math.round(z * 100) / 100,
    medianKrw: comp.medianKrw.toString(),
    askPriceKrw: input.askPriceKrw.toString(),
    percentVsMedian,
  };

  if (z >= 0) {
    // Above median — not a bait-listing pattern
    return { points: 0, reason: "", detail };
  }

  if (z <= -2.0) {
    const pct = Math.abs(percentVsMedian);
    return {
      points: 30,
      reason: `이 단지 비슷한 평형 최근 거래 중위 대비 -${pct}% (강한 이상치)`,
      detail,
    };
  }

  if (z < -1.0) {
    // Linear interpolation: z=-1 → 0 pts, z=-2 → 30 pts
    const points = Math.round(((-z - 1.0) / 1.0) * 30);
    const pct = Math.abs(percentVsMedian);
    return {
      points,
      reason: `이 단지 비슷한 평형 최근 거래 중위 대비 -${pct}% (이상치 의심)`,
      detail,
    };
  }

  // -1.0 <= z < 0 — normal range, just report the percentage
  const pct = Math.abs(percentVsMedian);
  return {
    points: 0,
    reason: `중위 대비 -${pct}% (정상 범위)`,
    detail,
  };
}
