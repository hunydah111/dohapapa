// Shared types for the suspicion-score pipeline.
// All scoring modules MUST import from here so signal shapes stay consistent.

export type SignalKey =
  | "price"
  | "brokerConcentration"
  | "stale"
  | "refresh"
  | "photoReuse"
  | "info"
  | "keywords"
  | "brokerHistory";

export const SIGNAL_WEIGHTS: Record<SignalKey, number> = {
  price: 30,
  brokerConcentration: 15,
  stale: 10,
  refresh: 15,
  photoReuse: 10,
  info: 5,
  keywords: 5,
  brokerHistory: 10,
};

export const SIGNAL_LABELS_KO: Record<SignalKey, string> = {
  price: "가격 이상치",
  brokerConcentration: "중개사 집중도",
  stale: "시장 체류일",
  refresh: "수정일자 갱신 패턴",
  photoReuse: "사진 재사용",
  info: "정보 부실",
  keywords: "미끼 키워드",
  brokerHistory: "중개사 이력",
};

/** Input shape — what users submit (form or parsed Naver URL). */
export interface ListingInput {
  complexName: string;
  sigungu?: string;
  dongName?: string;
  askPriceKrw: bigint;
  area: number; // 전용㎡
  floor?: number;
  direction?: string;
  description?: string;
  externalUrl?: string;
  brokerName?: string;
  postedAt?: Date;
  lastModifiedAt?: Date;
  refreshHistory?: { at: Date; priceKrw: bigint; modified: boolean }[];
  photoCount?: number;
}

/** Output of a single signal scorer. */
export interface SignalResult {
  /** Points contributed toward suspicion (0 = no concern, weight = max). */
  points: number;
  /** Human-readable Korean reason. Empty string if no concern detected. */
  reason: string;
  /** Optional structured detail for UI. */
  detail?: Record<string, unknown>;
}

/** Comparable transactions for the same 단지·평형. */
export interface ComparableSet {
  complexId: string;
  area: number;
  windowMonths: number;
  prices: bigint[]; // recent transaction prices in 원
  medianKrw: bigint;
  stdevKrw: bigint;
  count: number;
}

/** Full score output. */
export interface ScoreResult {
  total: number; // 0–100
  band: "green" | "yellow" | "red";
  signals: Record<SignalKey, number>;
  reasoning: Record<SignalKey, string>;
}

export function bandFor(total: number): "green" | "yellow" | "red" {
  if (total >= 70) return "red";
  if (total >= 40) return "yellow";
  return "green";
}
