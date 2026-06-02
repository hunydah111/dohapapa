"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BOARDS,
  getBoard,
  getRegion,
  listRegions,
  bestBoardFor,
  boardOf,
  regionId,
  regionLabel,
  totalOf,
  LEAGUE_AS_OF,
  type BoardId,
  type LeagueRegion,
  type LeagueUnit,
} from "@/lib/league";
import { SITE_URL } from "@/lib/site";
import { BijiFallbackImage } from "@/components/BijiFallbackImage";
import { NextRefresh } from "@/components/NextRefresh";
import { TodayNeighborhood } from "@/components/TodayNeighborhood";

// 동네 리그 — 동(읍면동)/시군구 2단위 × 4보드 순위. No-PII(내 동네 id만 localStorage), 번들(DB0).

const STORE_KEY = "biji-league-v2";
type Saved = { unit: LeagueUnit; id: string };

const asOfLabel = (() => {
  const [y, m] = LEAGUE_AS_OF.split("-");
  return `${y}.${Number(m)}`;
})();

const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}위`);

/** 리그 비지 — public/biji/league/<id>.png 있으면 이미지, 없으면 emoji 폴백. */
function LeagueBiji({ id, emoji, alt, className, emojiClassName }: { id: string; emoji: string; alt: string; className: string; emojiClassName?: string }) {
  return <BijiFallbackImage src={`/biji/league/${id}.png?v=1`} emoji={emoji} alt={alt} className={className} emojiClassName={emojiClassName} />;
}

export function LeagueExperience() {
  const [unit, setUnit] = useState<LeagueUnit>("dong");
  const [sel, setSel] = useState<string>("");
  const [board, setBoard] = useState<BoardId>("momentum");
  const [toast, setToast] = useState<string | null>(null);
  const regionList = listRegions(unit);

  /* eslint-disable react-hooks/set-state-in-effect -- localStorage 복원(마운트 1회) */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Saved;
        if (s?.unit && s?.id && getRegion(s.id, s.unit)) {
          setUnit(s.unit);
          setSel(s.id);
        }
      }
    } catch { /* 무시 */ }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const persist = (u: LeagueUnit, id: string) => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ unit: u, id } satisfies Saved)); } catch { /* 무시 */ }
  };

  const choose = (id: string, u: LeagueUnit = unit) => {
    setUnit(u);
    setSel(id);
    persist(u, id);
  };

  // 단위 전환 — 동→시군구는 부모 시군구로 자동 매핑, 시군구→동은(모호) 선택 해제.
  const switchUnit = (u: LeagueUnit) => {
    if (u === unit) return;
    let nextSel = "";
    const cur = sel ? getRegion(sel, unit) : null;
    if (cur && u === "sigungu") {
      const parent = getRegion(cur.sigungu, "sigungu");
      nextSel = parent ? regionId(parent) : "";
    }
    setUnit(u);
    setSel(nextSel);
    persist(u, nextSel);
  };

  const mine: LeagueRegion | null = sel ? getRegion(sel, unit) : null;
  const best = mine ? bestBoardFor(mine) : null;
  const total = totalOf(unit);

  const share = async () => {
    if (!mine || !best) return;
    const url = `${SITE_URL}/league`;
    const text = `${regionLabel(mine)} 이 달의 자랑 ${best.emoji} '${best.label}' ${mine.ranks[best.id]}위 (${total}곳 중) — 너희 동네 자랑은?`;
    try {
      if (navigator.share) await navigator.share({ title: "동네 자랑 리그", text, url });
      else { await navigator.clipboard.writeText(`${text}\n${url}`); setToast("링크 복사됨 — 카톡에 붙여넣기"); setTimeout(() => setToast(null), 2500); }
    } catch { /* 취소 무시 */ }
  };

  const top = getBoard(board, unit, 10);
  const inTop = mine && top.some((r) => regionId(r) === sel);
  const b = boardOf(board);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 py-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold text-coral-600 hover:text-coral-800">← 비집고</Link>
        <span className="text-[12px]" style={{ color: "#9a8f82" }}>
          {asOfLabel} 기준 · {total.toLocaleString()}곳 · 다음 갱신 <NextRefresh />
        </span>
      </div>

      <div className="rounded-3xl px-5 py-4 text-center" style={{ background: "linear-gradient(160deg,#fff4ef,#f7ead0)" }}>
        <LeagueBiji id="flag" emoji="🚩" alt="깃발 든 비지 마스코트" className="mx-auto mb-1 block h-16 w-16 object-contain text-[40px] leading-none" />
        <p className="font-jua text-[22px]" style={{ color: "#e8662f" }}>동네 자랑 리그</p>
        <p className="mt-1 text-[13px]" style={{ color: "#6e5b46" }}>우리 동네, 이 달의 자랑은?</p>
      </div>

      {/* 단위 토글 — 동(세분) / 시군구(전 지역 폴백) */}
      <div className="flex rounded-2xl bg-[#f3ece4] p-1 text-[13px] font-bold">
        {([["dong", "동네별"], ["sigungu", "구·시 전체"]] as [LeagueUnit, string][]).map(([u, label]) => (
          <button
            key={u}
            onClick={() => switchUnit(u)}
            className={`flex-1 rounded-xl py-2 transition-colors ${unit === u ? "bg-coral-600 text-white shadow-sm" : "text-[#6e5b46]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 오늘의 동네 — 매일 바뀜(날짜 시드). 클릭 시 내 동네로 선택. */}
      <TodayNeighborhood onPick={choose} />

      {/* 내 동네 선택 */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[13px] font-semibold" style={{ color: "#6e5b46" }}>내 동네</span>
        <select
          value={sel}
          onChange={(e) => choose(e.target.value)}
          className="min-w-0 flex-1 rounded-2xl border border-[#d9c5a4] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#3a2c1d] focus:outline-none focus:ring-2 focus:ring-coral-400"
        >
          <option value="">{unit === "dong" ? "동 선택…" : "시군구 선택…"}</option>
          {regionList.map((r) => {
            const id = regionId(r);
            return <option key={id} value={id}>{regionLabel(r)}</option>;
          })}
        </select>
      </div>

      {/* 내 동네 카드 — 가장 잘하는 보드 강조(긍정 프레이밍) */}
      {mine && best && (
        <div className="rounded-3xl border border-coral-200 p-5 text-center shadow-sm" style={{ background: "linear-gradient(160deg,#fff1ea,#ffe6d8)" }}>
          {mine.ranks[best.id] === 1 && (
            <LeagueBiji id="champ" emoji="👑" alt="1위 챔피언 비지 마스코트" className="mx-auto mb-1 block h-14 w-14 object-contain text-[36px] leading-none" />
          )}
          <p className="text-[13px] font-semibold" style={{ color: "#b08948" }}>{regionLabel(mine)}의 자랑</p>
          <p className="mt-1 font-jua text-[26px] leading-tight" style={{ color: "#e8662f" }}>
            {best.emoji} {best.label} {medal(mine.ranks[best.id])}
          </p>
          <p className="text-[12.5px]" style={{ color: "#6e5b46" }}>{best.desc} · {best.stat(mine)}</p>
          {/* 4보드 미니 순위 */}
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {BOARDS.map((bd) => (
              <button
                key={bd.id}
                onClick={() => setBoard(bd.id)}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-[12px] transition-colors ${
                  board === bd.id ? "bg-coral-600 text-white" : "bg-white/70 text-[#6e5b46] hover:bg-white"
                }`}
              >
                <span className="font-semibold">{bd.emoji} {bd.label}</span>
                <span className="font-bold">{medal(mine.ranks[bd.id])}</span>
              </button>
            ))}
          </div>
          <button onClick={share} className="mt-3 w-full rounded-2xl bg-amber-300 py-3 text-[15px] font-bold text-coral-900">📤 우리 동네 자랑 / 친구도 시켜보기</button>
        </div>
      )}

      {/* 보드 순위표 */}
      <div className="rounded-3xl border border-[#ecd9b3] bg-[#fffdf8] p-4 shadow-sm">
        {/* 보드 탭 */}
        <div className="grid grid-cols-2 gap-1.5">
          {BOARDS.map((bd) => (
            <button
              key={bd.id}
              onClick={() => setBoard(bd.id)}
              className={`rounded-2xl px-2 py-2 text-[12px] font-bold leading-tight transition-colors ${
                board === bd.id ? "bg-coral-600 text-white" : "bg-[#f3ece4] text-[#6e5b46] hover:bg-[#ecd9b3]"
              }`}
            >
              {bd.emoji} {bd.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11.5px]" style={{ color: "#9a8f82" }}>📍 {b.desc}</p>

        <ol className="mt-3 flex flex-col gap-1">
          {top.map((r) => {
            const id = regionId(r);
            const isMine = id === sel;
            return (
              <li
                key={id}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-[13px] ${
                  isMine ? "bg-coral-50 font-bold text-coral-800" : "text-[#3a2c1d]"
                }`}
              >
                <span className="flex items-center gap-2">
                  {r.ranks[board] === 1 ? (
                    <LeagueBiji id="champ" emoji="👑" alt="1위 챔피언 비지 마스코트" className="inline-block h-7 w-7 shrink-0 text-center text-[20px] leading-7" />
                  ) : (
                    <span className="inline-block w-7 text-center font-bold" style={{ color: isMine ? "#e8662f" : "#b08948" }}>{medal(r.ranks[board])}</span>
                  )}
                  {regionLabel(r)}{isMine && " (내 동네)"}
                </span>
                <span style={{ color: "#6e5b46" }}>{b.stat(r)}</span>
              </li>
            );
          })}
          {mine && !inTop && (
            <>
              <li className="py-0.5 text-center text-[11px]" style={{ color: "#c8bca9" }}>···</li>
              <li className="flex items-center justify-between rounded-xl bg-coral-50 px-3 py-2 text-[13px] font-bold text-coral-800">
                <span className="flex items-center gap-2">
                  <span className="inline-block w-7 text-center font-bold" style={{ color: "#e8662f" }}>{mine.ranks[board]}위</span>
                  {regionLabel(mine)} (내 동네)
                </span>
                <span style={{ color: "#6e5b46" }}>{b.stat(mine)}</span>
              </li>
            </>
          )}
        </ol>
      </div>

      <p className="text-[11px] leading-relaxed" style={{ color: "#b3a99c" }}>
        {asOfLabel} 국토부 공개 실거래 기준 · {unit === "dong" ? "읍면동" : "시군구"} 단위 순위이며 개인 정보 아님 · 과거 실거래 흐름이고 미래 예측·투자권유 아님.
        {unit === "dong" && " 상승 모멘텀은 시군구 단위 추세를 동에 적용한 값."}
      </p>

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="rounded-full bg-coral-600 px-5 py-3 text-sm font-medium text-white shadow-lg">{toast}</div>
        </div>
      )}
    </main>
  );
}
