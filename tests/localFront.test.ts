// 동네판(localFront) 순수 집계 — 발췌·게이트·이번 판 최고가·콜드스타트 픽 검증.

import { describe, expect, it } from "vitest";
import {
  LOCAL_ROW_LIMIT,
  LOCAL_TOP_LIMIT,
  briefFor,
  buildLocalFrontData,
  issueDates,
  pickColdStartSigungu,
  type LocalPatchInput,
  type RecentDay,
} from "@/lib/localFront";
import type { MajorItem, PatchDealInput, PatchItem } from "@/lib/patchNote";
import type { RegionTopFile } from "@/lib/regionTop";
import type { RegionSeriesFile } from "@/lib/regionSeries";

// ── 픽스처 팩토리 ─────────────────────────────────────────────────────────────
function major(over: Partial<MajorItem> & { sigungu: string; priceKrw: number }): MajorItem {
  return {
    dong: "테스트동",
    apt: "테스트단지",
    areaM2: 84.9,
    dealDate: "2026-07-05",
    pct: null,
    buildYear: null,
    sampleCount: null,
    floor: 10,
    ...over,
  };
}

function nerf(over: Partial<PatchItem> & { sigungu: string }): PatchItem {
  return {
    kind: "nerf",
    dong: "테스트동",
    apt: "강세단지",
    areaM2: 59.9,
    band: "p19_25",
    priceKrw: 900_000_000,
    medianKrw: 820_000_000,
    pct: 0.1, // 게이트 통과 기본값(중위가 대비 +10%)
    dealDate: "2026-07-04",
    prevKrw: 800_000_000,
    prevDate: "2026-06-20",
    prevFloor: 7,
    pctVsPrev: 0.125, // +12.5% — 이중 합의·상한 컷 통과
    ...over,
  };
}

function recentItem(
  over: Partial<PatchDealInput> & { sigunguName: string; priceKrw: number },
): PatchDealInput {
  return {
    apartmentName: "최근단지",
    dealDateISO: "2026-07-03",
    area: 84.9,
    dongName: "테스트동",
    floor: 5,
    dealingGbn: "중개거래",
    canceled: false,
    ...over,
  };
}

const basePatch: LocalPatchInput = {
  generatedAt: "2026-07-07",
  mode: "daily",
  nerf: [
    nerf({ sigungu: "강남구", apt: "게이트통과" }),
    // 게이트 탈락 — 중위가 대비 합의 미달(pct 3% < 7%)
    nerf({ sigungu: "강남구", apt: "합의미달", pct: 0.03 }),
    // 게이트 탈락 — 직전 거래 이상치 의심(+40% > 상한 30%)
    nerf({ sigungu: "서초구", apt: "이상치컷", pctVsPrev: 0.4 }),
    // 구 스키마 — 직전 팩트 없음
    nerf({
      sigungu: "서초구",
      apt: "직전없음",
      prevKrw: null,
      prevDate: null,
      prevFloor: null,
      pctVsPrev: null,
    }),
  ],
  major: [
    major({
      sigungu: "강남구",
      apt: "M1",
      priceKrw: 4_000_000_000,
      windowMaxKrw: 4_500_000_000,
      refMaxPeriod: "1년",
    }),
    major({ sigungu: "강남구", apt: "M2", priceKrw: 3_000_000_000 }),
    major({ sigungu: "강남구", apt: "M3", priceKrw: 2_500_000_000 }),
    major({ sigungu: "강남구", apt: "M4", priceKrw: 2_000_000_000 }), // 상한 초과분 — total 로만
    major({ sigungu: "서초구", apt: "S1", priceKrw: 1_800_000_000 }),
  ],
  strongRegions: [{ sigungu: "강남구", avgPct: 0.021, count: 6 }],
  weakRegions: [{ sigungu: "성남시 분당구", avgPct: -0.015, count: 5 }],
  regionCounts: { 강남구: 8, 서초구: 3, "성남시 분당구": 5, 송파구: 8 },
};

const baseRecent: RecentDay[] = [
  {
    date: "2026-07-05",
    items: [
      recentItem({ sigunguName: "강남구", priceKrw: 3_500_000_000 }),
      recentItem({ sigunguName: "마포구", priceKrw: 1_200_000_000 }),
    ],
  },
  {
    date: "2026-07-06",
    items: [
      recentItem({ sigunguName: "강남구", priceKrw: 2_000_000_000 }),
      // 해제 — 공개 합산·최고가 모두 제외
      recentItem({ sigunguName: "강남구", priceKrw: 9_000_000_000, canceled: true }),
    ],
  },
  {
    date: "2026-07-07",
    items: [
      recentItem({ sigunguName: "강남구", apartmentName: "오늘최고", priceKrw: 4_000_000_000 }),
      recentItem({ sigunguName: "강남구", priceKrw: 1_000_000_000 }),
      // 직거래 — 공개 건수엔 포함(공개 팩트), 최고가(가격 신호)에선 제외
      recentItem({ sigunguName: "강남구", priceKrw: 8_000_000_000, dealingGbn: "직거래" }),
      recentItem({ sigunguName: "서초구", priceKrw: 2_200_000_000 }),
    ],
  },
];

const baseTop: RegionTopFile = {
  generatedAt: "2026-07-06T00:00:00Z",
  windowDays: 60,
  regions: {
    강남구: {
      // 84㎡급(deals 12) > 59㎡급(deals 4) → 편집 기본은 84㎡급
      p19_25: {
        deals: 4,
        items: [
          {
            apt: "소형단지",
            dong: "역삼동",
            areaM2: 59.9,
            priceKrw: 1_900_000_000,
            dealDate: "2026-06-30",
            floor: 3,
            prevKrw: null,
            prevDate: null,
          },
        ],
      },
      p32_35: {
        deals: 12,
        items: Array.from({ length: 7 }, (_, i) => ({
          apt: `대형${i + 1}`,
          dong: "대치동",
          areaM2: 84.9,
          priceKrw: 3_000_000_000 - i * 100_000_000,
          dealDate: "2026-07-01",
          floor: i + 2,
          prevKrw: i === 0 ? 2_800_000_000 : null,
          prevDate: i === 0 ? "2026-06-01" : null,
        })),
      },
    },
  },
};

const baseSeries: RegionSeriesFile = {
  generatedAt: "2026-07-06T00:00:00Z",
  months: ["2026-05", "2026-06", "2026-07"],
  regions: {
    // 유효 월 2개 → 요약 생성
    강남구: { counts: [4, 6, 2], medianKrw: [2_000_000_000, 2_200_000_000, null] },
    // 유효 월 1개 → 요약 생략
    서초구: { counts: [1, 3, 0], medianKrw: [null, 1_900_000_000, null] },
  },
};

function build() {
  return buildLocalFrontData({
    patch: basePatch,
    recentDays: baseRecent,
    regionTop: baseTop,
    series: baseSeries,
  });
}

// ── buildLocalFrontData ──────────────────────────────────────────────────────
describe("buildLocalFrontData", () => {
  it("주요 거래는 시군구별 상한(LOCAL_ROW_LIMIT)으로 발췌하고 총건수를 보존한다", () => {
    const d = build();
    expect(d.majors["강남구"].rows.map((r) => r.apt)).toEqual(["M1", "M2", "M3"]);
    expect(d.majors["강남구"].rows).toHaveLength(LOCAL_ROW_LIMIT);
    expect(d.majors["강남구"].total).toBe(4);
    expect(d.majors["서초구"].total).toBe(1);
  });

  it("주요 거래 행은 기준점 최고가(refMax)를 보존한다 — '최고 대비 −x%' 병기 팩트", () => {
    const d = build();
    expect(d.majors["강남구"].rows[0].refMaxKrw).toBe(4_500_000_000);
    expect(d.majors["강남구"].rows[0].refMaxPeriod).toBe("1년");
    expect(d.majors["강남구"].rows[1].refMaxKrw).toBeNull(); // 기준점 없으면 서브라인 생략
  });

  it("강세 거래는 1면과 동일한 오보 게이트 통과분만 싣는다", () => {
    const d = build();
    expect(d.strongs["강남구"].rows.map((r) => r.apt)).toEqual(["게이트통과"]);
    expect(d.strongs["강남구"].total).toBe(1); // 합의미달 탈락
    expect(d.strongs["서초구"]).toBeUndefined(); // 이상치컷·직전없음 전부 탈락
  });

  it("시군구 평균 등락은 강세·약세 집계 합본이다", () => {
    const d = build();
    expect(d.pulses["강남구"]).toEqual({ avgPct: 0.021, count: 6 });
    expect(d.pulses["성남시 분당구"]).toEqual({ avgPct: -0.015, count: 5 });
    expect(d.pulses["서초구"]).toBeUndefined(); // 문턱 미달 동네는 생략(뷰에서 생략)
  });

  it("최근 며칠 합산은 해제만 제외하고(직거래 포함 — 공개 팩트) 일수를 병기용으로 보존한다", () => {
    const d = build();
    // 강남구: 7/5 1건 + 7/6 1건(해제 1건 제외) + 7/7 3건(직거래 포함) = 5건
    expect(d.recentCounts["강남구"]).toBe(5);
    expect(d.recentCounts["마포구"]).toBe(1);
    expect(d.recentDaysCount).toBe(3);
  });

  it("이번 판 최고가는 발행일 공개분의 중개거래(직거래·해제 제외) 최고가다", () => {
    const d = build();
    // 직거래 8억(아니 80억)이 아니라 중개 40억 — 7/5·7/6(전일 공개분)도 제외.
    expect(d.todayMax["강남구"]).toEqual({
      apt: "오늘최고",
      areaM2: 84.9,
      priceKrw: 4_000_000_000,
    });
    expect(d.todayMax["마포구"]).toBeUndefined(); // 7/5 공개분 — 이번 판 아님
  });

  it("[최근 거래 상위]는 거래 많은 밴드(편집 기본)의 상위 LOCAL_TOP_LIMIT 발췌다", () => {
    const d = build();
    const top = d.tops["강남구"];
    expect(top.bandLabel).toBe("84㎡급");
    expect(top.deals).toBe(12);
    expect(top.items).toHaveLength(LOCAL_TOP_LIMIT); // 7건 중 5건만
    expect(top.items[0]).toEqual({
      dong: "대치동",
      apt: "대형1",
      areaM2: 84.9,
      priceKrw: 3_000_000_000,
      dealDate: "2026-07-01",
      floor: 2,
      prevKrw: 2_800_000_000,
      prevDate: "2026-06-01",
    });
  });

  it("[12개월 추이] 요약은 유효 월 2개 이상 동네만 만든다", () => {
    const d = build();
    expect(d.seriesSummaries["강남구"]).toMatchObject({
      firstKrw: 2_000_000_000,
      lastKrw: 2_200_000_000,
      pct: 0.1,
    });
    expect(d.seriesSummaries["서초구"]).toBeUndefined();
  });

  it("placeholder(발행 전·주간 갱신 전)에서도 깨지지 않는다", () => {
    const d = buildLocalFrontData({
      patch: { generatedAt: null, nerf: [] },
      recentDays: [],
      regionTop: { generatedAt: null, windowDays: 60, regions: {} },
      series: { generatedAt: null, months: [], regions: {} },
    });
    expect(d.generatedAt).toBeNull();
    expect(d.regionCounts).toEqual({});
    expect(d.todayMax).toEqual({});
    expect(d.recentDaysCount).toBe(0);
    expect(pickColdStartSigungu(d)).toBeNull();
  });
});

// ── issueDates — 이번 판이 덮는 공개일 ─────────────────────────────────────────
describe("issueDates", () => {
  it("daily 는 발행일 하루만", () => {
    const f = issueDates({ generatedAt: "2026-07-07", mode: "daily" });
    expect(f("2026-07-07")).toBe(true);
    expect(f("2026-07-06")).toBe(false);
  });

  it("merged 는 합산 구간 전체", () => {
    const f = issueDates({
      generatedAt: "2026-07-07",
      mode: "merged",
      mergedFromDate: "2026-07-05",
      mergedToDate: "2026-07-07",
    });
    expect(f("2026-07-05")).toBe(true);
    expect(f("2026-07-06")).toBe(true);
    expect(f("2026-07-07")).toBe(true);
    expect(f("2026-07-04")).toBe(false);
  });

  it("발행 전(generatedAt null)은 아무 날도 안 덮는다", () => {
    const f = issueDates({ generatedAt: null });
    expect(f("2026-07-07")).toBe(false);
  });

  it("merged 최고가 — 합산 구간의 전일 공개분도 최고가 풀에 들어간다", () => {
    const d = buildLocalFrontData({
      patch: {
        ...basePatch,
        mode: "merged",
        mergedFromDate: "2026-07-05",
        mergedToDate: "2026-07-07",
      },
      recentDays: baseRecent,
      regionTop: baseTop,
      series: baseSeries,
    });
    // 7/5 공개된 마포구 12억이 이제 풀에 포함.
    expect(d.todayMax["마포구"]?.priceKrw).toBe(1_200_000_000);
    // 강남구 최고는 여전히 중개 40억(직거래 80억·해제 90억 제외).
    expect(d.todayMax["강남구"].priceKrw).toBe(4_000_000_000);
  });
});

// ── briefFor · pickColdStartSigungu ─────────────────────────────────────────
describe("briefFor", () => {
  it("동네 1곳의 브리핑을 온전히 도출한다", () => {
    const b = briefFor(build(), "강남구");
    expect(b.sigungu).toBe("강남구");
    expect(b.todayCount).toBe(8);
    expect(b.majors.rows).toHaveLength(3);
    expect(b.strongs.total).toBe(1);
    expect(b.pulse).toEqual({ avgPct: 0.021, count: 6 });
    expect(b.recentCount).toBe(5);
    expect(b.todayMax?.apt).toBe("오늘최고");
    expect(b.top?.bandLabel).toBe("84㎡급");
    expect(b.seriesSummary).not.toBeNull();
  });

  it("데이터 없는 동네는 0·빈 배열·null 로 안전하다(0건 폴백 경로)", () => {
    const b = briefFor(build(), "가평군");
    expect(b.todayCount).toBe(0);
    expect(b.majors).toEqual({ rows: [], total: 0 });
    expect(b.strongs).toEqual({ rows: [], total: 0 });
    expect(b.pulse).toBeNull();
    expect(b.recentCount).toBe(0);
    expect(b.todayMax).toBeNull();
    expect(b.top).toBeNull();
    expect(b.seriesSummary).toBeNull();
  });
});

describe("pickColdStartSigungu", () => {
  it("이번 판 최다 공개 동네를 고르고, 동률은 가나다 우선", () => {
    // 강남구 8 = 송파구 8 동률 → 가나다로 강남구.
    expect(pickColdStartSigungu(build())).toBe("강남구");
  });
});
