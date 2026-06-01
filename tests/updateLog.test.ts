import { describe, it, expect } from "vitest";
import { getUpdateEntries, getLatestUpdate, fmtDot } from "@/lib/updateLog";

describe("updateLog (데이터 업데이트 현황)", () => {
  it("fmtDot: YYYY-MM-DD → YYYY.M.D, YYYY-MM → YYYY.M", () => {
    expect(fmtDot("2026-05-31")).toBe("2026.5.31");
    expect(fmtDot("2026-05")).toBe("2026.5");
  });

  it("엔트리가 최신→과거 순(내림차순 date)", () => {
    const es = getUpdateEntries();
    expect(es.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < es.length; i++) {
      expect(es[i - 1].date >= es[i].date).toBe(true);
    }
  });

  it("최신 엔트리는 누적 txCount·수록단지가 채워짐", () => {
    const l = getLatestUpdate();
    expect(l).not.toBeNull();
    expect(l!.txCount).toBeGreaterThan(0);
    expect(l!.complexCount).toBeGreaterThan(0);
  });

  it("newTx가 있으면 txCount 증가와 정합(이전 누적 + 신규 = 현재)", () => {
    const es = getUpdateEntries(); // 최신→과거
    for (let i = 0; i < es.length - 1; i++) {
      if (es[i].newTx != null) {
        expect(es[i].txCount - es[i + 1].txCount).toBe(es[i].newTx);
      }
    }
  });
});
