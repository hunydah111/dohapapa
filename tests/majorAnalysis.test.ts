// 주요 거래 분석(majorAnalysis) — 구별 "최고 상승" 순수 줄세우기 테스트.
// 2026-07-11 사장 재지시: 게이트 상한컷·이중합의 제거. 조건은 딱 둘 — 직전 존재(+최근 60일) · 상승(+).
import { describe, expect, it } from "vitest";
import { majorAnalysis, type MajorAnalysisInput } from "@/lib/majorAnalysis";

const rows: MajorAnalysisInput[] = [
  // 강남: 최고 = +14.1%(개포A).
  { sigungu: "강남구", apt: "개포A", pctVsPrev: 0.141 },
  { sigungu: "강남구", apt: "개포B", pctVsPrev: 0.08 },
  // 광진: +9%.
  { sigungu: "광진구", apt: "광진A", pctVsPrev: 0.09 },
  // 송파: +5% — 이제 포함(상승이면 OK, 7% 하한 없음).
  { sigungu: "송파구", apt: "송파A", pctVsPrev: 0.05 },
  // 마포: +12% — 이제 포함(자기중위 이중합의 제거).
  { sigungu: "마포구", apt: "마포A", pctVsPrev: 0.12 },
  // 서초: +40% — 이제 포함(상한 컷 제거) → 최고, 1위.
  { sigungu: "서초구", apt: "서초A", pctVsPrev: 0.4 },
  // 용산: 직전 없음(null) → 제외.
  { sigungu: "용산구", apt: "용산A", pctVsPrev: null },
  // 강동: 하락(−3%) → 제외(상승만).
  { sigungu: "강동구", apt: "강동A", pctVsPrev: -0.03 },
];

describe("majorAnalysis — 구별 최고 상승 순수 줄세우기", () => {
  it("각 구 최고 상승률, 상승 큰 순 — 상한 컷 없이 +40%가 1위", () => {
    const out = majorAnalysis(rows);
    expect(out.map((r) => r.sigungu)).toEqual([
      "서초구", // 0.40
      "강남구", // 0.141
      "마포구", // 0.12
      "광진구", // 0.09
      "송파구", // 0.05
    ]);
    expect(out[0]).toEqual({ sigungu: "서초구", topPct: 0.4, apt: "서초A" });
    expect(out[1]).toEqual({ sigungu: "강남구", topPct: 0.141, apt: "개포A" }); // 평균 아님, 최고
  });

  it("직전 없음(null)·하락은 제외", () => {
    const names = majorAnalysis(rows).map((r) => r.sigungu);
    expect(names).not.toContain("용산구"); // 직전 없음
    expect(names).not.toContain("강동구"); // 하락
  });

  it("limit 상한", () => {
    expect(majorAnalysis(rows, 1)).toHaveLength(1);
    expect(majorAnalysis(rows, 1)[0].sigungu).toBe("서초구");
  });

  it("상승 0건이면 빈 배열", () => {
    expect(majorAnalysis([])).toEqual([]);
    expect(majorAnalysis([{ sigungu: "강남구", apt: "x", pctVsPrev: -0.01 }])).toEqual([]);
    expect(majorAnalysis([{ sigungu: "강남구", apt: "x", pctVsPrev: null }])).toEqual([]);
  });
});
