// 주간 동네(시군구) 인기 차트 집계 — 멜론식 "이번 주 인기 동네".
// AggCounter 에 "nb:<ISO주차KST>:<시군구>" 키로 추천 결과 상위 시군구의 증가값만 누적한다.
// 컴플라이언스: 프로필·식별정보 없음(시군구 카운트만) — No-PII 원칙 유지.
// 모든 함수는 실패해도 추천 흐름/응답을 막지 않도록 try/catch 로 우아하게 degrade.

import { db } from "@/lib/db";

const PREFIX = "nb:";
const TOP_PER_REQUEST = 3; // 요청당 상위 N개 시군구만 집계(인기 동네 1곳이 과대표되지 않게)

/**
 * 한국 시간(KST) 기준 ISO 주차 키 — 예 "2026-W21".
 * 기록과 조회가 같은 기준을 쓰므로 버킷이 어긋나지 않는다. (서버는 UTC라 +9h 시프트 후 계산.)
 */
export function isoWeekKeyKST(now: Date = new Date()): string {
  const k = new Date(now.getTime() + 9 * 3_600_000); // KST 벽시계로 시프트
  const d = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // 월=1 … 일=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // 그 주의 목요일로 (ISO 주 결정 기준일)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function prevWeekKeyKST(now: Date = new Date()): string {
  return isoWeekKeyKST(new Date(now.getTime() - 7 * 86_400_000));
}

/** 추천 결과 상위 시군구 +1 (현재 주차 버킷). 실패는 무시 — 집계는 부가기능. */
export async function recordNeighborhoods(sigungus: string[]): Promise<void> {
  const top = [...new Set(sigungus.filter(Boolean))].slice(0, TOP_PER_REQUEST);
  if (top.length === 0) return;
  const week = isoWeekKeyKST();
  try {
    await Promise.all(
      top.map((sgg) => {
        const key = `${PREFIX}${week}:${sgg}`;
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

export interface NeighborhoodChartEntry {
  rank: number;
  sigungu: string;
  count: number;
  /** 지난주 대비 순위 변동: 양수=상승, 음수=하락, 0=유지, null=신규(NEW). */
  rankDelta: number | null;
}

export interface NeighborhoodChart {
  week: string;
  entries: NeighborhoodChartEntry[];
  total: number;
}

function rankRows(rows: { key: string; count: number }[], prefix: string) {
  const counts = rows
    .map((r) => ({ sigungu: r.key.slice(prefix.length), count: r.count }))
    .filter((r) => r.sigungu)
    .sort(
      (a, b) => b.count - a.count || a.sigungu.localeCompare(b.sigungu, "ko"),
    );
  const ranks = new Map<string, number>();
  counts.forEach((c, i) => ranks.set(c.sigungu, i + 1));
  return { counts, ranks };
}

/** 이번 주 인기 동네 차트(상위 limit). 지난주 순위와 비교해 변동(rankDelta) 계산. */
export async function getNeighborhoodChart(limit = 8): Promise<NeighborhoodChart> {
  const week = isoWeekKeyKST();
  const prevWeek = prevWeekKeyKST();
  try {
    const [thisRows, prevRows] = await Promise.all([
      db.aggCounter.findMany({ where: { key: { startsWith: `${PREFIX}${week}:` } } }),
      db.aggCounter.findMany({
        where: { key: { startsWith: `${PREFIX}${prevWeek}:` } },
      }),
    ]);
    const cur = rankRows(thisRows, `${PREFIX}${week}:`);
    const prev = rankRows(prevRows, `${PREFIX}${prevWeek}:`);
    const total = cur.counts.reduce((a, b) => a + b.count, 0);
    const entries: NeighborhoodChartEntry[] = cur.counts
      .slice(0, limit)
      .map((c, i) => {
        const prevRank = prev.ranks.get(c.sigungu);
        return {
          rank: i + 1,
          sigungu: c.sigungu,
          count: c.count,
          rankDelta: prevRank == null ? null : prevRank - (i + 1),
        };
      });
    return { week, entries, total };
  } catch {
    return { week, entries: [], total: 0 };
  }
}
