// 전고점/회복률(regionPeaks) 순수 집계 함수 테스트 — 크론과 페이지가 같은 함수를 쓴다.
// 스펙 §6: 전고점 소표본 컷(<10건 달 후보 제외), 유효월 2개 미만 생략, 신고점 돌파(recovery>1),
//          trough 계산, 전 구간 null/빈 입력 안전.
import { describe, expect, it } from "vitest";
import {
  PEAK_MIN_DEALS,
  computeRegionPeaks,
  smooth3,
  recoveryBand,
  rankByRecovery,
  rankOf,
  topRecovered,
  type RegionPeakEntry,
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

describe("smooth3 — 3개월 이동 중위(단발 스파이크 제거)", () => {
  // 값은 억 단위(roundManwon=만원 반올림이 항등이 되도록). 20억=2e9, 34억=3.4e9.
  const B = 100_000_000;
  it("내부 단발 스파이크는 양옆 이웃 중위로 사라진다", () => {
    // [20, 34(스파이크), 20]억 → 가운데는 median(20,34,20)=20억. 서초 '22.3 반포월 왜곡의 핵심.
    expect(smooth3([20 * B, 34 * B, 20 * B])).toEqual([20 * B, 20 * B, 20 * B]);
  });

  it("지속된 고점(플래토)은 그대로 살아남는다", () => {
    expect(smooth3([20 * B, 20 * B, 20 * B])).toEqual([20 * B, 20 * B, 20 * B]);
  });

  it("양 끝단은 이웃이 한쪽뿐이라 원값을 유지(2값 평균 왜곡 회피)", () => {
    // 끝단 34억은 median 계산 없이 원값 — 절반 흡수(=(34+20)/2)로 되레 왜곡되는 걸 막는다.
    expect(smooth3([34 * B, 20 * B, 20 * B])).toEqual([34 * B, 20 * B, 20 * B]);
    expect(smooth3([20 * B, 20 * B, 34 * B])).toEqual([20 * B, 20 * B, 34 * B]);
  });

  it("null(표본 부족) 달은 평활도 null, 이웃이 null이면 원값 유지", () => {
    expect(smooth3([null, 20 * B, null])).toEqual([null, 20 * B, null]);
    // 가운데 null → 그대로 null. 양옆은 이웃 한쪽이 null이라 원값.
    expect(smooth3([10 * B, null, 12 * B])).toEqual([10 * B, null, 12 * B]);
  });

  it("빈 배열·단일 원소 안전", () => {
    expect(smooth3([])).toEqual([]);
    expect(smooth3([20 * B])).toEqual([20 * B]);
  });
});

describe("computeRegionPeaks — 전고점 소표본 컷", () => {
  // 연속 월(배열 인접 = 달력 인접) — 평활이 실데이터처럼 동작하게. 값은 플래토라 평활=항등.
  const months = ["2021-01", "2021-02", "2021-03"];

  it("표본 10건 미만인 달은 전고점 후보에서 제외한다(스파이크여도)", () => {
    // 가운데 달만 5건 26억(소표본 스파이크) — 전고점 후보 아님 + 평활로도 눌림.
    const rows = [
      ...deals("강남구", "2021-01", 2_000_000_000, 10),
      ...deals("강남구", "2021-02", 2_600_000_000, 5), // 소표본 fluke — 무시돼야
      ...deals("강남구", "2021-03", 2_000_000_000, 10),
    ];
    const out = computeRegionPeaks(rows, months);
    // 전고점은 26억(소표본)이 아니라 20억(≥10 후보 중 최대).
    expect(out["강남구"].peakKrw).toBe(2_000_000_000);
    expect(out["강남구"].peakYm).toBe("2021-01");
  });

  it("전고점 후보(≥10건)가 하나도 없는 시군구는 생략한다", () => {
    // 모든 달이 유효(≥3건)이나 어느 달도 10건에 못 미침 → 전고점 후보 0 → 생략.
    const rows = [
      ...deals("노원구", "2021-01", 900_000_000, 4),
      ...deals("노원구", "2021-02", 800_000_000, 5),
    ];
    const out = computeRegionPeaks(rows, months);
    expect(out["노원구"]).toBeUndefined();
  });
});

describe("computeRegionPeaks — 스파이크 평활(핵심)", () => {
  const months = ["2021-01", "2021-02", "2021-03", "2021-04", "2021-05"];

  it("내부 단발 스파이크(반포월형)는 전고점이 되지 못한다", () => {
    // 20억 플래토 한가운데 34억 한 달(내부) — 평활로 20억이 되어 전고점=20억.
    // 이게 서초 '22.3 34.1억 → 회복 67% 저평가를 막는 바로 그 로직.
    const rows = [
      ...deals("서초구", "2021-01", 2_000_000_000, 10),
      ...deals("서초구", "2021-02", 2_000_000_000, 10),
      ...deals("서초구", "2021-03", 3_400_000_000, 10), // 내부 스파이크
      ...deals("서초구", "2021-04", 2_000_000_000, 10),
      ...deals("서초구", "2021-05", 2_000_000_000, 10),
    ];
    const out = computeRegionPeaks(rows, months);
    expect(out["서초구"].peakKrw).toBe(2_000_000_000); // 34억 아님
  });
});

describe("computeRegionPeaks — 유효월 2개 미만 생략", () => {
  const months = ["2021-01", "2021-02", "2021-03"];

  it("유효월(중위 non-null)이 1개뿐이면 생략한다", () => {
    // 2021-01만 유효(≥3건), 나머지는 표본 부족(<3) → 유효월 1개 → 생략.
    const rows = [
      ...deals("과천시", "2021-01", 2_000_000_000, 12),
      ...deals("과천시", "2021-02", 2_100_000_000, 2), // <3 → 중위 null
    ];
    const out = computeRegionPeaks(rows, months);
    expect(out["과천시"]).toBeUndefined();
  });

  it("빈 입력·전 구간 null 안전 — 빈 객체를 돌려준다", () => {
    expect(computeRegionPeaks([], months)).toEqual({});
    // 전부 표본 부족(각 달 2건 < 3) → 유효월 0 → 생략.
    const sparse = [
      ...deals("성동구", "2021-01", 1_000_000_000, 2),
      ...deals("성동구", "2021-02", 1_100_000_000, 2),
    ];
    expect(computeRegionPeaks(sparse, months)).toEqual({});
  });
});

describe("computeRegionPeaks — 회복률·신고점 돌파", () => {
  it("현재가 전고점보다 낮으면 recovery < 1 (미회복) — 플래토라 평활=항등", () => {
    const months = ["2021-01", "2021-02", "2021-03"];
    const rows = [
      ...deals("마포구", "2021-01", 2_000_000_000, 12), // 전고점
      ...deals("마포구", "2021-02", 2_000_000_000, 12),
      ...deals("마포구", "2021-03", 1_840_000_000, 12), // 현재 — 92%
    ];
    const out = computeRegionPeaks(rows, months);
    expect(out["마포구"].peakKrw).toBe(2_000_000_000);
    expect(out["마포구"].peakYm).toBe("2021-01");
    expect(out["마포구"].currentKrw).toBe(1_840_000_000);
    expect(out["마포구"].currentYm).toBe("2021-03");
    expect(out["마포구"].recovery).toBeCloseTo(0.92, 10);
  });

  it("얇은 미완성 현재월(표본<10)은 현재로 안 쓴다 — 부풀린 회복률 방지(송파 '26.7 사태)", () => {
    // 최근월(5건 24억)은 월초·신고 지연 미완성 달 → 현재에서 제외. 직전의 표본 충분한
    // 달(≥10)을 현재로 삼아 현재 ≤ 전고점 → 회복률 118% 같은 헛값이 안 나온다.
    const months = ["2021-01", "2021-02", "2021-03"];
    const rows = [
      ...deals("송파구", "2021-01", 2_000_000_000, 10),
      ...deals("송파구", "2021-02", 2_000_000_000, 10),
      ...deals("송파구", "2021-03", 2_400_000_000, 5), // 얇은 현재월 — 무시돼야
    ];
    const out = computeRegionPeaks(rows, months);
    expect(out["송파구"].currentYm).toBe("2021-02"); // 2021-03(5건) 아님
    expect(out["송파구"].currentKrw).toBe(2_000_000_000);
    expect(out["송파구"].recovery).toBeLessThanOrEqual(1); // 118% 같은 헛값 없음
  });

  it("믿을 만한 현재월(≥10)이 하나도 없으면 시군구 생략", () => {
    // 유효월은 2개(≥3)지만 둘 다 <10 → 전고점 후보도 현재도 없음 → 생략.
    const months = ["2021-01", "2021-02", "2021-03"];
    const rows = [
      ...deals("가평군", "2021-01", 300_000_000, 4),
      ...deals("가평군", "2021-02", 320_000_000, 5),
    ];
    expect(computeRegionPeaks(rows, months)["가평군"]).toBeUndefined();
  });
});

describe("computeRegionPeaks — trough(전고점 이후 저점)", () => {
  // 6개월 연속 — 전고점 플래토(20) → 저점(14) → 부분 회복(17). 플래토라 평활=항등.
  const months = ["2021-01", "2021-02", "2021-03", "2021-04", "2021-05", "2021-06"];

  it("전고점 월 이후 ~ 현재 사이 평활 중위 최솟값을 trough로 잡는다", () => {
    const rows = [
      ...deals("송파구", "2021-01", 2_000_000_000, 12), // 전고점
      ...deals("송파구", "2021-02", 2_000_000_000, 12),
      ...deals("송파구", "2021-03", 1_400_000_000, 12), // 저점
      ...deals("송파구", "2021-04", 1_400_000_000, 12),
      ...deals("송파구", "2021-05", 1_700_000_000, 12),
      ...deals("송파구", "2021-06", 1_700_000_000, 12), // 현재
    ];
    const out = computeRegionPeaks(rows, months);
    expect(out["송파구"].peakYm).toBe("2021-01");
    expect(out["송파구"].troughKrw).toBe(1_400_000_000);
    expect(out["송파구"].troughYm).toBe("2021-03");
    expect(out["송파구"].currentYm).toBe("2021-06");
  });

  it("전고점이 현재월(가장 최근)과 같으면 (전고점,현재] 이 비어 trough null", () => {
    // 현재월이 최고이자 전고점 → 전고점 이후 구간이 없음 → trough 없음.
    const rows = [
      ...deals("성북구", "2021-01", 1_500_000_000, 12),
      ...deals("성북구", "2021-02", 1_500_000_000, 12),
      ...deals("성북구", "2021-03", 1_900_000_000, 12), // 최고이자 현재 → 전고점=현재
    ];
    const out = computeRegionPeaks(rows, ["2021-01", "2021-02", "2021-03"]);
    expect(out["성북구"].peakYm).toBe("2021-03");
    expect(out["성북구"].currentYm).toBe("2021-03");
    expect(out["성북구"].troughKrw).toBeNull();
    expect(out["성북구"].troughYm).toBeNull();
  });
});

describe("computeRegionPeaks — 창 밖·비양수·시군구명 처리", () => {
  const months = ["2021-01", "2021-02", "2021-03"];

  it("months 밖 거래·비양수 가격은 무시한다", () => {
    const rows = [
      ...deals("동작구", "2019-01", 9_000_000_000, 20), // 창 밖 — 무시
      ...deals("동작구", "2021-01", 1_500_000_000, 12),
      ...deals("동작구", "2021-02", 1_500_000_000, 12),
      ...deals("동작구", "2021-03", 1_400_000_000, 12),
      { sigungu: "동작구", ym: "2021-03", priceKrw: 0 }, // 비양수 — 무시
    ];
    const out = computeRegionPeaks(rows, months);
    expect(out["동작구"].peakKrw).toBe(1_500_000_000);
    expect(out["동작구"].recovery).toBeCloseTo(1_400_000_000 / 1_500_000_000, 10);
  });

  it("공백 포함 시군구명('수원시 팔달구')도 키 그대로 유지", () => {
    const rows = [
      ...deals("수원시 팔달구", "2021-01", 700_000_000, 12),
      ...deals("수원시 팔달구", "2021-02", 700_000_000, 12),
      ...deals("수원시 팔달구", "2021-03", 600_000_000, 12),
    ];
    const out = computeRegionPeaks(rows, months);
    expect(out["수원시 팔달구"]).toBeDefined();
    expect(out["수원시 팔달구"].peakKrw).toBe(700_000_000);
  });
});

// ── UI 헬퍼 — 밴드·랭킹·TOP(하위 랭킹 없음). ────────────────────────────────────
/** 테스트용 최소 엔트리 — recovery 만 중요. 나머지 필드는 형식만 맞춘다. */
function entry(recovery: number): RegionPeakEntry {
  return {
    peakKrw: 1_000_000_000,
    peakYm: "2021-10",
    currentKrw: Math.round(1_000_000_000 * recovery),
    currentYm: "2026-06",
    recovery,
    troughKrw: null,
    troughYm: null,
  };
}

describe("recoveryBand — 경계(100/90/75%)", () => {
  it("신고점 돌파(≥100%)는 밴드 3", () => {
    expect(recoveryBand(1)).toBe(3);
    expect(recoveryBand(1.12)).toBe(3);
  });
  it("90~100%는 밴드 2", () => {
    expect(recoveryBand(0.9)).toBe(2);
    expect(recoveryBand(0.999)).toBe(2);
  });
  it("75~90%는 밴드 1", () => {
    expect(recoveryBand(0.75)).toBe(1);
    expect(recoveryBand(0.899)).toBe(1);
  });
  it("<75%는 밴드 0", () => {
    expect(recoveryBand(0.749)).toBe(0);
    expect(recoveryBand(0.5)).toBe(0);
  });
});

describe("rankByRecovery — 내림차순 + 동률 가나다 안정 정렬", () => {
  it("회복률 높은 순, 동률은 시군구 가나다순", () => {
    const regions = {
      마포구: entry(0.92),
      강남구: entry(0.98),
      // 동률 0.85 — 가나다(성동 < 송파)로 성동구가 먼저.
      송파구: entry(0.85),
      성동구: entry(0.85),
    };
    const ranked = rankByRecovery(regions).map((r) => r.sigungu);
    expect(ranked).toEqual(["강남구", "마포구", "성동구", "송파구"]);
  });
  it("빈 입력은 빈 배열", () => {
    expect(rankByRecovery({})).toEqual([]);
  });
});

describe("rankOf — 본인 '82곳 중 N위'(동률 경쟁 랭킹)", () => {
  const regions = {
    강남구: entry(0.98),
    마포구: entry(0.92),
    성동구: entry(0.85),
    송파구: entry(0.85), // 성동과 동률
    노원구: entry(0.7),
  };
  it("총 M = regions 개수", () => {
    expect(rankOf(regions, "강남구")!.total).toBe(5);
  });
  it("1위·중간 순위", () => {
    expect(rankOf(regions, "강남구")!.rank).toBe(1);
    expect(rankOf(regions, "마포구")!.rank).toBe(2);
  });
  it("동률은 같은 순위를 공유(둘 다 3위 — 나보다 엄격히 높은 2곳 + 1)", () => {
    expect(rankOf(regions, "성동구")!.rank).toBe(3);
    expect(rankOf(regions, "송파구")!.rank).toBe(3);
  });
  it("없는 시군구는 null(회복률 줄 생략)", () => {
    expect(rankOf(regions, "종로구")).toBeNull();
    expect(rankOf({}, "강남구")).toBeNull();
  });
});

describe("topRecovered — 회복 상위만(하위/워스트 없음)", () => {
  const regions = {
    강남구: entry(1.05), // 신고점 돌파 — 자동으로 맨 위
    마포구: entry(0.92),
    성동구: entry(0.88),
    노원구: entry(0.7),
    도봉구: entry(0.6),
    강북구: entry(0.55),
  };
  it("상위 5곳, 신고점 돌파 우선(내림차순)", () => {
    const top = topRecovered(regions, 5).map((r) => r.sigungu);
    expect(top).toEqual(["강남구", "마포구", "성동구", "노원구", "도봉구"]);
    // 최하위(강북구 0.55)는 절대 포함되지 않는다.
    expect(top).not.toContain("강북구");
  });
  it("regions 가 n보다 적으면 있는 만큼만", () => {
    expect(topRecovered({ 강남구: entry(0.9) }, 5)).toHaveLength(1);
  });
});
