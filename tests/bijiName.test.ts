import { describe, expect, it } from "vitest";
import { composeBijiName, sigunguShortLabel } from "@/lib/bijiName";
import { BEAVER_TIERS } from "@/lib/budgetPercentile";

describe("sigunguShortLabel", () => {
  it("자치구 단일 토큰은 '구/시/군' 접미사 제거", () => {
    expect(sigunguShortLabel("강남구")).toBe("강남");
    expect(sigunguShortLabel("송파구")).toBe("송파");
    expect(sigunguShortLabel("광명시")).toBe("광명");
    expect(sigunguShortLabel("구리시")).toBe("구리");
    expect(sigunguShortLabel("연천군")).toBe("연천");
  });

  it("공백 토큰은 마지막 토큰(자치구·세부)을 우선해 짧게", () => {
    expect(sigunguShortLabel("성남시 분당구")).toBe("분당");
    expect(sigunguShortLabel("수원시 영통구")).toBe("영통");
    expect(sigunguShortLabel("안양시 동안구")).toBe("동안");
    expect(sigunguShortLabel("용인시 수지구")).toBe("수지");
  });

  it("고양시 일산동구 → 일산 (동·구 둘 다 떼기)", () => {
    expect(sigunguShortLabel("고양시 일산동구")).toBe("일산");
    expect(sigunguShortLabel("고양시 일산서구")).toBe("일산");
  });

  it("자체 의미인 동·서·북은 보존 (강남·강북 등)", () => {
    expect(sigunguShortLabel("강남구")).toBe("강남");
    expect(sigunguShortLabel("강북구")).toBe("강북");
    expect(sigunguShortLabel("강동구")).toBe("강동");
    expect(sigunguShortLabel("강서구")).toBe("강서");
  });

  it("인천 자치구·고유명 보존", () => {
    expect(sigunguShortLabel("미추홀구")).toBe("미추홀");
    expect(sigunguShortLabel("연수구")).toBe("연수");
    expect(sigunguShortLabel("부평구")).toBe("부평");
    expect(sigunguShortLabel("계양구")).toBe("계양");
  });

  it("빈/누락 입력은 빈 문자열", () => {
    expect(sigunguShortLabel("")).toBe("");
    expect(sigunguShortLabel(null)).toBe("");
    expect(sigunguShortLabel(undefined)).toBe("");
    expect(sigunguShortLabel("   ")).toBe("");
  });
});

describe("composeBijiName", () => {
  it("flex 등급은 '동네 등급비버' 자연어 형태", () => {
    expect(composeBijiName("광명시", BEAVER_TIERS.fever)).toBe("광명 피버");
    expect(composeBijiName("강남구", BEAVER_TIERS.justin)).toBe("강남 저스틴비버");
    expect(composeBijiName("성남시 분당구", BEAVER_TIERS.top)).toBe("분당 탑비버");
    expect(composeBijiName("송파구", BEAVER_TIERS.fever)).toBe("송파 피버");
    expect(composeBijiName("수원시 영통구", BEAVER_TIERS.nan)).toBe("영통 난비버");
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
