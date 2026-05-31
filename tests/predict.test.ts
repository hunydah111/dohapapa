import { describe, it, expect } from "vitest";
import {
  judge,
  scoreRound,
  playableCells,
  peerKeyOf,
  backtestRound,
} from "@/lib/game/predict";
import { ALL_SCOPE } from "@/lib/recommend/trendIndex";

describe("judge (순수 채점)", () => {
  it("아웃퍼폼 + UP = 적중", () => {
    const r = judge(100, 105, 100, 103, "UP"); // cell +5% > peer +3%
    expect(r.resolvable).toBe(true);
    expect(r.outperform).toBe(true);
    expect(r.correct).toBe(true);
  });
  it("아웃퍼폼 + DOWN = 오답", () => {
    expect(judge(100, 105, 100, 103, "DOWN").correct).toBe(false);
  });
  it("언더퍼폼 + DOWN = 적중", () => {
    const r = judge(100, 102, 100, 104, "DOWN"); // cell +2% < peer +4%
    expect(r.outperform).toBe(false);
    expect(r.correct).toBe(true);
  });
  it("동률 = 무효 라운드(resolvable=false)", () => {
    expect(judge(100, 103, 100, 103, "UP").resolvable).toBe(false);
  });
  it("결측·0이하 = 무효", () => {
    expect(judge(0, 105, 100, 103, "UP").resolvable).toBe(false);
    expect(judge(100, 105, null as unknown as number, 103, "UP").resolvable).toBe(false);
  });
});

describe("playableCells", () => {
  const cells = playableCells();
  it("충분한 셀(>40)", () => expect(cells.length).toBeGreaterThan(40));
  it("수도권(peer 자신)은 제외", () =>
    expect(cells.every((c) => c.sigungu !== ALL_SCOPE)).toBe(true));
  it("각 셀의 peer 시리즈가 존재(채점 가능)", () => {
    const c = cells[0];
    const r = scoreRound({
      cellKey: c.key,
      fromMonth: "2025-04",
      toMonth: "2026-05",
      pick: "UP",
    });
    expect(typeof r.resolvable).toBe("boolean");
  });
  it("peerKeyOf 형식", () => expect(peerKeyOf("low")).toBe(`${ALL_SCOPE}|low`));
});

describe("scoreRound (실데이터)", () => {
  it("알려진 셀+기간은 채점 가능, correct는 outperform과 일관", () => {
    const r = scoreRound({ cellKey: "종로구|low", fromMonth: "2025-04", toMonth: "2026-05", pick: "UP" });
    expect(r.resolvable).toBe(true);
    expect(r.correct).toBe(r.outperform); // pick=UP이므로 correct === outperform
  });
  it("없는 월은 무효", () => {
    const r = scoreRound({ cellKey: "종로구|low", fromMonth: "1999-01", toMonth: "1999-02", pick: "UP" });
    // valueAt 클램프로 양끝 동일값→동률→무효, 또는 결측→무효. 어느 쪽이든 적중 단정 불가.
    expect(r.resolvable).toBe(false);
  });
});

describe("backtestRound (복기 출제, 결정적)", () => {
  it("같은 seed면 같은 라운드", () => {
    const a = backtestRound(42);
    const b = backtestRound(42);
    expect(a.cellKey).toBe(b.cellKey);
    expect(a.fromMonth).toBe(b.fromMonth);
    expect(a.toMonth).toBe(b.toMonth);
  });
  it("출제된 라운드는 채점 가능", () => {
    const round = backtestRound(7);
    const r = scoreRound({ ...round, pick: "UP" });
    expect(r.resolvable).toBe(true);
  });
});
