"use client";

import { useEffect, useState } from "react";
import {
  getRegions,
  bestBoardFor,
  regionId,
  regionLabel,
  type Board,
  type LeagueRegion,
  type LeagueUnit,
} from "@/lib/league";

// 오늘의 동네 — 날짜 시드로 매일 한 곳(동 단위)을 뽑아 "살아있음" 연출(DB0·번들). 배포 없이 매일 바뀜.
// 하이드레이션 안전: new Date()는 마운트 후(useEffect)에만 — 서버/클라 날짜 불일치 방지.
export function TodayNeighborhood({ onPick }: { onPick?: (id: string, unit: LeagueUnit) => void }) {
  const [pick, setPick] = useState<{ region: LeagueRegion; board: Board } | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- 날짜 시드 픽(마운트 1회, 하이드레이션 안전) */
  useEffect(() => {
    const regions = getRegions("dong");
    if (!regions.length) return;
    const now = new Date();
    const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    const region = regions[seed % regions.length];
    setPick({ region, board: bestBoardFor(region) });
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!pick) return null;
  const { region, board } = pick;
  const rank = region.ranks[board.id];

  return (
    <button
      onClick={() => onPick?.(regionId(region), "dong")}
      className="flex w-full items-center gap-3 rounded-2xl border border-[#e3d5bd] bg-[#fffdf8] px-4 py-3 text-left shadow-sm transition-transform hover:scale-[1.01]"
    >
      <span className="text-[22px]" aria-hidden>📌</span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="text-[10.5px] font-bold" style={{ color: "#b08948" }}>오늘의 동네 · 매일 바뀜</span>
        <br />
        <span className="text-[15px] font-extrabold" style={{ color: "#3a2c1d" }}>{regionLabel(region)}</span>
        <span className="text-[13px] font-semibold" style={{ color: "#6e5b46" }}> — {board.emoji} {board.label} {rank}위</span>
      </span>
      <span className="shrink-0 text-[13px] font-bold" style={{ color: "#b08948" }} aria-hidden>보기 ›</span>
    </button>
  );
}
