import { describe, it, expect } from "vitest";
import {
  CHASE_MIN_DEALS,
  bucketRegionChase,
  buildChaseBoard,
  chaseIndex,
  findOvertakes,
  lastQuarters,
  topCut,
  yqOf,
  type RegionChaseFile,
  type RegionChaseTx,
} from "@/lib/regionChase";

describe("regionChase — 분기·백분위 유틸", () => {
  it("yqOf/lastQuarters — 분기 경계·연도 넘김", () => {
    expect(yqOf(new Date(2026, 0, 15))).toBe("2026-Q1");
    expect(yqOf(new Date(2026, 11, 31))).toBe("2026-Q4");
    expect(lastQuarters(new Date(2026, 0, 15), 3)).toEqual([
      "2025-Q3",
      "2025-Q4",
      "2026-Q1",
    ]);
  });

  it("topCut — nearest-rank 상위 컷 (P95/P90)", () => {
    const v = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    expect(topCut(v, 0.05)).toBe(96); // 상위 5% 진입값 = 내림차순 5번째
    expect(topCut(v, 0.1)).toBe(91);
    expect(topCut([7], 0.05)).toBe(7); // 최소 rank 1
    expect(topCut([], 0.05)).toBeNull();
  });
});

function tx(sigungu: string, yq: string, pricePerM2: number): RegionChaseTx {
  return { sigungu, yq, pricePerM2 };
}

/** 한 분기에 표본 CHASE_MIN_DEALS개(값 base..base+N-1×만원)를 깐다. */
function fill(sigungu: string, yq: string, base: number): RegionChaseTx[] {
  return Array.from({ length: CHASE_MIN_DEALS }, (_, i) =>
    tx(sigungu, yq, base + i * 10_000),
  );
}

describe("bucketRegionChase", () => {
  const quarters = ["2025-Q4", "2026-Q1", "2026-Q2"];

  it("표본 미달 분기는 null, 유효 분기 2개 미만 구는 통째 생략", () => {
    const regions = bucketRegionChase(
      [
        ...fill("강남구", "2025-Q4", 20_000_000),
        ...fill("강남구", "2026-Q1", 22_000_000),
        tx("강남구", "2026-Q2", 25_000_000), // 1건 — 미달
        ...fill("노원구", "2026-Q1", 8_000_000), // 유효 1분기뿐 — 생략
        tx("유령구", "2020-Q1", 1), // 창 밖 — 무시
      ],
      quarters,
    );
    expect(regions["강남구"].p95[2]).toBeNull();
    expect(regions["강남구"].p95[0]).not.toBeNull();
    expect(regions["강남구"].deals).toEqual([CHASE_MIN_DEALS, CHASE_MIN_DEALS, 1]);
    expect(regions["노원구"]).toBeUndefined();
    expect(regions["유령구"]).toBeUndefined();
  });

  it("p95 ≥ p90 (상위 5% 진입가가 10% 진입가보다 높다)", () => {
    const regions = bucketRegionChase(
      [...fill("강남구", "2025-Q4", 20_000_000), ...fill("강남구", "2026-Q1", 21_000_000)],
      quarters,
    );
    const e = regions["강남구"];
    expect(e.p95[0]!).toBeGreaterThanOrEqual(e.p90[0]!);
  });
});

describe("chaseIndex · findOvertakes", () => {
  const file: RegionChaseFile = {
    generatedAt: "2026-07-08",
    quarters: ["2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2"],
    regions: {
      강남구: { p95: [20_000_000, 20_000_000, null, 20_000_000], p90: [1, 1, 1, 1].map(() => null) as (number | null)[], deals: [30, 30, 0, 30] },
      성동구: { p95: [18_000_000, 21_000_000, 19_000_000, 19_000_000], p90: [null, null, null, null], deals: [30, 30, 30, 30] },
    },
  };

  it("강남=100 인덱스 — null 전파", () => {
    expect(chaseIndex(file, "성동구")).toEqual([90, 105, null, 95]);
    expect(chaseIndex(file, "없는구")).toBeNull();
  });

  it("역전 마커 — 우열 뒤집힌 분기(관측 없는 분기는 건너뜀)", () => {
    const marks = findOvertakes(file, "강남구", "성동구");
    // Q3 강남>성동 → Q4 성동>강남(역전) → Q1 강남 관측 없음(스킵) → Q2 강남>성동(재역전)
    expect(marks).toEqual([
      { quarter: "2025-Q4", passer: "성동구", passed: "강남구" },
      { quarter: "2026-Q2", passer: "강남구", passed: "성동구" },
    ]);
  });
});

describe("buildChaseBoard", () => {
  const file: RegionChaseFile = {
    generatedAt: "2026-07-08",
    quarters: ["2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2"],
    regions: {
      강남구: { p95: [20_000_000, 20_000_000, 20_000_000, 20_000_000], p90: [null, null, null, null], deals: [30, 30, 30, 30] },
      서초구: { p95: [19_000_000, null, null, 19_600_000], p90: [null, null, null, null], deals: [30, 0, 0, 30] },
      성동구: { p95: [14_000_000, 15_000_000, 16_000_000, 17_000_000], p90: [null, null, null, null], deals: [30, 30, 30, 30] },
      // 유효 인덱스 1분기뿐(궤적 불성립) — 보드에서 제외.
      김포시: { p95: [null, null, null, 8_000_000], p90: [null, null, null, null], deals: [0, 0, 0, 30] },
    },
  };

  it("최신 인덱스 내림차순 상위 n + 추격폭 1위 병기", () => {
    const board = buildChaseBoard(file, 2)!;
    expect(board.base).toBe("강남구");
    expect(board.rows.map((r) => r.sigungu)).toEqual(["서초구", "성동구"]);
    // 서초: 95 → 98 (중간 관측 없음 건너뜀), 성동: 70 → 85.
    expect(board.rows[0].first).toBe(95);
    expect(board.rows[0].latest).toBe(98);
    expect(board.rows[1].delta).toBe(15);
    // 추격폭 1위 = 성동(+15 > 서초 +3).
    expect(board.topClimber!.sigungu).toBe("성동구");
  });

  it("placeholder·기준 구 없음·궤적 불성립뿐이면 null", () => {
    expect(buildChaseBoard({ generatedAt: null, quarters: [], regions: {} }, 5)).toBeNull();
    expect(
      buildChaseBoard(
        { ...file, regions: { 성동구: file.regions["성동구"] } },
        5,
      ),
    ).toBeNull();
  });
});
