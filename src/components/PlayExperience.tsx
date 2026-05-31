"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  playableCells,
  scoreRound,
  regimeRound,
  liveRound,
  topPerformer,
  setGrade,
  SET_SIZE,
  REGIMES,
  type Pick,
  type Round,
  type RoundResult,
  type Regime,
  type Grade,
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
  /** 한 세트 최고 적중(자랑용 기록). */
  bestCorrect: number;
  /** 완료한 세트 수. */
  setsDone: number;
}
const FRESH: PlayState = { score: 0, streak: 0, bestStreak: 0, played: 0, correct: 0, pending: [], seed: 1, bestCorrect: 0, setsDone: 0 };

const dan = (correct: number) => Math.min(9, 1 + Math.floor(correct / 5));

/** 등급 비지 — public/biji/chok/<id>.png 있으면 이미지, 없으면 emoji 폴백. */
function GradeBiji({ grade }: { grade: Grade }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="text-[44px]" aria-hidden>{grade.emoji}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${grade.image}?v=1`}
      alt={`촉 등급: ${grade.label}`}
      className="h-20 w-20 object-contain"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

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
  // 세트(7문제) 진행 상태 — 한 판을 끊어서 결과·공유.
  const [setSeed, setSetSeed] = useState(1); // 이번 세트 시드 베이스
  const [qIdx, setQIdx] = useState(0); // 0..SET_SIZE-1
  const [setCorrect, setSetCorrect] = useState(0);
  const [setDone, setSetDone] = useState(false);
  const cells = useRef(playableCells());
  const setCorrectRef = useRef(0); // 세트 적중 즉시값(마지막 문제 stale 방지)

  const cellMeta = (key: string) => {
    const c = cells.current.find((x) => x.key === key);
    return { sigungu: c?.sigungu ?? key.split("|")[0], tier: key.split("|")[1] };
  };
  const showQuestion = (reg: Regime, base: number, idx: number) => {
    const r = regimeRound(reg, base + idx);
    setRound({ ...r, ...cellMeta(r.cellKey) });
    setResult(null);
  };
  // 새 세트 시작 — 문제 인덱스·적중 초기화 후 1번 문제 출제.
  const startSet = (reg: Regime, base: number) => {
    setSetSeed(base);
    setQIdx(0);
    setSetCorrect(0);
    setCorrectRef.current = 0;
    setSetDone(false);
    showQuestion(reg, base, 0);
  };
  const chooseRegime = (reg: Regime) => {
    setRegime(reg);
    startSet(reg, setSeed); // 국면 바꾸면 그 국면으로 새 세트
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
    startSet(REGIMES[0], merged.seed);
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

  // 복기 예측 → 즉시 채점(세트 내 한 문제).
  const guess = (pick: Pick) => {
    if (!round || result) return;
    const r = scoreRound({ ...round, pick });
    if (!r.resolvable) { showQuestion(regime, setSeed + 997, qIdx); return; } // 무효면 같은 슬롯 재출제
    setResult(r);
    const correct = !!r.correct;
    if (correct) setCorrectRef.current += 1;
    setSetCorrect(setCorrectRef.current);
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
  // 다음 문제 또는 세트 종료(결과 화면).
  const next = () => {
    if (qIdx + 1 < SET_SIZE) {
      const ni = qIdx + 1;
      setQIdx(ni);
      showQuestion(regime, setSeed, ni);
    } else {
      setSetDone(true);
      persist({ ...st, bestCorrect: Math.max(st.bestCorrect, setCorrectRef.current), setsDone: st.setsDone + 1 });
    }
  };
  const retry = () => startSet(regime, setSeed + SET_SIZE + 3);

  // 라이브 예측 — 미래 1개월, 대기열에 저장(다음 갱신 때 발표).
  const predictLive = (pick: Pick) => {
    const lr = liveRound(st.seed + 100);
    const meta = cellMeta(lr.cellKey);
    persist({ ...st, pending: [...st.pending, { ...lr, pick, ...meta }], seed: st.seed + 1 });
    setToast(`🔮 ${meta.sigungu} ${TIER_LABEL[meta.tier]} ${pick} 예측 등록 — 다음 달 발표`);
    setTimeout(() => setToast(null), 2500);
  };

  const share = async () => {
    const url = `${SITE_URL}/play`;
    const g = setGrade(setCorrect);
    const text = setDone
      ? `부동산 촉 테스트 ${SET_SIZE}문제 중 ${setCorrect}개 적중 — ${g.emoji} ${g.label}! 너도 동네가 시장 이길지 맞혀봐 👀`
      : `내 부동산 촉 ${dan(st.correct)}단 (최고 ${st.bestCorrect}/${SET_SIZE}) — 너도 해봐 👀`;
    try {
      if (navigator.share) await navigator.share({ title: "부동산 촉 테스트", text, url });
      else { await navigator.clipboard.writeText(`${text}\n${url}`); setToast("링크 복사됨 — 카톡에 붙여넣기"); setTimeout(() => setToast(null), 2500); }
    } catch { /* 취소 무시 */ }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 py-8">
      {/* 헤더 — 뒤로 + 최고/누적 기록 */}
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold text-coral-600 hover:text-coral-800">← 비집고</Link>
        <span className="text-[12px]" style={{ color: "#9a8f82" }}>최고 {st.bestCorrect}/{SET_SIZE} · 누적 촉 {dan(st.correct)}단</span>
      </div>

      {resolvedMsg && (
        <div className="rounded-2xl bg-emerald-50 px-4 py-2.5 text-[13px] font-semibold text-emerald-700">{resolvedMsg}</div>
      )}

      {/* ── 진행 중: 국면 선택 + 라운드 카드 ── */}
      {!setDone && (
        <>
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

          {round && (
            <div className="rounded-3xl border border-[#ecd9b3] bg-[#fffdf8] p-5 shadow-sm">
              {/* 세트 진행률 */}
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-bold" style={{ color: "#b08948" }}>문제 {qIdx + 1} / {SET_SIZE}</span>
                <span className="flex gap-1">
                  {Array.from({ length: SET_SIZE }).map((_, i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i < qIdx || (i === qIdx && result) ? "#e8662f" : "#e6dcc9" }} />
                  ))}
                </span>
              </div>
              <p className="text-[12px]" style={{ color: "#9a8f82" }}>{regime.label} · {fmtPeriod(round.fromMonth, round.toMonth)}</p>
              <p className="mt-1 text-[20px] font-extrabold" style={{ color: "#3a2c1d" }}>
                {round.sigungu} 내의 <span className="text-[15px] font-bold" style={{ color: "#b08948" }}>{TIER_LABEL[round.tier]}</span>
              </p>
              <p className="mt-1 text-[14px] leading-snug" style={{ color: "#6e5b46" }}>
                이 동네 이 가격대가 <b>같은 가격대 평균(시장)</b>보다 더 올랐을까?
              </p>

              {!result ? (
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <button onClick={() => guess("UP")} className="rounded-2xl bg-coral-600 py-3.5 text-[15px] font-bold text-white transition-transform hover:scale-[1.02]">📈 이겼다 (UP)</button>
                  <button onClick={() => guess("DOWN")} className="rounded-2xl border border-[#d9c5a4] bg-white py-3.5 text-[15px] font-bold text-[#6e5b46] transition-colors hover:bg-[#f3ece4]">📉 못 이겼다 (DOWN)</button>
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-2">
                  <p className="text-[16px] font-extrabold" style={{ color: result.correct ? "#2f8a4e" : "#c2731a" }}>
                    {result.correct ? "✅ 적중! 촉 좋다" : "❌ 빗나감"}
                  </p>
                  <p className="text-[13px]" style={{ color: "#6e5b46" }}>
                    {round.sigungu} <b>{pct(result.cellPct)}</b> vs 시장 {pct(result.peerPct)} → {result.outperform ? "아웃퍼폼" : "언더퍼폼"}
                    {result.cellPct != null && result.peerPct != null && (
                      <span style={{ color: "#9a8f82" }}> (격차 {pct(Math.abs(result.cellPct - result.peerPct))})</span>
                    )}
                  </p>
                  {/* 납득 — 그때 가장 많이 오른 곳 */}
                  {(() => {
                    const top = topPerformer(round.tier, round.fromMonth, round.toMonth);
                    if (!top) return null;
                    return (
                      <p className="rounded-xl px-3 py-2 text-[12.5px] leading-snug" style={{ background: "#f7ead0", color: "#7a6a52" }}>
                        📈 그때 이 가격대에서 가장 많이 오른 곳: <b>{top.sigungu} {TIER_LABEL[round.tier]}</b> <b style={{ color: "#c2731a" }}>{pct(top.pct)}</b>
                        {!result.outperform && <> — 여기({round.sigungu})는 시장만큼 못 따라가 언더퍼폼이었어.</>}
                      </p>
                    );
                  })()}
                  <button onClick={next} className="mt-1 rounded-2xl bg-[#3a2c1d] py-3 text-[15px] font-bold text-white">
                    {qIdx + 1 < SET_SIZE ? "다음 →" : "결과 보기 →"}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── 완료: 등급 결과 화면(공유·자랑) ── */}
      {setDone && (() => {
        const g = setGrade(setCorrect);
        const best = Math.max(st.bestCorrect, setCorrect);
        return (
          <div className="rounded-3xl p-6 text-center shadow-sm" style={{ background: "linear-gradient(160deg,#fff4ef,#f7ead0)" }}>
            <p className="text-[13px] font-semibold" style={{ color: "#b08948" }}>{regime.label} · {SET_SIZE}문제 결과</p>
            <div className="mx-auto my-3 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-sm">
              <GradeBiji grade={g} />
            </div>
            <p className="font-jua text-[30px] leading-tight" style={{ color: "#e8662f" }}>{g.label}</p>
            <p className="text-[13.5px]" style={{ color: "#6e5b46" }}>{g.blurb}</p>
            <p className="mt-2 text-[19px] font-extrabold" style={{ color: "#3a2c1d" }}>{SET_SIZE}개 중 <span style={{ color: "#e8662f" }}>{setCorrect}개</span> 적중</p>
            <p className="text-[11.5px]" style={{ color: "#9a8f82" }}>최고 기록 {best}/{SET_SIZE} · 누적 촉 {dan(st.correct)}단</p>
            <div className="mt-4 flex flex-col gap-2">
              <button onClick={share} className="rounded-2xl bg-amber-300 py-3 text-[15px] font-bold text-coral-900">📤 결과 자랑 / 친구 도발</button>
              <button onClick={retry} className="rounded-2xl bg-coral-600 py-3 text-[15px] font-bold text-white">다시 도전 →</button>
            </div>
          </div>
        );
      })()}

      {/* 라이브 예측 — 미래(진짜 촉) */}
      <div className="rounded-3xl border border-dashed border-[#d9c5a4] bg-white p-4">
        <p className="text-[13px] font-bold" style={{ color: "#3a2c1d" }}>🔮 라이브 예측 (진짜 촉)</p>
        <p className="mt-0.5 text-[12px]" style={{ color: "#9a8f82" }}>
          무작위 동네의 <b>다음 달</b>을 예측 → 갱신 때 발표. 대기 {st.pending.length}건.
        </p>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button onClick={() => predictLive("UP")} className="rounded-xl bg-coral-50 py-2 text-[13px] font-semibold text-coral-700">랜덤 동네 UP 예측</button>
          <button onClick={() => predictLive("DOWN")} className="rounded-xl bg-[#f3ece4] py-2 text-[13px] font-semibold text-[#6e5b46]">DOWN 예측</button>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed" style={{ color: "#b3a99c" }}>
        시세 감각 테스트 · 미래가치 예측·투자권유 아님 · 국토부 공개 실거래 기반 (시군구×가격대) 지수.
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
