// 주요 거래 분석(majorAnalysis) — 구별 "최고 상승"(오보 게이트 통과분) 테스트.
import { describe, expect, it } from "vitest";
import { majorAnalysis, type MajorAnalysisInput } from "@/lib/majorAnalysis";

// 게이트 통과 조건: prevKrw 존재 · pctVsPrev +7%~+30% · pct(자기중위 대비) +7%↑.
const rows: MajorAnalysisInput[] = [
  // 강남: 둘 다 통과 — 최고 = +14.1%(개포A).
  { sigungu: "강남구", apt: "개포A", pct: 0.1, prevKrw: 2_500_000_000, pctVsPrev: 0.141 },
  { sigungu: "강남구", apt: "개포B", pct: 0.08, prevKrw: 2_000_000_000, pctVsPrev: 0.08 },
  // 광진: 통과(+9%).
  { sigungu: "광진구", apt: "광진A", pct: 0.09, prevKrw: 1_800_000_000, pctVsPrev: 0.09 },
  // 송파: pctVsPrev 5% < 7% → 게이트 탈락(제외).
  { sigungu: "송파구", apt: "송파A", pct: 0.1, prevKrw: 2_000_000_000, pctVsPrev: 0.05 },
  // 마포: 자기중위 대비 pct 3% < 7% → 이중합의 실패(직전이 이상치 의심) → 제외.
  { sigungu: "마포구", apt: "마포A", pct: 0.03, prevKrw: 1_500_000_000, pctVsPrev: 0.12 },
  // 서초: pctVsPrev 40% > 30% 상한 → 제외.
  { sigungu: "서초구", apt: "서초A", pct: 0.2, prevKrw: 2_000_000_000, pctVsPrev: 0.4 },
  // 용산: 직전 없음(pctVsPrev null) → 제외.
  { sigungu: "용산구", apt: "용산A", pct: 0.1, prevKrw: null, pctVsPrev: null },
];

describe("majorAnalysis — 구별 최고 상승(게이트 통과)", () => {
  it("게이트 통과분 중 구별 '최고' 상승률, 상승 큰 순", () => {
    const out = majorAnalysis(rows);
    expect(out.map((r) => r.sigungu)).toEqual(["강남구", "광진구"]); // 나머지 게이트 탈락
    expect(out[0]).toEqual({ sigungu: "강남구", topPct: 0.141, apt: "개포A" }); // 평균(0.11) 아님, 최고
    expect(out[1].topPct).toBeCloseTo(0.09, 10);
  });

  it("게이트 탈락 구(송파 5%·마포 이중합의·서초 상한·용산 무직전)는 제외", () => {
    const out = majorAnalysis(rows);
    const names = out.map((r) => r.sigungu);
    expect(names).not.toContain("송파구");
    expect(names).not.toContain("마포구");
    expect(names).not.toContain("서초구");
    expect(names).not.toContain("용산구");
  });

  it("limit 상한", () => {
    expect(majorAnalysis(rows, 1)).toHaveLength(1);
    expect(majorAnalysis(rows, 1)[0].sigungu).toBe("강남구");
  });

  it("게이트 통과 0건이면 빈 배열", () => {
    expect(majorAnalysis([])).toEqual([]);
    expect(
      majorAnalysis([{ sigungu: "강남구", apt: "x", pct: 0.02, prevKrw: 1e9, pctVsPrev: 0.03 }]),
    ).toEqual([]);
  });
});
