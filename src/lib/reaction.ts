// 오늘의 반응 (v2.6) — 거래별 시세 평가 스탬프의 순수 로직 (DB·API 접근 없음).
// API 라우트·클라이언트 칩·테스트가 전부 이 파일 하나를 공유한다.
//
// 법적 방어 프레임(사장 확정 v5 + 3종 축소 확정):
// - 평가 대상은 "이미 체결·공개된 과거 거래"에 대한 독자 사후 평가 — 매물·호가 평가 아님.
//   캡션 "지난 거래에 대한 독자 평가 · 매수·매도 권유 아님 · 새벽 3시 리셋"을 스탬프
//   바로 아래 인라인으로 인쇄한다(스크린샷에 함께 잘리도록).
// - 조직 투표 방어(공인중개사법 33조의2 리스크): 읽기 시점 휴리스틱 — 해당 거래의 오늘
//   총 참여가 (전체 거래 오늘 참여 중앙값 × 10 초과 && 50 초과)면 카운트 대신
//   "참여 급증 감지 — 집계 보류"를 표시한다(버튼은 유지).
// - 개인정보·IP 저장 금지 — 집계 카운트만 남는다(AggCounter 재사용, No-PII).
//
// 새벽 3시 리셋: 집계 키 = KST 기준 (now − 3시간)의 날짜. 삭제 배치 불필요 —
// 읽기·쓰기 모두 "오늘 키"만 만지고, 지난 키는 자연히 조회되지 않는다.

import { dealKey as patchDealKey } from "@/lib/patchNote";

// ── 스탬프 3종 — 고정 배열(과열→중립→저평가 3점 척도, 2026-07-07 사장 최종 확정) ──
export const REACTION_STAMPS = [
  { slug: "hot", emoji: "🌡️", label: "과열" },
  { slug: "fair", emoji: "👌", label: "적당" },
  { slug: "cheap", emoji: "💎", label: "싸다" },
] as const;

export type ReactionStampSlug = (typeof REACTION_STAMPS)[number]["slug"];

const STAMP_SLUGS: ReadonlySet<string> = new Set(REACTION_STAMPS.map((s) => s.slug));

/** 화이트리스트 검증 — API POST는 이걸 통과 못 하면 200으로 조용히 무시(어뷰징 저항). */
export function isReactionStamp(v: unknown): v is ReactionStampSlug {
  return typeof v === "string" && STAMP_SLUGS.has(v);
}

// ── 문턱 상수 ────────────────────────────────────────────────────────────────
/** 총 참여가 이 미만이면 카운트 숨김(버튼만) — 빈약한 표본을 여론처럼 안 보이게. */
export const REACTION_MIN_TOTAL = 5;
/** 이상 참여 — 오늘 전체 거래 참여 중앙값의 이 배수 "초과"여야 감지. */
export const REACTION_ANOMALY_MULT = 10;
/** 이상 참여 — 절대 건수도 이 값 "초과"여야 감지(저볼륨 날 오탐 방지). */
export const REACTION_ANOMALY_MIN = 50;
/** 집계일 경계(KST 시각) — 새벽 3시. */
export const REACTION_RESET_HOUR_KST = 3;
/** GET 배치 조회 상한 — 동네면 한 페이지 분량(주요+강세+상위 20행) 여유 포함. */
export const REACTION_MAX_BATCH_KEYS = 60;
/** dealKey 길이 상한 — 비정상 페이로드 컷. */
export const REACTION_MAX_DEAL_KEY_LEN = 300;

// ── 집계일 키 — 새벽 3시 리셋 ────────────────────────────────────────────────
/** KST 기준 (now − 3h)의 날짜 "YYYY-MM-DD". KST=UTC+9 이므로 UTC+6 시각의 날짜와 같다. */
export function reactionDateKey(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + 6 * 3_600_000); // +9h(KST) − 3h(리셋)
  return shifted.toISOString().slice(0, 10);
}

// ── 거래 키 — patchNote dealKey(sigungu|apt|area|date|price|floor)와 동일 규격 ──
/** 지면 아이템(MajorItem/PatchItem/RegionTopItem) 필드 → patchNote dealKey 재사용.
 *  규격이 갈라지면 내일 지면 "어제 최다 반응" 환류가 못 잇는다 — 반드시 이 함수로만. */
export function reactionDealKey(d: {
  sigungu: string;
  apt: string;
  areaM2: number;
  dealDate: string;
  priceKrw: number;
  floor: number | null;
}): string {
  return patchDealKey({
    sigunguName: d.sigungu,
    apartmentName: d.apt,
    area: d.areaM2,
    dealDateISO: d.dealDate,
    priceKrw: d.priceKrw,
    dongName: "", // dealKey 미사용 필드 — 타입 충족용
    floor: d.floor,
  });
}

// ── AggCounter 키 — bijiDistribution("bd:")과 같은 프리픽스 규약("rx:") ─────────
export const REACTION_KEY_PREFIX = "rx:";

export function reactionAggKey(
  dateKey: string,
  dealKey: string,
  slug: ReactionStampSlug,
): string {
  return `${REACTION_KEY_PREFIX}${dateKey}:${dealKey}:${slug}`;
}

/** 역파싱 — dealKey에 ":"가 들어 있어도 안전하게: dateKey는 고정 10자,
 *  slug는 마지막 콜론 뒤 화이트리스트 값. 규약 밖 키는 null(조회에서 무시). */
export function parseReactionAggKey(
  key: string,
): { dateKey: string; dealKey: string; slug: ReactionStampSlug } | null {
  if (!key.startsWith(REACTION_KEY_PREFIX)) return null;
  const rest = key.slice(REACTION_KEY_PREFIX.length);
  const dateKey = rest.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || rest[10] !== ":") return null;
  const lastColon = rest.lastIndexOf(":");
  if (lastColon <= 10) return null;
  const dealKey = rest.slice(11, lastColon);
  const slug = rest.slice(lastColon + 1);
  if (dealKey.length === 0 || !isReactionStamp(slug)) return null;
  return { dateKey, dealKey, slug };
}

/** localStorage 중복 방지 키 — 1일 1거래 1스탬프(v1: 최초 1회만, 변경 불가). */
export function reactedStorageKey(dateKey: string, dealKey: string): string {
  return `biji-reacted:${dateKey}:${dealKey}`;
}

// ── 집계 요약 — 읽기 시점 순수 계산 (API GET·테스트 공유) ─────────────────────
export interface ReactionRow {
  dealKey: string;
  slug: ReactionStampSlug;
  count: number;
}

export interface DealReactionSummary {
  dealKey: string;
  /** 스탬프별 카운트 — 3종 전부 항상 채움(없으면 0). */
  counts: Record<ReactionStampSlug, number>;
  total: number;
  /** true = 카운트 표기 가능(총 5명 이상 && 이상 아님). false = 버튼만. */
  showCounts: boolean;
  /** true = "참여 급증 감지 — 집계 보류" 표시(버튼 유지·카운트 숨김). */
  anomaly: boolean;
}

function emptyCounts(): Record<ReactionStampSlug, number> {
  return { hot: 0, fair: 0, cheap: 0 };
}

/** 중앙값 — 짝수 길이는 가운데 두 값 평균. 빈 배열은 0. */
export function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 이상 참여 판정 — 둘 다 "초과"(≥ 아님). 중앙값엔 해당 거래 자신도 포함된다
 *  (전체 거래 오늘 참여의 중앙값 — 스펙 문언 그대로. 오늘 참여 거래가 그 1건뿐이면
 *  중앙값=자기 총계라 감지 불가 — v1 한계로 문서화). */
export function isAnomalousParticipation(total: number, medianTotal: number): boolean {
  return total > medianTotal * REACTION_ANOMALY_MULT && total > REACTION_ANOMALY_MIN;
}

/**
 * 오늘 키 전체 rows → 요청된 dealKeys 각각의 요약.
 * 중앙값은 "요청분"이 아니라 오늘 참여가 있었던 전체 거래의 총참여로 계산한다
 * (요청 배치가 좁아도 이상 감지 기준은 지면 전체 기준).
 */
export function summarizeReactions(
  rows: readonly ReactionRow[],
  requestedDealKeys: readonly string[],
): DealReactionSummary[] {
  const byDeal = new Map<string, Record<ReactionStampSlug, number>>();
  for (const r of rows) {
    const c = byDeal.get(r.dealKey) ?? emptyCounts();
    c[r.slug] += r.count;
    byDeal.set(r.dealKey, c);
  }
  const totals = new Map<string, number>();
  for (const [k, c] of byDeal) totals.set(k, c.hot + c.fair + c.cheap);
  const med = medianOf([...totals.values()]);

  return requestedDealKeys.map((dealKey) => {
    const counts = byDeal.get(dealKey) ?? emptyCounts();
    const total = totals.get(dealKey) ?? 0;
    const anomaly = isAnomalousParticipation(total, med);
    return {
      dealKey,
      counts,
      total,
      showCounts: total >= REACTION_MIN_TOTAL && !anomaly,
      anomaly,
    };
  });
}

/** 오늘 최다 참여 거래 1건 — 내일 지면 "어제 최다 반응" 코너용(API ?top=1).
 *  이상 참여 감지 거래는 제외(조직 투표가 내일 지면을 사면 방어가 무의미해진다).
 *  동률은 dealKey 사전순 — 결정적. 참여 0이면 null. */
export function topReaction(
  rows: readonly ReactionRow[],
): { dealKey: string; total: number; counts: Record<ReactionStampSlug, number> } | null {
  const totals = new Map<string, number>();
  const byDeal = new Map<string, Record<ReactionStampSlug, number>>();
  for (const r of rows) {
    totals.set(r.dealKey, (totals.get(r.dealKey) ?? 0) + r.count);
    const c = byDeal.get(r.dealKey) ?? emptyCounts();
    c[r.slug] += r.count;
    byDeal.set(r.dealKey, c);
  }
  const med = medianOf([...totals.values()]);
  let best: { dealKey: string; total: number } | null = null;
  for (const [dealKey, total] of totals) {
    if (total <= 0) continue;
    if (isAnomalousParticipation(total, med)) continue;
    if (
      !best ||
      total > best.total ||
      (total === best.total && dealKey < best.dealKey)
    ) {
      best = { dealKey, total };
    }
  }
  return best ? { ...best, counts: byDeal.get(best.dealKey) ?? emptyCounts() } : null;
}
