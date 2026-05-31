"use client";

import { useState } from "react";
import Link from "next/link";
import {
  QUESTIONS,
  classify,
  personaLabel,
  type Answer,
  type PersonaResult,
  type PersonaType,
} from "@/lib/game/persona";
import { SITE_URL } from "@/lib/site";
import { BijiFallbackImage } from "@/components/BijiFallbackImage";

// 부동산 성향 비지 테스트 — 직교 2축 → 4유형. No-PII(결과만 localStorage), 번들 로직(DB0).

const STORE_KEY = "biji-persona";

/** 유형 비지 — public/biji/persona/<id>.png 있으면 이미지, 없으면 emoji 폴백. */
function PersonaBiji({ type }: { type: PersonaType }) {
  return (
    <BijiFallbackImage
      src={`${type.image}?v=1`}
      emoji={type.emoji}
      alt={`성향 비지: ${type.label}`}
      className="h-24 w-24 object-contain"
      emojiClassName="text-[52px]"
    />
  );
}

export function PersonaExperience() {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [result, setResult] = useState<PersonaResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const step = answers.length; // 0..10
  const q = QUESTIONS[step];

  const pick = (a: Answer) => {
    const next = [...answers, a];
    setAnswers(next);
    if (next.length === QUESTIONS.length) {
      const r = classify(next);
      setResult(r);
      try { localStorage.setItem(STORE_KEY, r.type.id); } catch { /* 무시 */ }
    }
  };

  const restart = () => { setAnswers([]); setResult(null); };

  const share = async () => {
    if (!result) return;
    const label = personaLabel(result);
    const url = `${SITE_URL}/persona`;
    const text = `나 ${result.type.emoji} '${label}' 비지래 ㅋㅋ — 너는 무슨 부동산 성향 비지? 👀`;
    try {
      if (navigator.share) await navigator.share({ title: "내 부동산 성향 비지", text, url });
      else { await navigator.clipboard.writeText(`${text}\n${url}`); setToast("링크 복사됨 — 카톡에 붙여넣기"); setTimeout(() => setToast(null), 2500); }
    } catch { /* 취소 무시 */ }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 py-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold text-coral-600 hover:text-coral-800">← 비집고</Link>
        <span className="text-[12px]" style={{ color: "#9a8f82" }}>내 부동산 성향 비지</span>
      </div>

      {!result ? (
        <>
          {/* 인트로 */}
          <div className="rounded-3xl px-5 py-4 text-center" style={{ background: "linear-gradient(160deg,#fff4ef,#f7ead0)" }}>
            <p className="font-jua text-[22px]" style={{ color: "#e8662f" }}>내 부동산 성향 비지</p>
            <p className="mt-1 text-[13px]" style={{ color: "#6e5b46" }}>10문항이면 끝 · 너는 어떤 유형?</p>
          </div>

          {/* 진행률 */}
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold" style={{ color: "#b08948" }}>{step + 1} / {QUESTIONS.length}</span>
            <span className="flex gap-1">
              {QUESTIONS.map((_, i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i < step ? "#e8662f" : "#e6dcc9" }} />
              ))}
            </span>
          </div>

          {/* 문항 카드 */}
          <div className="rounded-3xl border border-[#ecd9b3] bg-[#fffdf8] p-5 shadow-sm">
            <p className="min-h-[3rem] text-[18px] font-extrabold leading-snug" style={{ color: "#3a2c1d" }}>
              {q.q}
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              <button onClick={() => pick("a")} className="rounded-2xl bg-coral-600 px-4 py-4 text-[15px] font-bold text-white transition-transform hover:scale-[1.02]">
                {q.a.label}
              </button>
              <button onClick={() => pick("b")} className="rounded-2xl border border-[#d9c5a4] bg-white px-4 py-4 text-[15px] font-bold text-[#6e5b46] transition-colors hover:bg-[#f3ece4]">
                {q.b.label}
              </button>
            </div>
          </div>
          <p className="text-center text-[11px]" style={{ color: "#b3a99c" }}>정답 없음 · 끌리는 쪽으로</p>
        </>
      ) : (
        <>
          {/* 결과 카드 */}
          <div className="rounded-3xl p-6 text-center shadow-sm" style={{ background: "linear-gradient(160deg,#fff4ef,#f7ead0)" }}>
            <p className="text-[12px] font-semibold" style={{ color: "#b08948" }}>{result.type.tagline}</p>
            <div className="mx-auto my-3 flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-sm">
              <PersonaBiji type={result.type} />
            </div>
            <p className="font-jua text-[26px] leading-tight" style={{ color: "#e8662f" }}>
              {result.type.emoji} {personaLabel(result)}
            </p>
            <p className="mt-1 text-[14px]" style={{ color: "#6e5b46" }}>{result.type.blurb}</p>
            <p className="mt-3 rounded-xl px-3 py-2 text-left text-[12.5px] leading-snug" style={{ background: "#f7ead0", color: "#7a6a52" }}>
              💡 {result.type.fact}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button onClick={share} className="rounded-2xl bg-amber-300 py-3 text-[15px] font-bold text-coral-900">📤 내 유형 자랑 / 친구도 시켜보기</button>
              <Link href="/" className="rounded-2xl bg-coral-600 py-3 text-center text-[15px] font-bold text-white">이 성향에 맞는 단지 찾아보기 →</Link>
              <button onClick={restart} className="rounded-2xl border border-[#d9c5a4] bg-white py-2.5 text-[13px] font-semibold text-[#6e5b46]">다시 하기</button>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: "#b3a99c" }}>
            재미용 성향 테스트 · 투자권유 아님 · 결과는 입력한 답으로만 계산(저장·전송 없음).
          </p>
        </>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="rounded-full bg-coral-600 px-5 py-3 text-sm font-medium text-white shadow-lg">{toast}</div>
        </div>
      )}
    </main>
  );
}
