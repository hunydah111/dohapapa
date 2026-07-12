// 주요 거래 분석(majorAnalysis) — 구별 "최고 상승" + 이상치 컷 테스트.
// 2026-07-12 사장 "+89%가 말이 될까": 순수 정렬(7/11)이 직전 이상 저가 대비 뻥튀기를
// 그날의 상승처럼 인쇄(수지구 +89% — 직전 8.2억 증여성, 시세 15억대) → 상한 +30% +
// 자기 중위가 방향 합의(pct>0) 복원. "최고 상승" 정렬 자체는 유지(평균 회귀 아님).
import { describe, expect, it } from "vitest";
import { majorAnalysis, type MajorAnalysisInput } from "@/lib/majorAnalysis";

const rows: MajorAnalysisInput[] = [
  // 강남: 최고 = +14.1%(개포A).
  { sigungu: "강남구", apt: "개포A", pctVsPrev: 0.141, pct: 0.1 },
  { sigungu: "강남구", apt: "개포B", pctVsPrev: 0.08, pct: 0.05 },
  // 광진: +9%.
  { sigungu: "광진구", apt: "광진A", pctVsPrev: 0.09, pct: 0.02 },
  // 송파: +5% — 포함(상승이면 OK, 7% 하한 없음).
  { sigungu: "송파구", apt: "송파A", pctVsPrev: 0.05, pct: 0.01 },
  // 마포: +12%지만 자기 중위가 대비 하락(직전이 이상 저가 의심) → 방향 합의 실패, 제외.
  { sigungu: "마포구", apt: "마포A", pctVsPrev: 0.12, pct: -0.02 },
  // 서초: +40% — 상한 컷(+30%) 초과 → 제외 (수지구 +89% 사태 재발 방지).
  { sigungu: "서초구", apt: "서초A", pctVsPrev: 0.4, pct: 0.15 },
  // 동작: 중위가 없음(pct null) — 합의 불가 → 제외(보수).
  { sigungu: "동작구", apt: "동작A", pctVsPrev: 0.1, pct: null },
  // 용산: 직전 없음(null) → 제외.
  { sigungu: "용산구", apt: "용산A", pctVsPrev: null, pct: 0.1 },
  // 강동: 하락(−3%) → 제외(상승만).
  { sigungu: "강동구", apt: "강동A", pctVsPrev: -0.03, pct: 0.02 },
];

describe("majorAnalysis — 구별 최고 상승 (이상치 컷)", () => {
  it("각 구 최고 상승률, 상승 큰 순 — 컷 통과분만", () => {
    const out = majorAnalysis(rows);
    expect(out.map((r) => r.sigungu)).toEqual([
      "강남구", // 0.141
      "광진구", // 0.09
      "송파구", // 0.05
    ]);
    expect(out[0]).toEqual({ sigungu: "강남구", topPct: 0.141, apt: "개포A" }); // 평균 아님, 최고
  });

  it("이상치 컷 — 상한 +30% 초과·중위가 방향 불합치·중위가 없음은 제외", () => {
    const names = majorAnalysis(rows).map((r) => r.sigungu);
    expect(names).not.toContain("서초구"); // +40% 상한 컷
    expect(names).not.toContain("마포구"); // 중위가 대비 하락 — 직전 이상 저가 의심
    expect(names).not.toContain("동작구"); // 중위가 없음 — 합의 불가
  });

  it("수지구 +89% 사태 재현 — 직전 이상 저가 대비 뻥튀기는 인쇄 금지", () => {
    const out = majorAnalysis([
      { sigungu: "용인시 수지구", apt: "성동마을엘지빌리지2차", pctVsPrev: 0.89, pct: 0.03 },
    ]);
    expect(out).toEqual([]);
  });

  it("직전 없음(null)·하락은 제외", () => {
    const names = majorAnalysis(rows).map((r) => r.sigungu);
    expect(names).not.toContain("용산구"); // 직전 없음
    expect(names).not.toContain("강동구"); // 하락
  });

  it("limit 상한", () => {
    expect(majorAnalysis(rows, 1)).toHaveLength(1);
    expect(majorAnalysis(rows, 1)[0].sigungu).toBe("강남구");
  });

  it("상승 0건이면 빈 배열", () => {
    expect(majorAnalysis([])).toEqual([]);
    expect(majorAnalysis([{ sigungu: "강남구", apt: "x", pctVsPrev: -0.01, pct: 0.01 }])).toEqual([]);
    expect(majorAnalysis([{ sigungu: "강남구", apt: "x", pctVsPrev: null, pct: null }])).toEqual([]);
  });
});
