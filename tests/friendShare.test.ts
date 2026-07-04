import { describe, it, expect } from "vitest";
import {
  encodeFriend,
  decodeFriend,
  buildFriendUrl,
  friendDdayLabel,
  friendReachName,
  reachFromFriendDday,
} from "@/lib/friendShare";
import type { DdayResult } from "@/lib/plan/dday";
import { verdictLine } from "@/lib/verdict";

function makeDday(over: Partial<DdayResult> = {}): DdayResult {
  return {
    sigungu: "마포구",
    band: "p32_35",
    bandLabel: "32~35평",
    targetKrw: 1_200_000_000,
    monthlySavingKrw: 2_000_000,
    gapKrw: 200_000_000, // months(100) × 월저축 근사 — 픽스처용
    months: 100,
    days: 3044,
    capped: false,
    ...over,
  };
}

describe("friendShare — 새 사정권 slug 인코드/디코드", () => {
  it("일수 인코딩 — {reachSlug}.{시군구}.{days} 왕복", () => {
    const enc = encodeFriend("마포구", makeDday());
    expect(enc.startsWith("sajeonggwon.")).toBe(true); // 3,044일 ≤ 3,650 → 사정권
    expect(enc.endsWith(".3044")).toBe(true);
    const tag = decodeFriend(enc)!;
    expect(tag.sigungu).toBe("마포구");
    expect(tag.tier).toBeNull(); // 새 slug 링크는 tier 없음(색 테마 기본값)
    expect(tag.reach?.slug).toBe("sajeonggwon");
    expect(tag.dday).toEqual({ kind: "days", days: 3044 });
    expect(friendDdayLabel(tag)).toBe("D-3,044");
    expect(friendReachName(tag)).toBe("마포구 사정권");
  });

  it("지금 가능 → ipseong/now, 아득 → adeuk/far", () => {
    const encNow = encodeFriend("마포구", makeDday({ months: 0, days: 0 }));
    expect(encNow.startsWith("ipseong.")).toBe(true);
    const now = decodeFriend(encNow)!;
    expect(now.dday).toEqual({ kind: "now" });
    expect(now.reach?.slug).toBe("ipseong");
    expect(friendDdayLabel(now)).toBe("지금 입성 가능");
    expect(friendReachName(now)).toBe("마포구 입성");

    const encFar = encodeFriend("마포구", makeDday({ months: null, days: null, capped: true }));
    expect(encFar.startsWith("adeuk.")).toBe(true);
    const far = decodeFriend(encFar)!;
    expect(far.dday).toEqual({ kind: "far" });
    expect(far.reach?.slug).toBe("adeuk");
    expect(friendDdayLabel(far)).toBe("D-아득");
  });

  it("10년 초과(3,651일+) → munbak", () => {
    const enc = encodeFriend("노원구", makeDday({ months: 168, days: 5114 }));
    expect(enc.startsWith("munbak.")).toBe(true);
    const tag = decodeFriend(enc)!;
    expect(friendReachName(tag)).toBe("노원구 문밖");
  });

  it("dday 미제공 인코딩 — 보수적 adeuk, 세그먼트 생략", () => {
    expect(encodeFriend("마포구")).toBe(`adeuk.${encodeURIComponent("마포구")}`);
  });

  it("깨진 입력은 null", () => {
    expect(decodeFriend("")).toBeNull();
    expect(decodeFriend("nope")).toBeNull();
    expect(decodeFriend("fakeslug.마포구.123")).toBeNull();
  });

  it("buildFriendUrl — ?f= 파라미터에 3필드", () => {
    const url = buildFriendUrl("https://bijigo.kr", "마포구", makeDday());
    expect(url).toContain("?f=sajeonggwon.");
    expect(url.endsWith(".3044")).toBe(true);
  });
});

describe("friendShare — 레거시 비버 slug 하위호환 (이미 뿌려진 링크)", () => {
  it("레거시 2필드 링크 — dday 없이 정상 디코드, 이름은 중립 '판정'", () => {
    const legacy = `queen.${encodeURIComponent("성남시 분당구")}`;
    const tag = decodeFriend(legacy)!;
    expect(tag.sigungu).toBe("성남시 분당구");
    expect(tag.tier?.slug).toBe("queen"); // 색 테마용으로만 보존
    expect(tag.dday).toBeUndefined();
    expect(tag.reach).toBeNull();
    expect(friendDdayLabel(tag)).toBeNull();
    // 비버 등급명("퀸비버")은 절대 노출 안 됨 — 중립 폴백.
    expect(friendReachName(tag)).toBe("분당구 판정");
  });

  it("레거시 3필드 링크 — dday 세그먼트에서 사정권 라벨 유도", () => {
    const tag = decodeFriend(`bieber.${encodeURIComponent("마포구")}.3044`)!;
    expect(tag.tier?.slug).toBe("bieber");
    expect(tag.reach?.slug).toBe("sajeonggwon");
    expect(friendReachName(tag)).toBe("마포구 사정권");

    const now = decodeFriend(`rain.${encodeURIComponent("서초구")}.now`)!;
    expect(now.reach?.slug).toBe("ipseong");
    const far = decodeFriend(`baby.${encodeURIComponent("강남구")}.far`)!;
    expect(far.reach?.slug).toBe("adeuk");
    const munbak = decodeFriend(`gukmin.${encodeURIComponent("노원구")}.5114`)!;
    expect(munbak.reach?.slug).toBe("munbak");
  });

  it("구세대 alias slug(justin 등)도 계속 파싱", () => {
    const tag = decodeFriend(`justin.${encodeURIComponent("마포구")}`)!;
    expect(tag.tier?.slug).toBe("bieber");
    expect(friendReachName(tag)).toBe("마포구 판정");
  });
});

describe("reachFromFriendDday — URL 세그먼트 → 라벨", () => {
  it("now→입성, far→아득, 경계 3650→사정권, 3651→문밖", () => {
    expect(reachFromFriendDday({ kind: "now" })?.slug).toBe("ipseong");
    expect(reachFromFriendDday({ kind: "far" })?.slug).toBe("adeuk");
    expect(reachFromFriendDday({ kind: "days", days: 3650 })?.slug).toBe("sajeonggwon");
    expect(reachFromFriendDday({ kind: "days", days: 3651 })?.slug).toBe("munbak");
    expect(reachFromFriendDday(null)).toBeNull();
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
