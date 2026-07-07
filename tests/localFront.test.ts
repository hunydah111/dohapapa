// 동네판(localFront) 순수 집계 — 발췌·게이트·이번 판 최고가·콜드스타트 픽 검증.

import { describe, expect, it } from "vitest";
import {
  LOCAL_PULSE_MIN_SAMPLE,
  LOCAL_ROW_LIMIT,
  LOCAL_TOP_LIMIT,
  briefFor,
  buildLocalFrontData,
  issueDates,
  momentumFor,
  pickColdStartSigungu,
  pickMomentumLeader,
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
      floor: 5, // 라이벌 보드 "최고 N억 · 단지 층" 병기 팩트
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
    expect(d.recentPulses).toEqual({});
    expect(d.momentums).toEqual({});
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

// ── momentumFor — 동네 기세(최근 2개 유효월 관측 중위 변화) ────────────────────
describe("momentumFor", () => {
  // regionSeries 계약 — 마지막 달("2026-06")은 당월(집계 중).
  const months = ["2026-03", "2026-04", "2026-05", "2026-06"];

  it("최근 2개 유효 완료월의 중위 변화 — 당월(마지막 버킷)은 non-null 이어도 제외", () => {
    const m = momentumFor(months, {
      counts: [3, 5, 4, 6],
      // 당월 12억(반쪽 표본)이 끼면 −43% 왜곡 기세가 찍힌다 — 완료월 04→05 만 비교.
      medianKrw: [1_900_000_000, 2_000_000_000, 2_100_000_000, 1_200_000_000],
    });
    expect(m).toEqual({
      pct: (2_100_000_000 - 2_000_000_000) / 2_000_000_000, // +5%
      fromMonth: "2026-04",
      toMonth: "2026-05",
    });
  });

  it("유효월 사이 표본 부족(null) 달이 끼면 건너뛰고 관측된 두 완료월을 비교한다", () => {
    const m = momentumFor(months, {
      counts: [4, 1, 6, 0],
      medianKrw: [2_000_000_000, null, 1_900_000_000, null],
    });
    expect(m).toEqual({
      pct: (1_900_000_000 - 2_000_000_000) / 2_000_000_000, // −5%
      fromMonth: "2026-03",
      toMonth: "2026-05",
    });
  });

  it("유효 완료월 2개 미만이면 null — 당월만 유효해도 마크는 안 찍는다", () => {
    expect(
      momentumFor(months, { counts: [1, 3, 0, 0], medianKrw: [null, 1_900_000_000, null, null] }),
    ).toBeNull();
    // 완료월 1개 + 당월 1개 — 당월은 제외라 여전히 null.
    expect(
      momentumFor(months, {
        counts: [0, 3, 0, 5],
        medianKrw: [null, 1_900_000_000, null, 2_500_000_000],
      }),
    ).toBeNull();
    expect(momentumFor([], { counts: [], medianKrw: [] })).toBeNull();
  });

  it("buildLocalFrontData 가 시군구별 momentums 로 굽는다 — 유효월 2개 미만 동네는 생략", () => {
    const d = build();
    // 강남구: 완료월 05(20억) → 06(22억) — 07은 당월(집계 중)이라 애초에 제외.
    expect(d.momentums["강남구"]).toEqual({
      pct: 0.1,
      fromMonth: "2026-05",
      toMonth: "2026-06",
    });
    expect(d.momentums["서초구"]).toBeUndefined(); // 유효월 1개
    expect(briefFor(d, "강남구").momentum).not.toBeNull();
    expect(briefFor(d, "서초구").momentum).toBeNull();
  });
});

// ── recentPulses — [직전 대비 평균] 최근 며칠 "합산" 표본(오늘분만이 아님) ────────
describe("recentPulses (직전 대비 평균 — 3일 합산)", () => {
  function pulseBuild(recentDays: RecentDay[]) {
    return buildLocalFrontData({
      patch: { generatedAt: "2026-07-07", mode: "daily", nerf: [] },
      recentDays,
      regionTop: { generatedAt: null, windowDays: 60, regions: {} },
      series: { generatedAt: null, months: [], regions: {} },
    });
  }

  it("전일 공개분이 직전 거래 기준으로 잡힌다 — 일자 경계를 넘는 합산 표본", () => {
    const d = pulseBuild([
      {
        date: "2026-07-05",
        items: [
          recentItem({
            sigunguName: "강남구",
            apartmentName: "단지X",
            priceKrw: 1_000_000_000,
            dealDateISO: "2026-06-20",
          }),
        ],
      },
      {
        date: "2026-07-07",
        items: [
          recentItem({
            sigunguName: "강남구",
            apartmentName: "단지X",
            priceKrw: 1_100_000_000,
            dealDateISO: "2026-07-05",
          }),
        ],
      },
    ]);
    // 7/5 계약 11억의 직전 = 6/20 계약 10억(이틀 전 공개분) → +10%, 표본 1.
    expect(d.recentPulses["강남구"]).toEqual({ avgPct: 0.1, count: 1 });
    expect(briefFor(d, "강남구").recentPulse).toEqual({ avgPct: 0.1, count: 1 });
  });

  it("직거래는 등락 주체에서 제외(기준으론 유효) · 해제·평형 불일치(±3㎡ 밖)는 매칭 제외", () => {
    const d = pulseBuild([
      {
        date: "2026-07-07",
        items: [
          // 직거래 8억(6/25) — 주체론 안 세지만 아래 중개 9억의 "직전" 기준으론 유효.
          recentItem({
            sigunguName: "강남구",
            apartmentName: "단지Y",
            priceKrw: 800_000_000,
            dealDateISO: "2026-06-25",
            dealingGbn: "직거래",
          }),
          recentItem({
            sigunguName: "강남구",
            apartmentName: "단지Y",
            priceKrw: 900_000_000,
            dealDateISO: "2026-07-06",
          }),
          // 해제 — 기준·주체 모두 제외(9.5억이 기준이 되면 안 됨).
          recentItem({
            sigunguName: "강남구",
            apartmentName: "단지Y",
            priceKrw: 950_000_000,
            dealDateISO: "2026-07-01",
            canceled: true,
          }),
          // 같은 단지지만 59㎡ — ±3㎡ 밖이라 84.9㎡ 거래의 직전이 될 수 없음.
          recentItem({
            sigunguName: "서초구",
            apartmentName: "단지Z",
            priceKrw: 700_000_000,
            dealDateISO: "2026-06-28",
            area: 59.9,
          }),
          recentItem({
            sigunguName: "서초구",
            apartmentName: "단지Z",
            priceKrw: 1_200_000_000,
            dealDateISO: "2026-07-05",
            area: 84.9,
          }),
        ],
      },
    ]);
    // 단지Y: 중개 9억 vs 직전 직거래 8억 = +12.5% — 표본은 중개 1건뿐.
    expect(d.recentPulses["강남구"]).toEqual({ avgPct: 0.125, count: 1 });
    // 단지Z: 평형 불일치라 직전 없음 → 서초구 표본 0(키 자체가 없음).
    expect(d.recentPulses["서초구"]).toBeUndefined();
    expect(briefFor(d, "서초구").recentPulse).toBeNull();
  });

  it("60일보다 묵은 직전 거래는 비교 무의미(제외) · 평균은 매칭분끼리만 낸다", () => {
    const d = pulseBuild([
      {
        date: "2026-07-07",
        items: [
          // 61일 전 계약 — 기준 후보였다가 나이 컷.
          recentItem({
            sigunguName: "송파구",
            apartmentName: "단지W",
            priceKrw: 1_000_000_000,
            dealDateISO: "2026-05-05",
          }),
          recentItem({
            sigunguName: "송파구",
            apartmentName: "단지W",
            priceKrw: 1_300_000_000,
            dealDateISO: "2026-07-06", // 5/5 대비 62일 — 컷
          }),
          // 매칭되는 쌍 — 10억(7/1) → 11억(7/6) = +10%.
          recentItem({
            sigunguName: "송파구",
            apartmentName: "단지V",
            priceKrw: 1_000_000_000,
            dealDateISO: "2026-07-01",
          }),
          recentItem({
            sigunguName: "송파구",
            apartmentName: "단지V",
            priceKrw: 1_100_000_000,
            dealDateISO: "2026-07-06",
          }),
        ],
      },
    ]);
    // 단지V 11억(+10%) 1건 + 단지V 10억(직전 없음·제외) + 단지W(나이 컷·제외) = 표본 1.
    expect(d.recentPulses["송파구"]).toEqual({ avgPct: 0.1, count: 1 });
    expect(LOCAL_PULSE_MIN_SAMPLE).toBe(3); // UI "표본 부족" 문턱 — 계약 고정
  });
});

// ── pickMomentumLeader — 우세 딱지 판정(동률·결측 생략) ───────────────────────
describe("pickMomentumLeader", () => {
  const m = (pct: number) => ({ pct, fromMonth: "2026-05", toMonth: "2026-06" });

  it("momentum pct 큰 쪽이 우세 — 음수끼리도 덜 내린 쪽", () => {
    expect(pickMomentumLeader(m(0.021), m(-0.014))).toBe("main");
    expect(pickMomentumLeader(m(-0.03), m(-0.014))).toBe("rival");
  });

  it("동률이면 null — 딱지·테두리 강조 생략", () => {
    expect(pickMomentumLeader(m(0.02), m(0.02))).toBeNull();
  });

  it("둘 중 하나라도 결측이면 null — 반쪽 비교로 우세 딱지 금지", () => {
    expect(pickMomentumLeader(m(0.02), null)).toBeNull();
    expect(pickMomentumLeader(null, m(0.02))).toBeNull();
    expect(pickMomentumLeader(null, null)).toBeNull();
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
    expect(b.recentPulse).toBeNull();
    expect(b.momentum).toBeNull();
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
