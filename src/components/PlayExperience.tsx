"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  playableCells,
  scoreRound,
  regimeRound,
  liveRound,
  REGIMES,
  type Pick,
  type Round,
  type RoundResult,
  type Regime,
} from "@/lib/game/predict";
import { trendLatestMonth } from "@/lib/recommend/trendIndex";
import { SITE_URL } from "@/lib/site";

// 부동산 촉 게임 — "이 동네(가격대), 같은 가격대 평균(시장) 이길까?" UP/DOWN.
// 복기(과거 즉시채점)로 재미 즉검증 + 라이브(미래 예측, 다음 갱신 때 발표). 줄세우기=촉(실력)뿐.
// No-PII: 점수·연승·대기예측 전부 localStorage. 컴플라이언스: 시세 감각 게임·예측/자문 아님.

const TIER_LABEL: Record<string, string> = {
  low: "10억 미만",
  mid1: "10억대",
  mid2: "20억대",
  high: "30억 이상",
};
const STORE_KEY = "biji-play";

const fmtPeriod = (from: string, to: string): string => {
  const [fy, fm] = from.split("-");
  const [ty, tm] = to.split("-");
  return fy === ty
    ? `${fy}년 ${Number(fm)}→${Number(tm)}월`
    : `${fy}.${Number(fm)} → ${ty}.${Number(tm)}`;
};
const pct = (v?: number) => (v == null ? "-" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);

interface PendingLive extends Round {
  pick: Pick;
  sigungu: string;
  tier: string;
}
interface PlayState {
  score: number;
  streak: number;
  bestStreak: number;
  played: number;
  correct: number;
  pending: PendingLive[];
  seed: number;
}
const FRESH: PlayState = { score: 0, streak: 0, bestStreak: 0, played: 0, correct: 0, pending: [], seed: 1 };

const dan = (correct: number) => Math.min(9, 1 + Math.floor(correct / 5));

function load(): PlayState {
  if (typeof window === "undefined") return FRESH;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? { ...FRESH, ...JSON.parse(raw) } : FRESH;
  } catch {
    return FRESH;
  }
}

export function PlayExperience() {
  const [st, setSt] = useState<PlayState>(FRESH);
  const [regime, setRegime] = useState<Regime>(REGIMES[0]);
  const [round, setRound] = useState<Round & { sigungu: string; tier: string }>();
  const [result, setResult] = useState<RoundResult | null>(null);
  const [resolvedMsg, setResolvedMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const cells = useRef(playableCells());

  const cellMeta = (key: string) => {
    const c = cells.current.find((x) => x.key === key);
    return { sigungu: c?.sigungu ?? key.split("|")[0], tier: key.split("|")[1] };
  };
  const newRound = (reg: Regime, seed: number) => {
    const r = regimeRound(reg, seed);
    setRound({ ...r, ...cellMeta(r.cellKey) });
    setResult(null);
  };
  const chooseRegime = (reg: Regime) => {
    setRegime(reg);
    newRound(reg, st.seed);
  };

  // 마운트: 저장 복원 + 대기 라이브 예측 채점(다음 갱신 도래분) + 첫 복기 출제.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- localStorage 복원·라운드 출제(마운트 1회, 하이드레이션 안전) */
  useEffect(() => {
    const s = load();
    const latest = trendLatestMonth();
    const stillPending: PendingLive[] = [];
    let resolved = 0;
    let dScore = 0, dCorrect = 0, dStreak = s.streak, dBest = s.bestStreak, dPlayed = 0;
    for (const p of s.pending) {
      if (p.toMonth <= latest) {
        const r = scoreRound(p);
        if (r.resolvable) {
          resolved++;
          dPlayed++;
          if (r.correct) { dScore++; dCorrect++; dStreak++; dBest = Math.max(dBest, dStreak); }
          else dStreak = 0;
        }
      } else stillPending.push(p);
    }
    const merged: PlayState = {
      ...s,
      pending: stillPending,
      score: s.score + dScore,
      correct: s.correct + dCorrect,
      played: s.played + dPlayed,
      streak: dStreak,
      bestStreak: dBest,
    };
    setSt(merged);
    if (resolved > 0) setResolvedMsg(`📣 지난 예측 ${resolved}건 발표 — 적중 ${dCorrect}`);
    newRound(REGIMES[0], merged.seed);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const persist = (next: PlayState) => {
    setSt(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* 시크릿 모드 등 — 조용히 무시 */
    }
  };

  // 복기 베팅 → 즉시 채점.
  const guess = (pick: Pick) => {
    if (!round || result) return;
    const r = scoreRound({ ...round, pick });
    if (!r.resolvable) { newRound(regime, st.seed + 1); return; } // 무효면 새 라운드
    setResult(r);
    const correct = !!r.correct;
    const streak = correct ? st.streak + 1 : 0;
    persist({
      ...st,
      score: st.score + (correct ? 1 : 0),
      correct: st.correct + (correct ? 1 : 0),
      played: st.played + 1,
      streak,
      bestStreak: Math.max(st.bestStreak, streak),
      seed: st.seed + 1,
    });
  };
  const next = () => newRound(regime, st.seed);

  // 라이브 예측 — 미래 1개월, 대기열에 저장(다음 갱신 때 발표).
  const betLive = (pick: Pick) => {
    const lr = liveRound(st.seed + 100);
    const meta = cellMeta(lr.cellKey);
    persist({ ...st, pending: [...st.pending, { ...lr, pick, ...meta }], seed: st.seed + 1 });
    setToast(`🔮 ${meta.sigungu} ${TIER_LABEL[meta.tier]} ${pick} 예측 등록 — 다음 달 발표`);
    setTimeout(() => setToast(null), 2500);
  };

  const share = async () => {
    const url = `${SITE_URL}/play`;
    const text = `내 부동산 촉 ${dan(st.correct)}단 (적중 ${st.correct}/${st.played}) — 너도 동네가 시장 이길지 맞혀봐 👀`;
    try {
      if (navigator.share) await navigator.share({ title: "부동산 촉 게임", text, url });
      else { await navigator.clipboard.writeText(`${text}\n${url}`); setToast("링크 복사됨 — 카톡에 붙여넣기"); setTimeout(() => setToast(null), 2500); }
    } catch { /* 취소 무시 */ }
  };

  const acc = st.played > 0 ? Math.round((st.correct / st.played) * 100) : 0;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 py-8">
      {/* 헤더 — 촉 등급·점수·연승 */}
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold text-coral-600 hover:text-coral-800">← 비집고</Link>
        <span className="text-[12px]" style={{ color: "#9a8f82" }}>적중 {st.correct}/{st.played} ({acc}%)</span>
      </div>
      <div className="rounded-3xl px-5 py-4 text-center" style={{ background: "linear-gradient(160deg,#fff4ef,#f7ead0)" }}>
        <p className="text-[13px] font-semibold" style={{ color: "#b08948" }}>부동산 촉</p>
        <p className="font-jua text-[28px]" style={{ color: "#e8662f" }}>{dan(st.correct)}단</p>
        <p className="text-[13px]" style={{ color: "#6e5b46" }}>🔥 연승 {st.streak} · 최고 {st.bestStreak}</p>
      </div>

      {resolvedMsg && (
        <div className="rounded-2xl bg-emerald-50 px-4 py-2.5 text-[13px] font-semibold text-emerald-700">{resolvedMsg}</div>
      )}

      {/* 국면 선택 — 의미있는 시장 시기 3종 */}
      <div className="flex gap-1.5">
        {REGIMES.map((r) => (
          <button
            key={r.id}
            onClick={() => chooseRegime(r)}
            className={`flex-1 rounded-2xl px-2 py-2 text-[11.5px] font-bold leading-tight transition-colors ${
              regime.id === r.id ? "bg-coral-600 text-white" : "bg-[#f3ece4] text-[#6e5b46] hover:bg-[#ecd9b3]"
            }`}
          >
            {r.label}
            <br />
            <span className="text-[10px] font-medium opacity-80">{r.short}</span>
          </button>
        ))}
      </div>
      <p className="-mt-2 text-[11.5px] leading-snug" style={{ color: "#9a8f82" }}>📍 {regime.desc}</p>

      {/* 라운드 카드 */}
      {round && (
        <div className="rounded-3xl border border-[#ecd9b3] bg-[#fffdf8] p-5 shadow-sm">
          <p className="text-[12px]" style={{ color: "#9a8f82" }}>{regime.label} · {fmtPeriod(round.fromMonth, round.toMonth)}</p>
          <p className="mt-1 text-[20px] font-extrabold" style={{ color: "#3a2c1d" }}>
            {round.sigungu} 내의 <span className="text-[15px] font-bold" style={{ color: "#b08948" }}>{TIER_LABEL[round.tier]}</span>
          </p>
          <p className="mt-1 text-[14px] leading-snug" style={{ color: "#6e5b46" }}>
            이 동네 이 가격대가 <b>같은 가격대 평균(시장)</b>보다 더 올랐을까?
          </p>

          {!result ? (
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button onClick={() => guess("UP")} className="rounded-2xl bg-coral-600 py-3.5 text-[15px] font-bold text-white transition-transform hover:scale-[1.02]">📈 이긴다 (UP)</button>
              <button onClick={() => guess("DOWN")} className="rounded-2xl border border-[#d9c5a4] bg-white py-3.5 text-[15px] font-bold text-[#6e5b46] transition-colors hover:bg-[#f3ece4]">📉 못 이긴다 (DOWN)</button>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-[16px] font-extrabold" style={{ color: result.correct ? "#2f8a4e" : "#c2731a" }}>
                {result.correct ? "✅ 적중! 촉 좋다" : "❌ 빗나감"}
              </p>
              <p className="text-[13px]" style={{ color: "#6e5b46" }}>
                {round.sigungu} <b>{pct(result.cellPct)}</b> vs 시장 {pct(result.peerPct)} → {result.outperform ? "아웃퍼폼" : "언더퍼폼"}
              </p>
              <button onClick={next} className="mt-1 rounded-2xl bg-[#3a2c1d] py-3 text-[15px] font-bold text-white">다음 →</button>
            </div>
          )}
        </div>
      )}

      {/* 라이브 예측 — 미래(진짜 촉) */}
      <div className="rounded-3xl border border-dashed border-[#d9c5a4] bg-white p-4">
        <p className="text-[13px] font-bold" style={{ color: "#3a2c1d" }}>🔮 라이브 예측 (진짜 촉)</p>
        <p className="mt-0.5 text-[12px]" style={{ color: "#9a8f82" }}>
          무작위 동네의 <b>다음 달</b>을 예측 → 갱신 때 발표. 대기 {st.pending.length}건.
        </p>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button onClick={() => betLive("UP")} className="rounded-xl bg-coral-50 py-2 text-[13px] font-semibold text-coral-700">랜덤 동네 UP에 걸기</button>
          <button onClick={() => betLive("DOWN")} className="rounded-xl bg-[#f3ece4] py-2 text-[13px] font-semibold text-[#6e5b46]">DOWN에 걸기</button>
        </div>
      </div>

      <button onClick={share} className="rounded-2xl bg-amber-300 py-3 text-[15px] font-bold text-coral-900">📤 내 촉 자랑 / 친구 도발</button>

      <p className="text-[11px] leading-relaxed" style={{ color: "#b3a99c" }}>
        시세 감각 게임 · 미래가치 예측·투자권유 아님 · 국토부 공개 실거래 기반 (시군구×가격대) 지수.
        실제 돈 거래 없음.
      </p>

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="rounded-full bg-coral-600 px-5 py-3 text-sm font-medium text-white shadow-lg">{toast}</div>
        </div>
      )}
    </main>
  );
}
