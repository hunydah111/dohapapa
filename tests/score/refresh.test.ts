import { describe, it, expect } from "vitest";
import scoreRefresh from "@/lib/score/refresh";
import type { ListingInput } from "@/types/listing";

/** Creates a refresh history entry. daysAgo=0 means now. */
function makeEntry(
  daysAgo: number,
  modified: boolean,
  priceKrw = 1_000_000_000n
): { at: Date; priceKrw: bigint; modified: boolean } {
  return {
    at: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    priceKrw,
    modified,
  };
}

function makeInput(
  refreshHistory?: ListingInput["refreshHistory"]
): ListingInput {
  return {
    complexName: "테스트단지",
    askPriceKrw: 1_000_000_000n,
    area: 84,
    refreshHistory,
  };
}

describe("scoreRefresh", () => {
  it("returns 0 points when no refreshHistory is provided", () => {
    const result = scoreRefresh(makeInput(undefined), null);
    expect(result.points).toBe(0);
    expect(result.reason).toBe("");
  });

  it("returns 0 points with only 1 entry in history (below minimum of 2)", () => {
    const history = [makeEntry(1, false)];
    const result = scoreRefresh(makeInput(history), null);
    expect(result.points).toBe(0);
    expect(result.reason).toBe("");
  });

  it("returns 0 points with 1 phantom refresh within 7 days (count=1 below threshold)", () => {
    // Two entries total: 1 phantom within window + 1 real outside window
    const history = [
      makeEntry(1, false), // phantom, within 7 days
      makeEntry(10, false), // phantom, but outside 7-day window
    ];
    const result = scoreRefresh(makeInput(history), null);
    // Only 1 phantom within window → 0 points
    expect(result.points).toBe(0);
  });

  it("returns 8 points for 2 phantom refreshes within 7 days", () => {
    const history = [
      makeEntry(1, false), // phantom, within 7 days
      makeEntry(2, false), // phantom, within 7 days
      makeEntry(15, false), // phantom, outside window — doesn't count
    ];
    const result = scoreRefresh(makeInput(history), null);
    expect(result.points).toBe(8);
    expect(result.reason).toMatch(/2회/);
  });

  it("returns 15 points (full) for 4 phantom refreshes within 7 days", () => {
    const history = [
      makeEntry(1, false),
      makeEntry(2, false),
      makeEntry(3, false),
      makeEntry(4, false),
    ];
    const result = scoreRefresh(makeInput(history), null);
    expect(result.points).toBe(15);
    expect(result.reason).toMatch(/4회/);
  });

  it("does not count refreshes with modified=true as phantom", () => {
    // 3 entries within 7 days but all are real modifications → 0 phantom
    const history = [
      makeEntry(1, true),
      makeEntry(2, true),
      makeEntry(3, true),
    ];
    const result = scoreRefresh(makeInput(history), null);
    expect(result.points).toBe(0);
  });

  it("counts only unmodified entries within the 7-day window", () => {
    // 1 phantom within window + 2 real modifications within window + 1 phantom outside window
    const history = [
      makeEntry(1, false), // phantom, within window → counts
      makeEntry(2, true), // real, within window → doesn't count
      makeEntry(3, true), // real, within window → doesn't count
      makeEntry(10, false), // phantom, outside window → doesn't count
    ];
    const result = scoreRefresh(makeInput(history), null);
    // Only 1 phantom within window → 0 points
    expect(result.points).toBe(0);
  });

  it("returns 15 points for 3 phantom refreshes within 7 days", () => {
    const history = [
      makeEntry(1, false),
      makeEntry(2, false),
      makeEntry(3, false),
    ];
    const result = scoreRefresh(makeInput(history), null);
    expect(result.points).toBe(15);
    expect(result.reason).toMatch(/3회/);
  });

  it("includes phantomRefreshCount and windowDays in detail", () => {
    const history = [
      makeEntry(1, false),
      makeEntry(2, false),
    ];
    const result = scoreRefresh(makeInput(history), null);
    expect(result.detail).toBeDefined();
    const detail = result.detail as Record<string, unknown>;
    expect(detail["phantomRefreshCount"]).toBe(2);
    expect(detail["windowDays"]).toBe(7);
  });
});
