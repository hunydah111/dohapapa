import { describe, it, expect } from "vitest";
import {
  BOARDS,
  getRegions,
  getBoard,
  getRegion,
  listRegions,
  bestBoardFor,
  regionId,
  regionLabel,
  totalOf,
  type BoardId,
  type LeagueUnit,
} from "@/lib/league";

const BOARD_IDS: BoardId[] = ["momentum", "trades", "value", "fresh"];
const UNITS: LeagueUnit[] = ["dong", "sigungu"];

describe("league 보드 정의", () => {
  it("보드 4개, 각 id 고유 + 라벨·이모지 존재", () => {
    expect(BOARDS).toHaveLength(4);
    expect(new Set(BOARDS.map((b) => b.id))).toEqual(new Set(BOARD_IDS));
    for (const b of BOARDS) {
      expect(b.label.length).toBeGreaterThan(0);
      expect(b.emoji.length).toBeGreaterThan(0);
    }
  });
});

describe.each(UNITS)("league 데이터 무결성 [%s]", (unit) => {
  it("지역 수 충분 + totalOf와 일치", () => {
    const regions = getRegions(unit);
    expect(regions.length).toBe(totalOf(unit));
    expect(regions.length).toBeGreaterThan(unit === "dong" ? 100 : 60);
  });

  it("각 보드 순위는 1..N 빠짐·중복 없는 완전순열", () => {
    const n = getRegions(unit).length;
    for (const id of BOARD_IDS) {
      const ranks = getRegions(unit).map((r) => r.ranks[id]).sort((a, b) => a - b);
      expect(ranks).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    }
  });

  it("getBoard는 순위 오름차순(1위가 맨 앞) + limit 적용", () => {
    const top10 = getBoard("momentum", unit, 10);
    expect(top10).toHaveLength(10);
    expect(top10[0].ranks.momentum).toBe(1);
    expect(top10[9].ranks.momentum).toBe(10);
  });

  it("bestBoardFor = 그 동네 순위가 가장 높은(작은) 보드", () => {
    for (const r of getRegions(unit)) {
      const best = bestBoardFor(r);
      const minRank = Math.min(...BOARD_IDS.map((id) => r.ranks[id]));
      expect(r.ranks[best.id]).toBe(minRank);
    }
  });

  it("보드별 1위가 서로 다른 동네 ≥3종 (다양성 — 한 동네 독식 아님)", () => {
    const winners = new Set(BOARD_IDS.map((id) => regionId(getBoard(id, unit, 1)[0])));
    expect(winners.size).toBeGreaterThanOrEqual(3);
  });

  it("regionId 라운드트립 + listRegions 가나다 정렬", () => {
    const list = listRegions(unit);
    expect(list.length).toBe(totalOf(unit));
    const labels = list.map(regionLabel);
    expect([...labels].sort((a, b) => a.localeCompare(b, "ko"))).toEqual(labels);
    const one = getRegion(regionId(list[0]), unit);
    expect(one && regionId(one)).toBe(regionId(list[0]));
    expect(getRegion("없는지역__", unit)).toBeNull();
  });

  it(`dongName 일관: ${unit}`, () => {
    for (const r of getRegions(unit)) {
      if (unit === "dong") expect(r.dongName).toBeTruthy();
      else expect(r.dongName).toBeNull();
    }
  });
});
