// 동네별 온도 시계열 — 시군구 분할 버킷 테스트 (2026-07-13 사장 "시계열 확장").
import { describe, expect, it } from "vitest";
import {
  bucketRegionTempSeries,
  regionSeriesFor,
  type RegionTempSeriesFile,
  type RegionTempSeriesTx,
} from "@/lib/regionTempSeries";
import { bucketTempSeries } from "@/lib/tempSeries";

const months = ["2026-05", "2026-06"];

function tx(
  sigungu: string,
  groupKey: string,
  id: string,
  dealDateISO: string,
  priceKrw: number,
): RegionTempSeriesTx {
  return { sigungu, groupKey, id, dealDateISO, priceKrw };
}

describe("bucketRegionTempSeries", () => {
  const txs: RegionTempSeriesTx[] = [
    // 강남 c1|p32_35: 5/10 10억(직전 없음) → 6/10 11억(+10% above)
    tx("강남구", "c1|p32_35", "a1", "2026-05-10", 1_000_000_000),
    tx("강남구", "c1|p32_35", "a2", "2026-06-10", 1_100_000_000),
    // 노원 c2|p19_25: 5/10 5억 → 6/10 4.5억(−10% below)
    tx("노원구", "c2|p19_25", "b1", "2026-05-10", 500_000_000),
    tx("노원구", "c2|p19_25", "b2", "2026-06-10", 450_000_000),
    // 창 밖 계약(직전 후보로만) — 4월 거래
    tx("강남구", "c1|p32_35", "a0", "2026-04-01", 900_000_000),
  ];

  it("시군구별 분할이 전역 규칙과 동일하고, 구별 결과 = 그 구만 넣은 전역 버킷과 일치", () => {
    const regions = bucketRegionTempSeries(txs, months);
    expect(Object.keys(regions)).toEqual(["강남구", "노원구"]); // 가나다순
    expect(regions["강남구"].above).toEqual([1, 1]); // 5월: 4/1 9억 대비 +11% above
    expect(regions["노원구"].below).toEqual([0, 1]);
    // 구별 결과 = 그 구 거래만 전역 버킷에 넣은 것과 동일(경계 왜곡 없음 검증).
    const solo = bucketTempSeries(txs.filter((t) => t.sigungu === "노원구"), months);
    expect(regions["노원구"]).toEqual(solo);
  });

  it("관측(matched) 전무 구는 생략", () => {
    const regions = bucketRegionTempSeries(
      [tx("과천시", "c9|p32_35", "z1", "2026-06-10", 1_000_000_000)], // 직전 없음 — 매칭 0
      months,
    );
    expect(regions["과천시"]).toBeUndefined();
  });
});

describe("regionSeriesFor", () => {
  const file: RegionTempSeriesFile = {
    generatedAt: "2026-07-13",
    months,
    regions: { 강남구: { above: [1, 1], below: [0, 0], matched: [1, 1] } },
  };

  it("TempSeriesFile 모양으로 — 차트·tempStory 재사용 가능", () => {
    const s = regionSeriesFor(file, "강남구")!;
    expect(s.months).toEqual(months);
    expect(s.above).toEqual([1, 1]);
    expect(s.generatedAt).toBe("2026-07-13");
  });

  it("placeholder·미수록이면 null(코너 생략)", () => {
    expect(regionSeriesFor({ generatedAt: null, months: [], regions: {} }, "강남구")).toBeNull();
    expect(regionSeriesFor(file, "노원구")).toBeNull();
  });
});
