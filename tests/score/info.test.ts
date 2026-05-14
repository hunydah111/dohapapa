import { describe, it, expect } from "vitest";
import scoreInfo from "@/lib/score/info";
import type { ListingInput } from "@/types/listing";

/** A complete listing input with all optional info fields populated. */
function makeFullInput(): ListingInput {
  return {
    complexName: "테스트단지",
    askPriceKrw: 1_000_000_000n,
    area: 84,
    floor: 5,
    direction: "남향",
    description: "넓고 채광이 좋은 매물입니다. 즉시 입주 가능합니다.", // >20 chars
    photoCount: 10,
  };
}

describe("scoreInfo", () => {
  it("returns 0 points when all info fields are present", () => {
    const result = scoreInfo(makeFullInput(), null);
    expect(result.points).toBe(0);
    expect(result.reason).toBe("");
  });

  it("returns 2 points when one field is missing (floor)", () => {
    const input: ListingInput = {
      ...makeFullInput(),
      floor: undefined,
    };
    const result = scoreInfo(input, null);
    expect(result.points).toBe(2);
    expect(result.reason).toMatch(/층/);
  });

  it("returns 2 points when one field is missing (direction)", () => {
    const input: ListingInput = {
      ...makeFullInput(),
      direction: undefined,
    };
    const result = scoreInfo(input, null);
    expect(result.points).toBe(2);
    expect(result.reason).toMatch(/향/);
  });

  it("treats short description (<20 chars) as missing", () => {
    const input: ListingInput = {
      ...makeFullInput(),
      description: "짧은 설명", // <20 chars
    };
    const result = scoreInfo(input, null);
    expect(result.points).toBe(2);
    expect(result.reason).toMatch(/상세설명/);
  });

  it("treats missing description as missing", () => {
    const input: ListingInput = {
      ...makeFullInput(),
      description: undefined,
    };
    const result = scoreInfo(input, null);
    expect(result.points).toBe(2);
  });

  it("returns 4 points when two fields are missing (floor + direction)", () => {
    const input: ListingInput = {
      ...makeFullInput(),
      floor: undefined,
      direction: undefined,
    };
    const result = scoreInfo(input, null);
    expect(result.points).toBe(4);
  });

  it("returns 5 points (full) when three or more fields are missing", () => {
    // missing floor, direction, description — all three text fields
    const input: ListingInput = {
      ...makeFullInput(),
      floor: undefined,
      direction: undefined,
      description: undefined,
    };
    const result = scoreInfo(input, null);
    expect(result.points).toBe(5);
  });

  it("returns 5 points (full) when everything is missing", () => {
    const input: ListingInput = {
      complexName: "테스트단지",
      askPriceKrw: 1_000_000_000n,
      area: 84,
      // floor, direction, description, photoCount all absent
    };
    const result = scoreInfo(input, null);
    expect(result.points).toBe(5);
  });

  it("treats photoCount of 0 as missing photos", () => {
    const input: ListingInput = {
      ...makeFullInput(),
      photoCount: 0,
    };
    // Only photos are missing → 1 missing field → 2 points
    const result = scoreInfo(input, null);
    expect(result.points).toBe(2);
    expect(result.reason).toMatch(/사진/);
  });
});
