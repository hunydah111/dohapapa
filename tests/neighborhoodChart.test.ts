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
  isoWeekKeyKST,
  recordNeighborhoods,
  getNeighborhoodChart,
} from "@/lib/neighborhoodChart";

describe("isoWeekKeyKST", () => {
  it("형식이 YYYY-Www", () => {
    expect(isoWeekKeyKST(new Date("2026-05-23T03:00:00Z"))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("2026-01-01(목)은 2026 W01", () => {
    expect(isoWeekKeyKST(new Date("2026-01-01T03:00:00Z"))).toBe("2026-W01");
  });

  it("2025-12-29(월)도 ISO상 2026 W01", () => {
    expect(isoWeekKeyKST(new Date("2025-12-29T03:00:00Z"))).toBe("2026-W01");
  });

  it("KST 시프트: UTC상 일요일 늦은 시각이 KST로 월요일이면 다음 주", () => {
    // 2026-01-04(일) 12:00Z → KST 21:00 일요일 → W01
    expect(isoWeekKeyKST(new Date("2026-01-04T12:00:00Z"))).toBe("2026-W01");
    // 2026-01-04(일) 16:00Z → KST 다음날 01:00 월요일 → W02
    expect(isoWeekKeyKST(new Date("2026-01-04T16:00:00Z"))).toBe("2026-W02");
  });
});

describe("recordNeighborhoods / getNeighborhoodChart", () => {
  beforeEach(() => store.clear());

  it("중복 제거 + 상위 3개만 집계", async () => {
    await recordNeighborhoods(["강남구", "송파구", "강남구", "마포구", "성동구"]);
    // 강남구·송파구·마포구 = 상위 3개(중복 강남구 1회), 성동구는 잘림
    const chart = await getNeighborhoodChart();
    const names = chart.entries.map((e) => e.sigungu);
    expect(names).toContain("강남구");
    expect(names).toContain("송파구");
    expect(names).toContain("마포구");
    expect(names).not.toContain("성동구");
    expect(chart.entries.every((e) => e.count === 1)).toBe(true);
  });

  it("누적 카운트로 순위 결정", async () => {
    await recordNeighborhoods(["강남구"]);
    await recordNeighborhoods(["강남구"]);
    await recordNeighborhoods(["송파구"]);
    const chart = await getNeighborhoodChart();
    expect(chart.entries[0]).toMatchObject({ rank: 1, sigungu: "강남구", count: 2 });
    expect(chart.entries[1]).toMatchObject({ rank: 2, sigungu: "송파구", count: 1 });
    expect(chart.total).toBe(3);
  });

  it("지난주 순위와 비교해 rankDelta·NEW 계산", async () => {
    const prevWeek = isoWeekKeyKST(new Date(Date.now() - 7 * 86_400_000));
    // 지난주: 송파구가 1위였다고 주입
    store.set(`nb:${prevWeek}:송파구`, 9);
    // 이번주: 강남구 2 > 송파구 1
    await recordNeighborhoods(["강남구"]);
    await recordNeighborhoods(["강남구"]);
    await recordNeighborhoods(["송파구"]);
    const chart = await getNeighborhoodChart();
    const gangnam = chart.entries.find((e) => e.sigungu === "강남구")!;
    const songpa = chart.entries.find((e) => e.sigungu === "송파구")!;
    expect(gangnam.rankDelta).toBeNull(); // 지난주 없음 → NEW
    expect(songpa.rankDelta).toBe(-1); // 1위 → 2위 = -1(하락)
  });
});
