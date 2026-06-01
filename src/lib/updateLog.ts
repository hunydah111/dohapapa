// 업데이트 로그 — /updates 페이지가 읽는 "살아있음 증거" 타임라인. 번들 JSON(주간 크론 누적).
// 빌더: scripts/build-update-log.ts (매주 한 줄 append). 순수·DB0.

import log from "@/data/updateLog.json";

export interface UpdateEntry {
  /** 갱신 실행일 YYYY-MM-DD. */
  date: string;
  /** 반영된 최신 실거래일. */
  latestDealDate: string;
  /** 누적 실거래 건수. */
  txCount: number;
  /** 지난 갱신 대비 증가분(첫 엔트리/미상은 null). */
  newTx: number | null;
  /** 수록 단지 수(과거 미상은 null). */
  complexCount: number | null;
  /** 리그 기준월(과거 미상은 null). */
  asOf: string | null;
  /** 그 시점 최고 상승 동네(과거 미상은 null). */
  topMomentum: { sigungu: string; pct: number } | null;
}

const entries = (log.entries as unknown as UpdateEntry[]) ?? [];

/** 최신 → 과거 순. */
export function getUpdateEntries(): UpdateEntry[] {
  return [...entries].reverse();
}

/** 가장 최근 갱신(없으면 null). */
export function getLatestUpdate(): UpdateEntry | null {
  return entries.length ? entries[entries.length - 1] : null;
}

/** "2026-05-31" → "2026.5.31" / "2026-05" → "2026.5". */
export function fmtDot(d: string): string {
  const [y, m, day] = d.split("-");
  return day ? `${y}.${Number(m)}.${Number(day)}` : `${y}.${Number(m)}`;
}
