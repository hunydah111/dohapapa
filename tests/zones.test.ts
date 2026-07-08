import { describe, it, expect } from "vitest";
import { ZONES, SIGUNGU_TO_ZONE, aggregateZoneTemp, type ZoneId } from "@/lib/zones";
import { LAWD_CODES } from "@/lib/molit";

describe("zones — 시군구→권역 전수 매핑", () => {
  it("LAWD_CODES 82키 전부가 정확히 한 권역에 매핑된다 (누락 0)", () => {
    const lawd = Object.keys(LAWD_CODES);
    const missing = lawd.filter((k) => !SIGUNGU_TO_ZONE[k]);
    expect(missing).toEqual([]);
    expect(lawd.length).toBe(82);
  });

  it("매핑에 LAWD에 없는 유령 키가 없다", () => {
    const lawd = new Set(Object.keys(LAWD_CODES));
    const ghosts = Object.keys(SIGUNGU_TO_ZONE).filter((k) => !lawd.has(k));
    expect(ghosts).toEqual([]);
  });

  it("권역별 구성 수 — 서울 25(5권역)·경기북부 12키·경기남부 35키·인천 10", () => {
    const count = (z: ZoneId) =>
      Object.values(SIGUNGU_TO_ZONE).filter((v) => v === z).length;
    expect(count("seoul-core")).toBe(3);
    expect(count("seoul-ne")).toBe(8);
    expect(count("seoul-nw")).toBe(3);
    expect(count("seoul-sw")).toBe(7);
    expect(count("seoul-se")).toBe(4);
    expect(count("gg-north")).toBe(12);
    expect(count("gg-south")).toBe(35);
    expect(count("incheon")).toBe(10);
  });

  it("공식 구획 스팟체크 — 마포=서북권, 노원=동북권, 강남=동남권, 고양=경기북부, 양평=경기남부", () => {
    expect(SIGUNGU_TO_ZONE["마포구"]).toBe("seoul-nw");
    expect(SIGUNGU_TO_ZONE["노원구"]).toBe("seoul-ne");
    expect(SIGUNGU_TO_ZONE["강남구"]).toBe("seoul-se");
    expect(SIGUNGU_TO_ZONE["고양시 덕양구"]).toBe("gg-north");
    expect(SIGUNGU_TO_ZONE["양평군"]).toBe("gg-south"); // 북부청 관할 아님
    expect(SIGUNGU_TO_ZONE["인천 중구"]).toBe("incheon");
    expect(SIGUNGU_TO_ZONE["중구"]).toBe("seoul-core"); // 서울 중구와 구분
  });

  it("ZONES는 고정 지리 순서 8개", () => {
    expect(ZONES.map((z) => z.id)).toEqual([
      "seoul-core", "seoul-ne", "seoul-nw", "seoul-sw", "seoul-se",
      "gg-south", "gg-north", "incheon",
    ]);
  });
});

describe("aggregateZoneTemp", () => {
  it("권역 합 = 전체 합 (집계 보존)", () => {
    const rt = {
      마포구: { above: 3, below: 1, matched: 5 },
      노원구: { above: 1, below: 4, matched: 6 },
      "수원시 영통구": { above: 2, below: 2, matched: 5 },
      "인천 서구": { above: 0, below: 1, matched: 1 },
    };
    const zones = aggregateZoneTemp(rt)!;
    const sum = (k: "above" | "below" | "matched") =>
      zones.reduce((s, z) => s + z[k], 0);
    expect(sum("above")).toBe(6);
    expect(sum("below")).toBe(8);
    expect(sum("matched")).toBe(17);
    // 항상 8행 전부 반환(0건 권역 포함)
    expect(zones.length).toBe(8);
    expect(zones.find((z) => z.id === "seoul-nw")!.matched).toBe(5);
    expect(zones.find((z) => z.id === "seoul-core")!.matched).toBe(0);
  });

  it("구 스키마(undefined) → null (UI 조용히 생략)", () => {
    expect(aggregateZoneTemp(undefined)).toBeNull();
    expect(aggregateZoneTemp(null)).toBeNull();
  });

  it("매핑에 없는 유령 시군구는 무시 (방어)", () => {
    const zones = aggregateZoneTemp({ 유령구: { above: 9, below: 9, matched: 18 } })!;
    expect(zones.reduce((s, z) => s + z.matched, 0)).toBe(0);
  });
});
