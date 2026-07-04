import { describe, expect, it } from "vitest";
import {
  composeBijiName,
  composeReachName,
  getReachBySlug,
  reachFromDday,
  sigunguShortLabel,
  REACH_LABELS,
  REACH_THRESHOLD_DAYS,
} from "@/lib/bijiName";
import { BEAVER_TIERS, getTierBySlug } from "@/lib/budgetPercentile";

describe("sigunguShortLabel", () => {
  it("자치구 단일 토큰은 '구/시/군' 접미사 보존", () => {
    expect(sigunguShortLabel("강남구")).toBe("강남구");
    expect(sigunguShortLabel("송파구")).toBe("송파구");
    expect(sigunguShortLabel("광명시")).toBe("광명시");
    expect(sigunguShortLabel("구로구")).toBe("구로구");
    expect(sigunguShortLabel("연천군")).toBe("연천군");
  });

  it("공백 토큰은 마지막 토큰(자치구·세부)을 그대로", () => {
    expect(sigunguShortLabel("성남시 분당구")).toBe("분당구");
    expect(sigunguShortLabel("수원시 영통구")).toBe("영통구");
    expect(sigunguShortLabel("안양시 동안구")).toBe("동안구");
    expect(sigunguShortLabel("고양시 일산동구")).toBe("일산동구");
  });

  it("빈/누락 입력은 빈 문자열", () => {
    expect(sigunguShortLabel("")).toBe("");
    expect(sigunguShortLabel(null)).toBe("");
    expect(sigunguShortLabel(undefined)).toBe("");
    expect(sigunguShortLabel("   ")).toBe("");
  });
});

// ── 사정권 라벨 4단계 (2026-07-04 비버 퇴장) ──────────────────────────────────

describe("reachFromDday — D-day 기반 사정권 라벨", () => {
  const base = { months: 100, days: 3044, capped: false };

  it("months===0 → 입성", () => {
    expect(reachFromDday({ months: 0, days: 0, capped: false }).slug).toBe("ipseong");
  });

  it("days ≤ 3,650 → 사정권 (경계 포함)", () => {
    expect(reachFromDday(base).slug).toBe("sajeonggwon");
    expect(reachFromDday({ ...base, days: REACH_THRESHOLD_DAYS }).slug).toBe("sajeonggwon");
  });

  it("days > 3,650 (캡 미만) → 문밖", () => {
    expect(reachFromDday({ ...base, days: REACH_THRESHOLD_DAYS + 1 }).slug).toBe("munbak");
    expect(reachFromDday({ ...base, days: 9999 }).slug).toBe("munbak");
  });

  it("capped(D-아득)·미도달 → 아득", () => {
    expect(reachFromDday({ months: 500, days: 15220, capped: true }).slug).toBe("adeuk");
    expect(reachFromDday({ months: null, days: null, capped: true }).slug).toBe("adeuk");
  });

  it("dday 자체가 없으면(데이터 부족) 보수적으로 아득", () => {
    expect(reachFromDday(null).slug).toBe("adeuk");
    expect(reachFromDday(undefined).slug).toBe("adeuk");
  });
});

describe("getReachBySlug / composeReachName", () => {
  it("새 slug 4종 해석", () => {
    expect(getReachBySlug("ipseong")?.label).toBe("입성");
    expect(getReachBySlug("sajeonggwon")?.label).toBe("사정권");
    expect(getReachBySlug("munbak")?.label).toBe("문밖");
    expect(getReachBySlug("adeuk")?.label).toBe("아득");
  });

  it("미지 slug·레거시 비버 slug는 null (레거시는 getTierBySlug 담당)", () => {
    expect(getReachBySlug("queen")).toBeNull();
    expect(getReachBySlug("unknown")).toBeNull();
    expect(getReachBySlug("")).toBeNull();
  });

  it("히어로 이름 — '{시군구 짧은 라벨} {라벨}'", () => {
    expect(composeReachName("마포구", REACH_LABELS.sajeonggwon)).toBe("마포구 사정권");
    expect(composeReachName("성남시 분당구", REACH_LABELS.ipseong)).toBe("분당구 입성");
    expect(composeReachName("광명시", REACH_LABELS.adeuk)).toBe("광명시 아득");
  });

  it("reach 없으면(레거시 링크) 중립 '판정', 시군구 없으면 라벨 단독", () => {
    expect(composeReachName("마포구", null)).toBe("마포구 판정");
    expect(composeReachName(null, REACH_LABELS.munbak)).toBe("문밖");
    expect(composeReachName(null, null)).toBe("판정");
  });
});

// ── 레거시 (비버 등급명 — deprecated, 하위호환 참조용) ───────────────────────

describe("composeBijiName (deprecated — 레거시 참조용)", () => {
  it("flex 등급은 '동네 등급비버' 자연어 형태 (구·시·군 보존)", () => {
    expect(composeBijiName("강남구", BEAVER_TIERS.queen)).toBe("강남구 퀸비버");
    expect(composeBijiName("성남시 분당구", BEAVER_TIERS.rain)).toBe("분당구 비  버");
    expect(composeBijiName("수원시 영통구", BEAVER_TIERS.bieber)).toBe("영통구 저스틴비버");
    expect(composeBijiName("광명시", BEAVER_TIERS.queen)).toBe("광명시 퀸비버");
    expect(composeBijiName("구로구", BEAVER_TIERS.rain)).toBe("구로구 비  버");
  });

  it("모든 등급에 시군구 prefix 적용 (gukmin·baby 포함, 일관성)", () => {
    expect(composeBijiName("광명시", BEAVER_TIERS.gukmin)).toBe("광명시 비버");
    expect(composeBijiName("강남구", BEAVER_TIERS.baby)).toBe("강남구 아기비버");
    expect(composeBijiName("성남시 분당구", BEAVER_TIERS.gukmin)).toBe("분당구 비버");
  });

  it("시군구 없으면 라벨로 폴백", () => {
    expect(composeBijiName(null, BEAVER_TIERS.queen)).toBe(BEAVER_TIERS.queen.label);
    expect(composeBijiName("", BEAVER_TIERS.rain)).toBe(BEAVER_TIERS.rain.label);
    expect(composeBijiName(undefined, BEAVER_TIERS.bieber)).toBe(BEAVER_TIERS.bieber.label);
  });
});

describe("getTierBySlug (옛 슬러그 alias)", () => {
  it("새 슬러그는 직접 해석", () => {
    expect(getTierBySlug("queen")?.slug).toBe("queen");
    expect(getTierBySlug("rain")?.slug).toBe("rain");
    expect(getTierBySlug("bieber")?.slug).toBe("bieber");
    expect(getTierBySlug("gukmin")?.slug).toBe("gukmin");
    expect(getTierBySlug("baby")?.slug).toBe("baby");
  });

  it("옛 슬러그(justin/fever/top/nan)는 가장 가까운 새 등급으로 alias — 404 차단", () => {
    expect(getTierBySlug("justin")?.slug).toBe("bieber");
    expect(getTierBySlug("fever")?.slug).toBe("queen");
    expect(getTierBySlug("top")?.slug).toBe("bieber");
    expect(getTierBySlug("nan")?.slug).toBe("gukmin");
  });

  it("미지 슬러그는 null", () => {
    expect(getTierBySlug("unknown")).toBe(null);
    expect(getTierBySlug("")).toBe(null);
  });
});
