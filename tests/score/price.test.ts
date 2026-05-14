import { describe, it, expect } from "vitest";
import scorePrice from "@/lib/score/price";
import type { ListingInput, ComparableSet } from "@/types/listing";

/** Build a minimal ListingInput for price tests. */
function makeInput(askPriceKrw: bigint): ListingInput {
  return {
    complexName: "테스트단지",
    askPriceKrw,
    area: 84,
  };
}

/** Build a ComparableSet given median, stdev, and optional count. */
function makeComp(
  medianKrw: bigint,
  stdevKrw: bigint,
  count = 5
): ComparableSet {
  return {
    complexId: "test-complex",
    area: 84,
    windowMonths: 6,
    prices: [],
    medianKrw,
    stdevKrw,
    count,
  };
}

// Reference values used across several tests
const MEDIAN = 2_000_000_000n; // 20억
// stdev = 10% of median → 200_000_000
const STDEV = 200_000_000n;

describe("scorePrice", () => {
  it("returns 0 points when comp is null, reason mentions 표본 부족", () => {
    const result = scorePrice(makeInput(MEDIAN), null);
    expect(result.points).toBe(0);
    expect(result.reason).toMatch(/표본 부족/);
  });

  it("returns 0 points when comp.count is 2 (still 부족)", () => {
    const comp = makeComp(MEDIAN, STDEV, 2);
    const result = scorePrice(makeInput(MEDIAN), comp);
    expect(result.points).toBe(0);
    expect(result.reason).toMatch(/표본 부족/);
  });

  it("returns 0 points when ask price equals the median (z = 0)", () => {
    const comp = makeComp(MEDIAN, STDEV, 5);
    // ask == median → z = 0, not below, so 0 points
    const result = scorePrice(makeInput(MEDIAN), comp);
    expect(result.points).toBe(0);
  });

  it("returns 30 points when ask is 30% below median (z ≈ -3, strong outlier)", () => {
    // 30% below median: ask = 20억 * 0.70 = 14억
    const ask = 1_400_000_000n;
    // z = (14억 - 20억) / 2억 = -6억 / 2억 = -3  → full 30 pts
    const comp = makeComp(MEDIAN, STDEV, 5);
    const result = scorePrice(makeInput(ask), comp);
    expect(result.points).toBe(30);
    expect(result.reason).toMatch(/강한 이상치/);
  });

  it("returns ≈15 points when ask is 15% below median (z ≈ -1.5)", () => {
    // 15% below median: ask = 20억 * 0.85 = 17억
    const ask = 1_700_000_000n;
    // z = (17억 - 20억) / 2억 = -3억 / 2억 = -1.5
    // Linear interp: ((-(-1.5)) - 1) / 1 * 30 = 0.5 * 30 = 15
    const comp = makeComp(MEDIAN, STDEV, 5);
    const result = scorePrice(makeInput(ask), comp);
    expect(result.points).toBeGreaterThanOrEqual(10);
    expect(result.points).toBeLessThanOrEqual(20);
  });

  it("returns 0 points when ask price is above median", () => {
    // 10% above median
    const ask = 2_200_000_000n;
    const comp = makeComp(MEDIAN, STDEV, 5);
    const result = scorePrice(makeInput(ask), comp);
    expect(result.points).toBe(0);
  });

  it("returns 0 points when z is between -1 and 0 (normal range)", () => {
    // 5% below median: ask = 20억 * 0.95 = 19억
    const ask = 1_900_000_000n;
    // z = (19억 - 20억) / 2억 = -0.5  → normal range, 0 pts
    const comp = makeComp(MEDIAN, STDEV, 5);
    const result = scorePrice(makeInput(ask), comp);
    expect(result.points).toBe(0);
  });
});
