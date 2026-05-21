import { describe, it, expect } from "vitest";
import {
  tierOf,
  clampBridge,
  bridgeWithinSeries,
  type TrendSeries,
} from "@/lib/recommend/trendIndex";

describe("tierOf — 가격대 분류", () => {
  it("저가 <10억, 중가 10~30억, 초고가 ≥30억", () => {
    expect(tierOf(9_900_000_000 / 10)).toBe("low"); // 9.9억
    expect(tierOf(1_000_000_000)).toBe("mid"); // 10억 (경계 포함 mid)
    expect(tierOf(2_999_000_000)).toBe("mid"); // 29.99억
    expect(tierOf(3_000_000_000)).toBe("high"); // 30억 (경계 포함 high)
    expect(tierOf(5_000_000_000)).toBe("high");
  });
});

describe("clampBridge — 계수 클램프", () => {
  it("[0.8, 1.25] 범위로 자른다", () => {
    expect(clampBridge(1.0)).toBe(1.0);
    expect(clampBridge(1.5)).toBe(1.25);
    expect(clampBridge(0.5)).toBe(0.8);
  });
});

describe("bridgeWithinSeries — 시점 보정 계수", () => {
  const series: TrendSeries = {
    index: {
      "2025-12": 100,
      "2026-01": 104,
      "2026-02": 110, // 고점
      "2026-03": 108,
      "2026-04": 108,
    },
  };

  it("같은 달이면 1", () => {
    expect(bridgeWithinSeries(series, "2026-02", "2026-02")).toBe(1);
  });

  it("상승 구간은 >1 (12월→2월: 110/100)", () => {
    expect(bridgeWithinSeries(series, "2025-12", "2026-02")).toBeCloseTo(1.1, 5);
  });

  it("고점 후 하락 구간은 <1 (2월→4월: 108/110, 초고가 조정 케이스)", () => {
    expect(bridgeWithinSeries(series, "2026-02", "2026-04")).toBeCloseTo(
      108 / 110,
      5,
    );
  });

  it("범위 밖 month 는 양끝으로 클램프(결손 없는 시리즈 가정)", () => {
    // 2025-10 은 시리즈 이전 → 첫 값(100) 사용 → 100→108 = 1.08
    expect(bridgeWithinSeries(series, "2025-10", "2026-04")).toBeCloseTo(1.08, 5);
    // 2026-09 는 시리즈 이후 → 끝 값(108) 사용 → 100→108 = 1.08
    expect(bridgeWithinSeries(series, "2025-12", "2026-09")).toBeCloseTo(1.08, 5);
  });

  it("과도한 변동은 클램프된다", () => {
    const wild: TrendSeries = { index: { "2025-01": 100, "2026-01": 200 } };
    expect(bridgeWithinSeries(wild, "2025-01", "2026-01")).toBe(1.25);
  });
});
