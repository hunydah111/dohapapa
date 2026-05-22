// 집 찾기 유형 분포 집계 — "줄세우기"(유형 희귀도)용. 비-PII 누적 카운트만.
// AggCounter 테이블에 key="type:{slug}" 로 증가값만 저장한다(프로필·식별정보 없음).
// 모든 함수는 실패해도 추천 흐름을 막지 않도록 try/catch 로 우아하게 degrade.

import { db } from "@/lib/db";
import { HOME_TYPE_SLUGS, type HomeTypeSlug } from "@/lib/homeType";

const PREFIX = "type:";

export type TypeCounts = Record<HomeTypeSlug, number>;

function emptyCounts(): TypeCounts {
  return Object.fromEntries(HOME_TYPE_SLUGS.map((s) => [s, 0])) as TypeCounts;
}

/** 유형 카운트 +1 (upsert). 실패는 무시 — 집계는 부가기능이라 절대 응답을 깨면 안 된다. */
export async function incrementTypeCount(slug: HomeTypeSlug): Promise<void> {
  try {
    await db.aggCounter.upsert({
      where: { key: PREFIX + slug },
      create: { key: PREFIX + slug, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch {
    /* 집계 실패 무시 */
  }
}

/** 전체 유형 분포. 테이블 없음/실패 시 0 분포(→ UI 자동 숨김). */
export async function getTypeCounts(): Promise<{
  counts: TypeCounts;
  total: number;
}> {
  try {
    const rows = await db.aggCounter.findMany({
      where: { key: { startsWith: PREFIX } },
    });
    const counts = emptyCounts();
    for (const r of rows) {
      const slug = r.key.slice(PREFIX.length) as HomeTypeSlug;
      if (slug in counts) counts[slug] = r.count;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { counts, total };
  } catch {
    return { counts: emptyCounts(), total: 0 };
  }
}
