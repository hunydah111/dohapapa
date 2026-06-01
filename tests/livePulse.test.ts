import { describe, it, expect } from "vitest";
import { getLivePulse } from "@/lib/livePulse";

describe("getLivePulse (라이브 펄스 — 번들 데이터에서 살아있는 팩트)", () => {
  const p = getLivePulse();

  it("확인일이 YYYY.M.D 형식", () => {
    expect(p.checkedDate).toMatch(/^\d{4}\.\d{1,2}\.\d{1,2}$/);
  });

  it("거래월 창 라벨이 YYYY.M~YYYY.M 형식", () => {
    expect(p.windowLabel).toMatch(/^\d{4}\.\d{1,2}~\d{4}\.\d{1,2}$/);
  });

  it("회전 팩트가 2개 이상이고 전부 label·value·icon 채워짐", () => {
    expect(p.facts.length).toBeGreaterThanOrEqual(2);
    for (const f of p.facts) {
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.value.length).toBeGreaterThan(0);
      expect(f.icon.length).toBeGreaterThan(0);
    }
  });

  it("누적 실거래 팩트는 천단위 콤마 + '건'", () => {
    const tx = p.facts.find((f) => f.label === "누적 실거래");
    expect(tx).toBeDefined();
    expect(tx!.value).toMatch(/^[\d,]+건$/);
    expect(tx!.value).toContain(",");
  });
});
