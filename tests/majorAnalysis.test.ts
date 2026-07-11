// 주요 거래 분석(majorAnalysis) 순수 함수 테스트 — 코너·공유 카드가 같은 함수를 쓴다.
import { describe, expect, it } from "vitest";
import { majorAnalysis } from "@/lib/majorAnalysis";

describe("majorAnalysis — 시군구별 직전 대비 평균(주요 거래분)", () => {
  it("구별로 pctVsPrev 평균 + 건수, 상승 큰 순 정렬", () => {
    const rows = [
      { sigungu: "강남구", pctVsPrev: 0.141 },
      { sigungu: "강남구", pctVsPrev: 0.059 }, // 강남 평균 (0.141+0.059)/2 = 0.10
      { sigungu: "송파구", pctVsPrev: -0.014 },
      { sigungu: "마포구", pctVsPrev: 0.023 },
    ];
    const out = majorAnalysis(rows);
    expect(out.map((r) => r.sigungu)).toEqual(["강남구", "마포구", "송파구"]); // 상승 desc
    expect(out[0].sigungu).toBe("강남구");
    expect(out[0].count).toBe(2);
    expect(out[0].avgPct).toBeCloseTo(0.1, 10); // (0.141+0.059)/2
    expect(out[2].avgPct).toBeCloseTo(-0.014, 10); // 하락 구도 그대로(그날 데이터대로)
  });

  it("pctVsPrev 없는 거래는 집계에서 제외", () => {
    const rows = [
      { sigungu: "강남구", pctVsPrev: 0.1 },
      { sigungu: "강남구", pctVsPrev: null }, // 제외
      { sigungu: "서초구" }, // pctVsPrev undefined — 제외 → 서초 자체가 안 뜸
    ];
    const out = majorAnalysis(rows);
    expect(out).toEqual([{ sigungu: "강남구", avgPct: 0.1, count: 1 }]);
  });

  it("집계 가능한 거래가 없으면 빈 배열", () => {
    expect(majorAnalysis([])).toEqual([]);
    expect(majorAnalysis([{ sigungu: "강남구", pctVsPrev: null }])).toEqual([]);
  });

  it("동률은 시군구 가나다순, limit 개까지", () => {
    const rows = [
      { sigungu: "송파구", pctVsPrev: 0.05 },
      { sigungu: "성동구", pctVsPrev: 0.05 }, // 동률 → 가나다(성동 < 송파)
      { sigungu: "강남구", pctVsPrev: 0.09 },
    ];
    expect(majorAnalysis(rows, 2).map((r) => r.sigungu)).toEqual(["강남구", "성동구"]);
  });
});
