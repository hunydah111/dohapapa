import { describe, it, expect } from "vitest";
import {
  estimateCurrentPrice,
  flagLowConfidence,
  pickRepresentative,
} from "@/lib/recommend/complexMedian";
import type { AreaMedian, Tx } from "@/lib/recommend/complexMedian";

const med = (
  area: number,
  medianKrw: number,
  count: number,
  lowConfidence = false,
): AreaMedian => ({
  area,
  medianKrw,
  rawMedianKrw: medianKrw,
  priceLow: medianKrw,
  priceHigh: medianKrw,
  midpointMonth: "2026-05",
  count,
  volatility: 0,
  sparse: false,
  lowConfidence,
});

const tx = (eok: number, daysAgo: number): Tx => ({
  price: eok * 100_000_000,
  daysAgo,
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

describe("estimateCurrentPrice — 얇은표본 보정 + 범위", () => {
  it("신축 입주장(3건·같은 주, 층따라 30.5~35.6억)에서 중위값이 최근 고가를 묻지 않게 위로 보정한다", () => {
    // 잠실르엘 59㎡ 실제 케이스: 중위값=31.66억(가운데 한 건)으로 35.63억을 버림.
    const txs = [tx(35.63, 84), tx(31.66, 87), tx(30.52, 87)];
    const est = estimateCurrentPrice(txs);
    // 중위값(31.66)보다 위로, 단 최근 최고가(35.63) 아래로.
    expect(est.price / 1e8).toBeGreaterThan(32.5);
    expect(est.price / 1e8).toBeLessThan(35.63);
    // 범위는 실거래 최저~최고 그대로(정직 표시).
    expect(est.low / 1e8).toBeCloseTo(30.52, 1);
    expect(est.high / 1e8).toBeCloseTo(35.63, 1);
  });

  it("하락 단지(옛 고가·최근 저가)는 보정하지 않는다 — 과대평가 방지", () => {
    const txs = [tx(31, 30), tx(40, 200)];
    const est = estimateCurrentPrice(txs);
    // 최근가(31)가 추정가보다 높지 않으므로 끌어올리지 않음.
    expect(est.price / 1e8).toBeLessThan(33);
  });

  it("표본이 충분(8건↑)하면 단일 고가 이상치에 끌려가지 않는다", () => {
    const txs = [
      tx(30, 30), tx(30, 35), tx(30, 40), tx(30, 45),
      tx(30, 50), tx(30, 55), tx(30, 60), tx(36, 32),
    ];
    const est = estimateCurrentPrice(txs);
    expect(est.price / 1e8).toBeLessThan(31);
    // 범위 상단은 분위로 트림되어 단일 36억에 끌려가지 않음.
    expect(est.high / 1e8).toBeLessThan(35);
  });
});
