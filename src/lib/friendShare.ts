// 친구 공유 — 결과 페이지에서 자기 판정(사정권 slug + sigungu + D-day)만 URL 파라미터로
// 던지고, 친구가 그 URL을 열면 LandingHero·결과 페이지·OG에 친구 판정이 노출됨.
//
// 2026-06-12 한 방 4단계: "{slug}.{시군구}" → "{slug}.{시군구}.{dday}" 3필드 확장.
//  - dday 세그먼트: "now"(지금 가능) | "far"(아득/미도달) | 숫자(일수). 없으면 레거시(비표시).
//  - 프레임은 자조 초대("나 까였다, 너도 까봐") — 1:1 대결 강요 아님 (박탈감 기각 평결).
//
// 2026-07-04 비버 퇴장: 새 발행 링크의 slug는 사정권 라벨(ipseong/sajeonggwon/munbak/adeuk).
// 레거시 slug(queen/rain/bieber/gukmin/baby + justin/fever/top/nan alias)는 계속 파싱
// (하위호환 — 이미 뿌려진 링크가 404·빈 배너가 되면 안 됨). 레거시 tier는 색 테마로만 쓰고
// 이름(비버 등급명)은 절대 노출하지 않는다.
//
// 컴플라이언스: 친구의 프로필(소득·자산·직장 등)은 전혀 전달 안 함. 라벨+동네+D-day 일수만.

import { getTierBySlug } from "./budgetPercentile";
import type { BudgetTier } from "./budgetPercentile";
import {
  composeReachName,
  getReachBySlug,
  reachFromDday,
  REACH_LABELS,
  REACH_THRESHOLD_DAYS,
  type ReachLabel,
} from "./bijiName";
import type { DdayResult } from "./plan/dday";

export const FRIEND_PARAM = "f";

export interface FriendDday {
  kind: "now" | "far" | "days";
  /** kind === "days"일 때만. */
  days?: number;
}

export interface FriendTag {
  /** 레거시 링크(비버 slug)의 tier — 카드 색 테마 전용, 이름 노출 금지. 새 slug 링크는 null. */
  tier: BudgetTier | null;
  sigungu: string;
  /** 3필드 링크에만 존재. 레거시 2필드 링크는 undefined. */
  dday?: FriendDday;
  /** 사정권 라벨 — 새 slug는 slug 자체, 레거시 slug는 dday 세그먼트에서 유도. 유도 불가 시 null. */
  reach: ReachLabel | null;
}

/** DdayResult → URL 세그먼트. null이면 세그먼트 생략(레거시 형태 유지). */
function ddaySegment(dday: DdayResult | null | undefined): string | null {
  if (!dday) return null;
  if (dday.months === 0) return "now";
  if (dday.capped || dday.days === null) return "far";
  return String(dday.days);
}

/** FriendDday(URL 세그먼트) → 사정권 라벨 — 레거시 링크의 라벨 유도용. */
export function reachFromFriendDday(d: FriendDday | null | undefined): ReachLabel | null {
  if (!d) return null;
  if (d.kind === "now") return REACH_LABELS.ipseong;
  if (d.kind === "far") return REACH_LABELS.adeuk;
  const days = d.days ?? 0;
  return days <= REACH_THRESHOLD_DAYS ? REACH_LABELS.sajeonggwon : REACH_LABELS.munbak;
}

/**
 * 자기 판정을 친구 공유용 짧은 string으로 인코딩. "{reachSlug}.{시군구}[.{dday}]"
 * slug는 항상 새 사정권 라벨 — dday가 없으면(데이터 부족) 보수적으로 adeuk.
 */
export function encodeFriend(sigungu: string, dday?: DdayResult | null): string {
  const reach = reachFromDday(dday);
  const base = `${reach.slug}.${encodeURIComponent(sigungu)}`;
  const seg = ddaySegment(dday);
  return seg ? `${base}.${seg}` : base;
}

/** URL 파라미터 값을 FriendTag으로 디코드. 잘못된 형식이면 null. 레거시 2·3필드 호환. */
export function decodeFriend(raw: string | null | undefined): FriendTag | null {
  if (!raw) return null;
  const dotIdx = raw.indexOf(".");
  if (dotIdx <= 0 || dotIdx === raw.length - 1) return null;
  const slug = raw.slice(0, dotIdx);
  let rest = raw.slice(dotIdx + 1);

  // 새 사정권 slug 우선, 아니면 레거시 비버 slug (색 테마용 tier로만 보존).
  const reachFromSlug = getReachBySlug(slug);
  const tier = reachFromSlug ? null : getTierBySlug(slug);
  if (!reachFromSlug && !tier) return null;

  // 3번째 세그먼트(dday) — 마지막 점 뒤가 now|far|숫자일 때만 분리.
  // 시군구 자체엔 점이 없으므로(인코딩됨) 안전하지만, 보수적으로 패턴 검증.
  let dday: FriendDday | undefined;
  const lastDot = rest.lastIndexOf(".");
  if (lastDot > 0 && lastDot < rest.length - 1) {
    const seg = rest.slice(lastDot + 1);
    if (seg === "now") dday = { kind: "now" };
    else if (seg === "far") dday = { kind: "far" };
    else if (/^\d{1,5}$/.test(seg)) dday = { kind: "days", days: Number(seg) };
    if (dday) rest = rest.slice(0, lastDot);
  }

  let sigungu: string;
  try {
    sigungu = decodeURIComponent(rest);
  } catch {
    return null;
  }
  if (!sigungu || sigungu.length > 20) return null;

  // 사정권 라벨 — 새 slug는 그대로, 레거시 slug는 dday 세그먼트에서 유도(없으면 null → "판정" 폴백).
  const reach = reachFromSlug ?? reachFromFriendDday(dday);
  return { tier, sigungu, dday, reach };
}

/** 친구 카드 히어로 이름 — "마포구 사정권" (레거시 dday 없는 링크는 "마포구 판정"). */
export function friendReachName(tag: FriendTag | null | undefined): string | null {
  if (!tag) return null;
  return composeReachName(tag.sigungu, tag.reach);
}

/** 친구 D-day 표시 문자열 — "D-5,114" | "지금 입성 가능" | "D-아득". 없으면 null. */
export function friendDdayLabel(tag: FriendTag | null | undefined): string | null {
  const d = tag?.dday;
  if (!d) return null;
  if (d.kind === "now") return "지금 입성 가능";
  if (d.kind === "far") return "D-아득";
  return `D-${(d.days ?? 0).toLocaleString()}`;
}

/** 친구 공유용 전체 URL 생성. siteUrl 끝에 / 없어야 함. */
export function buildFriendUrl(
  siteUrl: string,
  sigungu: string,
  dday?: DdayResult | null,
): string {
  return `${siteUrl}/?${FRIEND_PARAM}=${encodeFriend(sigungu, dday)}`;
}

/** 현재 URL에서 친구 태그 읽기 (브라우저 only). */
export function readFriendFromLocation(): FriendTag | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return decodeFriend(params.get(FRIEND_PARAM));
}

/** 디코드 검증 — 새 사정권 slug 또는 레거시 비버 slug(alias 포함) 여부. */
export function isValidFriendSlug(slug: string): boolean {
  return getReachBySlug(slug) !== null || getTierBySlug(slug) !== null;
}
