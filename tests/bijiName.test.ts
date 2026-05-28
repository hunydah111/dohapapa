import { describe, expect, it } from "vitest";
import { composeBijiName, sigunguShortLabel } from "@/lib/bijiName";
import { BEAVER_TIERS } from "@/lib/budgetPercentile";

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

describe("composeBijiName", () => {
  it("flex 등급은 '동네 등급비버' 자연어 형태 (구·시·군 보존)", () => {
    expect(composeBijiName("광명시", BEAVER_TIERS.fever)).toBe("광명시 피버");
    expect(composeBijiName("강남구", BEAVER_TIERS.justin)).toBe("강남구 저스틴비버");
    expect(composeBijiName("성남시 분당구", BEAVER_TIERS.top)).toBe("분당구 탑비버");
    expect(composeBijiName("구로구", BEAVER_TIERS.fever)).toBe("구로구 피버");
    expect(composeBijiName("수원시 영통구", BEAVER_TIERS.nan)).toBe("영통구 난비버");
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
