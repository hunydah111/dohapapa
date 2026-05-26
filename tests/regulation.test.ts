import { describe, expect, it } from "vitest";
import {
  classifyRegulation,
  isLandUseRestricted,
  isRegulated,
  REGULATED_SIGUNGU,
} from "@/lib/regulation";

describe("REGULATED_SIGUNGU 목록 (2025.10.15 대책)", () => {
  it("서울 25개 자치구 전부 포함", () => {
    const seoul = [
      "종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구",
      "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구",
      "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구", "송파구",
      "강동구",
    ];
    for (const gu of seoul) expect(REGULATED_SIGUNGU.has(gu)).toBe(true);
  });

  it("경기 12 자치구 정확히 포함", () => {
    const gyeonggi = [
      "과천시", "광명시", "의왕시", "하남시",
      "성남시 분당구", "성남시 수정구", "성남시 중원구",
      "수원시 영통구", "수원시 장안구", "수원시 팔달구",
      "안양시 동안구",
      "용인시 수지구",
    ];
    for (const sgg of gyeonggi) expect(REGULATED_SIGUNGU.has(sgg)).toBe(true);
  });

  it("비지정 시군구는 false (수원 권선·안양 만안·용인 처인/기흥 등)", () => {
    expect(REGULATED_SIGUNGU.has("수원시 권선구")).toBe(false);
    expect(REGULATED_SIGUNGU.has("안양시 만안구")).toBe(false);
    expect(REGULATED_SIGUNGU.has("용인시 처인구")).toBe(false);
    expect(REGULATED_SIGUNGU.has("용인시 기흥구")).toBe(false);
    expect(REGULATED_SIGUNGU.has("화성시 동탄구")).toBe(false);
    expect(REGULATED_SIGUNGU.has("부천시 원미구")).toBe(false);
    expect(REGULATED_SIGUNGU.has("구리시")).toBe(false);
    expect(REGULATED_SIGUNGU.has("남양주시")).toBe(false);
    expect(REGULATED_SIGUNGU.has("미추홀구")).toBe(false); // 인천
    expect(REGULATED_SIGUNGU.has("연수구")).toBe(false); // 인천
  });

  it("총 37개 = 서울 25 + 경기 12", () => {
    expect(REGULATED_SIGUNGU.size).toBe(37);
  });
});

describe("isRegulated / isLandUseRestricted", () => {
  it("규제지역은 둘 다 true (현재 범위 동일)", () => {
    expect(isRegulated("강남구")).toBe(true);
    expect(isLandUseRestricted("강남구")).toBe(true);
    expect(isRegulated("성남시 분당구")).toBe(true);
    expect(isLandUseRestricted("성남시 분당구")).toBe(true);
  });

  it("비규제지역은 둘 다 false", () => {
    expect(isRegulated("구리시")).toBe(false);
    expect(isLandUseRestricted("화성시 동탄구")).toBe(false);
    expect(isRegulated("미추홀구")).toBe(false);
  });

  it("null/빈 입력은 false", () => {
    expect(isRegulated(null)).toBe(false);
    expect(isRegulated(undefined)).toBe(false);
    expect(isRegulated("")).toBe(false);
  });
});

describe("classifyRegulation 사용자 안내", () => {
  it("규제지역은 토허제 안내 한 줄 (사전허가·2년 실거주)", () => {
    const r = classifyRegulation("강남구");
    expect(r.regulated).toBe(true);
    expect(r.landUseRestricted).toBe(true);
    expect(r.noticeLine).toMatch(/토지거래허가/);
    expect(r.noticeLine).toMatch(/2년 실거주/);
  });

  it("비규제지역은 안내 없음", () => {
    const r = classifyRegulation("구리시");
    expect(r.regulated).toBe(false);
    expect(r.landUseRestricted).toBe(false);
    expect(r.noticeLine).toBeNull();
  });
});
