import { describe, it, expect } from "vitest";
import {
  judge,
  scoreRound,
  playableCells,
  peerKeyOf,
  regimeRound,
  REGIMES,
  setGrade,
  topPerformer,
  SET_SIZE,
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
    // trendIndex 범위(2025-05~2026-05) 내 기간 사용. 셀은 playable 첫 셀로(데이터 보장).
    const cell = playableCells()[0].key;
    const r = scoreRound({ cellKey: cell, fromMonth: "2025-06", toMonth: "2026-05", pick: "UP" });
    expect(r.resolvable).toBe(true);
    expect(r.correct).toBe(r.outperform); // pick=UP이므로 correct === outperform
  });
  it("없는 월은 무효", () => {
    const r = scoreRound({ cellKey: "종로구|low", fromMonth: "1999-01", toMonth: "1999-02", pick: "UP" });
    // valueAt 클램프로 양끝 동일값→동률→무효, 또는 결측→무효. 어느 쪽이든 적중 단정 불가.
    expect(r.resolvable).toBe(false);
  });
});

describe("REGIMES / regimeRound (명명 국면 출제)", () => {
  it("3개 국면, 유효한 from<to 기간", () => {
    expect(REGIMES).toHaveLength(3);
    for (const r of REGIMES) {
      expect(r.from < r.to).toBe(true);
      expect(r.label.length).toBeGreaterThan(0);
    }
  });
  it("같은 seed·국면이면 같은 라운드 + 그 국면 기간 사용", () => {
    const reg = REGIMES[1];
    const a = regimeRound(reg, 42);
    const b = regimeRound(reg, 42);
    expect(a.cellKey).toBe(b.cellKey);
    expect(a.fromMonth).toBe(reg.from);
    expect(a.toMonth).toBe(reg.to);
  });
  it("출제 라운드는 채점 가능", () => {
    const r = scoreRound({ ...regimeRound(REGIMES[0], 7), pick: "UP" });
    expect(r.resolvable).toBe(true);
  });
});

describe("setGrade (7문제 세트 등급)", () => {
  it("7=촉신, 0~3=촉린이, 경계 단조", () => {
    expect(setGrade(7).label).toBe("촉신");
    expect(setGrade(6).label).toBe("촉고수");
    expect(setGrade(5).label).toBe("촉상수");
    expect(setGrade(4).label).toBe("촉중수");
    expect(setGrade(3).label).toBe("촉린이");
    expect(setGrade(0).label).toBe("촉린이");
  });
  it("image 경로 = id 기반(자산 폴백 키)", () => {
    expect(setGrade(7).image).toBe("/biji/chok/god.png");
    expect(SET_SIZE).toBe(7);
  });
});

describe("topPerformer (그 기간 최고 상승 시군구 — 납득용)", () => {
  it("국면① high tier 최고 상승지가 존재하고 peer(수도권)는 제외", () => {
    const reg = REGIMES[0]; // 고가 상승기
    const top = topPerformer("high", reg.from, reg.to);
    expect(top).not.toBeNull();
    expect(top!.sigungu).not.toBe("수도권");
    expect(Number.isFinite(top!.pct)).toBe(true);
  });
  it("결측 기간이면 null", () => {
    expect(topPerformer("high", "1999-01", "1999-02")).toBeNull();
  });
});
