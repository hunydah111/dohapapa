import { describe, it, expect } from "vitest";
import {
  computePatch,
  dealKey,
  seenKeyOf,
  subtractRecentFromSeen,
  pickHeadline,
  pickHeadlines,
  PATCH_SCOPE_DAYS,
  PATCH_TOP_N,
  PATCH_MAJOR_MIN_PRICE_KRW,
  PATCH_TEMP_MIN_MATCHED,
  PATCH_PREV_MAX_AGE_DAYS,
  PATCH_BUSIEST_MIN_COUNT,
  PATCH_BUSIEST_TOP_N,
  type PatchDealInput,
  type ComplexMedianLookup,
  type MajorItem,
  type PatchItem,
} from "@/lib/patchNote";

const TODAY = "2026-07-04";

function makeDeal(overrides: Partial<PatchDealInput> = {}): PatchDealInput {
  return {
    apartmentName: "테스트단지",
    dealDateISO: "2026-07-01",
    priceKrw: 1_000_000_000,
    area: 84, // p32_35 밴드권
    sigunguName: "강남구",
    dongName: "역삼동",
    floor: 10,
    ...overrides,
  };
}

/** 직전 거래 스텁 — window 안(스코프 밖, 6/15=19일 전) 같은 단지×밴드 기준 거래.
 *  [강세 거래]·온도·동네 집계가 직전 실거래 팩트를 요구하므로(2026-07-06 재정의)
 *  게재를 기대하는 fresh 거래엔 이 기준 거래를 짝지어 준다. */
function prevDeal(
  apartmentName: string,
  priceKrw = 1_000_000_000,
  dealDateISO = "2026-06-15",
  floor = 1,
): PatchDealInput {
  return makeDeal({ apartmentName, priceKrw, dealDateISO, floor });
}

// 강남구 소재 단지는 자기 중위가 10억, 표본 충분 — 단순 스텁 (내부 선별 필터용)
const lookup: ComplexMedianLookup = (d) =>
  d.sigunguName === "강남구"
    ? { medianKrw: 1_000_000_000, sampleCount: 30 }
    : null;

describe("patchNote.computePatch", () => {
  it("중위가 ±7% 이탈로 선별하되, 너프 게재엔 직전 거래 팩트가 실린다", () => {
    const r = computePatch({
      deals: [
        prevDeal("급등단지"), // 직전 거래 1.0억×10 (6/15)
        makeDeal({ apartmentName: "급등단지", priceKrw: 1_120_000_000 }), // +12%
        makeDeal({ apartmentName: "급락단지", priceKrw: 880_000_000 }), // -12% → buff(데이터)
        makeDeal({ apartmentName: "평범단지", priceKrw: 1_020_000_000 }), // +2% → 필터 제외
      ],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.nerf.map((i) => i.apt)).toEqual(["급등단지"]);
    expect(r.nerf[0].pct).toBeCloseTo(0.12, 5); // 내부 필터 값(중위가 대비)
    // 화면 노출용 팩트 — 직전 실거래 대비 + 날짜
    expect(r.nerf[0].prevKrw).toBe(1_000_000_000);
    expect(r.nerf[0].prevDate).toBe("2026-06-15");
    expect(r.nerf[0].pctVsPrev).toBeCloseTo(0.12, 5);
    expect(r.buff.map((i) => i.apt)).toEqual(["급락단지"]);
  });

  it("중위가 필터를 통과해도 직전 거래가 없으면 [강세 거래] 미게재 — 표시할 팩트가 없다", () => {
    const r = computePatch({
      deals: [makeDeal({ apartmentName: "이력없는급등", priceKrw: 1_120_000_000 })],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.nerf).toHaveLength(0);
  });

  it("직전 거래가 60일(PREV_MAX_AGE)보다 묵으면 비교 무효 → 미게재, 경계 60일은 유효", () => {
    // 4/30 → 7/1 = 62일 → 무효
    const stale = computePatch({
      deals: [
        prevDeal("묵은단지", 1_000_000_000, "2026-04-30"),
        makeDeal({ apartmentName: "묵은단지", priceKrw: 1_120_000_000 }),
      ],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(stale.nerf).toHaveLength(0);
    // 5/2 → 7/1 = 딱 60일 → 유효
    const edge = computePatch({
      deals: [
        prevDeal("경계단지", 1_000_000_000, "2026-05-02"),
        makeDeal({ apartmentName: "경계단지", priceKrw: 1_120_000_000 }),
      ],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(edge.nerf).toHaveLength(1);
    expect(edge.nerf[0].prevDate).toBe("2026-05-02");
    void PATCH_PREV_MAX_AGE_DAYS; // 문서화용 상수 참조
  });

  it("같은 날짜의 타거래도 직전 거래로 허용(자기 자신 제외) — 층이 달라도", () => {
    const r = computePatch({
      deals: [
        makeDeal({ apartmentName: "동일자단지", floor: 3, priceKrw: 1_000_000_000 }),
        makeDeal({ apartmentName: "동일자단지", floor: 20, priceKrw: 1_120_000_000 }),
      ],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    // 1.12억×10 거래의 직전 = 같은 날 3층 1.0억×10 (자기 자신은 제외)
    expect(r.nerf.map((i) => i.apt)).toEqual(["동일자단지"]);
    expect(r.nerf[0].priceKrw).toBe(1_120_000_000);
    expect(r.nerf[0].prevKrw).toBe(1_000_000_000);
  });

  it("이미 본 거래(seenKeys)는 신규로 잡지 않는다", () => {
    const deal = makeDeal({ priceKrw: 1_200_000_000 });
    const r = computePatch({
      deals: [deal],
      seenKeys: new Set([dealKey(deal)]),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.newDealCount).toBe(0);
    expect(r.nerf).toHaveLength(0);
    // 하지만 seen 유지 대상엔 남는다 (내일도 재폴링되므로)
    expect(r.nextSeenKeys).toContain(dealKey(deal));
  });

  it("계약일이 스코프(14일) 밖이거나 미래인 거래는 무시", () => {
    const old = makeDeal({
      apartmentName: "뒷북단지",
      dealDateISO: "2026-06-01", // 33일 전
      priceKrw: 1_300_000_000,
    });
    const future = makeDeal({
      apartmentName: "미래단지",
      dealDateISO: "2026-07-09",
      priceKrw: 1_300_000_000,
    });
    const r = computePatch({
      deals: [old, future],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.scopeDealCount).toBe(0);
    // v2.3 재설계: seen은 스코프가 아니라 window "전체" 기준 — 스코프 밖 거래도 seen에
    // 남는다(해제 감시가 window 전역이라 seen도 전역이어야 재등장을 막는다).
    expect(r.nextSeenKeys).toHaveLength(2);
    expect(r.nextSeenKeys).toContain(dealKey(old));
  });

  it("스코프 경계: 정확히 14일 전은 포함 (직전 거래는 스코프 밖이라도 인덱스에 남는다)", () => {
    const edge = makeDeal({
      dealDateISO: "2026-06-20", // 딱 14일 전
      priceKrw: 1_150_000_000,
    });
    const r = computePatch({
      deals: [prevDeal("테스트단지"), edge], // 기준 거래는 6/15(스코프 밖)
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.scopeDealCount).toBe(1); // 스코프 밖 기준 거래는 안 셈
    expect(r.nerf).toHaveLength(1);
    expect(r.nerf[0].prevKrw).toBe(1_000_000_000);
    void PATCH_SCOPE_DAYS; // 문서화용 상수 참조
  });

  it("노이즈 컷: ±35% 초과 괴리·표본 부족·초저가는 제외 (내부 선별 필터)", () => {
    const sparseLookup: ComplexMedianLookup = (d) =>
      d.sigunguName === "강남구"
        ? { medianKrw: 1_000_000_000, sampleCount: 30 }
        : d.sigunguName === "표본부족구"
          ? { medianKrw: 500_000_000, sampleCount: 2 }
          : null;
    const r = computePatch({
      deals: [
        makeDeal({ apartmentName: "증여의심", priceKrw: 400_000_000 }), // -60% → 컷
        makeDeal({ apartmentName: "지분거래", priceKrw: 30_000_000 }), // 초저가 → 컷
        makeDeal({
          apartmentName: "표본부족",
          sigunguName: "표본부족구",
          priceKrw: 600_000_000,
        }), // 표본 2 → 컷
      ],
      seenKeys: new Set(),
      lookupMedian: sparseLookup,
      todayISO: TODAY,
    });
    expect(r.nerf).toHaveLength(0);
    expect(r.buff).toHaveLength(0);
  });

  it("같은 단지×평형은 pctVsPrev 최대 대표 1건만 — 도배 방지", () => {
    const r = computePatch({
      deals: [
        prevDeal("도배단지"), // 6/15 · 1.0억×10
        makeDeal({ apartmentName: "도배단지", dealDateISO: "2026-06-28", floor: 3, priceKrw: 1_080_000_000 }), // 직전(6/15) 대비 +8%
        makeDeal({ apartmentName: "도배단지", dealDateISO: "2026-07-01", floor: 15, priceKrw: 1_140_000_000 }), // 직전(6/28) 대비 +5.6%
      ],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    const 도배 = r.nerf.filter((i) => i.apt === "도배단지");
    expect(도배).toHaveLength(1);
    expect(도배[0].priceKrw).toBe(1_080_000_000); // pctVsPrev(+8%) 최대 건이 대표
  });

  it("[강세 거래]는 pctVsPrev 내림차순 상위 N건", () => {
    const many: PatchDealInput[] = [];
    for (let i = 0; i < 7; i++) {
      many.push(prevDeal(`단지${i}`)); // 각 단지 기준 거래 1.0억×10
      many.push(
        makeDeal({
          apartmentName: `단지${i}`,
          priceKrw: 1_080_000_000 + i * 10_000_000, // 직전 대비 +8%…+14%
        }),
      );
    }
    const r = computePatch({
      deals: many,
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.nerf).toHaveLength(PATCH_TOP_N);
    expect(r.nerf[0].apt).toBe("단지6"); // 가장 큰 +14%부터
    const pcts = r.nerf.map((i) => i.pctVsPrev ?? 0);
    expect([...pcts].sort((a, b) => b - a)).toEqual(pcts);
  });

  it("직거래는 분류에서 제외(스코프·seen엔 포함), 해제 거래는 스코프에서 제외", () => {
    const direct = makeDeal({
      apartmentName: "가족거래단지",
      priceKrw: 700_000_000, // -30% 급락처럼 보이지만 직거래
      dealingGbn: "직거래",
    });
    const canceledDeal = makeDeal({
      apartmentName: "해제단지",
      priceKrw: 1_200_000_000,
      canceled: true,
    });
    const normal = makeDeal({
      apartmentName: "정상중개단지",
      priceKrw: 1_120_000_000,
      dealingGbn: "중개거래",
    });
    const r = computePatch({
      deals: [prevDeal("정상중개단지"), direct, canceledDeal, normal],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    // 해제는 스코프 밖, 직거래·정상은 스코프 안 (기준 거래 6/15는 스코프 밖)
    expect(r.scopeDealCount).toBe(2);
    // 분류는 정상 중개거래만
    expect(r.buff).toHaveLength(0);
    expect(r.nerf.map((i) => i.apt)).toEqual(["정상중개단지"]);
    // 직거래도 seen엔 남아 내일 중복 등장 방지
    expect(r.nextSeenKeys).toContain(dealKey(direct));
  });

  it("scopeDays 오버라이드(창간호 3일): 3일 밖 거래는 스코프 제외돼도 직전 거래론 쓰인다", () => {
    const inside = makeDeal({
      apartmentName: "창간호단지",
      dealDateISO: "2026-07-02", // 2일 전
      priceKrw: 1_150_000_000,
    });
    const outside = makeDeal({
      apartmentName: "창간호단지",
      dealDateISO: "2026-06-28", // 6일 전 — 3일 스코프엔 제외, 직전 거래로는 유효
      priceKrw: 1_000_000_000,
      floor: 2,
    });
    const r = computePatch({
      deals: [inside, outside],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
      scopeDays: 3,
    });
    expect(r.scopeDealCount).toBe(1);
    expect(r.nerf.map((i) => i.apt)).toEqual(["창간호단지"]);
    expect(r.nerf[0].prevKrw).toBe(1_000_000_000);
    expect(r.nerf[0].prevDate).toBe("2026-06-28");
    expect(r.nerf[0].pctVsPrev).toBeCloseTo(0.15, 5);
  });

  it("dealKey는 층·가격까지 포함해 같은 날 같은 단지의 다른 거래를 구분", () => {
    const a = makeDeal({ floor: 3 });
    const b = makeDeal({ floor: 20 });
    expect(dealKey(a)).not.toBe(dealKey(b));
  });

  it("비대칭 노이즈 컷 — 상승은 +35%까지, 하락은 −30%까지만 (내부 필터)", () => {
    const r = computePatch({
      deals: [
        prevDeal("상승32"),
        prevDeal("상승36"),
        makeDeal({ apartmentName: "상승32", priceKrw: 1_320_000_000 }), // +32% → 너프 OK
        makeDeal({ apartmentName: "상승36", priceKrw: 1_360_000_000 }), // +36% → 컷
        makeDeal({ apartmentName: "하락28", priceKrw: 720_000_000 }), // -28% → 버프 OK
        makeDeal({ apartmentName: "하락32", priceKrw: 680_000_000 }), // -32% → 증여성 의심 컷
      ],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.nerf.map((i) => i.apt)).toEqual(["상승32"]);
    expect(r.buff.map((i) => i.apt)).toEqual(["하락28"]);
  });
});

// ── [주요 거래] — 오늘 공개된 15억 이상 중개거래 전부 ─────────────────────────

describe("patchNote.computePatch — major", () => {
  it("15억 경계 포함·미만 제외, 가격 내림차순 정렬", () => {
    const r = computePatch({
      deals: [
        makeDeal({ apartmentName: "경계딱", priceKrw: PATCH_MAJOR_MIN_PRICE_KRW }), // 15.0억 → 포함
        makeDeal({ apartmentName: "경계밑", priceKrw: PATCH_MAJOR_MIN_PRICE_KRW - 1 }), // 미만 → 제외
        makeDeal({ apartmentName: "최고가", priceKrw: 3_500_000_000 }),
        makeDeal({ apartmentName: "중간", priceKrw: 2_200_000_000 }),
      ],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.major.map((m) => m.apt)).toEqual(["최고가", "중간", "경계딱"]);
    const prices = r.major.map((m) => m.priceKrw);
    expect([...prices].sort((a, b) => b - a)).toEqual(prices);
  });

  it("직거래·해제 거래는 major에서 제외", () => {
    const r = computePatch({
      deals: [
        makeDeal({ apartmentName: "직거래20억", priceKrw: 2_000_000_000, dealingGbn: "직거래" }),
        makeDeal({ apartmentName: "해제20억", priceKrw: 2_000_000_000, canceled: true }),
        makeDeal({ apartmentName: "정상16억", priceKrw: 1_600_000_000, dealingGbn: "중개거래" }),
      ],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.major.map((m) => m.apt)).toEqual(["정상16억"]);
  });

  it("이미 본 거래(seen)는 major에 안 실림 — '오늘 처음 확인'만", () => {
    const deal = makeDeal({ apartmentName: "어제것", priceKrw: 2_000_000_000 });
    const r = computePatch({
      deals: [deal],
      seenKeys: new Set([dealKey(deal)]),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.major).toHaveLength(0);
  });

  it("pct·sampleCount — lookup 성공 시 채움, 실패 시 null(거래 이력 없음 신호)", () => {
    const r = computePatch({
      deals: [
        makeDeal({ apartmentName: "이력있음", priceKrw: 1_600_000_000 }), // 강남구 → lookup OK
        makeDeal({
          apartmentName: "신축첫거래",
          sigunguName: "이력없는구",
          priceKrw: 1_800_000_000,
          buildYear: 2026,
        }), // lookup null
      ],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    const known = r.major.find((m) => m.apt === "이력있음")!;
    expect(known.pct).toBeCloseTo(0.6, 5); // 16억 vs 중위 10억 (내부 필터 값)
    expect(known.sampleCount).toBe(30);
    expect(known.prevKrw).toBeNull(); // 직전 거래 없음
    const fresh = r.major.find((m) => m.apt === "신축첫거래")!;
    expect(fresh.pct).toBeNull();
    expect(fresh.sampleCount).toBeNull();
    expect(fresh.buildYear).toBe(2026);
  });

  it("major에도 직전 거래 팩트(prevKrw·prevDate·pctVsPrev)가 실린다", () => {
    const r = computePatch({
      deals: [
        prevDeal("대장주", 2_000_000_000, "2026-06-15"),
        makeDeal({ apartmentName: "대장주", priceKrw: 2_100_000_000 }),
      ],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.major).toHaveLength(1); // 기준 거래(6/15)는 스코프 밖 — fresh 아님
    expect(r.major[0].prevKrw).toBe(2_000_000_000);
    expect(r.major[0].prevDate).toBe("2026-06-15");
    expect(r.major[0].pctVsPrev).toBeCloseTo(0.05, 5);
  });

  it("기준점(2개월) — 자기 자신이 최고면 windowMax는 차순위(자기 제외) 거래", () => {
    const r = computePatch({
      deals: [
        prevDeal("신고가단지", 2_000_000_000, "2026-06-15"),
        makeDeal({ apartmentName: "신고가단지", priceKrw: 2_100_000_000 }), // 창 내 최고는 자기
      ],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    const m = r.major[0];
    expect(m.windowMaxKrw).toBe(2_000_000_000); // 자기 제외 최고 → 이번 거래(2.1억×10) ≥ 기준
    expect(m.windowMaxDate).toBe("2026-06-15");
    expect(m.refMaxPeriod).toBe("2개월");
  });

  it("기준점(2개월) — 창 안에 더 높은 과거 거래가 있으면 그 가격·날짜", () => {
    const r = computePatch({
      deals: [
        prevDeal("고점단지", 2_500_000_000, "2026-06-10"),
        prevDeal("고점단지", 2_000_000_000, "2026-06-15", 2),
        makeDeal({ apartmentName: "고점단지", priceKrw: 2_100_000_000 }),
      ],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    const m = r.major.find((x) => x.priceKrw === 2_100_000_000)!;
    expect(m.windowMaxKrw).toBe(2_500_000_000);
    expect(m.windowMaxDate).toBe("2026-06-10");
    expect(m.refMaxPeriod).toBe("2개월");
  });

  it("기준점 — 스냅샷 1년 최고가(maxKrw)가 있으면 우선, 라벨 '1년'·날짜 없음", () => {
    const maxLookup: ComplexMedianLookup = () => ({
      medianKrw: 2_000_000_000,
      sampleCount: 30,
      maxKrw: 2_400_000_000,
    });
    const r = computePatch({
      deals: [
        prevDeal("연최고단지", 2_000_000_000, "2026-06-15"),
        makeDeal({ apartmentName: "연최고단지", priceKrw: 2_100_000_000 }),
      ],
      seenKeys: new Set(),
      lookupMedian: maxLookup,
      todayISO: TODAY,
    });
    const m = r.major.find((x) => x.priceKrw === 2_100_000_000)!;
    expect(m.windowMaxKrw).toBe(2_400_000_000);
    expect(m.windowMaxDate).toBeNull();
    expect(m.refMaxPeriod).toBe("1년");
  });

  it("기준점 — 비교 대상이 전혀 없으면(신축 첫거래 등) null → UI 서브라인 생략", () => {
    const r = computePatch({
      deals: [
        makeDeal({
          apartmentName: "신축첫거래",
          sigunguName: "이력없는구", // lookup null → 스냅샷 maxKrw 없음
          priceKrw: 1_800_000_000,
        }),
      ],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    const m = r.major[0];
    expect(m.windowMaxKrw).toBeNull();
    expect(m.windowMaxDate).toBeNull();
    expect(m.refMaxPeriod).toBeNull();
  });

  it("좌표 — lookup 셀의 lat/lng가 major·nerf 아이템에 실리고, 미등재면 null", () => {
    const geoLookup: ComplexMedianLookup = (d) =>
      d.sigunguName === "강남구"
        ? { medianKrw: 1_500_000_000, sampleCount: 30, lat: 37.5172, lng: 127.0473 }
        : null;
    const r = computePatch({
      deals: [
        prevDeal("좌표단지", 1_500_000_000, "2026-06-15"),
        makeDeal({ apartmentName: "좌표단지", priceKrw: 1_700_000_000 }), // +13.3% → nerf·major
        makeDeal({
          apartmentName: "미등재단지",
          sigunguName: "이력없는구",
          priceKrw: 1_800_000_000,
        }),
      ],
      seenKeys: new Set(),
      lookupMedian: geoLookup,
      todayISO: TODAY,
    });
    const geo = r.major.find((m) => m.apt === "좌표단지")!;
    expect(geo.lat).toBeCloseTo(37.5172, 4);
    expect(geo.lng).toBeCloseTo(127.0473, 4);
    const none = r.major.find((m) => m.apt === "미등재단지")!;
    expect(none.lat).toBeNull();
    expect(none.lng).toBeNull();
    expect(r.nerf[0].lat).toBeCloseTo(37.5172, 4);
  });
});

// ── 오늘의 온도 — 직전 실거래 대비(팩트 기준) ─────────────────────────────────

describe("patchNote.computePatch — temp", () => {
  /** 단지마다 (6/15 기준 거래 1.0억×10) + (오늘 fresh 거래 price) 짝을 만든다. */
  function pairedDeals(
    n: number,
    priceOf: (i: number) => number,
    tag = "P",
  ): PatchDealInput[] {
    const out: PatchDealInput[] = [];
    for (let i = 0; i < n; i++) {
      out.push(prevDeal(`단지${tag}${i}`));
      out.push(
        makeDeal({ apartmentName: `단지${tag}${i}`, floor: i + 2, priceKrw: priceOf(i) }),
      );
    }
    return out;
  }

  it("직전 거래 대비 ±1% 이내는 중립(matched에만), 높게/낮게 집계", () => {
    // 20건: 10 높게(+5%), 6 낮게(−5%), 4 중립(+0.5%)
    const deals = [
      ...pairedDeals(10, () => 1_050_000_000, "위"),
      ...pairedDeals(6, () => 950_000_000, "아래"),
      ...pairedDeals(4, () => 1_005_000_000, "중립"),
    ];
    const r = computePatch({ deals, seenKeys: new Set(), lookupMedian: lookup, todayISO: TODAY });
    expect(r.temp).toEqual({ above: 10, below: 6, matched: 20 });
  });

  it("matched < 20이면 표본 부족 → null", () => {
    const deals = pairedDeals(PATCH_TEMP_MIN_MATCHED - 1, () => 1_050_000_000);
    const r = computePatch({ deals, seenKeys: new Set(), lookupMedian: lookup, todayISO: TODAY });
    expect(r.temp).toBeNull();
  });

  it("직전 거래가 없는 거래는 matched에 안 셈 (중위가 lookup 성공과 무관)", () => {
    const deals = [
      ...pairedDeals(20, () => 1_050_000_000),
      makeDeal({ apartmentName: "직전없음", priceKrw: 1_050_000_000 }), // lookup OK지만 prev 없음
    ];
    const r = computePatch({ deals, seenKeys: new Set(), lookupMedian: lookup, todayISO: TODAY });
    expect(r.temp?.matched).toBe(20);
  });
});

// ── [약세/강세 동네] — 시군구 평균 등락(직전 실거래 대비) 집계 ────────────────

describe("patchNote.computePatch — weakRegions / strongRegions", () => {
  // 동네 집계는 직전 거래 팩트 기준 — 중위가 lookup 불필요.
  const noLookup: ComplexMedianLookup = () => null;

  /** 시군구별 n개 단지 — 각 단지에 (6/15 기준 1.0억×10) + (오늘 price) 짝. */
  function guDeals(sigungu: string, n: number, priceKrw: number): PatchDealInput[] {
    const out: PatchDealInput[] = [];
    for (let i = 0; i < n; i++) {
      out.push(
        makeDeal({
          apartmentName: `${sigungu}단지${i}`,
          sigunguName: sigungu,
          dealDateISO: "2026-06-15",
          priceKrw: 1_000_000_000,
          floor: 1,
        }),
      );
      out.push(
        makeDeal({
          apartmentName: `${sigungu}단지${i}`,
          sigunguName: sigungu,
          floor: 2,
          priceKrw,
        }),
      );
    }
    return out;
  }

  it("count≥5 AND avgPct≤−1%만 약세 — 표본 4건·중립(±1% 미만) 동네는 제외", () => {
    const r = computePatch({
      deals: [
        ...guDeals("약세구", 6, 950_000_000), // 직전 대비 −5% × 6건 → 게재
        ...guDeals("표본부족구", 4, 900_000_000), // −10%지만 4건 → 제외
        ...guDeals("중립구", 5, 995_000_000), // −0.5% → 문턱 미달 제외
      ],
      seenKeys: new Set(),
      lookupMedian: noLookup,
      todayISO: TODAY,
    });
    expect(r.weakRegions).toHaveLength(1);
    expect(r.weakRegions[0].sigungu).toBe("약세구");
    expect(r.weakRegions[0].count).toBe(6);
    expect(r.weakRegions[0].avgPct).toBeCloseTo(-0.05, 10);
  });

  it("약세는 avgPct 오름차순(가장 약세부터)·상위 3개만", () => {
    const r = computePatch({
      deals: [
        ...guDeals("완만구", 5, 980_000_000), // −2%
        ...guDeals("급락구", 5, 900_000_000), // −10%
        ...guDeals("중간구", 5, 950_000_000), // −5%
        ...guDeals("꼴찌구", 5, 985_000_000), // −1.5% → 4위, 상위 3 컷
      ],
      seenKeys: new Set(),
      lookupMedian: noLookup,
      todayISO: TODAY,
    });
    expect(r.weakRegions.map((w) => w.sigungu)).toEqual(["급락구", "중간구", "완만구"]);
  });

  it("대칭 강세(avgPct≥+1%)는 strongRegions에 — 내림차순(가장 강세부터)", () => {
    const r = computePatch({
      deals: [
        ...guDeals("강세구", 5, 1_050_000_000), // +5%
        ...guDeals("더강세구", 5, 1_100_000_000), // +10%
        ...guDeals("약세구", 5, 950_000_000), // −5% → strong 아님
      ],
      seenKeys: new Set(),
      lookupMedian: noLookup,
      todayISO: TODAY,
    });
    expect(r.strongRegions.map((s) => s.sigungu)).toEqual(["더강세구", "강세구"]);
    expect(r.weakRegions.map((w) => w.sigungu)).toEqual(["약세구"]);
  });

  it("직거래·직전 거래 없는 거래는 동네 집계에 안 들어간다", () => {
    const 직거래표시 = guDeals("직거래구", 5, 800_000_000).map((d) =>
      d.floor === 2 ? { ...d, dealingGbn: "직거래" } : d,
    );
    const 직전없음 = Array.from({ length: 5 }, (_, i) =>
      makeDeal({
        apartmentName: `무이력단지${i}`,
        sigunguName: "무이력구",
        floor: i + 1,
        priceKrw: 800_000_000,
      }),
    );
    const r = computePatch({
      deals: [...guDeals("약세구", 5, 950_000_000), ...직거래표시, ...직전없음],
      seenKeys: new Set(),
      lookupMedian: noLookup,
      todayISO: TODAY,
    });
    expect(r.weakRegions.map((w) => w.sigungu)).toEqual(["약세구"]);
  });

  it("buff(하락 실명)는 데이터에 계속 남는다 — UI 비게재는 렌더 계층 책임", () => {
    const r = computePatch({
      deals: [makeDeal({ apartmentName: "급락단지", priceKrw: 880_000_000 })], // −12%
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.buff.map((i) => i.apt)).toEqual(["급락단지"]);
  });

  it("nerf 아이템에 lookup 셀의 maxKrw(1년 최고가)와 windowMaxKrw가 실린다", () => {
    const maxLookup: ComplexMedianLookup = (d) =>
      d.sigunguName === "강남구"
        ? { medianKrw: 1_000_000_000, sampleCount: 30, maxKrw: 1_100_000_000 }
        : null;
    const withMax = computePatch({
      deals: [
        prevDeal("갱신단지"),
        makeDeal({ apartmentName: "갱신단지", priceKrw: 1_150_000_000 }), // +15%
      ],
      seenKeys: new Set(),
      lookupMedian: maxLookup,
      todayISO: TODAY,
    });
    expect(withMax.nerf[0].maxKrw).toBe(1_100_000_000);
    expect(withMax.nerf[0].windowMaxKrw).toBe(1_000_000_000); // window 내 자기 제외 최고
    const without = computePatch({
      deals: [
        prevDeal("구스냅샷단지"),
        makeDeal({ apartmentName: "구스냅샷단지", priceKrw: 1_150_000_000 }),
      ],
      seenKeys: new Set(),
      lookupMedian: lookup, // maxKrw 미제공(구 스냅샷)
      todayISO: TODAY,
    });
    expect(without.nerf[0].maxKrw).toBeNull();
  });
});

// ── 오늘의 헤드라인 — 뉴스가치 사다리 (비교 문구는 전부 실거래 팩트) ──────────

describe("patchNote.pickHeadline", () => {
  function makeMajor(over: Partial<MajorItem> = {}): MajorItem {
    return {
      sigungu: "강남구",
      dong: "개포동",
      apt: "디에이치퍼스티어",
      areaM2: 84,
      priceKrw: 3_560_000_000,
      dealDate: "2026-07-02",
      pct: null,
      buildYear: 2024,
      sampleCount: null,
      ...over,
    };
  }
  function makeNerf(over: Partial<PatchItem> = {}): PatchItem {
    return {
      kind: "nerf",
      sigungu: "안양시 만안구",
      dong: "안양동",
      apt: "관악성원",
      areaM2: 59,
      band: "p18_25",
      priceKrw: 520_000_000,
      medianKrw: 415_000_000,
      pct: 0.252,
      dealDate: "2026-07-02",
      ...over,
    };
  }
  /** 직전 거래 팩트가 실린 너프 — 4.8억(6/25) → 5.2억 = +8.3%. */
  function makeNerfWithPrev(over: Partial<PatchItem> = {}): PatchItem {
    return makeNerf({
      prevKrw: 480_000_000,
      prevDate: "2026-06-25",
      pctVsPrev: (520_000_000 - 480_000_000) / 480_000_000,
      windowMaxKrw: 600_000_000, // 기본: 창 내 더 높은 거래 있음 → "두 달 내 최고가" 아님
      ...over,
    });
  }

  it("1순위 — 신축(기준연도−3 이내) 첫 실거래: 거래 이력 없음 + 15억 이상", () => {
    const h = pickHeadline({
      major: [makeMajor()],
      nerf: [makeNerfWithPrev()], // 너프가 있어도 첫거래가 이긴다
      newDealCount: 487,
      todayISO: "2026-07-04",
    });
    expect(h.kind).toBe("first-trade");
    expect(h.text).toBe("디에이치퍼스티어 입주 후 첫 실거래 — 35.6억 공개");
  });

  it("1순위 변형 — 표본 1~2면 'n번째 거래' (기존 표본 + 이번)", () => {
    const h = pickHeadline({
      major: [makeMajor({ sampleCount: 1, pct: 0.02 })],
      nerf: [],
      newDealCount: 100,
      todayISO: "2026-07-04",
    });
    expect(h.kind).toBe("first-trade");
    expect(h.text).toBe("디에이치퍼스티어 2번째 거래 35.6억");
  });

  it("구축(buildYear 오래됨)·표본 충분(≥3)은 첫거래 후보 아님", () => {
    const h = pickHeadline({
      major: [
        makeMajor({ buildYear: 2010 }), // 구축
        makeMajor({ apt: "표본충분", buildYear: 2025, sampleCount: 3 }), // 표본 3
      ],
      nerf: [],
      newDealCount: 100,
      todayISO: "2026-07-04",
    });
    expect(h.kind).toBe("top-major"); // 첫거래 건너뛰고 최고가로
  });

  it("첫거래 후보 여럿이면 가격 최고 채택", () => {
    const h = pickHeadline({
      major: [
        makeMajor({ apt: "싼신축", priceKrw: 1_600_000_000 }),
        makeMajor({ apt: "비싼신축", priceKrw: 4_000_000_000 }),
      ],
      nerf: [],
      newDealCount: 100,
      todayISO: "2026-07-04",
    });
    expect(h.text).toContain("비싼신축");
  });

  it("2순위 ① — 최근 1년 최고가(maxKrw) 갱신: 등락률은 최고가 대비 재계산", () => {
    // price 5.2억 vs maxKrw 5억 → (5.2−5)/5 = +4%
    const h = pickHeadline({
      major: [],
      nerf: [makeNerfWithPrev({ maxKrw: 500_000_000 })],
      newDealCount: 487,
      todayISO: "2026-07-04",
    });
    expect(h.kind).toBe("nerf");
    expect(h.text).toBe("안양시 만안구 관악성원, 최근 1년 최고가 4% 갱신 — 5.2억");
  });

  it("2순위 ② — 두 달(폴링창) 내 최고가: 직전 거래 날짜 병기", () => {
    const h = pickHeadline({
      major: [],
      nerf: [makeNerfWithPrev({ windowMaxKrw: 500_000_000 })], // 5.2억 > 창 내 최고 5억
      newDealCount: 487,
      todayISO: "2026-07-04",
    });
    expect(h.kind).toBe("nerf");
    expect(h.text).toBe(
      "안양시 만안구 관악성원, 두 달 내 최고가 — 직전 거래(6/25)보다 8.3% 높게 팔렸다",
    );
  });

  it("2순위 ③ — 직전 거래 대비: 날짜 병기 + 가격", () => {
    const h = pickHeadline({
      major: [],
      nerf: [makeNerfWithPrev()], // windowMax 6억 > 5.2억 → 최고가 아님, 직전 대비로
      newDealCount: 487,
      todayISO: "2026-07-04",
    });
    expect(h.kind).toBe("nerf");
    expect(h.text).toBe(
      "안양시 만안구 관악성원, 직전 거래(6/25)보다 8.3% 높게 팔렸다 — 5.2억",
    );
  });

  it("2순위 ④ — 비교 팩트 없는 후보는 스킵하고 다음 후보로", () => {
    const h = pickHeadline({
      major: [],
      nerf: [
        makeNerf(), // 구 스키마 — prev·maxKrw 없음 → 스킵
        makeNerfWithPrev({ apt: "팩트단지" }),
      ],
      newDealCount: 487,
      todayISO: "2026-07-04",
    });
    expect(h.kind).toBe("nerf");
    expect(h.text).toContain("팩트단지, 직전 거래(6/25)보다");
  });

  it("2순위 전멸(전부 팩트 없음)이면 다음 rung(최고가)로 내려간다", () => {
    const h = pickHeadline({
      major: [makeMajor({ buildYear: 2010 })],
      nerf: [makeNerf(), makeNerf({ apt: "팩트없음2" })],
      newDealCount: 487,
      todayISO: "2026-07-04",
    });
    expect(h.kind).toBe("top-major");
  });

  it("후보 순서 우선 — 입력(pctVsPrev 내림차순) 첫 팩트 후보가 이긴다", () => {
    const h = pickHeadline({
      major: [],
      nerf: [
        makeNerfWithPrev({ apt: "일등단지" }),
        makeNerfWithPrev({ apt: "이등단지" }),
      ],
      newDealCount: 487,
      todayISO: "2026-07-04",
    });
    expect(h.text).toContain("일등단지");
  });

  it("3순위 — 이탈 없으면 오늘의 최고가(major[0])", () => {
    const h = pickHeadline({
      major: [makeMajor({ buildYear: 2010 })],
      nerf: [],
      newDealCount: 487,
      todayISO: "2026-07-04",
    });
    expect(h.kind).toBe("top-major");
    expect(h.text).toBe("오늘 공개 최고가 — 디에이치퍼스티어 35.6억");
  });

  it("4순위 폴백 — 아무것도 없으면 '판을 흔든 거래 없음' ('시세' 단어 금지)", () => {
    const h = pickHeadline({ major: [], nerf: [], newDealCount: 487, todayISO: "2026-07-04" });
    expect(h.kind).toBe("none");
    expect(h.text).toBe("오늘 공개 487건 — 판을 흔든 거래는 없었다");
  });

  it("하락(버프)은 어떤 경우에도 헤드라인 금지 — 입력 자체를 안 받는다", () => {
    // pickHeadline 시그니처에 buff가 없음을 타입으로 보증 + 폴백 동작 확인.
    const h = pickHeadline({ major: [], nerf: [], newDealCount: 3, todayISO: "2026-07-04" });
    expect(h.kind).toBe("none");
  });
});

// ── [오늘의 해제] ① — seen 재설계·wasTopInWindow (v2.3) ───────────────────────

describe("patchNote.computePatch — cancellations · seen 재설계", () => {
  it("처음 확인된 해제는 cancellations에 실리고, seen 키(해제 구분)에도 들어간다", () => {
    const cxl = makeDeal({ apartmentName: "해제단지", priceKrw: 1_200_000_000, canceled: true });
    const r = computePatch({
      deals: [cxl],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.cancellations.map((c) => c.apt)).toEqual(["해제단지"]);
    expect(r.cancellations[0].priceKrw).toBe(1_200_000_000);
    expect(r.cancellations[0].dealDate).toBe("2026-07-01");
    // seen엔 해제 상태 구분 키로 저장 — 유효 키와 별개.
    expect(r.nextSeenKeys).toContain(seenKeyOf(cxl));
    expect(seenKeyOf(cxl)).not.toBe(dealKey(cxl));
  });

  it("해제는 다음 폴링부터 seen에 잡혀 매일 '신규 해제'로 재등장하지 않는다(버그 수정)", () => {
    const cxl = makeDeal({ apartmentName: "재등장금지", priceKrw: 1_200_000_000, canceled: true });
    const day1 = computePatch({
      deals: [cxl],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(day1.cancellations).toHaveLength(1);
    const day2 = computePatch({
      deals: [cxl],
      seenKeys: new Set(day1.nextSeenKeys),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(day2.cancellations).toHaveLength(0);
  });

  it("유효로 공개됐다가(seen) 해제로 전환되면 — 그때 딱 한 번 '오늘 처음 확인된 해제'", () => {
    const asValid = makeDeal({ apartmentName: "전환단지", priceKrw: 1_300_000_000 });
    const asCanceled = { ...asValid, canceled: true };
    // 어제까지는 유효로 seen에 있었음
    const seenYesterday = new Set([dealKey(asValid)]);
    const r = computePatch({
      deals: [asCanceled],
      seenKeys: seenYesterday,
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.cancellations.map((c) => c.apt)).toEqual(["전환단지"]);
    // 다음 날부터는 해제 키가 seen에 있어 재등장 안 함
    const r2 = computePatch({
      deals: [asCanceled],
      seenKeys: new Set(r.nextSeenKeys),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r2.cancellations).toHaveLength(0);
  });

  it("스코프(14일) 밖 계약일의 해제도 감지한다 — 해제 감시는 window 전역", () => {
    const oldCxl = makeDeal({
      apartmentName: "묵은해제",
      dealDateISO: "2026-06-01", // 33일 전 — 분석 스코프 밖
      priceKrw: 1_100_000_000,
      canceled: true,
    });
    const r = computePatch({
      deals: [oldCxl],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.scopeDealCount).toBe(0); // 분석 scope는 계속 canceled·스코프 밖 제외
    expect(r.cancellations.map((c) => c.apt)).toEqual(["묵은해제"]);
    expect(r.nextSeenKeys).toContain(seenKeyOf(oldCxl)); // 내일 재등장 방지
  });

  it("초저가(지분성 의심) 해제는 코너에서 컷", () => {
    const r = computePatch({
      deals: [makeDeal({ apartmentName: "지분해제", priceKrw: 30_000_000, canceled: true })],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.cancellations).toHaveLength(0);
  });

  it("wasTopInWindow — window 내 다른 유효 거래 '전부'보다 높았을 때만 true", () => {
    const valid1 = makeDeal({ apartmentName: "감시단지", priceKrw: 1_000_000_000, floor: 3 });
    const valid2 = makeDeal({ apartmentName: "감시단지", priceKrw: 1_100_000_000, floor: 7 });
    const topCxl = makeDeal({
      apartmentName: "감시단지",
      priceKrw: 1_200_000_000,
      floor: 15,
      canceled: true,
    });
    const midCxl = makeDeal({
      apartmentName: "감시단지",
      priceKrw: 1_050_000_000,
      floor: 9,
      canceled: true,
    });
    const r = computePatch({
      deals: [valid1, valid2, topCxl, midCxl],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.cancellations).toHaveLength(2);
    const top = r.cancellations.find((c) => c.priceKrw === 1_200_000_000)!;
    const mid = r.cancellations.find((c) => c.priceKrw === 1_050_000_000)!;
    expect(top.wasTopInWindow).toBe(true); // 1.0·1.1억×10 전부보다 높음
    expect(mid.wasTopInWindow).toBe(false); // 1.1억×10보다 낮음
    // 정렬 — wasTop 우선
    expect(r.cancellations[0].wasTopInWindow).toBe(true);
  });

  it("wasTopInWindow — 비교할 유효 거래가 없으면 false(공허한 최고가 주장 금지), 동가도 false", () => {
    const lonely = makeDeal({ apartmentName: "유일해제", priceKrw: 1_200_000_000, canceled: true });
    const tieValid = makeDeal({ apartmentName: "동가단지", priceKrw: 1_200_000_000, floor: 3 });
    const tieCxl = makeDeal({
      apartmentName: "동가단지",
      priceKrw: 1_200_000_000,
      floor: 10,
      canceled: true,
    });
    const r = computePatch({
      deals: [lonely, tieValid, tieCxl],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.cancellations.find((c) => c.apt === "유일해제")!.wasTopInWindow).toBe(false);
    expect(r.cancellations.find((c) => c.apt === "동가단지")!.wasTopInWindow).toBe(false);
  });

  it("해제 자기들끼리는 비교 기준이 아니다 — 유효 거래(timeline)만 기준", () => {
    // 더 비싼 '해제' 거래가 있어도, 유효 거래 전부보다 높으면 wasTop true.
    const r = computePatch({
      deals: [
        makeDeal({ apartmentName: "혼합단지", priceKrw: 1_000_000_000, floor: 3 }),
        makeDeal({ apartmentName: "혼합단지", priceKrw: 1_500_000_000, floor: 20, canceled: true }),
        makeDeal({ apartmentName: "혼합단지", priceKrw: 1_200_000_000, floor: 11, canceled: true }),
      ],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    const low = r.cancellations.find((c) => c.priceKrw === 1_200_000_000)!;
    expect(low.wasTopInWindow).toBe(true); // 유효 1.0억×10보다 높음 — 해제 1.5억×10은 기준 아님
  });
});

// ── [오늘 최다 공개 동네] ② (v2.3) ────────────────────────────────────────────

describe("patchNote.computePatch — busiestRegions", () => {
  const noLookup: ComplexMedianLookup = () => null;
  /** 시군구에 fresh 유효 거래 n건 생성 (층으로 dealKey 구분). */
  function freshIn(sigungu: string, n: number): PatchDealInput[] {
    return Array.from({ length: n }, (_, i) =>
      makeDeal({ apartmentName: `${sigungu}단지${i}`, sigunguName: sigungu, floor: i + 1 }),
    );
  }

  it("fresh 유효 거래 시군구 집계 — count≥3만, 내림차순 상위 3", () => {
    const r = computePatch({
      deals: [
        ...freshIn("화성시 동탄구", 18),
        ...freshIn("강남구", 9),
        ...freshIn("송파구", 7),
        ...freshIn("노원구", 5), // 4위 — 상위 3 컷
        ...freshIn("과천시", 2), // count<3 — 컷
      ],
      seenKeys: new Set(),
      lookupMedian: noLookup,
      todayISO: TODAY,
    });
    expect(r.busiestRegions).toEqual([
      { sigungu: "화성시 동탄구", count: 18 },
      { sigungu: "강남구", count: 9 },
      { sigungu: "송파구", count: 7 },
    ]);
    void PATCH_BUSIEST_MIN_COUNT;
    void PATCH_BUSIEST_TOP_N;
  });

  it("seen(이미 확인)·해제 거래는 집계에 안 들어간다 — fresh 유효만", () => {
    const seenDeal = makeDeal({ apartmentName: "어제확인", sigunguName: "강남구", floor: 99 });
    const r = computePatch({
      deals: [
        ...freshIn("강남구", 2), // fresh 2건 + seen 1건 → 3 미달
        seenDeal,
        makeDeal({ apartmentName: "해제건", sigunguName: "강남구", floor: 98, canceled: true }),
      ],
      seenKeys: new Set([dealKey(seenDeal)]),
      lookupMedian: noLookup,
      todayISO: TODAY,
    });
    expect(r.busiestRegions).toEqual([]);
  });
});

// ── 주말 저볼륨 폴백 ④ — merged 합산 (v2.3) ───────────────────────────────────

describe("patchNote — subtractRecentFromSeen (merged 폴백)", () => {
  it("최근 항목(freshDeals)을 seen에서 빼면 코너(강세·해제)가 합산분으로 복원된다", () => {
    const base = prevDeal("합산단지"); // 6/15 기준 거래(스코프 밖 — fresh 아님)
    const d1 = makeDeal({
      apartmentName: "합산단지",
      dealDateISO: "2026-07-01",
      priceKrw: 1_120_000_000,
    });
    const cxl = makeDeal({ apartmentName: "합산해제", priceKrw: 1_200_000_000, canceled: true });

    // 어제(7/3) 실행 — d1·cxl이 fresh
    const day1 = computePatch({
      deals: [base, d1, cxl],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: "2026-07-03",
    });
    expect(day1.nerf).toHaveLength(1);
    expect(day1.cancellations).toHaveLength(1);
    expect(day1.freshDeals.map((d) => d.apartmentName).sort()).toEqual([
      "합산단지",
      "합산해제",
    ]);

    // 오늘(7/4) 실행 — 신규 없음 → 코너 전멸
    const day2 = computePatch({
      deals: [base, d1, cxl],
      seenKeys: new Set(day1.nextSeenKeys),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(day2.newDealCount).toBe(0);
    expect(day2.nerf).toHaveLength(0);
    expect(day2.cancellations).toHaveLength(0);

    // merged — 어제 fresh를 seen에서 차감하고 재계산 → 합산 코너 복원
    const merged = computePatch({
      deals: [base, d1, cxl],
      seenKeys: subtractRecentFromSeen(new Set(day1.nextSeenKeys), day1.freshDeals),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(merged.newDealCount).toBe(1);
    expect(merged.nerf.map((i) => i.apt)).toEqual(["합산단지"]);
    expect(merged.nerf[0].dealDate).toBe("2026-07-01"); // 개별 아이템 날짜는 그대로 병기
    expect(merged.cancellations.map((c) => c.apt)).toEqual(["합산해제"]);
  });

  it("차감은 원본 seen을 변경하지 않는다(순수)", () => {
    const d = makeDeal({});
    const seen = new Set([dealKey(d), "다른키"]);
    const out = subtractRecentFromSeen(seen, [d]);
    expect(out.has(dealKey(d))).toBe(false);
    expect(seen.has(dealKey(d))).toBe(true);
    expect(out.has("다른키")).toBe(true);
  });
});

// ── 층·역거리 태그 ③ (v2.3) ───────────────────────────────────────────────────

describe("patchNote.computePatch — floor·nearestSubwayM 전파", () => {
  const subwayLookup: ComplexMedianLookup = (d) =>
    d.sigunguName === "강남구"
      ? { medianKrw: 1_000_000_000, sampleCount: 30, nearestSubwayM: 350 }
      : null;

  it("nerf·major·cancellations 아이템에 floor·nearestSubwayM이 실린다", () => {
    const r = computePatch({
      deals: [
        prevDeal("역세권단지"), // 84㎡ 밴드 기준 거래(6/15 · 1.0억×10)
        makeDeal({ apartmentName: "역세권단지", priceKrw: 1_120_000_000, floor: 12 }), // +12% → nerf
        // 다른 밴드(120㎡ = over45) — 위 84㎡ 밴드의 직전 거래 비교를 오염시키지 않음.
        makeDeal({ apartmentName: "역세권단지", area: 120, priceKrw: 1_600_000_000, floor: 20 }), // major
        makeDeal({ apartmentName: "역세권단지", priceKrw: 1_150_000_000, floor: 5, canceled: true }),
      ],
      seenKeys: new Set(),
      lookupMedian: subwayLookup,
      todayISO: TODAY,
    });
    expect(r.nerf.map((i) => i.apt)).toEqual(["역세권단지"]);
    expect(r.nerf[0].floor).toBe(12);
    expect(r.nerf[0].nearestSubwayM).toBe(350);
    const m = r.major.find((x) => x.priceKrw === 1_600_000_000)!;
    expect(m.floor).toBe(20);
    expect(m.nearestSubwayM).toBe(350);
    expect(r.cancellations[0].floor).toBe(5);
    expect(r.cancellations[0].nearestSubwayM).toBe(350);
  });

  it("lookup 실패(스냅샷 미등재)·층 미제공이면 null", () => {
    const r = computePatch({
      deals: [
        makeDeal({
          apartmentName: "미등재해제",
          sigunguName: "이력없는구",
          priceKrw: 1_200_000_000,
          floor: null,
          canceled: true,
        }),
      ],
      seenKeys: new Set(),
      lookupMedian: subwayLookup,
      todayISO: TODAY,
    });
    expect(r.cancellations[0].floor).toBeNull();
    expect(r.cancellations[0].nearestSubwayM).toBeNull();
  });
});

// ── 헤드라인 묶음 ⑤ — 톱 1 + 서브 3 (v2.3) ────────────────────────────────────

describe("patchNote.pickHeadlines", () => {
  /** 직전 거래 팩트가 실린 너프 생성기 — 세그먼트 조합용. */
  function nerfOf(over: Partial<PatchItem> & { apt: string }): PatchItem {
    const priceKrw = over.priceKrw ?? 520_000_000;
    const prevKrw = over.prevKrw ?? Math.round(priceKrw / 1.083);
    return {
      kind: "nerf",
      sigungu: "안양시 만안구",
      dong: "안양동",
      areaM2: 59,
      band: "p18_25",
      medianKrw: prevKrw,
      pct: 0.1,
      dealDate: "2026-07-02",
      prevDate: "2026-06-25",
      windowMaxKrw: priceKrw * 2, // 기본: 창 내 최고가 아님 → "직전 거래 대비" rung
      ...over,
      priceKrw,
      prevKrw,
      pctVsPrev: (priceKrw - prevKrw) / prevKrw,
    };
  }

  it("top은 pickHeadline과 동일한 사다리 결과", () => {
    const nerfs = [
      nerfOf({ apt: "서울일등", sigungu: "강남구", priceKrw: 2_000_000_000 }),
      nerfOf({ apt: "경기이등", sigungu: "수원시 장안구", priceKrw: 700_000_000 }),
    ];
    const single = pickHeadline({ major: [], nerf: nerfs, newDealCount: 100, todayISO: TODAY });
    const bundle = pickHeadlines({ major: [], nerf: nerfs, newDealCount: 100, todayISO: TODAY });
    expect(bundle.top).toEqual(single);
    expect(bundle.top.text).toContain("서울일등");
  });

  it("세그먼트 3종 — [서울]·[경기·인천]·[9억 이하] 각각 자기 사다리 1픽", () => {
    const bundle = pickHeadlines({
      major: [],
      nerf: [
        nerfOf({ apt: "서울톱", sigungu: "강남구", priceKrw: 2_000_000_000 }), // top이 됨
        nerfOf({ apt: "서울차선", sigungu: "노원구", priceKrw: 1_000_000_000 }),
        nerfOf({ apt: "경기대표", sigungu: "수원시 장안구", priceKrw: 700_000_000 }),
      ],
      newDealCount: 100,
      todayISO: TODAY,
    });
    expect(bundle.top.text).toContain("서울톱");
    const byLabel = Object.fromEntries(bundle.subs.map((s) => [s.label, s.text]));
    // [서울] — 톱과 동일 아이템(서울톱) 회피 → 차순위 '서울차선'
    expect(byLabel["서울"]).toContain("서울차선");
    // [경기·인천] — 서울 외
    expect(byLabel["경기·인천"]).toContain("경기대표");
    // [9억 이하] — 7억 거래
    expect(byLabel["9억 이하"]).toContain("경기대표");
    expect(bundle.subs).toHaveLength(3);
  });

  it("톱과 동일 아이템 회피 — 세그먼트에 차순위가 없으면 그 서브는 생략", () => {
    const bundle = pickHeadlines({
      major: [],
      nerf: [nerfOf({ apt: "유일단지", sigungu: "강남구", priceKrw: 2_000_000_000 })],
      newDealCount: 100,
      todayISO: TODAY,
    });
    expect(bundle.top.text).toContain("유일단지");
    // 서울 세그 후보 = 톱과 동일 아이템뿐 → 생략. 경기·9억 이하는 후보 자체가 없음 → 생략.
    expect(bundle.subs).toHaveLength(0);
  });

  it("팩트 후보 없는 세그먼트는 생략 — 서울만 있으면 서브는 서울 계열만", () => {
    const bundle = pickHeadlines({
      major: [],
      nerf: [
        nerfOf({ apt: "강남A", sigungu: "강남구", priceKrw: 2_000_000_000 }),
        nerfOf({ apt: "강남B", sigungu: "서초구", priceKrw: 1_800_000_000 }),
      ],
      newDealCount: 100,
      todayISO: TODAY,
    });
    const labels = bundle.subs.map((s) => s.label);
    expect(labels).toEqual(["서울"]); // 경기·인천 후보 없음, 9억 이하 후보 없음
    expect(bundle.subs[0].text).toContain("강남B");
  });

  it("서브의 kind도 사다리 그대로 — 9억 이하 세그에 major는 없으니(15억 하한) nerf rung만", () => {
    const bundle = pickHeadlines({
      major: [],
      nerf: [
        nerfOf({ apt: "서울톱", sigungu: "강남구", priceKrw: 2_000_000_000 }), // top 차지
        nerfOf({ apt: "구억이하", sigungu: "수원시 장안구", priceKrw: 700_000_000 }),
      ],
      newDealCount: 100,
      todayISO: TODAY,
    });
    const cheap = bundle.subs.find((s) => s.label === "9억 이하");
    expect(cheap?.kind).toBe("nerf");
    expect(cheap?.text).toContain("구억이하");
  });

  it("아무 후보도 없으면 top은 기존 폴백('판을 흔든 거래는 없었다'), subs는 []", () => {
    const bundle = pickHeadlines({ major: [], nerf: [], newDealCount: 42, todayISO: TODAY });
    expect(bundle.top.kind).toBe("none");
    expect(bundle.top.text).toBe("오늘 공개 42건 — 판을 흔든 거래는 없었다");
    expect(bundle.subs).toEqual([]);
  });
});
