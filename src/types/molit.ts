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
  /**
   * 분양권/입주권 구분 — 분양권전매 API(SilvTrade)에서만 채워진다. 매매(AptTrade)는 undefined.
   * 원본 ownershipGbn: "분"(분양권) | "입"(입주권). 매매 적재 시엔 없음.
   */
  ownershipGbn?: string;
  /** 거래유형 — "중개거래" | "직거래" (2023 개정판 필드). 없으면 undefined. */
  dealingGbn?: string;
  /** 해제여부 — true = 계약 해제된 거래(cdealType "O"). */
  canceled?: boolean;
}

export interface MolitFetchOptions {
  sigunguCode: string;      // e.g. "11680" 강남구
  dealYearMonth: string;    // "YYYYMM" e.g. "202604"
  pageNo?: number;
  numOfRows?: number;
}
