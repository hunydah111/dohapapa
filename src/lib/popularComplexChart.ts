// 주간 인기 아파트(단지) 차트 집계 — 멜론식 "이번 주 인기 아파트".
// AggCounter 에 "ap:<ISO주차KST>:<complexId>\x1f<단지명>\x1f<시군구>\x1f<동>" 키로 추천 결과
// 상위 단지의 증가값만 누적한다. 표시정보를 키에 함께 담아 조회 시 스냅샷 로드가 불필요하다.
// 컴플라이언스: '조건에 맞아 많이 뜬 단지' 사용집계(사실)일 뿐 추천·광고·순위보장 아님. No-PII.
// 모든 함수는 실패해도 응답을 막지 않도록 try/catch 로 우아하게 degrade.

import { db } from "@/lib/db";
import { isoWeekKeyKST } from "@/lib/neighborhoodChart";

const PREFIX = "ap:";
const TOP_PER_REQUEST = 3; // 요청당 상위 N단지만 집계(한 단지 과대표 방지)
// 키 내부 구분자 — 실제 단지명/지명엔 없는 제어문자(U+001F, Unit Separator).
const SEP = "";

export interface PopularComplexInput {
  complexId: string;
  complexName: string;
  sigungu: string;
  dongName: string;
}

/** 추천 결과 상위 단지 +1 (현재 주차 버킷). 실패는 무시 — 집계는 부가기능. */
export async function recordPopularComplexes(
  complexes: PopularComplexInput[],
): Promise<void> {
  const seen = new Set<string>();
  const top: PopularComplexInput[] = [];
  for (const c of complexes) {
    if (!c.complexId || !c.complexName) continue;
    // 구분자가 든 비정상 값은 스킵(실데이터엔 없음).
    if ([c.complexName, c.sigungu, c.dongName].some((s) => s?.includes(SEP)))
      continue;
    if (seen.has(c.complexId)) continue;
    seen.add(c.complexId);
    top.push(c);
    if (top.length >= TOP_PER_REQUEST) break;
  }
  if (top.length === 0) return;
  const week = isoWeekKeyKST();
  try {
    await Promise.all(
      top.map((c) => {
        const key = `${PREFIX}${week}:${c.complexId}${SEP}${c.complexName}${SEP}${c.sigungu}${SEP}${c.dongName}`;
        return db.aggCounter.upsert({
          where: { key },
          create: { key, count: 1 },
          update: { count: { increment: 1 } },
        });
      }),
    );
  } catch {
    /* 집계 실패 무시 */
  }
}

export interface PopularComplexEntry {
  rank: number;
  complexName: string;
  sigungu: string;
  dongName: string;
  count: number;
  /** 지난주 대비 순위 변동: 양수=상승, 음수=하락, 0=유지, null=신규(NEW). */
  rankDelta: number | null;
}

export interface PopularComplexChart {
  week: string;
  entries: PopularComplexEntry[];
  total: number;
  /** 이번 주 집계의 최신 갱신 시각(ISO). 데이터 없으면 null. */
  lastUpdated: string | null;
}

interface ParsedRow {
  complexId: string;
  complexName: string;
  sigungu: string;
  dongName: string;
  count: number;
}

function parseRows(rows: { key: string; count: number }[], prefix: string) {
  const parsed: ParsedRow[] = [];
  for (const r of rows) {
    const parts = r.key.slice(prefix.length).split(SEP);
    if (parts.length < 4 || !parts[0] || !parts[1]) continue;
    parsed.push({
      complexId: parts[0],
      complexName: parts[1],
      sigungu: parts[2],
      dongName: parts[3],
      count: r.count,
    });
  }
  parsed.sort(
    (a, b) =>
      b.count - a.count || a.complexName.localeCompare(b.complexName, "ko"),
  );
  const ranks = new Map<string, number>(); // complexId → 순위
  parsed.forEach((c, i) => ranks.set(c.complexId, i + 1));
  return { parsed, ranks };
}

/** 이번 주 인기 아파트 차트(상위 limit). 지난주 순위와 비교해 변동(rankDelta) 계산. */
export async function getPopularComplexChart(
  limit = 8,
): Promise<PopularComplexChart> {
  const week = isoWeekKeyKST();
  const prevWeek = isoWeekKeyKST(new Date(Date.now() - 7 * 86_400_000));
  try {
    const [thisRows, prevRows] = await Promise.all([
      db.aggCounter.findMany({ where: { key: { startsWith: `${PREFIX}${week}:` } } }),
      db.aggCounter.findMany({
        where: { key: { startsWith: `${PREFIX}${prevWeek}:` } },
      }),
    ]);
    const cur = parseRows(thisRows, `${PREFIX}${week}:`);
    const prev = parseRows(prevRows, `${PREFIX}${prevWeek}:`);
    const total = cur.parsed.reduce((a, b) => a + b.count, 0);
    const times = thisRows
      .map((r) => (r as { updatedAt?: Date | string }).updatedAt)
      .filter((t): t is Date | string => t != null)
      .map((t) => new Date(t).getTime());
    const lastUpdated = times.length
      ? new Date(Math.max(...times)).toISOString()
      : null;
    const entries: PopularComplexEntry[] = cur.parsed
      .slice(0, limit)
      .map((c, i) => {
        const prevRank = prev.ranks.get(c.complexId);
        return {
          rank: i + 1,
          complexName: c.complexName,
          sigungu: c.sigungu,
          dongName: c.dongName,
          count: c.count,
          rankDelta: prevRank == null ? null : prevRank - (i + 1),
        };
      });
    return { week, entries, total, lastUpdated };
  } catch {
    return { week, entries: [], total: 0, lastUpdated: null };
  }
}
