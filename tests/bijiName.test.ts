import { describe, expect, it } from "vitest";
import { composeBijiName, sigunguShortKey } from "@/lib/bijiName";
import { BEAVER_TIERS } from "@/lib/budgetPercentile";

describe("sigunguShortKey", () => {
  it("자치구 한 토큰은 첫 글자", () => {
    expect(sigunguShortKey("강남구")).toBe("강");
    expect(sigunguShortKey("광명시")).toBe("광");
  });

  it("공백 토큰은 마지막 토큰(자치구) 첫 글자", () => {
    expect(sigunguShortKey("성남시 분당구")).toBe("분");
    expect(sigunguShortKey("수원시 영통구")).toBe("영");
    expect(sigunguShortKey("고양시 일산동구")).toBe("일");
  });

  it("빈/누락 입력은 빈 문자열", () => {
    expect(sigunguShortKey("")).toBe("");
    expect(sigunguShortKey(null)).toBe("");
    expect(sigunguShortKey(undefined)).toBe("");
    expect(sigunguShortKey("   ")).toBe("");
  });
});

describe("composeBijiName", () => {
  it("flex 등급은 동네 첫 글자 + 닉네임", () => {
    expect(composeBijiName("광명시", BEAVER_TIERS.fever)).toBe("광피버");
    expect(composeBijiName("강남구", BEAVER_TIERS.justin)).toBe("강저스");
    expect(composeBijiName("성남시 분당구", BEAVER_TIERS.top)).toBe("분탑비");
    expect(composeBijiName("강남구", BEAVER_TIERS.nan)).toBe("강난비");
  });

  it("isFlex=false 등급(국민·아기)은 합성 안 함 — 박탈감 차단", () => {
    expect(composeBijiName("광명시", BEAVER_TIERS.gukmin)).toBe(BEAVER_TIERS.gukmin.label);
    expect(composeBijiName("강남구", BEAVER_TIERS.baby)).toBe(BEAVER_TIERS.baby.label);
  });

  it("시군구 없으면 라벨로 폴백", () => {
    expect(composeBijiName(null, BEAVER_TIERS.fever)).toBe(BEAVER_TIERS.fever.label);
    expect(composeBijiName("", BEAVER_TIERS.top)).toBe(BEAVER_TIERS.top.label);
    expect(composeBijiName(undefined, BEAVER_TIERS.justin)).toBe(BEAVER_TIERS.justin.label);
  });
});
