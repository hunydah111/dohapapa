// [최근 거래 상위] — 시군구 × 평형 밴드(59㎡급/84㎡급) 최근 60일 TOP10 순수 함수 검증.
// 크론(scripts/build-region-series.ts)과 동네면이 같은 규칙을 공유한다.
import { describe, expect, it } from "vitest";
import {
  REGION_TOP_BANDS,
  REGION_TOP_LIMIT,
  REGION_TOP_WINDOW_DAYS,
  buildRegionTop,
  orderedBandKeys,
  type RegionTopTx,
} from "@/lib/regionTop";

const WINDOW_START = "2026-05-07"; // 창 시작(포함)

let seq = 0;
function tx(overrides: Partial<RegionTopTx> = {}): RegionTopTx {
  seq += 1;
  return {
    id: `t${seq}`,
    complexId: "cx1",
    sigungu: "마포구",
    dong: "아현동",
    apt: "마포래미안푸르지오",
    areaM2: 84.9, // p32_35 밴드
    priceKrw: 1_800_000_000,
    dealDateISO: "2026-06-01",
    floor: 12,
    ...overrides,
  };
}

describe("regionTop.buildRegionTop", () => {
  it("밴드 상수 — 59㎡급=p19_25 · 84㎡급=p32_35 (기존 AreaRangeKey 체계 재사용)", () => {
    expect(REGION_TOP_BANDS.map((b) => b.key)).toEqual(["p19_25", "p32_35"]);
    expect(REGION_TOP_BANDS.map((b) => b.label)).toEqual(["59㎡급", "84㎡급"]);
    expect(REGION_TOP_WINDOW_DAYS).toBe(60);
    expect(REGION_TOP_LIMIT).toBe(10);
  });

  it("단지당 대표 1건 — 창 내 최신 계약, 같은 날이면 최고가", () => {
    const out = buildRegionTop(
      [
        tx({ dealDateISO: "2026-05-20", priceKrw: 1_700_000_000 }),
        tx({ dealDateISO: "2026-06-10", priceKrw: 1_750_000_000, floor: 3 }),
        tx({ dealDateISO: "2026-06-10", priceKrw: 1_820_000_000, floor: 20 }), // 같은 날 최고가
      ],
      WINDOW_START,
    );
    const items = out["마포구"].p32_35!.items;
    expect(items).toHaveLength(1); // 단지당 1건
    expect(items[0].priceKrw).toBe(1_820_000_000);
    expect(items[0].dealDate).toBe("2026-06-10");
    expect(items[0].floor).toBe(20);
  });

  it("직전 거래(60일 내·자기 제외)를 prevKrw/prevDate로 병기 — 없으면 null", () => {
    const out = buildRegionTop(
      [
        tx({ dealDateISO: "2026-05-01", priceKrw: 1_600_000_000 }), // 창 밖 — 직전 후보로만
        tx({ dealDateISO: "2026-06-15", priceKrw: 1_800_000_000 }),
        tx({ complexId: "cx2", apt: "외딴단지", dealDateISO: "2026-06-01", priceKrw: 900_000_000, areaM2: 59.9 }),
      ],
      WINDOW_START,
    );
    const rep = out["마포구"].p32_35!.items[0];
    expect(rep.prevKrw).toBe(1_600_000_000);
    expect(rep.prevDate).toBe("2026-05-01");
    const lone = out["마포구"].p19_25!.items[0];
    expect(lone.prevKrw).toBeNull();
    expect(lone.prevDate).toBeNull();
  });

  it("직전 거래가 60일보다 묵었으면 무효(null) — patchNote 규칙 동일", () => {
    const out = buildRegionTop(
      [
        tx({ dealDateISO: "2026-04-01", priceKrw: 1_500_000_000 }), // 대표(6/15)에서 75일 전
        tx({ dealDateISO: "2026-06-15", priceKrw: 1_800_000_000 }),
      ],
      WINDOW_START,
    );
    const rep = out["마포구"].p32_35!.items[0];
    expect(rep.prevKrw).toBeNull();
  });

  it("가격 내림차순 상위 10 — 11개 단지면 최저가가 잘린다", () => {
    const rows = Array.from({ length: 11 }, (_, i) =>
      tx({
        complexId: `cx${i}`,
        apt: `단지${i}`,
        priceKrw: 1_000_000_000 + i * 10_000_000,
        dealDateISO: "2026-06-20",
      }),
    );
    const out = buildRegionTop(rows, WINDOW_START);
    const items = out["마포구"].p32_35!.items;
    expect(items).toHaveLength(10);
    expect(items[0].priceKrw).toBe(1_100_000_000); // 최고가가 1위
    // 최저가(10.0억)는 탈락.
    expect(items.some((r) => r.priceKrw === 1_000_000_000)).toBe(false);
    // 내림차순 정렬.
    for (let i = 1; i < items.length; i++) {
      expect(items[i].priceKrw).toBeLessThanOrEqual(items[i - 1].priceKrw);
    }
  });

  it("59㎡/84㎡ 두 밴드 밖 면적(예: 110㎡·30㎡)은 스킵, 밴드별로 나뉜다", () => {
    const out = buildRegionTop(
      [
        tx({ complexId: "a", areaM2: 59.8, priceKrw: 1_200_000_000 }), // p19_25
        tx({ complexId: "b", areaM2: 84.9, priceKrw: 1_800_000_000 }), // p32_35
        tx({ complexId: "c", areaM2: 110.2, priceKrw: 3_000_000_000 }), // p41_45 — 탭 없음
        tx({ complexId: "d", areaM2: 30.0, priceKrw: 500_000_000 }), // under18 — 탭 없음
      ],
      WINDOW_START,
    );
    expect(out["마포구"].p19_25!.items).toHaveLength(1);
    expect(out["마포구"].p32_35!.items).toHaveLength(1);
    expect(Object.keys(out["마포구"])).toHaveLength(2);
  });

  it("같은 단지라도 밴드가 다르면 대표가 각각 — 59와 84는 별도 그룹", () => {
    const out = buildRegionTop(
      [
        tx({ areaM2: 59.9, priceKrw: 1_300_000_000, dealDateISO: "2026-06-01" }),
        tx({ areaM2: 84.9, priceKrw: 1_800_000_000, dealDateISO: "2026-06-02" }),
      ],
      WINDOW_START,
    );
    expect(out["마포구"].p19_25!.items[0].priceKrw).toBe(1_300_000_000);
    expect(out["마포구"].p32_35!.items[0].priceKrw).toBe(1_800_000_000);
  });

  it("창 내 거래가 없는 단지·시군구는 생략(빈 결과)", () => {
    const out = buildRegionTop(
      [tx({ dealDateISO: "2026-04-30" })], // 전부 창 밖
      WINDOW_START,
    );
    expect(Object.keys(out)).toHaveLength(0);
  });

  it("비양수 가격은 방어적으로 무시", () => {
    const out = buildRegionTop([tx({ priceKrw: 0 })], WINDOW_START);
    expect(Object.keys(out)).toHaveLength(0);
  });

  it("deals = 창 내 그 밴드 유효 거래 총수 — 대표로 안 뽑힌 거래·창 밖 거래 구분", () => {
    const out = buildRegionTop(
      [
        tx({ dealDateISO: "2026-05-01" }), // 창 밖 — deals 미포함(직전 후보로만)
        tx({ dealDateISO: "2026-05-20" }),
        tx({ dealDateISO: "2026-06-10" }),
        tx({ complexId: "cx2", apt: "이웃단지", dealDateISO: "2026-06-05" }),
      ],
      WINDOW_START,
    );
    // 창 내 3건(같은 단지 2 + 이웃단지 1), 대표는 단지당 1건씩 2행.
    expect(out["마포구"].p32_35!.deals).toBe(3);
    expect(out["마포구"].p32_35!.items).toHaveLength(2);
  });
});

describe("regionTop.orderedBandKeys — 편집 기본(거래 많은 밴드가 위, 무조작 완결)", () => {
  const item = {
    apt: "a", dong: "b", areaM2: 84, priceKrw: 1, dealDate: "2026-06-01",
    floor: null, prevKrw: null, prevDate: null,
  };

  it("창 내 거래(deals)가 많은 밴드가 앞", () => {
    expect(
      orderedBandKeys({
        p19_25: { deals: 3, items: [item] },
        p32_35: { deals: 12, items: [item] },
      }),
    ).toEqual(["p32_35", "p19_25"]);
    expect(
      orderedBandKeys({
        p19_25: { deals: 20, items: [item] },
        p32_35: { deals: 12, items: [item] },
      }),
    ).toEqual(["p19_25", "p32_35"]);
  });

  it("동률은 선언 순서(59㎡급 먼저), 빈 밴드는 생략", () => {
    expect(
      orderedBandKeys({
        p19_25: { deals: 5, items: [item] },
        p32_35: { deals: 5, items: [item] },
      }),
    ).toEqual(["p19_25", "p32_35"]);
    expect(orderedBandKeys({ p32_35: { deals: 5, items: [item] } })).toEqual(["p32_35"]);
    expect(orderedBandKeys({})).toEqual([]);
  });
});
