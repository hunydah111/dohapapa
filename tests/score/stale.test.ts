import { describe, it, expect } from "vitest";
import scoreStale from "@/lib/score/stale";
import type { ListingInput } from "@/types/listing";

function makeInput(daysAgo?: number): ListingInput {
  const base: ListingInput = {
    complexName: "테스트단지",
    askPriceKrw: 1_000_000_000n,
    area: 84,
  };

  if (daysAgo === undefined) {
    return base;
  }

  const postedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return { ...base, postedAt };
}

describe("scoreStale", () => {
  it("returns 0 points when postedAt is not set", () => {
    const result = scoreStale(makeInput(undefined), null);
    expect(result.points).toBe(0);
    expect(result.reason).toBe("");
  });

  it("returns 0 points for a listing posted 10 days ago (fresh)", () => {
    const result = scoreStale(makeInput(10), null);
    expect(result.points).toBe(0);
    expect(result.reason).toBe("");
  });

  it("returns 0 points for a listing posted 29 days ago (still fresh)", () => {
    const result = scoreStale(makeInput(29), null);
    expect(result.points).toBe(0);
  });

  it("returns 5 points for a listing posted 45 days ago (장기 체류)", () => {
    // 30 <= days < 60 → 5 points
    const result = scoreStale(makeInput(45), null);
    expect(result.points).toBe(5);
    expect(result.reason).toMatch(/45일/);
    expect(result.reason).toMatch(/장기 체류/);
  });

  it("returns 10 points for a listing posted 90 days ago (이례적 장기 체류)", () => {
    // days >= 60 → 10 points
    const result = scoreStale(makeInput(90), null);
    expect(result.points).toBe(10);
    expect(result.reason).toMatch(/90일/);
    expect(result.reason).toMatch(/이례적 장기 체류/);
  });

  it("returns 10 points at the 60-day boundary (이례적 장기 체류)", () => {
    const result = scoreStale(makeInput(60), null);
    expect(result.points).toBe(10);
  });

  it("returns 5 points at the 30-day boundary (장기 체류)", () => {
    const result = scoreStale(makeInput(30), null);
    expect(result.points).toBe(5);
  });

  it("includes days detail in the result", () => {
    const result = scoreStale(makeInput(45), null);
    expect(result.detail).toBeDefined();
    expect((result.detail as Record<string, unknown>)["days"]).toBeGreaterThanOrEqual(44);
    expect((result.detail as Record<string, unknown>)["days"]).toBeLessThanOrEqual(46);
  });
});
