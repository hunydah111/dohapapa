// 동네 리그 — 동(읍면동)·시군구 2단위 × 4개 보드 순위. 번들 leagueTable.json(빌드시 굽힘) 읽음, DB0·순수.
// 컴플라이언스: 동네 줄세우기지 개인 아님. 과거 실거래 지수 기반·미래예측 아님.

import table from "@/data/leagueTable.json";

export type BoardId = "momentum" | "trades" | "value" | "fresh";
export type LeagueUnit = "dong" | "sigungu";

export interface LeagueRegion {
  sigungu: string;
  dongName: string | null; // 동 단위면 동 이름, 시군구 단위면 null
  momentumPct: number; // 최근 3개월 상승률(%)  ※동은 부모 시군구 값 차용
  trades: number; // median window 총 거래수
  complexCount: number;
  pricePerPy: number; // 만원/평
  recentSharePct: number; // 최근 10년 신축 비율(%)
  medianBuildYear: number; // 동네 아파트 준공연도 중앙값
  ranks: Record<BoardId, number>;
}

export interface Board {
  id: BoardId;
  emoji: string;
  label: string;
  desc: string;
  /** 해당 보드에서 그 동네의 값 표시. */
  stat: (r: LeagueRegion) => string;
}

export const BOARDS: Board[] = [
  { id: "momentum", emoji: "🔥", label: "상승 모멘텀", desc: "최근 3개월 가장 많이 오른 동네",
    stat: (r) => `${r.momentumPct >= 0 ? "+" : ""}${r.momentumPct}%` },
  { id: "trades", emoji: "📈", label: "거래 활발", desc: "손바뀜이 가장 많은 동네",
    stat: (r) => `${r.trades.toLocaleString()}건` },
  { id: "value", emoji: "🌙", label: "가성비 강세", desc: "저렴한데 잘 버티고 오르는 동네",
    stat: (r) => `평당 ${r.pricePerPy.toLocaleString()}만` },
  { id: "fresh", emoji: "✨", label: "신축 강세", desc: "최근 10년 새 아파트가 많은 동네",
    stat: (r) => `신축 ${r.recentSharePct}%` },
];

export const LEAGUE_AS_OF: string = table.asOf;

const POOLS: Record<LeagueUnit, LeagueRegion[]> = {
  dong: table.regions as LeagueRegion[],
  sigungu: table.sigunguRegions as LeagueRegion[],
};

export function totalOf(unit: LeagueUnit): number {
  return POOLS[unit].length;
}

/** 지역 고유 id — 선택값·localStorage 용. 동은 "시군구|동", 시군구는 "시군구". */
export function regionId(r: LeagueRegion): string {
  return r.dongName ? `${r.sigungu}|${r.dongName}` : r.sigungu;
}

/** 화면 표시명 — "강남구 대치동" 또는 "강남구". */
export function regionLabel(r: LeagueRegion): string {
  return r.dongName ? `${r.sigungu} ${r.dongName}` : r.sigungu;
}

export function getRegions(unit: LeagueUnit): LeagueRegion[] {
  return POOLS[unit];
}

/** 선택 드롭다운용 — 라벨 가나다 정렬 전체 목록. */
export function listRegions(unit: LeagueUnit): LeagueRegion[] {
  return [...POOLS[unit]].sort((a, b) => regionLabel(a).localeCompare(regionLabel(b), "ko"));
}

/** 보드 순위표(상위→하위). */
export function getBoard(id: BoardId, unit: LeagueUnit, limit?: number): LeagueRegion[] {
  const sorted = [...POOLS[unit]].sort((a, b) => a.ranks[id] - b.ranks[id]);
  return limit ? sorted.slice(0, limit) : sorted;
}

export function getRegion(id: string, unit: LeagueUnit): LeagueRegion | null {
  return POOLS[unit].find((r) => regionId(r) === id) ?? null;
}

/** 그 동네가 가장 잘하는(순위 가장 높은) 보드 — 긍정 프레이밍용. */
export function bestBoardFor(r: LeagueRegion): Board {
  let best = BOARDS[0];
  for (const b of BOARDS) {
    if (r.ranks[b.id] < r.ranks[best.id]) best = b;
  }
  return best;
}

export function boardOf(id: BoardId): Board {
  return BOARDS.find((b) => b.id === id)!;
}
