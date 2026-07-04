// 판정 카드 히어로 이름 — "{시군구} {사정권 라벨}" (예: "마포구 사정권").
//
// 2026-07-04 비버 완전 퇴장: 등급명(퀸비버·저스틴비버 류) 말장난을 D-day 기반
// 사정권 라벨 4단계(입성·사정권·문밖·아득)로 교체. 기존 tier(budgetPercentile
// 백분위 등급)는 카드 색 테마로만 잔존 — 이름 노출 금지.
//
// 사정권 임계값:
//   months === 0            → 입성   ("지금 닿는다")
//   days ≤ 3,650 (10년)     → 사정권 ("버틸 만한 싸움이다")
//   days > 3,650 (캡 미만)  → 문밖
//   capped(D-아득)·미도달    → 아득

import type { BudgetTier } from "./budgetPercentile";
import type { DdayResult } from "./plan/dday";

/**
 * 시군구 → 사용자 친화 짧은 라벨.
 * "강남구"→"강남구", "송파구"→"송파구", "성남시 분당구"→"분당구",
 * "수원시 영통구"→"영통구", "고양시 일산동구"→"일산동구", "광명시"→"광명시".
 *
 * 룰: 공백 토큰 있으면 마지막 토큰(자치구·세부)을 그대로. "구·시·군" 접미사는 보존.
 */
export function sigunguShortLabel(sigungu: string | null | undefined): string {
  if (!sigungu) return "";
  const trimmed = sigungu.trim();
  if (!trimmed) return "";
  const tokens = trimmed.split(/\s+/);
  return tokens[tokens.length - 1] ?? trimmed;
}

// ── 사정권 라벨 4단계 ──────────────────────────────────────────────────────────

export type ReachSlug = "ipseong" | "sajeonggwon" | "munbak" | "adeuk";

export interface ReachLabel {
  /** URL·공유카드 식별 슬러그. */
  slug: ReachSlug;
  label: string;
}

export const REACH_LABELS: Record<ReachSlug, ReachLabel> = {
  ipseong: { slug: "ipseong", label: "입성" },
  sajeonggwon: { slug: "sajeonggwon", label: "사정권" },
  munbak: { slug: "munbak", label: "문밖" },
  adeuk: { slug: "adeuk", label: "아득" },
};

/** 사정권/문밖 경계 — 10년(일수). */
export const REACH_THRESHOLD_DAYS = 3650;

/**
 * DdayResult → 사정권 라벨.
 * dday 자체가 없으면(데이터 부족) 보수적으로 "아득" — 미도달과 같은 취급.
 */
export function reachFromDday(
  dday: Pick<DdayResult, "months" | "days" | "capped"> | null | undefined,
): ReachLabel {
  if (!dday) return REACH_LABELS.adeuk;
  if (dday.months === 0) return REACH_LABELS.ipseong;
  if (dday.capped || dday.days === null) return REACH_LABELS.adeuk;
  if (dday.days <= REACH_THRESHOLD_DAYS) return REACH_LABELS.sajeonggwon;
  return REACH_LABELS.munbak;
}

/** 슬러그 → 사정권 라벨 (공유 URL·OG용). 미지 슬러그는 null. */
export function getReachBySlug(slug: string): ReachLabel | null {
  return (REACH_LABELS as Record<string, ReachLabel>)[slug] ?? null;
}

/**
 * 카드 히어로 이름 "{시군구} {라벨}" — 예 "마포구 사정권".
 * reach가 null(레거시 링크 등 유도 불가)이면 중립 "판정"으로,
 * 시군구가 없으면 라벨 단독으로 폴백.
 */
export function composeReachName(
  sigungu: string | null | undefined,
  reach: ReachLabel | null | undefined,
): string {
  const short = sigunguShortLabel(sigungu);
  const label = reach?.label ?? "판정";
  if (!short) return label;
  return `${short} ${label}`;
}

// ── 레거시 (비버 등급명 — 2026-07-04 퇴장) ────────────────────────────────────

/**
 * @deprecated 비버 등급명 합성("마포구 저스틴비버")은 퇴장. 새 코드는
 * composeReachName(사정권 라벨)을 쓸 것. 레거시 공유 링크 호환 참조용으로만 유지.
 */
export function composeBijiName(sigungu: string | null | undefined, tier: BudgetTier): string {
  const short = sigunguShortLabel(sigungu);
  if (!short) return tier.label;
  return `${short} ${tier.label}`;
}
