// Types for the 국토교통부 실거래가 공개 API (아파트 매매 실거래가).
// Consumers import from here; lib/molit.ts produces these shapes.

export interface MolitDeal {
  apartmentName: string;    // 단지명 raw string from API
  dealDate: Date;
  priceKrw: bigint;         // 거래가 in 원
  area: number;             // 전용면적 ㎡
  floor: number | null;
  sigunguCode: string;      // 5-digit 법정동코드
  sigunguName: string;      // e.g. "강남구"
  dongName: string;         // 법정동
  buildYear: number | null;
}

export interface MolitFetchOptions {
  sigunguCode: string;      // e.g. "11680" 강남구
  dealYearMonth: string;    // "YYYYMM" e.g. "202604"
  pageNo?: number;
  numOfRows?: number;
}
