import { describe, it, expect } from "vitest";
import {
  computePatch,
  dealKey,
  pickHeadline,
  PATCH_SCOPE_DAYS,
  PATCH_TOP_N,
  PATCH_MAJOR_MIN_PRICE_KRW,
  PATCH_TEMP_MIN_MATCHED,
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

// 강남구 소재 단지는 자기 중위가 10억, 표본 충분 — 단순 스텁 (단지 자기 시세 기준)
const lookup: ComplexMedianLookup = (d) =>
  d.sigunguName === "강남구"
    ? { medianKrw: 1_000_000_000, sampleCount: 30 }
    : null;

describe("patchNote.computePatch", () => {
  it("단지 시세 +7% 이상 신규 거래는 너프, -7% 이하는 버프", () => {
    const r = computePatch({
      deals: [
        makeDeal({ apartmentName: "급등단지", priceKrw: 1_120_000_000 }), // +12%
        makeDeal({ apartmentName: "급락단지", priceKrw: 880_000_000 }), // -12%
        makeDeal({ apartmentName: "평범단지", priceKrw: 1_020_000_000 }), // +2% → 제외
      ],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.nerf.map((i) => i.apt)).toEqual(["급등단지"]);
    expect(r.buff.map((i) => i.apt)).toEqual(["급락단지"]);
    expect(r.nerf[0].pct).toBeCloseTo(0.12, 5);
    expect(r.buff[0].pct).toBeCloseTo(-0.12, 5);
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
    expect(r.nextSeenKeys).toHaveLength(0);
  });

  it("스코프 경계: 정확히 14일 전은 포함", () => {
    const edge = makeDeal({
      dealDateISO: "2026-06-20", // 딱 14일 전
      priceKrw: 1_150_000_000,
    });
    const r = computePatch({
      deals: [edge],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    expect(r.scopeDealCount).toBe(1);
    expect(r.nerf).toHaveLength(1);
    void PATCH_SCOPE_DAYS; // 문서화용 상수 참조
  });

  it("노이즈 컷: ±35% 초과 괴리·표본 부족·초저가는 제외", () => {
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

  it("같은 단지×평형은 |pct| 최대 1건만, 각 리스트 상위 N건 제한", () => {
    const many: PatchDealInput[] = [];
    // 같은 단지 3건 — 대표 1건만 남아야 함
    for (const [floor, price] of [
      [3, 1_080_000_000],
      [15, 1_140_000_000], // |pct| 최대 → 대표
      [7, 1_100_000_000],
    ] as const) {
      many.push(makeDeal({ apartmentName: "도배단지", floor, priceKrw: price }));
    }
    // 서로 다른 단지 7건 — TOP_N(5) 컷 확인
    for (let i = 0; i < 7; i++) {
      many.push(
        makeDeal({
          apartmentName: `단지${i}`,
          priceKrw: 1_080_000_000 + i * 10_000_000,
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
    const 도배 = r.nerf.filter((i) => i.apt === "도배단지");
    expect(도배).toHaveLength(1);
    expect(도배[0].priceKrw).toBe(1_140_000_000);
    // 정렬: |pct| 내림차순
    const pcts = r.nerf.map((i) => Math.abs(i.pct));
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
      deals: [direct, canceledDeal, normal],
      seenKeys: new Set(),
      lookupMedian: lookup,
      todayISO: TODAY,
    });
    // 해제는 스코프 밖, 직거래·정상은 스코프 안
    expect(r.scopeDealCount).toBe(2);
    // 분류는 정상 중개거래만
    expect(r.buff).toHaveLength(0);
    expect(r.nerf.map((i) => i.apt)).toEqual(["정상중개단지"]);
    // 직거래도 seen엔 남아 내일 중복 등장 방지
    expect(r.nextSeenKeys).toContain(dealKey(direct));
  });

  it("scopeDays 오버라이드(창간호 3일): 3일 밖 거래는 제외, 안은 포함", () => {
    const inside = makeDeal({
      apartmentName: "창간호단지",
      dealDateISO: "2026-07-02", // 2일 전
      priceKrw: 1_150_000_000,
    });
    const outside = makeDeal({
      apartmentName: "스코프밖단지",
      dealDateISO: "2026-06-28", // 6일 전 — 기본 14일엔 들지만 3일엔 제외
      priceKrw: 1_150_000_000,
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
  });

  it("dealKey는 층·가격까지 포함해 같은 날 같은 단지의 다른 거래를 구분", () => {
    const a = makeDeal({ floor: 3 });
    const b = makeDeal({ floor: 20 });
    expect(dealKey(a)).not.toBe(dealKey(b));
  });

  it("비대칭 노이즈 컷 — 상승은 +35%까지, 하락은 −30%까지만 코너 게재", () => {
    const r = computePatch({
      deals: [
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

  it("pct·sampleCount — lookup 성공 시 채움, 실패 시 null(시세 이력 없음 신호)", () => {
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
    expect(known.pct).toBeCloseTo(0.6, 5); // 16억 vs 중위 10억
    expect(known.sampleCount).toBe(30);
    const fresh = r.major.find((m) => m.apt === "신축첫거래")!;
    expect(fresh.pct).toBeNull();
    expect(fresh.sampleCount).toBeNull();
    expect(fresh.buildYear).toBe(2026);
  });
});

// ── 오늘의 온도 — fresh 중개거래의 자기 시세 위:아래 ──────────────────────────

describe("patchNote.computePatch — temp", () => {
  function bulkDeals(n: number, priceOf: (i: number) => number): PatchDealInput[] {
    return Array.from({ length: n }, (_, i) =>
      makeDeal({ apartmentName: `단지${i}`, floor: i + 1, priceKrw: priceOf(i) }),
    );
  }

  it("±1% 이내는 중립(matched에만), 위/아래 집계", () => {
    // 30건: 12 위(+5%), 10 아래(−5%), 8 중립(±0.5%)
    const deals = [
      ...bulkDeals(12, () => 1_050_000_000),
      ...bulkDeals(10, () => 950_000_000).map((d, i) => ({ ...d, apartmentName: `아래${i}` })),
      ...bulkDeals(8, () => 1_005_000_000).map((d, i) => ({ ...d, apartmentName: `중립${i}` })),
    ];
    const r = computePatch({ deals, seenKeys: new Set(), lookupMedian: lookup, todayISO: TODAY });
    expect(r.temp).toEqual({ above: 12, below: 10, matched: 30 });
  });

  it("matched < 30이면 표본 부족 → null", () => {
    const deals = bulkDeals(PATCH_TEMP_MIN_MATCHED - 1, () => 1_050_000_000);
    const r = computePatch({ deals, seenKeys: new Set(), lookupMedian: lookup, todayISO: TODAY });
    expect(r.temp).toBeNull();
  });

  it("lookup 실패 거래는 matched에 안 셈", () => {
    const deals = [
      ...bulkDeals(30, () => 1_050_000_000),
      makeDeal({ apartmentName: "이력없음", sigunguName: "이력없는구", priceKrw: 1_050_000_000 }),
    ];
    const r = computePatch({ deals, seenKeys: new Set(), lookupMedian: lookup, todayISO: TODAY });
    expect(r.temp?.matched).toBe(30);
  });
});

// ── 오늘의 헤드라인 — 뉴스가치 사다리 ─────────────────────────────────────────

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

  it("1순위 — 신축(기준연도−3 이내) 첫 실거래: 시세 이력 없음 + 15억 이상", () => {
    const h = pickHeadline({
      major: [makeMajor()],
      nerf: [makeNerf()], // 너프가 있어도 첫거래가 이긴다
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

  it("2순위 — 신고가성 상승 이탈: pct × log10(price) 스코어 최대", () => {
    // 이탈률은 작아도 체급이 크면 이길 수 있는 가중 확인:
    // A: 25.2% × log10(5.2억) ≈ 2.20 · B: 24% × log10(52억) ≈ 2.33 → B
    const h = pickHeadline({
      major: [],
      nerf: [
        makeNerf(),
        makeNerf({ sigungu: "서초구", apt: "체급단지", priceKrw: 5_200_000_000, pct: 0.24 }),
      ],
      newDealCount: 487,
      todayISO: "2026-07-04",
    });
    expect(h.kind).toBe("nerf");
    expect(h.text).toBe("서초구 체급단지, 자기 시세를 24% 웃돌았다 — 52억");
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

  it("4순위 폴백 — 아무것도 없으면 '흔든 거래 없음'", () => {
    const h = pickHeadline({ major: [], nerf: [], newDealCount: 487, todayISO: "2026-07-04" });
    expect(h.kind).toBe("none");
    expect(h.text).toBe("오늘 공개 487건 — 시세를 흔든 거래는 없었다");
  });

  it("하락(버프)은 어떤 경우에도 헤드라인 금지 — 입력 자체를 안 받는다", () => {
    // pickHeadline 시그니처에 buff가 없음을 타입으로 보증 + 폴백 동작 확인.
    const h = pickHeadline({ major: [], nerf: [], newDealCount: 3, todayISO: "2026-07-04" });
    expect(h.kind).toBe("none");
  });
});
