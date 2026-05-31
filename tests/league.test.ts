import { describe, it, expect } from "vitest";
import {
  BOARDS,
  getRegions,
  getBoard,
  getRegion,
  bestBoardFor,
  allSigungu,
  LEAGUE_TOTAL,
  type BoardId,
} from "@/lib/league";

const BOARD_IDS: BoardId[] = ["momentum", "trades", "value", "stability"];

describe("league 데이터 무결성", () => {
  it("보드 4개, 각 id 고유 + 라벨·이모지 존재", () => {
    expect(BOARDS).toHaveLength(4);
    expect(new Set(BOARDS.map((b) => b.id))).toEqual(new Set(BOARD_IDS));
    for (const b of BOARDS) {
      expect(b.label.length).toBeGreaterThan(0);
      expect(b.emoji.length).toBeGreaterThan(0);
    }
  });

  it("시군구 충분(>60) + total과 일치", () => {
    const regions = getRegions();
    expect(regions.length).toBe(LEAGUE_TOTAL);
    expect(regions.length).toBeGreaterThan(60);
  });

  it("각 보드 순위는 1..N 빠짐·중복 없는 완전순열", () => {
    const n = getRegions().length;
    for (const id of BOARD_IDS) {
      const ranks = getRegions().map((r) => r.ranks[id]).sort((a, b) => a - b);
      expect(ranks).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    }
  });

  it("getBoard는 순위 오름차순(1위가 맨 앞) + limit 적용", () => {
    const top10 = getBoard("momentum", 10);
    expect(top10).toHaveLength(10);
    expect(top10[0].ranks.momentum).toBe(1);
    expect(top10[9].ranks.momentum).toBe(10);
  });

  it("bestBoardFor = 그 동네 순위가 가장 높은(작은) 보드", () => {
    for (const r of getRegions()) {
      const best = bestBoardFor(r);
      const minRank = Math.min(...BOARD_IDS.map((id) => r.ranks[id]));
      expect(r.ranks[best.id]).toBe(minRank);
    }
  });

  it("보드별 1위가 서로 다른 동네 ≥3종 (다양성 — 한 동네 독식 아님)", () => {
    const winners = new Set(BOARD_IDS.map((id) => getBoard(id, 1)[0].sigungu));
    expect(winners.size).toBeGreaterThanOrEqual(3);
  });

  it("getRegion 조회 + allSigungu 정렬 목록", () => {
    const list = allSigungu();
    expect(list.length).toBe(LEAGUE_TOTAL);
    const one = getRegion(list[0]);
    expect(one?.sigungu).toBe(list[0]);
    expect(getRegion("없는구__")).toBeNull();
  });
});
