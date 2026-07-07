// 오늘의 반응 (v2.6) — 순수 로직 테스트.
// 핵심 축: ① dateKey 새벽 3시 경계 ② 스탬프 화이트리스트(3종 고정)
// ③ 이상 참여 휴리스틱(중앙값×10 초과 && 50 초과) ④ 5명 미만 카운트 숨김
// ⑤ dealKey 규격 = patchNote dealKey 재사용 ⑥ agg 키 왕복(":"·"|" 포함 dealKey).

import { describe, expect, it } from "vitest";
import {
  REACTION_STAMPS,
  REACTION_MIN_TOTAL,
  isReactionStamp,
  reactionDateKey,
  reactionDealKey,
  reactionAggKey,
  parseReactionAggKey,
  reactedStorageKey,
  medianOf,
  isAnomalousParticipation,
  summarizeReactions,
  topReaction,
  type ReactionRow,
} from "@/lib/reaction";
import { dealKey } from "@/lib/patchNote";

describe("reactionDateKey — 새벽 3시(KST) 리셋 경계", () => {
  it("KST 02:59는 전날 키", () => {
    expect(reactionDateKey(new Date("2026-07-07T02:59:59+09:00"))).toBe("2026-07-06");
  });
  it("KST 03:00 정각부터 오늘 키", () => {
    expect(reactionDateKey(new Date("2026-07-07T03:00:00+09:00"))).toBe("2026-07-07");
  });
  it("KST 자정 직후(00:30)도 전날 키 — 심야 참여는 어제 지면에 귀속", () => {
    expect(reactionDateKey(new Date("2026-07-07T00:30:00+09:00"))).toBe("2026-07-06");
  });
  it("KST 23:59는 당일 키", () => {
    expect(reactionDateKey(new Date("2026-07-07T23:59:00+09:00"))).toBe("2026-07-07");
  });
  it("월 경계 — 8/1 01:00 KST는 7/31 키", () => {
    expect(reactionDateKey(new Date("2026-08-01T01:00:00+09:00"))).toBe("2026-07-31");
  });
});

describe("스탬프 화이트리스트 — 3종 고정 배열", () => {
  it("고정 순서: 과열 → 적당 → 싸다", () => {
    expect(REACTION_STAMPS.map((s) => s.slug)).toEqual(["hot", "fair", "cheap"]);
    expect(REACTION_STAMPS.map((s) => s.label)).toEqual(["과열", "적당", "싸다"]);
  });
  it("유효 슬러그만 통과", () => {
    expect(isReactionStamp("hot")).toBe(true);
    expect(isReactionStamp("fair")).toBe(true);
    expect(isReactionStamp("cheap")).toBe(true);
  });
  it("구 5종(거품·헐값)·자유 텍스트·비문자열은 거부", () => {
    expect(isReactionStamp("bubble")).toBe(false);
    expect(isReactionStamp("steal")).toBe(false);
    expect(isReactionStamp("거품")).toBe(false);
    expect(isReactionStamp("")).toBe(false);
    expect(isReactionStamp("HOT")).toBe(false);
    expect(isReactionStamp(null)).toBe(false);
    expect(isReactionStamp(42)).toBe(false);
  });
});

describe("reactionDealKey — patchNote dealKey 규격 재사용", () => {
  it("동일 거래는 patchNote dealKey와 완전 동일 문자열", () => {
    const viaPatch = dealKey({
      sigunguName: "수원시 팔달구",
      apartmentName: "매교역푸르지오SK뷰",
      area: 84.87,
      dealDateISO: "2026-07-01",
      priceKrw: 1_050_000_000,
      dongName: "매교동",
      floor: 15,
    });
    const viaReaction = reactionDealKey({
      sigungu: "수원시 팔달구",
      apt: "매교역푸르지오SK뷰",
      areaM2: 84.87,
      dealDate: "2026-07-01",
      priceKrw: 1_050_000_000,
      floor: 15,
    });
    expect(viaReaction).toBe(viaPatch);
    expect(viaReaction).toBe("수원시 팔달구|매교역푸르지오SK뷰|84.87|2026-07-01|1050000000|15");
  });
  it("floor null은 빈 문자열 세그먼트 — patchNote와 동일", () => {
    expect(
      reactionDealKey({
        sigungu: "강남구",
        apt: "래미안",
        areaM2: 59.9,
        dealDate: "2026-06-30",
        priceKrw: 2_000_000_000,
        floor: null,
      }),
    ).toBe("강남구|래미안|59.9|2026-06-30|2000000000|");
  });
});

describe("reactionAggKey — AggCounter 키 왕복", () => {
  it("생성→파싱 왕복 (dealKey에 ':'·'|' 포함해도 안전)", () => {
    const dk = "강남구|어쩌구 1:2단지|84.9|2026-07-01|1500000000|3";
    const key = reactionAggKey("2026-07-07", dk, "fair");
    expect(key).toBe(`rx:2026-07-07:${dk}:fair`);
    expect(parseReactionAggKey(key)).toEqual({
      dateKey: "2026-07-07",
      dealKey: dk,
      slug: "fair",
    });
  });
  it("규약 밖 키는 null — 다른 프리픽스·깨진 날짜·비화이트리스트 슬러그", () => {
    expect(parseReactionAggKey("bd:강남구:tier")).toBeNull();
    expect(parseReactionAggKey("rx:20260707:a|b|c|d|e|f:hot")).toBeNull();
    expect(parseReactionAggKey("rx:2026-07-07:a|b|c|d|e|f:bubble")).toBeNull();
    expect(parseReactionAggKey("rx:2026-07-07::hot")).toBeNull();
  });
  it("localStorage 키 규격", () => {
    expect(reactedStorageKey("2026-07-07", "a|b|c|d|e|f")).toBe(
      "biji-reacted:2026-07-07:a|b|c|d|e|f",
    );
  });
});

describe("medianOf", () => {
  it("홀수 길이 — 가운데 값", () => {
    expect(medianOf([9, 1, 5])).toBe(5);
  });
  it("짝수 길이 — 가운데 두 값 평균", () => {
    expect(medianOf([1, 3, 5, 100])).toBe(4);
  });
  it("빈 배열 — 0", () => {
    expect(medianOf([])).toBe(0);
  });
});

describe("isAnomalousParticipation — 조직 투표 휴리스틱(둘 다 '초과')", () => {
  it("중앙값×10 초과 AND 50 초과 → 감지", () => {
    expect(isAnomalousParticipation(51, 5)).toBe(true); // 51 > 50, 51 > 50
  });
  it("50 이하면 배수 조건을 넘어도 미감지 (저볼륨 날 오탐 방지)", () => {
    expect(isAnomalousParticipation(50, 3)).toBe(false); // 50 > 30 이지만 50 > 50 아님
    expect(isAnomalousParticipation(49, 1)).toBe(false);
  });
  it("정확히 중앙값×10은 미감지(초과 조건)", () => {
    expect(isAnomalousParticipation(600, 60)).toBe(false); // 600 = 60×10
    expect(isAnomalousParticipation(601, 60)).toBe(true);
  });
  it("중앙값 이내 대량 참여는 정상 (지면 전체가 흥한 날)", () => {
    expect(isAnomalousParticipation(300, 100)).toBe(false);
  });
});

// ── summarize용 헬퍼 ─────────────────────────────────────────────────────────
function row(dealKey: string, slug: ReactionRow["slug"], count: number): ReactionRow {
  return { dealKey, slug, count };
}

describe("summarizeReactions", () => {
  it("스탬프별 카운트 집계 — 3종 전부 항상 채움", () => {
    const rows = [row("A", "hot", 2), row("A", "cheap", 4)];
    const [s] = summarizeReactions(rows, ["A"]);
    expect(s.counts).toEqual({ hot: 2, fair: 0, cheap: 4 });
    expect(s.total).toBe(6);
  });
  it("총 5명 미만 → showCounts=false (버튼만)", () => {
    const rows = [row("A", "fair", 4)];
    const [s] = summarizeReactions(rows, ["A"]);
    expect(s.total).toBe(4);
    expect(s.showCounts).toBe(false);
    expect(s.anomaly).toBe(false);
  });
  it(`정확히 ${REACTION_MIN_TOTAL}명부터 카운트 표시`, () => {
    const rows = [row("A", "fair", REACTION_MIN_TOTAL)];
    const [s] = summarizeReactions(rows, ["A"]);
    expect(s.showCounts).toBe(true);
  });
  it("참여 없는 요청 키 — 0 집계로 반환(빠뜨리지 않음)", () => {
    const [s] = summarizeReactions([], ["없는거래"]);
    expect(s).toEqual({
      dealKey: "없는거래",
      counts: { hot: 0, fair: 0, cheap: 0 },
      total: 0,
      showCounts: false,
      anomaly: false,
    });
  });
  it("이상 참여 거래 — anomaly=true, showCounts=false (버튼 유지·집계 보류)", () => {
    // 평범한 거래 5건(각 5표) + 조직 투표 의심 1건(80표): 중앙값 = 5 →
    // 80 > 50(=5×10) && 80 > 50 → 감지.
    const rows: ReactionRow[] = [
      row("B1", "fair", 5),
      row("B2", "fair", 5),
      row("B3", "hot", 5),
      row("B4", "cheap", 5),
      row("B5", "fair", 5),
      row("SUS", "cheap", 80),
    ];
    const [sus, normal] = summarizeReactions(rows, ["SUS", "B1"]);
    expect(sus.anomaly).toBe(true);
    expect(sus.showCounts).toBe(false);
    expect(sus.total).toBe(80);
    expect(normal.anomaly).toBe(false);
    expect(normal.showCounts).toBe(true);
  });
  it("중앙값은 요청 배치가 아니라 오늘 전체 거래 기준", () => {
    // 요청엔 SUS만 넣어도, 전체 rows의 중앙값(5)으로 감지된다.
    const rows: ReactionRow[] = [
      row("B1", "fair", 5),
      row("B2", "fair", 5),
      row("B3", "fair", 5),
      row("SUS", "cheap", 80),
    ];
    const [sus] = summarizeReactions(rows, ["SUS"]);
    expect(sus.anomaly).toBe(true);
  });
  it("오늘 참여 거래가 1건뿐이면 중앙값=자기 총계 — 감지 불가(v1 문서화된 한계)", () => {
    const rows = [row("ONLY", "hot", 400)];
    const [s] = summarizeReactions(rows, ["ONLY"]);
    expect(s.anomaly).toBe(false);
    expect(s.showCounts).toBe(true);
  });
});

describe("topReaction — ?top=1 (내일 지면 '어제 최다 반응' 환류)", () => {
  it("최다 참여 거래 1건 — 카운트 동봉", () => {
    const rows: ReactionRow[] = [
      row("A", "hot", 3),
      row("A", "fair", 4),
      row("B", "cheap", 5),
    ];
    expect(topReaction(rows)).toEqual({
      dealKey: "A",
      total: 7,
      counts: { hot: 3, fair: 4, cheap: 0 },
    });
  });
  it("참여 0 — null", () => {
    expect(topReaction([])).toBeNull();
  });
  it("동률은 dealKey 사전순 — 결정적", () => {
    const rows = [row("나", "hot", 3), row("가", "fair", 3)];
    expect(topReaction(rows)?.dealKey).toBe("가");
  });
  it("이상 참여 감지 거래는 최다여도 제외 — 조직 투표가 내일 지면을 못 산다", () => {
    const rows: ReactionRow[] = [
      row("B1", "fair", 5),
      row("B2", "fair", 5),
      row("B3", "hot", 6),
      row("B4", "cheap", 5),
      row("B5", "fair", 5),
      row("SUS", "cheap", 80),
    ];
    expect(topReaction(rows)?.dealKey).toBe("B3");
  });
});
