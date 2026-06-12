import { describe, it, expect } from "vitest";
import {
  encodeFriend,
  decodeFriend,
  buildFriendUrl,
  friendDdayLabel,
} from "@/lib/friendShare";
import { budgetTier } from "@/lib/budgetPercentile";
import type { DdayResult } from "@/lib/plan/dday";
import { verdictLine } from "@/lib/verdict";

const tier = budgetTier(23); // bieber

function makeDday(over: Partial<DdayResult> = {}): DdayResult {
  return {
    sigungu: "마포구",
    band: "p32_35",
    bandLabel: "32~35평",
    targetKrw: 1_200_000_000,
    monthlySavingKrw: 2_000_000,
    months: 100,
    days: 3044,
    capped: false,
    ...over,
  };
}

describe("friendShare 3필드 인코드/디코드", () => {
  it("일수 인코딩 — {slug}.{시군구}.{days} 왕복", () => {
    const enc = encodeFriend(tier, "마포구", makeDday());
    expect(enc.endsWith(".3044")).toBe(true);
    const tag = decodeFriend(enc)!;
    expect(tag.sigungu).toBe("마포구");
    expect(tag.tier.slug).toBe(tier.slug);
    expect(tag.dday).toEqual({ kind: "days", days: 3044 });
    expect(friendDdayLabel(tag)).toBe("D-3,044");
  });

  it("지금 가능 → now, 아득 → far", () => {
    const now = decodeFriend(encodeFriend(tier, "마포구", makeDday({ months: 0, days: 0 })))!;
    expect(now.dday).toEqual({ kind: "now" });
    expect(friendDdayLabel(now)).toBe("지금 입성 가능");
    const far = decodeFriend(encodeFriend(tier, "마포구", makeDday({ months: null, days: null, capped: true })))!;
    expect(far.dday).toEqual({ kind: "far" });
    expect(friendDdayLabel(far)).toBe("D-아득");
  });

  it("레거시 2필드 링크 회귀 — dday 없이 정상 디코드", () => {
    const legacy = `${tier.slug}.${encodeURIComponent("성남시 분당구")}`;
    const tag = decodeFriend(legacy)!;
    expect(tag.sigungu).toBe("성남시 분당구");
    expect(tag.dday).toBeUndefined();
    expect(friendDdayLabel(tag)).toBeNull();
  });

  it("dday 미제공 인코딩은 레거시 형태 그대로", () => {
    expect(encodeFriend(tier, "마포구")).toBe(`${tier.slug}.${encodeURIComponent("마포구")}`);
  });

  it("깨진 입력은 null", () => {
    expect(decodeFriend("")).toBeNull();
    expect(decodeFriend("nope")).toBeNull();
    expect(decodeFriend("fakeslug.마포구.123")).toBeNull();
  });

  it("buildFriendUrl — ?f= 파라미터에 3필드", () => {
    const url = buildFriendUrl("https://bijigo.kr", tier, "마포구", makeDday());
    expect(url).toContain("?f=");
    expect(url.endsWith(".3044")).toBe(true);
  });
});

describe("verdictLine — 자조 한 줄", () => {
  it("결정적 — 같은 입력이면 항상 같은 문장", () => {
    const d = makeDday();
    expect(verdictLine(d)).toBe(verdictLine(d));
  });
  it("버킷 분기 — now/soon/grind/far 모두 비어있지 않은 문장", () => {
    for (const d of [
      makeDday({ months: 0, days: 0 }),
      makeDday({ months: 30, days: 913 }),
      makeDday({ months: 200, days: 6088 }),
      makeDday({ months: null, days: null, capped: true }),
    ]) {
      const v = verdictLine(d);
      expect(v).toBeTruthy();
      expect(v!.length).toBeGreaterThan(3);
    }
  });
  it("dday 없으면 null", () => {
    expect(verdictLine(null)).toBeNull();
  });
});
