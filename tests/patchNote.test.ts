import { describe, it, expect } from "vitest";
import {
  computePatch,
  dealKey,
  PATCH_SCOPE_DAYS,
  PATCH_TOP_N,
  type PatchDealInput,
  type ComplexMedianLookup,
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
});
