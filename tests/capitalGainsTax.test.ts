import { describe, expect, it } from "vitest";
import { estimateCapitalGainsTax } from "@/lib/capitalGainsTax";

const 억 = 100_000_000;

describe("estimateCapitalGainsTax — 1세대 1주택 비과세", () => {
  it("매도가 12억 이하 + 비과세 요건 충족 → 0", () => {
    const r = estimateCapitalGainsTax({
      expectedSalePriceKrw: 6 * 억,
      remainingLoanKrw: 2 * 억,
      qualifiesForTaxExemption: true,
    });
    expect(r.taxKrw).toBe(0);
  });

  it("매도가 정확히 12억 + 비과세 → 0", () => {
    const r = estimateCapitalGainsTax({
      expectedSalePriceKrw: 12 * 억,
      remainingLoanKrw: 0,
      qualifiesForTaxExemption: true,
    });
    expect(r.taxKrw).toBe(0);
  });

  it("비과세 + 12억 초과 + 취득가 미상 → 초과분 약 6% 폴백", () => {
    const r = estimateCapitalGainsTax({
      expectedSalePriceKrw: 15 * 억,
      remainingLoanKrw: 0,
      qualifiesForTaxExemption: true,
    });
    // (15-12)억 × 6% = 1,800만
    expect(r.taxKrw).toBe(18_000_000);
  });

  it("비과세 + 15억 + 취득 10억 + 보유 5년 → 12억 초과분만 누진세 + 1주택 우대 장특", () => {
    const r = estimateCapitalGainsTax({
      expectedSalePriceKrw: 15 * 억,
      remainingLoanKrw: 0,
      qualifiesForTaxExemption: true,
      acquisitionPriceKrw: 10 * 억,
      holdingYears: 5,
    });
    // gain = 5억, taxableGain = 5억 × 3/15 = 1억
    // 장특 5×8% = 40% → 1억 × 0.6 = 6,000만
    // 기본공제 250만 → base 5,750만
    // 누진: 5,750만 ≤ 8,800만 → 5,750만 × 24% − 576만 = 804만
    // 지방세 ×1.1 → 약 884.4만
    expect(r.taxKrw).toBeGreaterThan(8_500_000);
    expect(r.taxKrw).toBeLessThan(9_500_000);
  });

  it("비과세 + 매도 10억 + 취득 4억 + 10년 보유 → 12억 이하라 0", () => {
    const r = estimateCapitalGainsTax({
      expectedSalePriceKrw: 10 * 억,
      remainingLoanKrw: 0,
      qualifiesForTaxExemption: true,
      acquisitionPriceKrw: 4 * 억,
      holdingYears: 10,
    });
    expect(r.taxKrw).toBe(0);
  });
});

describe("estimateCapitalGainsTax — 비과세 미충족", () => {
  it("매도 8억 + 취득 5억 + 보유 1년 → 장특 0, 큰 세금", () => {
    const r = estimateCapitalGainsTax({
      expectedSalePriceKrw: 8 * 억,
      remainingLoanKrw: 0,
      qualifiesForTaxExemption: false,
      acquisitionPriceKrw: 5 * 억,
      holdingYears: 1,
    });
    // gain 3억, 장특 0, base = 3억 − 250만 = 2.975억
    // 누진 3억 구간: 2.975억 × 38% − 1,994만 = 11,305 − 1,994 = 9,311만
    // ×1.1 ≈ 1.024억
    expect(r.taxKrw).toBeGreaterThan(95_000_000);
    expect(r.taxKrw).toBeLessThan(110_000_000);
  });

  it("매도 8억 + 취득 5억 + 보유 5년 → 일반표 장특 10% 적용", () => {
    const r = estimateCapitalGainsTax({
      expectedSalePriceKrw: 8 * 억,
      remainingLoanKrw: 0,
      qualifiesForTaxExemption: false,
      acquisitionPriceKrw: 5 * 억,
      holdingYears: 5,
    });
    // gain 3억, 장특 10% → 2.7억, base 2.675억
    // 누진 3억: 2.675 × 38% − 1,994만 = 10,165 − 1,994 = 8,171만 × 1.1 ≈ 8,988만
    expect(r.taxKrw).toBeGreaterThan(80_000_000);
    expect(r.taxKrw).toBeLessThan(100_000_000);
    // 1년 보유보다는 명확히 적어야 함
    const oneYear = estimateCapitalGainsTax({
      expectedSalePriceKrw: 8 * 억,
      remainingLoanKrw: 0,
      qualifiesForTaxExemption: false,
      acquisitionPriceKrw: 5 * 억,
      holdingYears: 1,
    });
    expect(r.taxKrw).toBeLessThan(oneYear.taxKrw);
  });

  it("취득가 미상 → 매도가 약 6% 폴백", () => {
    const r = estimateCapitalGainsTax({
      expectedSalePriceKrw: 8 * 억,
      remainingLoanKrw: 0,
      qualifiesForTaxExemption: false,
    });
    expect(r.taxKrw).toBe(48_000_000); // 8억 × 6%
  });
});

describe("estimateCapitalGainsTax — 엣지 케이스", () => {
  it("매도가 0 → 0", () => {
    const r = estimateCapitalGainsTax({
      expectedSalePriceKrw: 0,
      remainingLoanKrw: 0,
      qualifiesForTaxExemption: true,
    });
    expect(r.taxKrw).toBe(0);
  });

  it("취득가 ≥ 매도가(언더워터) → 양도차익 0, 세금 0", () => {
    const r = estimateCapitalGainsTax({
      expectedSalePriceKrw: 5 * 억,
      remainingLoanKrw: 0,
      qualifiesForTaxExemption: false,
      acquisitionPriceKrw: 6 * 억,
      holdingYears: 3,
    });
    expect(r.taxKrw).toBe(0);
  });

  it("보유 10년+ 1주택 우대 → 장특 80% 캡", () => {
    const r10 = estimateCapitalGainsTax({
      expectedSalePriceKrw: 20 * 억,
      remainingLoanKrw: 0,
      qualifiesForTaxExemption: true,
      acquisitionPriceKrw: 10 * 억,
      holdingYears: 10,
    });
    const r15 = estimateCapitalGainsTax({
      expectedSalePriceKrw: 20 * 억,
      remainingLoanKrw: 0,
      qualifiesForTaxExemption: true,
      acquisitionPriceKrw: 10 * 억,
      holdingYears: 15,
    });
    // 둘 다 80% 캡 → 같은 세액
    expect(r10.taxKrw).toBe(r15.taxKrw);
  });

  it("취득가 입력 시 세금이 미상 폴백보다 합리적으로 작거나 같다", () => {
    const known = estimateCapitalGainsTax({
      expectedSalePriceKrw: 8 * 억,
      remainingLoanKrw: 0,
      qualifiesForTaxExemption: false,
      acquisitionPriceKrw: 7 * 억, // 1억 차익만
      holdingYears: 10,
    });
    const unknown = estimateCapitalGainsTax({
      expectedSalePriceKrw: 8 * 억,
      remainingLoanKrw: 0,
      qualifiesForTaxExemption: false,
    });
    expect(known.taxKrw).toBeLessThan(unknown.taxKrw);
  });
});
