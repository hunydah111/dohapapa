// 전고점/회복률(regionPeaks) 순수 집계 함수 테스트 — 크론과 페이지가 같은 함수를 쓴다.
// 스펙 §6: 전고점 소표본 컷(<10건 달 후보 제외), 유효월 2개 미만 생략, 신고점 돌파(recovery>1),
//          trough 계산, 전 구간 null/빈 입력 안전.
import { describe, expect, it } from "vitest";
import {
  PEAK_MIN_DEALS,
  computeRegionPeaks,
  type RegionPeakTx,
} from "@/lib/regionPeaks";

// 헬퍼 — 한 시군구·한 달에 n건의 거래를 만든다(가격은 서로 다르게 흩뿌려 중위 = price 되게).
// n 건의 값이 [price-2, price-1, price, price+1, price+2 ...] 처럼 price 중심 대칭이면
// 홀수 n의 중위 = price. 여기선 단순히 전부 price 로 채워 중위 = price(만원 단위).
function deals(sigungu: string, ym: string, price: number, n: number): RegionPeakTx[] {
  return Array.from({ length: n }, () => ({ sigungu, ym, priceKrw: price }));
}

describe("PEAK_MIN_DEALS 상수", () => {
  it("전고점 후보 최소 표본은 10(소표본 fluke 방지)", () => {
    expect(PEAK_MIN_DEALS).toBe(10);
  });
});

describe("computeRegionPeaks — 전고점 소표본 컷", () => {
  const months = ["2021-10", "2022-12", "2026-06"];

  it("표본 10건 미만인 달은 전고점 후보에서 제외한다", () => {
    // 2021-10: 소표본(5건)의 25억 — 후보 아님. 2022-12: 10건 18억(후보). 2026-06: 10건 20억(후보).
    const rows = [
      ...deals("강남구", "2021-10", 2_500_000_000, 5), // 소표본 fluke — 무시돼야
      ...deals("강남구", "2022-12", 1_800_000_000, 10),
      ...deals("강남구", "2026-06", 2_000_000_000, 10),
    ];
    const out = computeRegionPeaks(rows, months);
    // 전고점은 25억(소표본)이 아니라 20억('26.6, 후보 중 최대)이어야 한다.
    expect(out["강남구"].peakKrw).toBe(2_000_000_000);
    expect(out["강남구"].peakYm).toBe("2026-06");
  });

  it("전고점 후보(≥10건)가 하나도 없는 시군구는 생략한다", () => {
    // 모든 달이 유효(≥3건)이나 어느 달도 10건에 못 미침 → 전고점 후보 0 → 생략.
    const rows = [
      ...deals("노원구", "2021-10", 900_000_000, 4),
      ...deals("노원구", "2026-06", 800_000_000, 5),
    ];
    const out = computeRegionPeaks(rows, months);
    expect(out["노원구"]).toBeUndefined();
  });
});

describe("computeRegionPeaks — 유효월 2개 미만 생략", () => {
  const months = ["2021-10", "2022-12", "2026-06"];

  it("유효월(중위 non-null)이 1개뿐이면 생략한다", () => {
    // 2021-10만 유효(≥3건), 나머지는 표본 부족(<3) → 유효월 1개 → 생략.
    const rows = [
      ...deals("과천시", "2021-10", 2_000_000_000, 12),
      ...deals("과천시", "2026-06", 2_100_000_000, 2), // <3 → 중위 null
    ];
    const out = computeRegionPeaks(rows, months);
    expect(out["과천시"]).toBeUndefined();
  });

  it("빈 입력·전 구간 null 안전 — 빈 객체를 돌려준다", () => {
    expect(computeRegionPeaks([], months)).toEqual({});
    // 전부 표본 부족(각 달 2건 < 3) → 유효월 0 → 생략.
    const sparse = [
      ...deals("성동구", "2021-10", 1_000_000_000, 2),
      ...deals("성동구", "2026-06", 1_100_000_000, 2),
    ];
    expect(computeRegionPeaks(sparse, months)).toEqual({});
  });
});

describe("computeRegionPeaks — 회복률·신고점 돌파", () => {
  const months = ["2021-10", "2022-12", "2026-06"];

  it("현재가 전고점보다 낮으면 recovery < 1 (미회복)", () => {
    const rows = [
      ...deals("마포구", "2021-10", 2_000_000_000, 12), // 전고점
      ...deals("마포구", "2026-06", 1_840_000_000, 10), // 현재 — 92%
    ];
    const out = computeRegionPeaks(rows, months);
    expect(out["마포구"].peakKrw).toBe(2_000_000_000);
    expect(out["마포구"].peakYm).toBe("2021-10");
    expect(out["마포구"].currentKrw).toBe(1_840_000_000);
    expect(out["마포구"].currentYm).toBe("2026-06");
    expect(out["마포구"].recovery).toBeCloseTo(0.92, 10);
  });

  it("현재가 과거 최고를 넘으면 신고점 돌파 — recovery > 1", () => {
    // 전고점 후보(≥10)는 '21.10 20억과 '26.6 22억 둘 다. 최댓값=22억(현재월과 동일).
    const rows = [
      ...deals("서초구", "2021-10", 2_000_000_000, 12),
      ...deals("서초구", "2026-06", 2_200_000_000, 12),
    ];
    const out = computeRegionPeaks(rows, months);
    // 월 중위 최댓값 = 현재월 22억 → 전고점=현재 → recovery=1(정확히 돌파 경계).
    expect(out["서초구"].peakKrw).toBe(2_200_000_000);
    expect(out["서초구"].recovery).toBe(1);
  });

  it("전고점이 과거에 있고 현재가 그를 넘어서면 recovery > 1", () => {
    // '21.10 후보 20억, 중간 '22.12 후보 24억(진짜 전고점), 현재 '26.6 26억 → 26/24 > 1.
    const months2 = ["2021-10", "2022-12", "2026-06"];
    const rows = [
      ...deals("용산구", "2021-10", 2_000_000_000, 12),
      ...deals("용산구", "2022-12", 2_400_000_000, 12),
      ...deals("용산구", "2026-06", 2_600_000_000, 12),
    ];
    const out = computeRegionPeaks(rows, months2);
    // 월 중위 최댓값 = 26억(현재월). 전고점=현재 → recovery=1.
    expect(out["용산구"].peakKrw).toBe(2_600_000_000);
    expect(out["용산구"].recovery).toBe(1);
  });
});

describe("computeRegionPeaks — trough(전고점 이후 저점)", () => {
  const months = ["2021-10", "2022-12", "2024-06", "2026-06"];

  it("전고점 월 이후 ~ 현재 사이 월 중위 최솟값을 trough로 잡는다", () => {
    const rows = [
      ...deals("송파구", "2021-10", 2_000_000_000, 12), // 전고점
      ...deals("송파구", "2022-12", 1_400_000_000, 12), // 저점 후보(최소)
      ...deals("송파구", "2024-06", 1_600_000_000, 12),
      ...deals("송파구", "2026-06", 1_840_000_000, 12), // 현재
    ];
    const out = computeRegionPeaks(rows, months);
    expect(out["송파구"].peakYm).toBe("2021-10");
    expect(out["송파구"].troughKrw).toBe(1_400_000_000);
    expect(out["송파구"].troughYm).toBe("2022-12");
    expect(out["송파구"].currentYm).toBe("2026-06");
  });

  it("전고점 이후 저점 후보(유효월)가 없으면 trough null", () => {
    // 전고점이 현재월과 같은 달(가장 최근)이면 (전고점, 현재] 사이가 비어 trough 없음.
    const rows = [
      ...deals("성북구", "2021-10", 1_500_000_000, 12),
      ...deals("성북구", "2026-06", 1_900_000_000, 12), // 최고이자 현재 → 전고점=현재
    ];
    const out = computeRegionPeaks(rows, months);
    expect(out["성북구"].peakYm).toBe("2026-06");
    expect(out["성북구"].troughKrw).toBeNull();
    expect(out["성북구"].troughYm).toBeNull();
  });
});

describe("computeRegionPeaks — 창 밖·비양수·시군구명 처리", () => {
  const months = ["2021-10", "2026-06"];

  it("months 밖 거래·비양수 가격은 무시한다", () => {
    const rows = [
      ...deals("동작구", "2019-01", 9_000_000_000, 20), // 창 밖 — 무시
      ...deals("동작구", "2021-10", 1_500_000_000, 12),
      ...deals("동작구", "2026-06", 1_400_000_000, 12),
      { sigungu: "동작구", ym: "2026-06", priceKrw: 0 }, // 비양수 — 무시
    ];
    const out = computeRegionPeaks(rows, months);
    expect(out["동작구"].peakKrw).toBe(1_500_000_000);
    expect(out["동작구"].recovery).toBeCloseTo(1_400_000_000 / 1_500_000_000, 10);
  });

  it("공백 포함 시군구명('수원시 팔달구')도 키 그대로 유지", () => {
    const rows = [
      ...deals("수원시 팔달구", "2021-10", 700_000_000, 12),
      ...deals("수원시 팔달구", "2026-06", 600_000_000, 12),
    ];
    const out = computeRegionPeaks(rows, months);
    expect(out["수원시 팔달구"]).toBeDefined();
    expect(out["수원시 팔달구"].peakKrw).toBe(700_000_000);
  });
});
