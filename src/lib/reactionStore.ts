// 오늘의 반응 — 저장/조회 (서버 전용).
//
// DB 패턴: bijiDistribution(src/lib/bijiDistribution.ts)과 동일 — 기존 AggCounter
// (key-value 누적 카운터, prisma/schema.prisma)를 "rx:" 프리픽스 키로 재사용한다.
// 새 Prisma 모델·마이그레이션 불필요(배포 무마이그레이션), 원자적 upsert increment,
// No-PII(개인정보·IP 저장 금지 — 범주 키의 카운트만).
//
// 개발 폴백: DB 없는 로컬(NODE_ENV=development, DATABASE_URL 미설정 등)에서는
// 인메모리 Map으로 폴백해 흐름 검증이 가능하다. production에서는 폴백하지 않고
// bijiDistribution과 동일하게 조용히 실패한다(쓰기 무시·읽기 빈 배열).

import {
  parseReactionAggKey,
  reactionAggKey,
  REACTION_KEY_PREFIX,
  type ReactionRow,
  type ReactionStampSlug,
} from "@/lib/reaction";

// ── 개발용 인메모리 폴백 — dev 서버 핫리로드에도 살아남게 globalThis에 고정 ────
const memGlobal = globalThis as unknown as {
  __bijiReactionMem?: Map<string, number>;
};
function memStore(): Map<string, number> {
  memGlobal.__bijiReactionMem ??= new Map();
  return memGlobal.__bijiReactionMem;
}
const allowMemFallback = process.env.NODE_ENV !== "production";

/** db.ts는 모듈 로드 시 PrismaClient를 만들므로 동적 import로 지연 —
 *  DATABASE_URL 없는 dev에서 라우트 모듈 로드 자체가 죽지 않게. */
async function getDb() {
  const { db } = await import("@/lib/db");
  return db;
}

/** 스탬프 1건 누적 — 원자적 upsert increment. 실패는 조용히(집계는 부가 기능). */
export async function recordReaction(
  dateKey: string,
  dealKey: string,
  slug: ReactionStampSlug,
): Promise<void> {
  const key = reactionAggKey(dateKey, dealKey, slug);
  try {
    const db = await getDb();
    await db.aggCounter.upsert({
      where: { key },
      create: { key, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch {
    if (allowMemFallback) {
      const mem = memStore();
      mem.set(key, (mem.get(key) ?? 0) + 1);
    }
    /* production: 집계 실패 무시 — bijiDistribution과 동일 */
  }
}

/** 오늘 키 전체 조회 — 이상 감지 중앙값 계산에 "전체 거래" 참여가 필요해서
 *  요청 dealKeys로 좁히지 않고 오늘 프리픽스 전부를 읽는다(하루치 소량). */
export async function readTodayReactionRows(dateKey: string): Promise<ReactionRow[]> {
  const prefix = `${REACTION_KEY_PREFIX}${dateKey}:`;
  try {
    const db = await getDb();
    const rows = await db.aggCounter.findMany({
      where: { key: { startsWith: prefix } },
    });
    return toReactionRows(rows.map((r) => ({ key: r.key, count: r.count })), dateKey);
  } catch {
    if (allowMemFallback) {
      const out: { key: string; count: number }[] = [];
      for (const [key, count] of memStore()) {
        if (key.startsWith(prefix)) out.push({ key, count });
      }
      return toReactionRows(out, dateKey);
    }
    return [];
  }
}

function toReactionRows(
  raw: readonly { key: string; count: number }[],
  dateKey: string,
): ReactionRow[] {
  const out: ReactionRow[] = [];
  for (const r of raw) {
    const parsed = parseReactionAggKey(r.key);
    if (!parsed || parsed.dateKey !== dateKey) continue; // 규약 밖 키 무시
    out.push({ dealKey: parsed.dealKey, slug: parsed.slug, count: r.count });
  }
  return out;
}
