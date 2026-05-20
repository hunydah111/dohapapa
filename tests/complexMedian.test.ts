import { describe, it, expect } from "vitest";
import { flagLowConfidence, pickRepresentative } from "@/lib/recommend/complexMedian";
import type { AreaMedian } from "@/lib/recommend/complexMedian";

const med = (
  area: number,
  medianKrw: number,
  count: number,
  lowConfidence = false,
): AreaMedian => ({
  area,
  medianKrw,
  count,
  volatility: 0,
  sparse: false,
  lowConfidence,
});

describe("flagLowConfidence — 평형 간 ㎡당 단가 교차검증", () => {
  it("신뢰표본 대비 극단적으로 싼 빈약표본 평형을 표시한다", () => {
    const medians = [
      med(60, 2_900_000_000, 11), // ref ~4.83e7/㎡ (신뢰)
      med(85, 3_710_000_000, 15), // ref ~4.36e7/㎡ (신뢰)
      med(50, 1_500_000_000, 2), // 3.0e7/㎡, ratio ~0.69 → 비정상
      med(110, 4_130_000_000, 1), // 3.75e7/㎡, ratio ~0.86 → 정상(대형 할인)
    ];
    flagLowConfidence(medians);

    expect(medians.find((m) => m.area === 50)!.lowConfidence).toBe(true);
    expect(medians.find((m) => m.area === 110)!.lowConfidence).toBe(false);
    // 신뢰표본은 절대 플래그하지 않는다
    expect(medians.find((m) => m.area === 60)!.lowConfidence).toBe(false);
    expect(medians.find((m) => m.area === 85)!.lowConfidence).toBe(false);
  });

  it("신뢰표본이 2개 미만이면 아무것도 표시하지 않는다", () => {
    const medians = [
      med(60, 2_900_000_000, 11),
      med(50, 100_000_000, 2), // 말도 안 되게 싸지만 기준 표본 부족
    ];
    flagLowConfidence(medians);
    expect(medians.every((m) => m.lowConfidence === false)).toBe(true);
  });
});

describe("pickRepresentative — lowConfidence 평형 제외", () => {
  it("거래가 더 많아도 lowConfidence 평형은 대표로 뽑지 않는다", () => {
    const medians = [
      med(84, 3_700_000_000, 10, true), // 최다 거래지만 신뢰도 낮음
      med(85, 3_700_000_000, 5, false),
    ];
    const rep = pickRepresentative(medians, 80, 100);
    expect(rep?.area).toBe(85);
  });

  it("구간 내 평형이 모두 lowConfidence 면 null", () => {
    const medians = [med(84, 3_700_000_000, 10, true)];
    expect(pickRepresentative(medians, 80, 100)).toBeNull();
  });
});
