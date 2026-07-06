// 온도 시계열(최대 5년) — 월별(계약월) above/below/matched 버킷 검증.
// 규칙은 오늘의 온도(patchNote)와 동일: 직전 거래 = 같은 단지×밴드 그룹의 계약일이
// 같거나 이른 것 중 최신(자기 제외, 60일 내), ±1% 중립 밴드.
import { describe, it, expect } from "vitest";
import {
  PHASE_MIN_MONTHS,
  REFERENCE_PHASES,
  bucketTempSeries,
  phaseAvg,
  trimLeadingEmptyMonths,
  TEMP_SERIES_DEFAULT_MONTHS,
  type TempSeriesTx,
} from "@/lib/tempSeries";

const MONTHS = ["2026-05", "2026-06", "2026-07"] as const;

let seq = 0;
function tx(overrides: Partial<TempSeriesTx> = {}): TempSeriesTx {
  seq += 1;
  return {
    groupKey: "cx1|p32_35",
    id: `t${seq}`,
    dealDateISO: "2026-07-01",
    priceKrw: 1_000_000_000,
    ...overrides,
  };
}

describe("tempSeries.bucketTempSeries", () => {
  it("직전 거래 대비 above/below/matched를 계약월 버킷에 센다 — ±1%는 중립", () => {
    const r = bucketTempSeries(
      [
        tx({ dealDateISO: "2026-06-10", priceKrw: 1_000_000_000 }), // 기준(6월엔 직전 없음)
        tx({ dealDateISO: "2026-07-01", priceKrw: 1_050_000_000 }), // +5% → 7월 above
        tx({ dealDateISO: "2026-07-02", priceKrw: 1_055_000_000 }), // 직전(7/1 1.05) 대비 +0.5% → 중립
        tx({ dealDateISO: "2026-07-03", priceKrw: 900_000_000 }), // 직전(7/2) 대비 −14.7% → below
      ],
      MONTHS,
    );
    expect(r.matched).toEqual([0, 0, 3]);
    expect(r.above).toEqual([0, 0, 1]);
    expect(r.below).toEqual([0, 0, 1]); // 중립 1건은 matched에만
  });

  it("months 밖(이전 2개월) 거래는 버킷엔 없지만 직전 거래 후보로 쓰인다", () => {
    const r = bucketTempSeries(
      [
        tx({ dealDateISO: "2026-04-20", priceKrw: 1_000_000_000 }), // months 밖 — 후보 전용
        tx({ dealDateISO: "2026-05-05", priceKrw: 1_100_000_000 }), // 4/20 대비 +10% → 5월 above
      ],
      MONTHS,
    );
    expect(r.matched).toEqual([1, 0, 0]);
    expect(r.above).toEqual([1, 0, 0]);
  });

  it("직전 거래가 60일보다 묵으면 비교 무효 — 미집계", () => {
    const r = bucketTempSeries(
      [
        tx({ dealDateISO: "2026-04-30", priceKrw: 1_000_000_000 }), // 7/1까지 62일
        tx({ dealDateISO: "2026-07-01", priceKrw: 1_100_000_000 }),
      ],
      MONTHS,
    );
    expect(r.matched).toEqual([0, 0, 0]);
  });

  it("다른 그룹(단지×밴드)의 거래는 직전 거래가 아니다", () => {
    const r = bucketTempSeries(
      [
        tx({ groupKey: "cx1|p32_35", dealDateISO: "2026-06-10", priceKrw: 1_000_000_000 }),
        tx({ groupKey: "cx2|p32_35", dealDateISO: "2026-07-01", priceKrw: 1_100_000_000 }),
      ],
      MONTHS,
    );
    expect(r.matched).toEqual([0, 0, 0]);
  });

  it("같은 날짜 타거래도 직전으로 허용(자기 제외) — 여럿이면 가격 최고 채택(보수적)", () => {
    const r = bucketTempSeries(
      [
        tx({ dealDateISO: "2026-07-01", priceKrw: 1_000_000_000 }),
        tx({ dealDateISO: "2026-07-01", priceKrw: 1_040_000_000 }),
      ],
      MONTHS,
    );
    // 1.0억 → 직전 1.04(같은 날 최고) 대비 −3.8% below / 1.04 → 직전 1.0 대비 +4% above
    expect(r.matched).toEqual([0, 0, 2]);
    expect(r.above).toEqual([0, 0, 1]);
    expect(r.below).toEqual([0, 0, 1]);
  });

  it("가격 0 이하 레코드는 무시한다(방어)", () => {
    const r = bucketTempSeries(
      [
        tx({ dealDateISO: "2026-06-10", priceKrw: 0 }),
        tx({ dealDateISO: "2026-07-01", priceKrw: 1_000_000_000 }),
      ],
      MONTHS,
    );
    expect(r.matched).toEqual([0, 0, 0]);
  });
});

describe("tempSeries.trimLeadingEmptyMonths — 앞쪽 빈 달 잘라내기", () => {
  it("첫 데이터 달의 인덱스를 돌려준다 — 중간 빈 달은 안 자른다", () => {
    expect(trimLeadingEmptyMonths([0, 0, 5, 0, 3])).toBe(2);
    expect(trimLeadingEmptyMonths([1, 0, 0])).toBe(0);
  });

  it("전부 비면 length — 호출부가 빈 파일 처리", () => {
    expect(trimLeadingEmptyMonths([0, 0, 0])).toBe(3);
    expect(trimLeadingEmptyMonths([])).toBe(0);
  });

  it("기본 버킷 수 = 5년 + 당월", () => {
    expect(TEMP_SERIES_DEFAULT_MONTHS).toBe(61);
  });
});

describe("tempSeries.phaseAvg — 국면 참조 척도(역사적 관측 평균만, 임의 임계 금지)", () => {
  /** months 구간을 만들어 above/matched를 채우는 헬퍼. */
  function mk(months: string[], above: number[], matched: number[]) {
    return { months, above, matched };
  }
  const boom = { from: "2020-11", to: "2021-10" };

  it("구간 월들의 matched 가중 평균 above%를 돌려준다", () => {
    // 6개월 관측: matched가 큰 달이 평균을 지배해야 한다(단순 평균 아님).
    const months = ["2020-11", "2020-12", "2021-01", "2021-02", "2021-03", "2021-04"];
    const above = [90, 10, 10, 10, 10, 10]; // 첫 달만 90/100, 나머지 10/20
    const matched = [100, 20, 20, 20, 20, 20];
    // 가중 평균 = (90+50) / (100+100) = 140/200 = 70%
    expect(phaseAvg(mk(months, above, matched), boom)).toBeCloseTo(70, 10);
  });

  it("구간이 부분만 있어도(전부 아님) 6개월 이상이면 값을 준다", () => {
    // 폭등기 12개월 중 7개월만 시리즈에 존재.
    const months = ["2021-04", "2021-05", "2021-06", "2021-07", "2021-08", "2021-09", "2021-10"];
    const above = months.map(() => 6);
    const matched = months.map(() => 10);
    expect(phaseAvg(mk(months, above, matched), boom)).toBeCloseTo(60, 10);
  });

  it("구간 관측월이 6개월 미만이면 null — 백필 전엔 참조선이 안 뜬다", () => {
    const months = ["2021-06", "2021-07", "2021-08", "2021-09", "2021-10"]; // 5개월
    const above = months.map(() => 6);
    const matched = months.map(() => 10);
    expect(phaseAvg(mk(months, above, matched), boom)).toBeNull();
  });

  it("구간 안이라도 matched=0 달은 관측월로 안 센다", () => {
    const months = ["2020-11", "2020-12", "2021-01", "2021-02", "2021-03", "2021-04"];
    const above = [5, 5, 5, 5, 5, 0];
    const matched = [10, 10, 10, 10, 10, 0]; // 관측 5개월뿐
    expect(phaseAvg(mk(months, above, matched), boom)).toBeNull();
  });

  it("구간 밖 달은 집계에 안 들어간다", () => {
    const months = [
      "2020-10", // 구간 앞 — 제외
      "2020-11", "2020-12", "2021-01", "2021-02", "2021-03", "2021-04",
      "2021-11", // 구간 뒤 — 제외
    ];
    const above = [1000, 5, 5, 5, 5, 5, 5, 1000];
    const matched = [1000, 10, 10, 10, 10, 10, 10, 1000];
    expect(phaseAvg(mk(months, above, matched), boom)).toBeCloseTo(50, 10);
  });

  it("참조 국면 상수 — 폭등기/급락기 두 국면, 최소 관측 6개월", () => {
    expect(REFERENCE_PHASES.map((p) => p.key)).toEqual(["boom", "slump"]);
    expect(REFERENCE_PHASES[0].tone).toBe("up");
    expect(REFERENCE_PHASES[1].tone).toBe("down");
    expect(PHASE_MIN_MONTHS).toBe(6);
  });
});
