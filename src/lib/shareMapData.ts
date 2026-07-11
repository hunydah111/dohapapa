// 공유용 지도 카드 데이터 — 거래 지도·회복률 지도 공유 카드(/s/trade·/s/recovery)의
// 단일 데이터 소스 (2026-07-11 사장: 지도도 전용 공유 카드). HTML 페이지(CSS grid)와
// OG 이미지(satori 절대배치)가 같은 tiles/legend/callouts 를 쓴다 — 색·밴드 단일화.
//
// 순수 데이터 모듈 — 빌드 타임 JSON(dailyPatch·regionPeaks)만, 요청당 I/O 0.

import { TILE_MAP, TILE_GRID_COLS, TILE_GRID_ROWS, tileLevel } from "@/lib/tileMap";
import { recoveryBand } from "@/lib/regionPeaks";
import regionPeaksRaw from "@/data/regionPeaks.json";
import dailyPatchRaw from "@/data/dailyPatch.json";

export type MapKind = "trade" | "recovery";

// 색문법 — DailyFront 지도와 동일(거래=먹 농담, 회복=시세 방향색). 상수 소형·안정이라 병기.
const INK = "#191713";
const PAPER = "#fbfaf6";
const INK_SOFT = "#5d574c";
const TILE_FILL = ["#f3efe6", "#e4ddc9", "#c9bfa0", INK] as const;
const TILE_TEXT = [INK_SOFT, INK, INK, PAPER] as const;
const RECOVERY_FILL = ["#1f4e82", "#c7d8ea", "#e8a0a4", "#c9252d"] as const;
const RECOVERY_TEXT = [PAPER, INK, INK, PAPER] as const;

export const TILE_BORDER = "#e3ddcd";
export const MAP_COLS = TILE_GRID_COLS;
export const MAP_ROWS = TILE_GRID_ROWS;

export interface ShareTile {
  sigungu: string;
  col: number;
  row: number;
  label: string;
  fill: string;
  text: string;
}
export interface ShareCallout {
  sigungu: string;
  value: string;
}
export interface ShareMap {
  tiles: ShareTile[];
  legend: { bg: string; label: string }[];
  /** 우측/하단 콜아웃 — 거래: 가장 활발한 구, 회복: 회복률 최상위 구(각 3). */
  callouts: ShareCallout[];
  emptyFill: string;
}

const regionCounts = (dailyPatchRaw as { regionCounts?: Record<string, number> }).regionCounts;
const peaks = (
  regionPeaksRaw as { regions?: Record<string, { recovery: number; peakYm: string }> }
).regions;

export function buildShareMap(kind: MapKind): ShareMap {
  const tiles: ShareTile[] = Object.entries(TILE_MAP).map(([sigungu, t]) => {
    if (kind === "trade") {
      const lvl = tileLevel(regionCounts?.[sigungu] ?? 0);
      return { sigungu, col: t.col, row: t.row, label: t.label, fill: TILE_FILL[lvl], text: TILE_TEXT[lvl] };
    }
    const e = peaks?.[sigungu];
    if (!e) return { sigungu, col: t.col, row: t.row, label: t.label, fill: TILE_FILL[0], text: INK_SOFT };
    const b = recoveryBand(e.recovery);
    return { sigungu, col: t.col, row: t.row, label: t.label, fill: RECOVERY_FILL[b], text: RECOVERY_TEXT[b] };
  });

  const legend =
    kind === "trade"
      ? [
          { bg: TILE_FILL[3], label: "7건+" },
          { bg: TILE_FILL[2], label: "3~6" },
          { bg: TILE_FILL[1], label: "1~2" },
          { bg: TILE_FILL[0], label: "0건" },
        ]
      : [
          { bg: RECOVERY_FILL[3], label: "신고가" },
          { bg: RECOVERY_FILL[2], label: "90~100%" },
          { bg: RECOVERY_FILL[1], label: "75~90%" },
          { bg: RECOVERY_FILL[0], label: "75% 미만" },
        ];

  let callouts: ShareCallout[] = [];
  if (kind === "trade" && regionCounts) {
    callouts = Object.entries(regionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([sigungu, c]) => ({ sigungu, value: `${c}건` }));
  } else if (kind === "recovery" && peaks) {
    callouts = Object.entries(peaks)
      .sort((a, b) => b[1].recovery - a[1].recovery)
      .slice(0, 3)
      .map(([sigungu, e]) => ({ sigungu, value: `${Math.round(e.recovery * 100)}%` }));
  }

  return { tiles, legend, callouts, emptyFill: TILE_FILL[0] };
}
