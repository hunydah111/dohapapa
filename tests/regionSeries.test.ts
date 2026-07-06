// 동네면 시계열(regionSeries) 순수 집계 함수 테스트 — 크론과 페이지가 같은 함수를 쓴다.
import { describe, expect, it } from "vitest";
import {
  REGION_SERIES_MIN_DEALS,
  REGION_SERIES_MONTHS,
  bucketRegionSeries,
  lastMonths,
  median,
  medianLineSegments,
  priceAxis,
  regionSeriesSummary,
  roundManwon,
  ymOf,
  type RegionSeriesEntry,
  type RegionSeriesTx,
} from "@/lib/regionSeries";

describe("lastMonths", () => {
  it("당월 포함 최근 n개월을 YYYY-MM 오름차순으로 만든다", () => {
    expect(lastMonths(new Date(2026, 6, 6), 13)).toEqual([
      "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07",
    ]);
  });

  it("연 경계(1월)를 올바르게 넘는다", () => {
    expect(lastMonths(new Date(2026, 0, 15), 3)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });

  it("버킷 수 상수는 완료월 12 + 당월 1", () => {
    expect(REGION_SERIES_MONTHS).toBe(13);
  });
});

describe("ymOf / roundManwon / median", () => {
  it("ymOf 는 로컬 연-월을 zero-pad 한다", () => {
    expect(ymOf(new Date(2026, 2, 3))).toBe("2026-03");
    expect(ymOf(new Date(2025, 11, 31))).toBe("2025-12");
  });

  it("roundManwon 은 만원 단위 반올림", () => {
    expect(roundManwon(1_234_567_891)).toBe(1_234_570_000);
    expect(roundManwon(1_234_564_999)).toBe(1_234_560_000);
  });

  it("median — 홀수는 가운데, 짝수는 가운데 두 값 평균, 빈 배열은 null", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("bucketRegionSeries", () => {
  const months = ["2026-05", "2026-06", "2026-07"];
  const tx = (sigungu: string, ym: string, priceKrw: number): RegionSeriesTx => ({
    sigungu,
    ym,
    priceKrw,
  });

  it("시군구 × 월 버킷으로 counts·medianKrw(만원 반올림)를 채운다", () => {
    const rows = [
      tx("마포구", "2026-06", 1_000_000_000),
      tx("마포구", "2026-06", 1_200_000_000),
      tx("마포구", "2026-06", 1_400_004_999), // 중위 계산 후 만원 반올림 검증용
      tx("마포구", "2026-07", 900_000_000),
    ];
    const out = bucketRegionSeries(rows, months);
    expect(out["마포구"].counts).toEqual([0, 3, 1]);
    // 6월: 3건 → 중위 1_200_000_000. 7월: 1건(< MIN_DEALS) → null. 5월: 0건 → null.
    expect(out["마포구"].medianKrw).toEqual([null, 1_200_000_000, null]);
  });

  it(`거래 ${REGION_SERIES_MIN_DEALS}건 미만인 달은 medianKrw null(표본 부족) — 건수는 유지`, () => {
    const rows = [tx("과천시", "2026-05", 2_000_000_000), tx("과천시", "2026-05", 2_100_000_000)];
    const out = bucketRegionSeries(rows, months);
    expect(out["과천시"].counts).toEqual([2, 0, 0]);
    expect(out["과천시"].medianKrw).toEqual([null, null, null]);
  });

  it("짝수 표본 중위(두 값 평균)도 만원 단위로 반올림된다", () => {
    const rows = [
      tx("강남구", "2026-07", 1_000_000_000),
      tx("강남구", "2026-07", 1_100_000_000),
      tx("강남구", "2026-07", 1_200_000_000),
      tx("강남구", "2026-07", 1_300_015_000),
    ];
    const out = bucketRegionSeries(rows, months);
    // 중위 = (11억 + 12억)/2 = 11.5억 — 이미 만원 단위.
    expect(out["강남구"].medianKrw[2]).toBe(1_150_000_000);
  });

  it("months 밖 거래·비양수 가격은 무시, 거래 0건 시군구는 생략", () => {
    const rows = [
      tx("송파구", "2025-01", 1_000_000_000), // 창 밖
      tx("송파구", "2026-06", 0), // 비양수
    ];
    const out = bucketRegionSeries(rows, months);
    expect(out["송파구"]).toBeUndefined();
    expect(Object.keys(out)).toHaveLength(0);
  });

  it("공백 포함 시군구명('수원시 팔달구')도 키 그대로 유지", () => {
    const rows = [
      tx("수원시 팔달구", "2026-07", 500_000_000),
      tx("수원시 팔달구", "2026-07", 600_000_000),
      tx("수원시 팔달구", "2026-07", 700_000_000),
    ];
    const out = bucketRegionSeries(rows, months);
    expect(out["수원시 팔달구"].medianKrw[2]).toBe(600_000_000);
  });
});

describe("medianLineSegments — null(표본 부족) 달에서 라인이 끊긴다", () => {
  it("연속 구간을 나누고 고립 1점도 구간으로 남긴다", () => {
    const segs = medianLineSegments([100, 200, null, 300, null, null, 400, 500]);
    expect(segs).toEqual([
      [{ i: 0, v: 100 }, { i: 1, v: 200 }],
      [{ i: 3, v: 300 }],
      [{ i: 6, v: 400 }, { i: 7, v: 500 }],
    ]);
  });

  it("전부 null 이면 빈 배열", () => {
    expect(medianLineSegments([null, null])).toEqual([]);
  });
});

describe("priceAxis — y축 가격 눈금(동적 도메인·깔끔한 스냅)", () => {
  it("14억~16억 구간은 1억 스냅 눈금 2~3개(14/15/16억꼴)", () => {
    const axis = priceAxis(1_400_000_000, 1_600_000_000)!;
    expect(axis.ticks.length).toBeGreaterThanOrEqual(2);
    expect(axis.ticks.length).toBeLessThanOrEqual(3);
    // 전부 5천만의 배수("깔끔한" 눈금).
    for (const t of axis.ticks) expect(t % 50_000_000).toBe(0);
    // 도메인이 관측 범위를 여유 있게 감싼다.
    expect(axis.domainMin).toBeLessThan(1_400_000_000);
    expect(axis.domainMax).toBeGreaterThan(1_600_000_000);
    // 눈금은 도메인 안.
    expect(axis.ticks[0]).toBeGreaterThanOrEqual(axis.domainMin);
    expect(axis.ticks[axis.ticks.length - 1]).toBeLessThanOrEqual(axis.domainMax);
  });

  it("좁은 구간(5천만 폭)은 5천만 스냅으로 눈금이 잡힌다", () => {
    const axis = priceAxis(500_000_000, 550_000_000)!;
    expect(axis.ticks.length).toBeGreaterThanOrEqual(2);
    expect(axis.ticks.length).toBeLessThanOrEqual(3);
    for (const t of axis.ticks) expect(t % 50_000_000).toBe(0);
  });

  it("광폭 구간(강남 18.8억~28.5억)도 눈금 2~3개로 절제된다", () => {
    const axis = priceAxis(1_880_000_000, 2_850_000_000)!;
    expect(axis.ticks.length).toBeGreaterThanOrEqual(2);
    expect(axis.ticks.length).toBeLessThanOrEqual(3);
    for (const t of axis.ticks) expect(t % 50_000_000).toBe(0);
  });

  it("평평한 구간(min=max — 유효월 1개)도 도메인을 벌려 눈금 2개 이상 보장", () => {
    const axis = priceAxis(1_470_000_000, 1_470_000_000)!;
    expect(axis.ticks.length).toBeGreaterThanOrEqual(2);
    expect(axis.domainMin).toBeLessThan(1_470_000_000);
    expect(axis.domainMax).toBeGreaterThan(1_470_000_000);
  });

  it("비정상 입력(min>max·0 이하)은 null — 호출부가 축 없이 렌더", () => {
    expect(priceAxis(2_000_000_000, 1_000_000_000)).toBeNull();
    expect(priceAxis(0, 1_000_000_000)).toBeNull();
  });
});

describe("regionSeriesSummary — 12개월 요약 한 줄", () => {
  const months = ["2025-07", "2025-08", "2025-09", "2025-10"];

  it("첫·마지막 유효월과 등락률, 거래 최다 월을 요약한다", () => {
    const entry: RegionSeriesEntry = {
      counts: [5, 12, 8, 2],
      medianKrw: [1_000_000_000, 1_050_000_000, 1_098_000_000, null],
    };
    const s = regionSeriesSummary(months, entry)!;
    expect(s.firstYm).toBe("2025-07");
    expect(s.firstKrw).toBe(1_000_000_000);
    expect(s.lastYm).toBe("2025-09"); // 마지막 유효(non-null) 월
    expect(s.lastKrw).toBe(1_098_000_000);
    expect(s.pct).toBeCloseTo(0.098, 10);
    expect(s.busiestYm).toBe("2025-08");
    expect(s.busiestCount).toBe(12);
  });

  it("거래 최다 동률은 최신 월을 채택한다", () => {
    const entry: RegionSeriesEntry = {
      counts: [9, 3, 9, 1],
      medianKrw: [1_000_000_000, null, 900_000_000, null],
    };
    const s = regionSeriesSummary(months, entry)!;
    expect(s.busiestYm).toBe("2025-09");
    expect(s.pct).toBeCloseTo(-0.1, 10);
  });

  it("유효월 2개 미만이면 null — 요약 줄 생략", () => {
    const entry: RegionSeriesEntry = {
      counts: [1, 2, 1, 0],
      medianKrw: [null, 1_000_000_000, null, null],
    };
    expect(regionSeriesSummary(months, entry)).toBeNull();
  });
});
