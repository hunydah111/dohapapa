import { describe, it, expect } from "vitest";
import scoreKeywords from "@/lib/score/keywords";
import type { ListingInput, ComparableSet } from "@/types/listing";

function makeInput(description?: string): ListingInput {
  return {
    complexName: "테스트단지",
    askPriceKrw: 1_000_000_000n,
    area: 84,
    description,
  };
}

describe("scoreKeywords", () => {
  it("returns 0 points for empty description", () => {
    const result = scoreKeywords(makeInput(""), null);
    expect(result.points).toBe(0);
    expect(result.reason).toBe("");
  });

  it("returns 0 points when description is undefined", () => {
    const result = scoreKeywords(makeInput(undefined), null);
    expect(result.points).toBe(0);
  });

  it("returns 2 points for one keyword (급매)", () => {
    const result = scoreKeywords(makeInput("급매 매물입니다"), null);
    expect(result.points).toBe(2);
    expect(result.reason).toMatch(/급매/);
  });

  it("returns 4 points for two keywords (급매 즉시입주)", () => {
    const result = scoreKeywords(makeInput("급매! 즉시입주 가능합니다"), null);
    expect(result.points).toBe(4);
    expect(result.reason).toMatch(/2건/);
  });

  it("returns 5 points (full) for three or more keywords", () => {
    const result = scoreKeywords(
      makeInput("급매 즉시입주 초특가 단독 매물"),
      null
    );
    expect(result.points).toBe(5);
    expect(result.reason).toMatch(/3건|4건|5건/);
  });

  it("handles uppercase keyword with case-insensitive match (VIP)", () => {
    const result = scoreKeywords(makeInput("VIP 매물"), null);
    expect(result.points).toBe(2);
    expect(result.reason).toMatch(/VIP/);
  });

  it("handles keywords with extra spacing around them", () => {
    // 급처분 should be found within the description text regardless of spacing
    const result = scoreKeywords(makeInput("  급처분  물건입니다  "), null);
    expect(result.points).toBe(2);
  });

  it("comp parameter does not affect keyword scoring (null or provided)", () => {
    const comp: ComparableSet = {
      complexId: "test",
      area: 84,
      windowMonths: 6,
      prices: [],
      medianKrw: 1_000_000_000n,
      stdevKrw: 100_000_000n,
      count: 5,
    };
    const withNull = scoreKeywords(makeInput("급매"), null);
    const withComp = scoreKeywords(makeInput("급매"), comp);
    expect(withNull.points).toBe(withComp.points);
  });
});
