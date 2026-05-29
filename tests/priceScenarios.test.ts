import { describe, it, expect, vi } from "vitest";

// rebIndex 부분 모킹 — 강남구만 R-ONE 값(0.08) 주입. 나머지는 KB 권역 폴백 검증.
vi.mock("@/data/rebIndex.json", () => ({
  default: {
    generatedAt: "2026-05-29",
    source: "R-ONE test",
    regions: { 강남구: { rateAnnual: 0.08, asOf: "2026Q1" } },
  },
}));

import { upRateFor, regionScenarios, defaultUpPct } from "@/lib/plan/priceScenarios";

describe("priceScenarios A5 (R-ONE 우선 + KB 폴백)", () => {
  it("R-ONE 구워진 시군구는 그 실측 상승률 사용", () => {
    const r = upRateFor("강남구");
    expect(r.fromReb).toBe(true);
    expect(r.rateAnnual).toBe(0.08);
    expect(r.asOf).toBe("2026Q1");
    expect(defaultUpPct("강남구")).toBeCloseTo(8);
    const sc = regionScenarios("강남구");
    expect(sc.up.rateAnnual).toBe(0.08);
    expect(sc.up.source).toContain("R-ONE");
  });

  it("R-ONE 없는 서울 시군구는 KB 서울 폴백(5%)", () => {
    const r = upRateFor("서초구");
    expect(r.fromReb).toBe(false);
    expect(r.rateAnnual).toBe(0.05);
    expect(regionScenarios("서초구").up.source).toContain("KB");
  });

  it("R-ONE 없는 경기 시군구는 KB 경기 폴백(3%)", () => {
    const r = upRateFor("화성시 동탄구");
    expect(r.fromReb).toBe(false);
    expect(r.rateAnnual).toBe(0.03);
  });

  it("down/flat 시나리오는 R-ONE 무관하게 고정", () => {
    const sc = regionScenarios("강남구");
    expect(sc.flat.rateAnnual).toBe(0);
    expect(sc.down.rateAnnual).toBeLessThan(0);
  });
});
