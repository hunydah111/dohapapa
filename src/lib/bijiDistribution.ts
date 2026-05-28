// 동네 비지 분포 집계 — "강남구 검색자 중 32%가 저스틴비버" 통계.
// AggCounter에 "bd:{시군구}:{tier_slug}" 키로 누적 (lifetime — 주간 버킷 없이).
// 비지 등급은 사용자 자산·소득 기반이라 분포가 동네별로 자연 형성됨 (강남=상위, 외곽=중위 등).
//
// 컴플라이언스: 시군구 + 등급 슬러그만 — No-PII. 프로필 자체는 저장 안 함.
// MIN_TOTAL 미만이면 표시 안 함 (사용자 룰 [[feedback-no-empty-results]]에서 파생: 가짜 시드 금지).

import { db } from "@/lib/db";
import { BEAVER_TIERS, type BeaverTierSlug } from "@/lib/budgetPercentile";

const PREFIX = "bd:";
const MIN_TOTAL = 5; // 이 미만이면 신뢰 X — null 반환

/** 추천 결과 top 후보의 시군구 + 사용자 등급 +1. 실패 무시(집계는 부가). */
export async function recordBijiDistribution(
  sigungu: string,
  tierSlug: BeaverTierSlug,
): Promise<void> {
  if (!sigungu || !tierSlug) return;
  try {
    const key = `${PREFIX}${sigungu}:${tierSlug}`;
    await db.aggCounter.upsert({
      where: { key },
      create: { key, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch {
    /* 집계 실패 무시 */
  }
}

export interface BijiDistribution {
  /** 시군구. */
  sigungu: string;
  /** 이 시군구 매칭자 누적 수. MIN 미만이면 표시 X. */
  total: number;
  /** 가장 흔한 등급 슬러그. total < MIN 이면 null. */
  topSlug: BeaverTierSlug | null;
  /** 가장 흔한 등급 라벨 (UI 표시용). */
  topLabel: string | null;
  /** 가장 흔한 등급 % (반올림). */
  topPercent: number | null;
  /** 사용자 등급의 % (인자로 받은 viewerSlug). */
  viewerPercent: number | null;
}

const VALID_SLUGS: Set<string> = new Set(Object.keys(BEAVER_TIERS));

/**
 * 시군구 비지 분포 조회 + viewer(=현재 사용자) 등급 % 동시 반환.
 * MIN_TOTAL 미만이면 null들 반환 (UI에서 자동 숨김).
 */
export async function getBijiDistribution(
  sigungu: string,
  viewerSlug: BeaverTierSlug,
): Promise<BijiDistribution> {
  if (!sigungu) {
    return { sigungu, total: 0, topSlug: null, topLabel: null, topPercent: null, viewerPercent: null };
  }
  try {
    const rows = await db.aggCounter.findMany({
      where: { key: { startsWith: `${PREFIX}${sigungu}:` } },
    });
    const byTier: Record<string, number> = {};
    let total = 0;
    const offset = `${PREFIX}${sigungu}:`.length;
    for (const r of rows) {
      const slug = r.key.slice(offset);
      if (!VALID_SLUGS.has(slug)) continue;
      byTier[slug] = r.count;
      total += r.count;
    }
    if (total < MIN_TOTAL) {
      return { sigungu, total, topSlug: null, topLabel: null, topPercent: null, viewerPercent: null };
    }
    let topSlug: BeaverTierSlug | null = null;
    let topCount = 0;
    for (const [slug, count] of Object.entries(byTier)) {
      if (count > topCount) {
        topCount = count;
        topSlug = slug as BeaverTierSlug;
      }
    }
    const topLabel = topSlug ? BEAVER_TIERS[topSlug].label : null;
    const topPercent = topSlug ? Math.round((topCount / total) * 100) : null;
    const viewerCount = byTier[viewerSlug] ?? 0;
    const viewerPercent = viewerCount > 0 ? Math.round((viewerCount / total) * 100) : 0;
    return { sigungu, total, topSlug, topLabel, topPercent, viewerPercent };
  } catch {
    return { sigungu, total: 0, topSlug: null, topLabel: null, topPercent: null, viewerPercent: null };
  }
}
