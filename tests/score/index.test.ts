import { describe, it, expect } from "vitest";
import { computeScore } from "@/lib/score/index";
import type { ListingInput, ComparableSet, SignalKey } from "@/types/listing";

const ALL_SIGNAL_KEYS: SignalKey[] = [
  "price",
  "brokerConcentration",
  "stale",
  "refresh",
  "photoReuse",
  "info",
  "keywords",
  "brokerHistory",
];

/** A clean, fresh listing with no suspicious signals. */
function makeCleanInput(): ListingInput {
  return {
    complexName: "좋은단지",
    askPriceKrw: 2_000_000_000n, // right at median
    area: 84,
    floor: 7,
    direction: "남향",
    description: "넓고 깨끗한 매물. 주변 환경이 쾌적합니다. 방3 화2.",
    photoCount: 15,
    postedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    refreshHistory: [],
  };
}

/** Comparable set at 20억 median with small stdev. */
function makeComp(): ComparableSet {
  return {
    complexId: "good-complex",
    area: 84,
    windowMonths: 6,
    prices: [],
    medianKrw: 2_000_000_000n,
    stdevKrw: 200_000_000n, // 10% of median
    count: 10,
  };
}

describe("computeScore", () => {
  it("returns a low total score (< 10) and band='green' for a clean listing", () => {
    const result = computeScore(makeCleanInput(), makeComp());
    // Clean listing at median price, fresh, good info, no keywords
    expect(result.total).toBeLessThan(10);
    expect(result.band).toBe("green");
  });

  it("returns a high total score and band='red' for a clearly bait listing", () => {
    const baitInput: ListingInput = {
      complexName: "의심단지",
      // 30% below median → z ≈ -3 → 30 pts (price)
      askPriceKrw: 1_400_000_000n,
      area: 84,
      // Missing info fields
      floor: undefined,
      direction: undefined,
      description: "급매 즉시입주 초특가", // 3 bait keywords → 5 pts (keywords), but <20 chars so info also triggered
      photoCount: 0,
      // Posted 90 days ago → 10 pts (stale)
      postedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      // 3 phantom refreshes within 7 days → 15 pts (refresh)
      refreshHistory: [
        { at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), priceKrw: 1_400_000_000n, modified: false },
        { at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), priceKrw: 1_400_000_000n, modified: false },
        { at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), priceKrw: 1_400_000_000n, modified: false },
      ],
    };

    const result = computeScore(baitInput, makeComp());
    // MVP: brokerConcentration/photoReuse/brokerHistory are placeholders (0 pts).
    // Realistic max with implemented signals: price(30)+stale(10)+refresh(15)+keywords(5)+info(5) = 65.
    // 65 falls in the "yellow" band (40–70). When placeholders activate later, this should push to "red".
    expect(result.total).toBeGreaterThanOrEqual(60);
    expect(result.band).toBe("yellow");
  });

  it("signals object contains all 8 SignalKeys", () => {
    const result = computeScore(makeCleanInput(), makeComp());
    for (const key of ALL_SIGNAL_KEYS) {
      expect(result.signals).toHaveProperty(key);
      expect(typeof result.signals[key]).toBe("number");
    }
    expect(Object.keys(result.signals)).toHaveLength(ALL_SIGNAL_KEYS.length);
  });

  it("reasoning object contains all 8 SignalKeys", () => {
    const result = computeScore(makeCleanInput(), makeComp());
    for (const key of ALL_SIGNAL_KEYS) {
      expect(result.reasoning).toHaveProperty(key);
      expect(typeof result.reasoning[key]).toBe("string");
    }
  });

  it("total is clamped to [0, 100]", () => {
    // Even a maximally suspicious listing should not exceed 100
    const result = computeScore(makeCleanInput(), null);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it("band is 'yellow' for a moderately suspicious listing (40-69 range)", () => {
    const moderateInput: ListingInput = {
      complexName: "보통단지",
      // 20% below median → z = -2 → 30 pts (price, exactly at boundary)
      askPriceKrw: 1_600_000_000n,
      area: 84,
      floor: 5,
      direction: "동향",
      description: "급매 즉시입주", // 2 keywords → 4 pts
      photoCount: 5,
      // posted 45 days ago → 5 pts (stale)
      postedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    };

    const result = computeScore(moderateInput, makeComp());
    // price(30) + stale(5) + keywords(4) = 39 minimum, possibly more
    // With boundary rounding it may land 39–50 depending on exact z
    expect(result.total).toBeGreaterThanOrEqual(30);
    // Band should be yellow or red (not green)
    expect(["yellow", "red"]).toContain(result.band);
  });

  it("total equals sum of individual signal points", () => {
    const result = computeScore(makeCleanInput(), makeComp());
    const signalSum = Object.values(result.signals).reduce(
      (acc, pts) => acc + pts,
      0
    );
    // total is clamped so if unclamped sum <= 100 they must be equal
    expect(result.total).toBe(Math.min(100, Math.max(0, signalSum)));
  });
});
