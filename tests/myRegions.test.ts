// 동네판 구독 모델(myRegions) — 화이트리스트 검증·직렬화·localStorage 라운드트립.

import { beforeEach, describe, expect, it } from "vitest";
import {
  MY_REGIONS_KEY,
  clearMyRegions,
  loadMyRegions,
  parseMyRegions,
  saveMyRegions,
  serializeMyRegions,
} from "@/lib/myRegions";

describe("parseMyRegions — 화이트리스트 검증(순수)", () => {
  it("유효한 main 만 있으면 rival 없이 통과한다", () => {
    expect(parseMyRegions(JSON.stringify({ main: "강남구" }))).toEqual({
      main: "강남구",
    });
  });

  it("공백 포함 풀네임(수원시 팔달구)도 통과한다", () => {
    expect(
      parseMyRegions(JSON.stringify({ main: "수원시 팔달구", rival: "용인시 수지구" })),
    ).toEqual({ main: "수원시 팔달구", rival: "용인시 수지구" });
  });

  it("미지 시군구 main 은 null — 렌더에 불량값이 흘러들지 않는다", () => {
    expect(parseMyRegions(JSON.stringify({ main: "판교구" }))).toBeNull();
    expect(parseMyRegions(JSON.stringify({ main: "강남" }))).toBeNull(); // 축약형 불허(풀네임만)
  });

  it("rival 불량(미지·main 중복·비문자열)은 rival 만 버리고 main 은 살린다", () => {
    expect(parseMyRegions(JSON.stringify({ main: "강남구", rival: "가상구" }))).toEqual({
      main: "강남구",
    });
    expect(parseMyRegions(JSON.stringify({ main: "강남구", rival: "강남구" }))).toEqual({
      main: "강남구",
    });
    expect(parseMyRegions(JSON.stringify({ main: "강남구", rival: 42 }))).toEqual({
      main: "강남구",
    });
  });

  it("깨진 입력(비 JSON·비객체·null·main 비문자열)은 전부 null", () => {
    expect(parseMyRegions(null)).toBeNull();
    expect(parseMyRegions("")).toBeNull();
    expect(parseMyRegions("not-json{")).toBeNull();
    expect(parseMyRegions('"강남구"')).toBeNull();
    expect(parseMyRegions("[1,2]")).toBeNull(); // 배열 — main 없음
    expect(parseMyRegions(JSON.stringify({ main: 11 }))).toBeNull();
    expect(parseMyRegions("null")).toBeNull();
  });
});

describe("serializeMyRegions — 쓰기 경로 검증(순수)", () => {
  it("유효값은 JSON, rival 은 유효·비중복일 때만 포함한다", () => {
    expect(JSON.parse(serializeMyRegions({ main: "강남구", rival: "서초구" })!)).toEqual({
      main: "강남구",
      rival: "서초구",
    });
    expect(JSON.parse(serializeMyRegions({ main: "강남구", rival: "강남구" })!)).toEqual({
      main: "강남구",
    });
    expect(JSON.parse(serializeMyRegions({ main: "강남구", rival: "가상구" })!)).toEqual({
      main: "강남구",
    });
  });

  it("미지 main 은 저장 자체를 거부(null)한다", () => {
    expect(serializeMyRegions({ main: "가상구" })).toBeNull();
  });
});

describe("save/load/clear — localStorage 라운드트립", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
  });

  it("저장 → 로드가 동일 구독을 돌려준다", () => {
    saveMyRegions({ main: "강남구", rival: "서초구" });
    expect(loadMyRegions()).toEqual({ main: "강남구", rival: "서초구" });
  });

  it("불량 main 은 저장하지 않는다(기존 값 보존)", () => {
    saveMyRegions({ main: "강남구" });
    saveMyRegions({ main: "가상구" });
    expect(loadMyRegions()).toEqual({ main: "강남구" });
  });

  it("clear 는 즉시 삭제한다", () => {
    saveMyRegions({ main: "강남구" });
    clearMyRegions();
    expect(loadMyRegions()).toBeNull();
    expect(store.has(MY_REGIONS_KEY)).toBe(false);
  });

  it("localStorage 에 앉은 손상값은 로드 시 null", () => {
    store.set(MY_REGIONS_KEY, '{"main":"가상구"}');
    expect(loadMyRegions()).toBeNull();
  });
});
