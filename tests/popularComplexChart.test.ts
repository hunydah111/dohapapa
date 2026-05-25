import { describe, it, expect, beforeEach, vi } from "vitest";

// db 를 인메모리 Map 으로 모킹 — 공용 Neon DB 를 건드리지 않고 집계 로직만 검증한다.
const { store } = vi.hoisted(() => ({ store: new Map<string, number>() }));

vi.mock("@/lib/db", () => ({
  db: {
    aggCounter: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      upsert: async ({ where, create, update }: any) => {
        const k = where.key as string;
        if (store.has(k)) {
          store.set(k, (store.get(k) ?? 0) + (update.count.increment ?? 0));
        } else {
          store.set(k, create.count ?? 0);
        }
        return { key: k, count: store.get(k) };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findMany: async ({ where }: any) => {
        const prefix = where.key.startsWith as string;
        return [...store.entries()]
          .filter(([k]) => k.startsWith(prefix))
          .map(([key, count]) => ({ key, count }));
      },
    },
  },
}));

import {
  recordPopularComplexes,
  getPopularComplexChart,
} from "@/lib/popularComplexChart";
import { isoWeekKeyKST } from "@/lib/neighborhoodChart";

const SEP = String.fromCharCode(31); // U+001F — lib 의 키 구분자와 동일

describe("recordPopularComplexes / getPopularComplexChart", () => {
  beforeEach(() => store.clear());

  it("complexId 중복 제거 + 상위 3단지만 집계", async () => {
    await recordPopularComplexes([
      { complexId: "c1", complexName: "래미안", sigungu: "강남구", dongName: "개포동" },
      { complexId: "c2", complexName: "자이", sigungu: "송파구", dongName: "잠실동" },
      { complexId: "c1", complexName: "래미안", sigungu: "강남구", dongName: "개포동" }, // 중복
      { complexId: "c3", complexName: "힐스테이트", sigungu: "마포구", dongName: "아현동" },
      { complexId: "c4", complexName: "푸르지오", sigungu: "성동구", dongName: "행당동" }, // 4번째 → 잘림
    ]);
    const chart = await getPopularComplexChart();
    const names = chart.entries.map((e) => e.complexName);
    expect(names).toContain("래미안");
    expect(names).toContain("자이");
    expect(names).toContain("힐스테이트");
    expect(names).not.toContain("푸르지오");
    expect(chart.entries.every((e) => e.count === 1)).toBe(true);
  });

  it("누적 카운트로 순위 + 표시필드(시군구·동) 라운드트립", async () => {
    await recordPopularComplexes([
      { complexId: "c1", complexName: "래미안", sigungu: "강남구", dongName: "개포동" },
    ]);
    await recordPopularComplexes([
      { complexId: "c1", complexName: "래미안", sigungu: "강남구", dongName: "개포동" },
    ]);
    await recordPopularComplexes([
      { complexId: "c2", complexName: "자이", sigungu: "송파구", dongName: "잠실동" },
    ]);
    const chart = await getPopularComplexChart();
    expect(chart.entries[0]).toMatchObject({
      rank: 1,
      complexName: "래미안",
      sigungu: "강남구",
      dongName: "개포동",
      count: 2,
    });
    expect(chart.entries[1]).toMatchObject({ rank: 2, complexName: "자이", count: 1 });
    expect(chart.total).toBe(3);
  });

  it("지난주 순위와 비교해 rankDelta·NEW 계산(complexId 매칭)", async () => {
    const prevWeek = isoWeekKeyKST(new Date(Date.now() - 7 * 86_400_000));
    // 지난주: c2(자이)가 1위였다고 주입 (키 포맷 동일하게)
    store.set(`ap:${prevWeek}:c2${SEP}자이${SEP}송파구${SEP}잠실동`, 9);
    // 이번주: c1 2 > c2 1
    await recordPopularComplexes([
      { complexId: "c1", complexName: "래미안", sigungu: "강남구", dongName: "개포동" },
    ]);
    await recordPopularComplexes([
      { complexId: "c1", complexName: "래미안", sigungu: "강남구", dongName: "개포동" },
    ]);
    await recordPopularComplexes([
      { complexId: "c2", complexName: "자이", sigungu: "송파구", dongName: "잠실동" },
    ]);
    const chart = await getPopularComplexChart();
    const c1 = chart.entries.find((e) => e.complexName === "래미안")!;
    const c2 = chart.entries.find((e) => e.complexName === "자이")!;
    expect(c1.rankDelta).toBeNull(); // 지난주 없음 → NEW
    expect(c2.rankDelta).toBe(-1); // 1위 → 2위 = -1(하락)
  });
});
