// 권역(생활권) 구획 — #20 권역 온도 8행 (2026-07-08).
//
// 은어 0 원칙(마용성·노도강 금지): 전부 공식 행정 구획만 쓴다.
//  · 서울 5개 권역 = 「2030 서울생활권계획」의 5대 생활권(도심·동북·서북·서남·동남).
//  · 경기 남부/북부 = 경기도 북부청사 관할(고양·의정부·남양주·구리·파주·양주·포천·
//    동두천·연천·가평) 기준 이분.
//  · 인천 = 인천광역시 전역.
// 표시는 항상 이 고정 지리 순서 — 순위·줄세우기 아님(헌장 5조).
//
// 매핑은 LAWD_CODES 82개 키 전수 명시(누락·중복은 테스트가 잡는다).

import type { PatchTemp } from "./patchNote";

export type ZoneId =
  | "seoul-core"
  | "seoul-ne"
  | "seoul-nw"
  | "seoul-sw"
  | "seoul-se"
  | "gg-south"
  | "gg-north"
  | "incheon";

export interface Zone {
  id: ZoneId;
  /** 표시명 — 공식 구획 용어. */
  label: string;
  /** 라벨 보조(괄호 병기) — 서울 생활권엔 "서울". */
  region: "서울" | "경기" | "인천";
}

/** 고정 지리 순서(표시 순서 그 자체) — 순위 아님. */
export const ZONES: Zone[] = [
  { id: "seoul-core", label: "도심권", region: "서울" },
  { id: "seoul-ne", label: "동북권", region: "서울" },
  { id: "seoul-nw", label: "서북권", region: "서울" },
  { id: "seoul-sw", label: "서남권", region: "서울" },
  { id: "seoul-se", label: "동남권", region: "서울" },
  { id: "gg-south", label: "경기 남부", region: "경기" },
  { id: "gg-north", label: "경기 북부", region: "경기" },
  { id: "incheon", label: "인천", region: "인천" },
];

// ── 시군구 → 권역 전수 매핑 (LAWD_CODES 82키와 1:1 — zones.test.ts가 검증) ──
export const SIGUNGU_TO_ZONE: Record<string, ZoneId> = {
  // 서울 · 도심권 (2030 서울생활권계획)
  종로구: "seoul-core",
  중구: "seoul-core",
  용산구: "seoul-core",
  // 서울 · 동북권
  성동구: "seoul-ne",
  광진구: "seoul-ne",
  동대문구: "seoul-ne",
  중랑구: "seoul-ne",
  성북구: "seoul-ne",
  강북구: "seoul-ne",
  도봉구: "seoul-ne",
  노원구: "seoul-ne",
  // 서울 · 서북권
  은평구: "seoul-nw",
  서대문구: "seoul-nw",
  마포구: "seoul-nw",
  // 서울 · 서남권
  양천구: "seoul-sw",
  강서구: "seoul-sw",
  구로구: "seoul-sw",
  금천구: "seoul-sw",
  영등포구: "seoul-sw",
  동작구: "seoul-sw",
  관악구: "seoul-sw",
  // 서울 · 동남권
  서초구: "seoul-se",
  강남구: "seoul-se",
  송파구: "seoul-se",
  강동구: "seoul-se",
  // 경기 북부 (도 북부청사 관할 10개 시·군)
  "고양시 덕양구": "gg-north",
  "고양시 일산동구": "gg-north",
  "고양시 일산서구": "gg-north",
  의정부시: "gg-north",
  남양주시: "gg-north",
  구리시: "gg-north",
  파주시: "gg-north",
  양주시: "gg-north",
  포천시: "gg-north",
  동두천시: "gg-north",
  연천군: "gg-north",
  가평군: "gg-north",
  // 경기 남부 (북부청 관할 외 전부)
  "수원시 장안구": "gg-south",
  "수원시 권선구": "gg-south",
  "수원시 팔달구": "gg-south",
  "수원시 영통구": "gg-south",
  "성남시 수정구": "gg-south",
  "성남시 중원구": "gg-south",
  "성남시 분당구": "gg-south",
  "안양시 만안구": "gg-south",
  "안양시 동안구": "gg-south",
  "안산시 상록구": "gg-south",
  "안산시 단원구": "gg-south",
  "용인시 처인구": "gg-south",
  "용인시 기흥구": "gg-south",
  "용인시 수지구": "gg-south",
  "부천시 원미구": "gg-south",
  "부천시 소사구": "gg-south",
  "부천시 오정구": "gg-south",
  "화성시 남양구": "gg-south",
  "화성시 향남구": "gg-south",
  "화성시 병점구": "gg-south",
  "화성시 동탄구": "gg-south",
  광명시: "gg-south",
  평택시: "gg-south",
  과천시: "gg-south",
  오산시: "gg-south",
  시흥시: "gg-south",
  군포시: "gg-south",
  의왕시: "gg-south",
  하남시: "gg-south",
  이천시: "gg-south",
  안성시: "gg-south",
  김포시: "gg-south",
  광주시: "gg-south",
  여주시: "gg-south",
  양평군: "gg-south",
  // 인천 전역
  "인천 중구": "incheon",
  "인천 동구": "incheon",
  미추홀구: "incheon",
  연수구: "incheon",
  남동구: "incheon",
  부평구: "incheon",
  계양구: "incheon",
  "인천 서구": "incheon",
  강화군: "incheon",
  옹진군: "incheon",
};

export interface ZoneTemp extends Zone {
  above: number;
  below: number;
  /** 직전 거래가 존재한 거래 수(±1% 중립 포함). */
  matched: number;
}

/**
 * 시군구별 온도(regionTemp)를 8권역으로 집계. 항상 8행 전부 반환(0건 권역 포함) —
 * 표시/생략 판단은 UI가 표본 기준으로 한다. 매핑에 없는 키는 무시(방어).
 */
export function aggregateZoneTemp(
  regionTemp: Record<string, PatchTemp> | undefined | null,
): ZoneTemp[] | null {
  if (!regionTemp) return null;
  const acc = new Map<ZoneId, { above: number; below: number; matched: number }>();
  for (const z of ZONES) acc.set(z.id, { above: 0, below: 0, matched: 0 });
  for (const [sigungu, t] of Object.entries(regionTemp)) {
    const zoneId = SIGUNGU_TO_ZONE[sigungu];
    if (!zoneId) continue;
    const a = acc.get(zoneId)!;
    a.above += t.above;
    a.below += t.below;
    a.matched += t.matched;
  }
  return ZONES.map((z) => ({ ...z, ...acc.get(z.id)! }));
}
