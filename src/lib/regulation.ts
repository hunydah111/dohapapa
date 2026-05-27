// 시군구 → 규제·토허제 분류 (2025.10.15 주택시장 안정화 대책 기준).
//
// **단일 진실**: 어느 시군구가 조정대상지역·투기과열지구·토지거래허가구역인지.
// 출처: 정부 2025.10.15 발표, 시행 2025.10.16(규제지역) / 2025.10.20(토허제).
// LTV·DSR 차등은 src/lib/budget.ts 가 이 분류를 입력으로 받아 적용한다.
//
// **모델 가정 변경**: 이 모듈 도입 전 코드는 "서울 전역 규제로 가정" 단일 가정으로
// 모든 수도권에 동일 LTV·DSR 적용했음. 2025.10.15 대책 이후 정확성 위해 분기.
//
// **2025.10.15 지정 = 서울 25 + 경기 12 자치구.** 토허제 범위는 동일(시 전역, 동 단위
// 차등 명시 없음). 매수자 사전허가 + 2년 실거주 의무 (2025.10.20~ 계약 적용).
//
// 비규제지역(인천·경기 비지정·서울 외 수도권)은 일반 룰: LTV 무주택 70%·유주택 60%,
// 스트레스 DSR +1.5%p.

/** 2025.10.15 대책으로 지정된 규제지역(조정대상+투기과열+토허제) 시군구 정확 목록. */
export const REGULATED_SIGUNGU: ReadonlySet<string> = new Set([
  // 서울특별시 전 25개 구
  "종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구",
  "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구",
  "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구", "송파구",
  "강동구",
  // 경기 12 자치구 — 시 전역 4곳·자치구 일부 4곳·다구 시 3곳 자치구
  "과천시", "광명시", "의왕시", "하남시",
  "성남시 분당구", "성남시 수정구", "성남시 중원구",
  "수원시 영통구", "수원시 장안구", "수원시 팔달구",
  "안양시 동안구",
  "용인시 수지구",
]);

/** 정책 효력일·출처 메타. */
export const REGULATION_META = {
  effectiveLabel: "2025.10.15 대책 반영",
  effectiveDate: "2025-10-16", // 규제지역 시행. 토허제는 2025-10-20.
  landUseEffectiveDate: "2025-10-20",
  lastVerified: "2026-05-26",
  sources: [
    "정부 2025.10.15 주택시장 안정화 대책",
    "https://www.korea.kr/news/policyNewsView.do?newsId=148950973",
  ],
} as const;

/** 시군구가 2025.10.15 규제지역(조정대상+투기과열)인지. 동일 지역이 토허제이기도 함. */
export function isRegulated(sigungu: string | null | undefined): boolean {
  if (!sigungu) return false;
  return REGULATED_SIGUNGU.has(sigungu);
}

/**
 * 시군구가 토지거래허가구역인지 (현재 = 규제지역과 동일 범위).
 * 분리 함수: 향후 정책 변경으로 토허제 ≠ 규제지역이 되면 여기서만 분기.
 */
export function isLandUseRestricted(sigungu: string | null | undefined): boolean {
  return isRegulated(sigungu);
}

/** UI/budget 입력용 분류 결과. */
export interface RegulationStatus {
  sigungu: string | null;
  /** 조정대상+투기과열 = "규제지역". */
  regulated: boolean;
  /** 토지거래허가구역. */
  landUseRestricted: boolean;
  /** 사용자 안내 한 줄 (없으면 null — 비규제). */
  noticeLine: string | null;
}

/** 시군구 분류 + 사용자 안내 한 줄. */
export function classifyRegulation(sigungu: string | null | undefined): RegulationStatus {
  const regulated = isRegulated(sigungu);
  const landUseRestricted = isLandUseRestricted(sigungu);
  let noticeLine: string | null = null;
  if (landUseRestricted) {
    // 토허제 + 규제 — 사전허가·2년 실거주 의무 안내(추정 아닌 사실).
    noticeLine =
      "토허제 · 사전허가+2년 실거주 (잘 알아보자)";
  }
  return {
    sigungu: sigungu ?? null,
    regulated,
    landUseRestricted,
    noticeLine,
  };
}
